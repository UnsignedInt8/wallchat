import Telegraph, { ContextMessageUpdate, Telegram } from 'telegraf';
import SocksAgent from 'socks5-https-client/lib/Agent';
import { Wechaty, Message, Contact, Room, FileBox, Friendship, RoomInvitation } from "wechaty";
import qr from 'qr-image';
import lang from './strings';
import { ContactType, MessageType } from 'wechaty-puppet';
import * as TT from 'telegraf/typings/telegram-types';
import takeScreenshot from './lib/TakeScreenshot';
import { createHash } from 'crypto';
import MiscHelper from './lib/MiscHelper';
import axios from 'axios';
import got from 'got';
import download from 'download';
import fs from 'fs';
import path from 'path';
import tempfile from 'tempfile';
import HTMLTemplates from './lib/HTMLTemplates';
import Logger from './lib/Logger';
import * as XMLParser from './lib/XmlParser';
import { AllHtmlEntities } from 'html-entities';

const html = new AllHtmlEntities();

interface MessageUI {
    url: string;
    avatarDir: string;
}

export interface BotOptions {
    token: string;
    socks5Proxy?: { host: string, port: number, username?: string, password?: string, };
    msgui?: MessageUI;
    keepMsgs?: number;
}

interface Client {
    wechat: Wechaty;
    receiveGroups?: boolean;
    receiveOfficialAccount?: boolean;
    receiveSelf?: boolean;
    imageOnly?: boolean;
    msgs: Map<number, Contact | Room>;
    currentContact?: Room | Contact;
    contactLocked?: boolean;
    wechatId?: string;
}

export default class Bot {

    protected bot: Telegraph<ContextMessageUpdate>;
    protected clients: Map<number, Client> = new Map();
    protected msgui: MessageUI;
    protected keeyMsgs: number;
    private token: string;
    protected beforeCheckUserList: ((ctx?: ContextMessageUpdate) => Promise<boolean>)[] = [];
    protected pendingFriends = new Map<string, Friendship>();
    protected lastRoomInvitation: RoomInvitation = null;

    constructor({ token, socks5Proxy, msgui, keepMsgs }: BotOptions) {

        this.token = token;
        this.msgui = msgui;
        this.keeyMsgs = keepMsgs === undefined ? 200 : (Math.max(keepMsgs, 100) || 200);

        let agent = socks5Proxy ? new SocksAgent({
            socksHost: socks5Proxy.host,
            socksPort: socks5Proxy.port,
            socksUsername: socks5Proxy.username,
            socksPassword: socks5Proxy.password,
        }) : undefined;

        this.bot = new Telegraph(token, {
            telegram: { agent }
        });

        this.bot.start(this.handleStart);
        this.bot.command('stop', (ctx, n) => this.checkUser(ctx, n), this.handleLogout);
        this.bot.command('login', (ctx) => this.handleLogin(ctx));
        this.bot.command('groupon', (ctx, n) => this.checkUser(ctx, n), (ctx, n) => { ctx['user'].receiveGroups = true; n(); }, ctx => ctx.reply('OK'));
        this.bot.command('groupoff', (ctx, n) => this.checkUser(ctx, n), (ctx, n) => { ctx['user'].receiveGroups = false; n(); }, ctx => ctx.reply('OK'));
        this.bot.command('officialon', (ctx, n) => this.checkUser(ctx, n), (ctx, n) => { ctx['user'].receiveOfficialAccount = true, n() }, ctx => ctx.reply('OK'));
        this.bot.command('officialoff', (ctx, n) => this.checkUser(ctx, n), (ctx, n) => { ctx['user'].receiveOfficialAccount = false, n() }, ctx => ctx.reply('OK'));
        this.bot.command('selfon', (ctx, n) => this.checkUser(ctx, n), (ctx, n) => { ctx['user'].receiveSelf = true; n() }, ctx => ctx.reply('OK'));
        this.bot.command('selfoff', (ctx, n) => this.checkUser(ctx, n), (ctx, n) => { ctx['user'].receiveSelf = false; n() }, ctx => ctx.reply('OK'));
        this.bot.command('texton', (ctx, n) => this.checkUser(ctx, n), (ctx, n) => { ctx['user'].imageOnly = false; n(); }, ctx => ctx.reply('OK'));
        this.bot.command('textoff', (ctx, n) => this.checkUser(ctx, n), (ctx, n) => { ctx['user'].imageOnly = true; n() }, ctx => ctx.reply('OK'));
        this.bot.command('find', (ctx, n) => this.checkUser(ctx, n), this.handleFind);
        this.bot.command('lock', (ctx, n) => this.checkUser(ctx, n), this.handleLock);
        this.bot.command('unlock', (ctx, n) => this.checkUser(ctx, n), this.handleUnlock);
        this.bot.command('findandlock', (ctx, n) => this.checkUser(ctx, n), this.handleFind, this.handleLock);
        this.bot.command('current', (ctx, n) => this.checkUser(ctx, n), this.handleCurrent);
        this.bot.command('agree', (ctx, n) => this.checkUser(ctx, n), this.handleAgreeFriendship);
        this.bot.command('disagree', (ctx, n) => this.checkUser(ctx, n), this.handleDisagreeFriendship);
        this.bot.command('acceptroom', (ctx, n) => this.checkUser(ctx, n));
        this.bot.command('logout', (ctx, n) => this.checkUser(ctx, n), this.handleLogout);
        this.bot.help(ctx => ctx.reply(lang.help));

        this.bot.catch((err) => {
            Logger.error('Ooops', err.message);
        });
    }

    launch() {
        this.bot.on('message', (ctx, n) => this.checkUser(ctx, n), this.handleTelegramMessage);
        this.bot.launch().then(() => Logger.info(`Bot is running`));
    }

    async exit() {
        for (let [_, client] of this.clients) {
            await client.wechat.logout();
            await client.wechat.stop();
        }
    }

    protected handleStart = async (ctx: ContextMessageUpdate) => {
        await ctx.reply(lang.welcome).catch();
        ctx.reply(lang.help);
    }

    protected async handleLogin(ctx: ContextMessageUpdate) {
        for (let c of this.beforeCheckUserList) {
            if (!await c(ctx)) return;
        }

        let id = ctx.chat.id;
        let qrcodeCache = '';
        if (this.clients.has(id)) {
            let user = this.clients.get(id);
            if (user.wechatId) {
                ctx.reply(lang.login.logined(user.wechat.userSelf().name()))
                return;
            }

            ctx.reply(lang.login.retry);
            return;
        };

        ctx.reply(lang.login.request);

        let wechat = new Wechaty();
        let client: Client = { wechat, msgs: new Map(), receiveGroups: true, receiveOfficialAccount: true };
        this.clients.set(ctx.chat.id, client);
        let loginTimer: NodeJS.Timeout;
        let deleteWechat = async () => {
            Logger.info('login timeout');
            this.clients.delete(id);
            wechat.removeAllListeners();
            await wechat.stop().catch();
        }

        const handleQrcode = async (qrcode: string) => {
            if (qrcode === qrcodeCache) return;
            qrcodeCache = qrcode;

            if (client.wechatId) return;

            if (!loginTimer) {
                loginTimer = setTimeout(() => { deleteWechat(); ctx.reply(lang.message.timeout); }, 3 * 60 * 1000);
            }

            await ctx.replyWithPhoto({ source: qr.image(qrcode) }).catch(() => deleteWechat());
        };

        wechat.on('scan', handleQrcode);

        wechat.once('login', user => {
            this.clients.get(id).wechatId = user.id;
            ctx.reply(lang.login.logined(user.name()));
            clearTimeout(loginTimer);
            wechat.removeListener('scan', handleQrcode);
        });

        wechat.on('friendship', async req => {
            let hello = req.hello();
            let contact = req.contact();
            let name = contact.name();

            let avatar = await (await contact.avatar()).toStream();
            await ctx.replyWithPhoto({ source: avatar }, { caption: `${name}: ${hello}, /agree ${name} | /disagree ${name}` });

            this.pendingFriends.set(name.toLowerCase(), req);
        });

        wechat.on('room-invite', async (invitation) => {
            let inviter = (await invitation.inviter()).name();
            let topic = await invitation.roomTopic();

            await ctx.reply(`${lang.message.inviteRoom(inviter, topic)} /acceptroom`);
        });

        wechat.on('logout', async user => {
            await deleteWechat();
            await ctx.reply(lang.login.logouted(user.name()));
        });

        wechat.on('error', async (error) => {
            Logger.warn(error.message);
            ctx.reply(lang.message.error);
            await deleteWechat();
        });


        // wechat.puppet.on('error', async () => {
        //     ctx.reply(lang.message.error);
        //     await deleteWechat();
        // });

        wechat.on('message', msg => this.handleWechatMessage(msg, ctx));

        await wechat.start();
    }

    protected async checkUser(ctx: ContextMessageUpdate, next: Function) {
        for (let c of this.beforeCheckUserList) {
            if (!await c(ctx)) return;
        }

        if (!ctx) return next ? next() : undefined;

        let id = ctx.chat.id;
        let user = this.clients.get(id);
        if (!user) return;

        ctx['user'] = user;
        next(ctx);
    }

    protected handleLogout = async (ctx: ContextMessageUpdate) => {
        let user = ctx['user'] as Client;
        if (!user) return;

        try {
            this.clients.delete(ctx.chat.id);
            user.wechat.removeAllListeners();
        } catch (error) { }

        await user.wechat.logout().catch(reason => Logger.error(reason));
        await user.wechat.stop().catch(reason => Logger.error(reason));
        ctx.reply(lang.login.bye);
    }

    protected handleFind = async (ctx: ContextMessageUpdate, next: Function) => {
        let [_, name] = ctx.message.text.split(' ');
        if (!name) {
            ctx.reply(lang.commands.find);
            return;
        }

        name = name.trim();
        let user = ctx['user'] as Client;

        let found: Contact;
        try {
            found = await user.wechat.Contact.find({ name }) || await user.wechat.Contact.find({ alias: name });
        } catch (error) {
            Logger.error(error.message);
            return;
        }

        if (!found) {
            ctx.reply(lang.message.contactNotFound)
            return;
        }

        let info = (user.contactLocked ? ` [${lang.message.contactLocked('').trim()}]` : '');
        await ctx.reply(lang.message.contactFound(`${name}`) + info).catch();
        user.currentContact = found;

        if (next) next();
    }

    protected handleLock = async (ctx: ContextMessageUpdate) => {
        let user = ctx['user'] as Client;
        if (!user.currentContact) return;
        if (user.contactLocked) return;
        user.contactLocked = true;
        ctx.reply(lang.message.contactLocked((user.currentContact as Contact).name()));
    }

    protected handleUnlock = async (ctx: ContextMessageUpdate) => {
        let user = ctx['user'] as Client;
        if (!user.currentContact) return;
        if (!user.contactLocked) return;
        user.contactLocked = false;
        ctx.reply(lang.message.contactUnlocked((user.currentContact as Contact).name()));
    }

    protected handleCurrent = async (ctx: ContextMessageUpdate) => {
        let user = ctx['user'] as Client;
        if (!user.currentContact) {
            ctx.reply(lang.message.noCurrentContact);
            return;
        }

        let name: string;
        try {
            name = (user.currentContact as Contact).name();
        } catch (error) {
            name = await (user.currentContact as Room).topic();
        }

        let info = (user.contactLocked ? ` [${lang.message.contactLocked('').trim()}]` : '');

        ctx.reply(lang.message.current(name) + info);
    }

    protected handleAcceptRoomInvitation = async (ctx: ContextMessageUpdate) => {
        this.lastRoomInvitation?.accept();
        this.lastRoomInvitation = null;
    }

    protected handleAgreeFriendship = async (ctx: ContextMessageUpdate) => {
        let [_, name] = ctx.message.text.split(' ');

        if (this.pendingFriends.size === 1) {
            for (let [key, req] of this.pendingFriends) {
                await req.accept();
                await ctx.reply(`${key} OK`);
            }

            this.pendingFriends.clear();
            return;
        }

        if (!name) {
            await ctx.reply(lang.commands.agree);
            return;
        }

        let req = this.pendingFriends.get(name.toLowerCase());
        await req?.accept();
        this.pendingFriends.delete(name.toLowerCase());

        await ctx.reply('OK');
    }

    protected handleDisagreeFriendship = async (ctx: ContextMessageUpdate) => {
        let [_, name] = ctx.message.text.split(' ');
        if (!name) {
            await ctx.reply(lang.commands.disagree);
            return;
        }

        this.pendingFriends.delete(name.toLowerCase());
        await ctx.reply('OK');
    }

    protected handleTelegramMessage = async (ctx: ContextMessageUpdate) => {
        let msg = ctx.message;
        let user = ctx['user'] as Client;
        if (msg.text && msg.text.startsWith('/find')) return;

        let contact = user.currentContact;
        if (msg.reply_to_message) {
            contact = user.msgs.get(msg.reply_to_message.message_id)
        }

        if (!contact) return;

        let file = msg.audio || (msg.video || (msg.photo && msg.photo[0]));
        if (file && file.file_size <= 50 * 1024 * 1024) {
            // return;
            try {
                let url = `https://api.telegram.org/bot${this.token}/getFile?file_id=${file.file_id}`
                let resp = await axios.get(url);
                if (!resp.data || !resp.data.ok) return;

                let filePath = resp.data.result.file_path;
                url = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
                let ext = path.extname(filePath);
                let distFile = tempfile(ext);
                fs.writeFileSync(distFile, await download(url));

                console.log(distFile);
                // Not available on default puppet
                await contact.say(FileBox.fromFile(distFile));
                // await contact.say(FileBox.fromStream(got.stream(url), file.file_id));
            } catch (error) {
                Logger.error(error.message);
            }
            return;
        }

        if (msg.text) await contact.say(msg.text);
        if (!user.contactLocked) user.currentContact = contact;
    }

    protected async handleWechatMessage(msg: Message, ctx: ContextMessageUpdate) {
        let id = ctx.chat.id;
        let user = this.clients.get(id);

        let from = msg.from();
        let room = msg.room();
        let type = msg.type();
        let text = msg.text().replace(/\<br\/\>/g, ' \n').replace(/<[^>]*>?/gm, '');

        // if (from.type() === ContactType.Official) {
        //     console.log('-------------\n')
        // console.log(html.decode(msg.text()));
        //     console.log(type);
        //     console.log('-------------\n')
        // }

        if (user.wechatId === from.id && !user.receiveSelf) return;
        if (!user.receiveOfficialAccount && from.type() === ContactType.Official) return;
        if (!user.receiveGroups && room) return;

        let alias = await from.alias();
        let nickname = from.name() + (alias ? ` (${alias})` : '');
        let caption = nickname + (room ? ` [${await room.topic()}]` : '');
        let sent: TT.Message;

        switch (type) {
            case MessageType.Text:
                if (!text) break;

                if (user.imageOnly && this.msgui) {
                    let signature = room ? await room.topic() : from['payload'].signature;
                    let city = from.city() || '';
                    let provice = from.province() || '';
                    let avatar = await from.avatar();
                    let avatarName = createHash('md5').update(room ? signature : nickname).digest().toString('hex') + '.jpg';
                    let avatarPath = `${this.msgui.avatarDir}/${avatarName}`;

                    if (!await MiscHelper.fileExists(avatarPath)) {
                        await avatar.toFile(avatarPath).catch(reason => Logger.error(reason));
                    }

                    let data = `n=${nickname}&s=${signature}&m=${text}&p=${provice}&c=${city}&a=${avatarName}`;
                    data = Buffer.from(data, 'utf-8').toString('base64');
                    const url = `${this.msgui.url}/?${data}`;

                    let screen = await takeScreenshot({ url });
                    if (screen.length === 0) break;
                    sent = await this.bot.telegram.sendPhoto(ctx.chat.id, { source: screen });
                } else {
                    nickname = `${nickname}` + (room ? ` [${await room.topic()}]` : '');
                    sent = await ctx.replyWithHTML(HTMLTemplates.message({ nickname, message: text }));
                }

                break;

            case MessageType.Attachment:
                try {
                    let xml = html.decode(msg.text());
                    let markdown = from.type() === ContactType.Official ? XMLParser.parseOffical(xml) : XMLParser.parseAttach(xml);
                    sent = await ctx.replyWithMarkdown(HTMLTemplates.markdown({ nickname, content: markdown }));
                } catch (error) { }

                break;

            case MessageType.Money:
                sent = await ctx.replyWithHTML(HTMLTemplates.message({ nickname, message: lang.message.money }));
                break;

            case MessageType.Audio:
                let audio = await msg.toFileBox();
                let duration = audio.metadata['duration'] as number || (audio.size / 1024 / 3);
                sent = await ctx.replyWithVoice({ source: await audio.toStream(), }, { caption, duration }) as TT.Message;
                break;

            case MessageType.Image:
                let image = await msg.toFileBox();
                // sent = (image.mimeType || '').toLowerCase().includes('gif') ? await ctx.replyWithVideo({ source: await image.toStream() }) : await ctx.replyWithPhoto({ source: await image.toStream() }, { caption });
                sent = await await ctx.replyWithPhoto({ source: await image.toStream() }, { caption });
                break;

            case MessageType.Video:
                let video = await msg.toFileBox();
                sent = await ctx.replyWithVideo({ source: await video.toStream() }, { caption } as any);
                break;

            default:
                break;
        }

        if (!sent) {
            return;
        }

        user.msgs.set(sent.message_id, room || from);
        if (!user.contactLocked) user.currentContact = room || from;

        // The bot just knows recent messages
        if (sent.message_id < this.keeyMsgs) return;
        let countToDelete = sent.message_id - this.keeyMsgs;

        do {
            try {
                if (!await this.bot.telegram.deleteMessage(ctx.chat.id, countToDelete)) break;
            } catch (error) {
                break;
            }

            user.msgs.delete(countToDelete);
            countToDelete--;
        } while (countToDelete > 0);
    }
}
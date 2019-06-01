import Telegraph, { ContextMessageUpdate, Telegram } from 'telegraf';
import SocksAgent from 'socks5-https-client/lib/Agent';
import { Wechaty, Message, Contact, Room, FileBox } from "wechaty";
import qr from 'qr-image';
import lang from './strings';
import { ContactType, MessageType } from 'wechaty-puppet';
import * as TT from 'telegraf/typings/telegram-types';
import takeScreenshot from './lib/TakeScreenshot';
import { createHash } from 'crypto';
import MiscHelper from './lib/MiscHelper';
import axios from 'axios';
import got from 'got';
import HTMLTemplates from './lib/HTMLTemplates';
import Logger from './lib/Logger';

interface MessageUI {
    url: string;
    avatarDir: string;
}
interface BotOptions {
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
    lastContact?: Room | Contact;
    id?: string;
}

export default class Bot {

    protected bot: Telegraph<ContextMessageUpdate>;
    protected clients: Map<number, Client> = new Map();
    protected msgui: MessageUI;
    protected keeyMsgs: number;
    private token: string;

    constructor({ token, socks5Proxy, msgui, keepMsgs }: BotOptions) {

        this.token = token;
        this.msgui = msgui;
        this.keeyMsgs = keepMsgs === undefined ? 300 : (Math.max(keepMsgs, 100) || 300);

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
        this.bot.command('stop', this.checkUser, this.handleLogout);
        this.bot.command('login', this.handleLogin);
        this.bot.command('groupon', this.checkUser, (ctx, n) => { ctx['user'].receiveGroups = true; n(); }, ctx => ctx.reply('OK'));
        this.bot.command('groupoff', this.checkUser, (ctx, n) => { ctx['user'].receiveGroups = false; n(); }, ctx => ctx.reply('OK'));
        this.bot.command('officialon', this.checkUser, (ctx, n) => { ctx['user'].receiveOfficialAccount = true, n() }, ctx => ctx.reply('OK'));
        this.bot.command('officialoff', this.checkUser, (ctx, n) => { ctx['user'].receiveOfficialAccount = false, n() }, ctx => ctx.reply('OK'));
        this.bot.command('selfon', this.checkUser, (ctx, n) => { ctx['user'].receiveSelf = true; n() }, ctx => ctx.reply('OK'));
        this.bot.command('selfoff', this.checkUser, (ctx, n) => { ctx['user'].receiveSelf = false; n() }, ctx => ctx.reply('OK'));
        this.bot.command('texton', this.checkUser, (ctx, n) => { ctx['user'].imageOnly = false; n(); }, ctx => ctx.reply('OK'));
        this.bot.command('textoff', this.checkUser, (ctx, n) => { ctx['user'].imageOnly = true; n() }, ctx => ctx.reply('OK'));
        this.bot.command('logout', this.checkUser, this.handleLogout);
        this.bot.help(ctx => ctx.reply(lang.help));
        this.bot.on('message', this.checkUser, this.handleTelegramMessage);

        this.bot.catch((err) => {
            Logger.error('Ooops', err)
        });

        this.bot.launch().then(() => Logger.info(`Bot is running`));
    }

    async exit() {
        for (let [_, client] of this.clients) {
            await client.wechat.logout();
            await client.wechat.stop();
        }
    }

    handleStart = (ctx: ContextMessageUpdate) => {
        ctx.reply(lang.welcome);
        ctx.reply(lang.help);
    }

    handleLogin = async (ctx: ContextMessageUpdate) => {
        let id = ctx.chat.id;
        let qrcodeCache = '';
        if (this.clients.has(id)) {
            ctx.reply(lang.login.retry);
            return;
        };

        ctx.reply(lang.login.request);

        let wechat = new Wechaty();
        this.clients.set(ctx.chat.id, { wechat, msgs: new Map(), receiveGroups: true, receiveOfficialAccount: false });

        wechat.on('scan', async (qrcode: string) => {
            if (qrcode === qrcodeCache) return;
            qrcodeCache = qrcode;
            ctx.replyWithPhoto({ source: qr.image(qrcode) });
        });

        wechat.once('login', user => {
            this.clients.get(ctx.chat.id).id = user.id;
            ctx.reply(lang.login.logined(user.name()));
        });

        wechat.on('logout', user => {
            ctx.reply(lang.login.logouted(user.name()));
            wechat.stop();
            wechat.removeAllListeners();

            this.clients.delete(id);
        });

        wechat.on('message', msg => this.handleWechatMessage(msg, ctx));

        await wechat.start();
    }

    checkUser = (ctx: ContextMessageUpdate, next: Function) => {
        if (!ctx) return next ? next() : undefined;

        let id = ctx.chat.id;
        let user = this.clients.get(id);
        if (!user) return;

        ctx['user'] = user;
        next(ctx);
    }

    handleLogout = async (ctx: ContextMessageUpdate) => {
        let user = ctx['user'] as Client;
        if (!user) return;

        await user.wechat.logout().catch(reason => Logger.error(reason));
        await user.wechat.stop().catch(reason => Logger.error(reason));
        user.wechat.removeAllListeners();
        this.clients.delete(ctx.chat.id);
        ctx.reply(lang.login.bye);
    }

    handleTelegramMessage = async (ctx: ContextMessageUpdate) => {
        let msg = ctx.message;
        let user = ctx['user'] as Client;

        let contact = user.lastContact;
        if (msg.reply_to_message) {
            contact = user.msgs.get(msg.reply_to_message.message_id)
        }


        if (!contact) return;

        let file = msg.audio || (msg.video || (msg.photo && msg.photo[0]));
        if (file && file.file_size <= 50 * 1024 * 1024) {
            return;
            try {
                let url = `https://api.telegram.org/bot${this.token}/getFile?file_id=${file.file_id}`
                let resp = await axios.get(url);
                if (!resp.data || !resp.data.ok) return;

                let filePath = resp.data.result.file_path;
                url = `https://api.telegram.org/file/bot${this.token}/${filePath}`;

                // Not available on default puppet
                await contact.say(FileBox.fromStream(got.stream(url), file.file_id));
            } catch (error) {
                Logger.error(error.message);
            }
            return;
        }

        if (msg.text) await contact.say(msg.text);
    }

    async handleWechatMessage(msg: Message, ctx: ContextMessageUpdate) {
        let id = ctx.chat.id;
        let user = this.clients.get(id);

        let from = msg.from();
        let room = msg.room();
        let type = msg.type();
        let text = msg.text().replace(/\<br\/\>/g, ' \n').replace(/<[^>]*>?/gm, '');

        if (user.id === from.id && !user.receiveSelf) return;
        if (!user.receiveOfficialAccount && from.type() === ContactType.Official) return;
        if (!user.receiveGroups && room) return;

        let alias = await from.alias();
        let nickname = from.name() + (alias ? ` (${alias})` : '');
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
                break;

            case MessageType.Audio:
                let audio = await msg.toFileBox();
                sent = await ctx['replyWithVoice']({ source: await audio.toStream() }) as TT.Message;
                break;

            case MessageType.Image:
                let image = await msg.toFileBox();
                sent = await ctx.replyWithPhoto({ source: await image.toStream() }, { caption: nickname });
                break;

            case MessageType.Video:
                let video = await msg.toFileBox();
                sent = await ctx.replyWithVideo({ source: await video.toStream() });
                break;

            default:
                break;
        }

        if (!sent) {
            return;
        }

        user.msgs.set(sent.message_id, room || from);
        user.lastContact = room || from;

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
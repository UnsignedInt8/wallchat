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
import { FileBoxType } from 'file-box';
import axios from 'axios';
import got from 'got';

interface MessageUI {
    url: string;
    avatarDir: string;
}
interface BotOptions {
    token: string;
    socks5Proxy?: { host: string, port: number, username?: string, password?: string, };
    msgui: MessageUI;
}

interface Client {
    wechat: Wechaty;
    receiveGroups?: boolean;
    receiveOfficialAccount?: boolean;
    receiveSelf?: boolean;
    msgs: Map<number, Contact | Room>;
    lastContact?: Room | Contact;
    id?: string;
}

export default class Bot {

    protected bot: Telegraph<ContextMessageUpdate>;
    protected clients: Map<number, Client> = new Map();
    protected msgui: MessageUI;
    private token: string;

    constructor({ token, socks5Proxy, msgui }: BotOptions) {
        let agent: any;
        this.token = token;
        this.msgui = msgui;

        if (socks5Proxy) {
            agent = new SocksAgent({
                socksHost: socks5Proxy.host,
                socksPort: socks5Proxy.port,
                socksUsername: socks5Proxy.username,
                socksPassword: socks5Proxy.password,
            });
        }

        this.bot = new Telegraph(token, {
            telegram: { agent }
        });

        this.bot.start(this.handleStart);
        (this.bot['stop'] as any)(this.checkUser, this.handleLogout);
        this.bot.command('login', this.handleLogin);
        this.bot.command('turnOnGroups', this.checkUser, ctx => ctx['user'].receiveGroups = true);
        this.bot.command('turnOffGroups', this.checkUser, ctx => ctx['user'].receiveGroups = false);
        this.bot.command('turnOnOfficial', this.checkUser, ctx => ctx['user'].receiveOfficialAccount = true);
        this.bot.command('turnOffOfficial', this.checkUser, ctx => ctx['user'].receiveOfficialAccount = false);
        this.bot.command('turnOnSelf', this.checkUser, ctx => ctx['user'].receiveSelf = true);
        this.bot.command('turnOffSelf', this.checkUser, ctx => ctx['user'].receiveSelf = false);

        this.bot.command('logout', this.checkUser, this.handleLogout);
        this.bot.on('message', this.checkUser, this.handleTelegramMessage);

        this.bot.catch((err) => {
            console.log('Ooops', err)
        });

        this.bot.launch();
    }

    async exit() {
        for (let [_, client] of this.clients) {
            await client.wechat.logout();
            await client.wechat.stop();
        }
    }

    handleStart = (ctx: ContextMessageUpdate) => {
        ctx.reply(`Hello`);
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
        await user.wechat.logout();
        await user.wechat.stop();
        user.wechat.removeAllListeners();
        this.clients.delete(ctx.chat.id);
        ctx.reply(lang.login.bye);
    }

    handleTurnOffGroups = (client: Client, on: boolean) => {
        client.receiveGroups = on;
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
            try {
                let url = `https://api.telegram.org/bot${this.token}/getFile?file_id=${file.file_id}`
                let resp = await axios.get(url);
                if (!resp.data || !resp.data.ok) return;

                let filePath = resp.data.result.file_path;
                url = `https://api.telegram.org/file/bot${this.token}/${filePath}`;

                // Not available on default puppet
                await contact.say(FileBox.fromStream(got.stream(url), file.file_id));
            } catch (error) {
                console.log(error.message);
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
        let text = msg.text().replace(/<[^>]*>?/gm, '');

        if (user.id === from.id && !user.receiveSelf) return;
        if (!user.receiveOfficialAccount && from.type() === ContactType.Official) return;
        if (!user.receiveGroups && room) return;

        let alias = await from.alias();
        let nickname = from.name() + (alias ? ` (${alias})` : '');
        let signature = room ? await room.topic() : from['payload'].signature;
        let city = from.city() || '';
        let provice = from.province() || '';
        let sent: TT.Message;
        let avatar = room ? await room.avatar() || await from.avatar() : await from.avatar();
        let avatarName = createHash('md5').update(room ? signature : nickname).digest().toString('hex') + '.jpg';
        let avatarPath = `${this.msgui.avatarDir}/${avatarName}`;

        if (!await MiscHelper.fileExists(avatarPath)) {
            await avatar.toFile(avatarPath).catch(reason => console.error(reason));
        }

        switch (type) {
            case MessageType.Text:
                let data = `n=${nickname}&s=${signature}&m=${text}&p=${provice}&c=${city}&a=${avatarName}`;
                data = Buffer.from(data, 'utf-8').toString('base64');

                const url = `${this.msgui.url}/?${data}`;
                let screen = await takeScreenshot({ url });

                try {
                    sent = await this.bot.telegram.sendPhoto(ctx.chat.id, { source: screen });
                } catch (error) {
                    console.log('text message error', error);
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
            console.log(msg);
            return;
        }

        user.msgs.set(sent.message_id, room || from);
        user.lastContact = room || from;

        // Delete old history
        if (user.msgs.size > 1000) {
            let start = sent.message_id - 1000;
            while (user.msgs.size > 1000 && start >= 0) {
                user.msgs.delete(start--);
            }
        }
    }
}
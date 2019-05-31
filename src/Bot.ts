import Telegraph, { ContextMessageUpdate, Telegram } from 'telegraf';
import SocksAgent from 'socks5-https-client/lib/Agent';
import { Wechaty, Message } from "wechaty";
import qr from 'qr-image';
import StreamToBuffer from './lib/StreamToBuffer';
import lang from './strings';
import { ContactType, MessageType } from 'wechaty-puppet';
import * as TT from 'telegraf/typings/telegram-types';
import takeScreenshot from './lib/TakeScreenshot';

interface MessageUI {
    url: string;
    avatarDir: string;
}
interface BotOptions {
    token: string;
    socks5Proxy?: { host: string, port: number, username?: string, password?: string };
    msgui: MessageUI;
}

interface Client {
    wechat: Wechaty;
    receiveGroups?: boolean;
    receiveOfficialAccount?: boolean;
}

export default class Bot {

    protected bot: Telegraph<ContextMessageUpdate>;
    protected clients: Map<number, Client> = new Map();
    protected msgui: MessageUI;

    constructor({ token, socks5Proxy, msgui }: BotOptions) {
        let agent: any;
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
        this.bot.command('login', this.handleLogin);
        this.bot.on('message', this.handleMessage);
        this.bot.catch((err) => {
            console.log('Ooops', err)
        });

        this.bot.launch();

        console.log(this.bot);

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

        let client = new Wechaty();
        this.clients.set(ctx.chat.id, { wechat: client });

        client.on('scan', async (qrcode: string) => {
            if (qrcode === qrcodeCache) return;
            qrcodeCache = qrcode;

            // ctx.replyWithPhoto({ source: await StreamToBuffer(qr.image(qrcode)) });
            ctx.replyWithPhoto({ source: qr.image(qrcode) });
        });

        client.on('login', user => {
            ctx.reply(lang.login.logined(user.name()));
        });

        client.on('logout', user => {
            ctx.reply(lang.login.logouted(user.name()));
            client.stop();
            client.removeAllListeners();

            this.clients.delete(id);
        });

        client.on('message', msg => this.handleWechatMessage(msg, ctx));

        await client.start();
    }

    handleMessage = (ctx: ContextMessageUpdate) => {
        let msg = ctx.message;
    }

    async handleWechatMessage(msg: Message, ctx: ContextMessageUpdate) {
        let id = ctx.chat.id;
        let user = this.clients.get(id);

        let from = msg.from();
        let room = msg.room();
        let type = msg.type();
        let text = msg.text().replace(/<[^>]*>?/gm, '');

        // if (user.wechat.id === from.id) return;

        let avatar = room ? await room.avatar() : await from.avatar();
        let alias = await from.alias();
        let nickname = from.name() + (alias ? ` (${alias})` : '');
        let signature = room ? await room.topic() : from['payload'].signature;
        let city = from.city() || '';
        let provice = from.province() || '';
        let sent: TT.Message;

        console.log(msg);

        switch (type) {
            case MessageType.Text:
                const url = `${this.msgui.url}/?n=${nickname}&s=${signature}&m=${text}&p=${provice}&c=${city}`;
                let screen = await takeScreenshot({ url });

                console.log('taking screen', url, screen);

                try {
                    sent = await this.bot.telegram.sendPhoto(ctx.chat.id, { source: screen });
                    console.log('text message sent', sent);
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
                sent = await ctx.replyWithPhoto({ source: await image.toStream() });
                break;

            case MessageType.Video:
                let video = await msg.toFileBox();
                sent = await ctx.replyWithVideo({ source: await video.toStream() });
                break;

            default:
                break;
        }
    }
}
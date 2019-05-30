import Telegraph, { ContextMessageUpdate, } from 'telegraf';
import SocksAgent from 'socks5-https-client/lib/Agent';
import { Wechaty } from "wechaty";
import qr from 'qr-image';
import StreamToBuffer from './lib/StreamToBuffer';

interface BotOptions {
    token: string;
    socks5Proxy?: { host: string, port: number, username?: string, password?: string }
}

export default class Bot {

    protected bot: Telegraph<ContextMessageUpdate>;
    protected clients: Map<number, Wechaty> = new Map();

    constructor({ token, socks5Proxy }: BotOptions) {

        let agent: any;

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

    }

    handleStart = (ctx: ContextMessageUpdate) => {
        ctx.reply(`Hello`);
    }

    handleLogin = async (ctx: ContextMessageUpdate) => {
        let id = ctx.chat.id;
        let qrcodeCache = '';
        if (this.clients.has(id) && this.clients.get(id).logonoff()) return;

        ctx.reply('Requesting Wechat QRCode...');

        let client = new Wechaty();
        this.clients.set(ctx.chat.id, client);

        client.on('scan', async (qrcode: string) => {
            if (qrcode === qrcodeCache) return;
            qrcodeCache = qrcode;
            let image = await StreamToBuffer(qr.image(qrcode));
            ctx.replyWithPhoto({ source: image });
        });

        await client.start();
    }

    handleMessage = (ctx: ContextMessageUpdate) => {
        let msg = ctx.message;
    }



}
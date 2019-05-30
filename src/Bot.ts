import Telegraph, { ContextMessageUpdate, } from 'telegraf';
import Session from 'telegraf/session';
import SocksAgent from 'socks5-https-client/lib/Agent';

interface BotOptions {
    token: string;
    socks5Proxy?: { host: string, port: number, username?: string, password?: string }
}

export default class Bot {

    private bot: Telegraph<ContextMessageUpdate>;

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

        this.bot.use(new Session());
        this.bot.start(this.handleStart);
        this.bot.command('login', this.handleLogin);
        this.bot.catch((err) => {
            console.log('Ooops', err)
        });
        this.bot.launch();

        console.log(this.bot);

    }

    handleStart = (ctx: ContextMessageUpdate) => {
        console.log(ctx);
        ctx.reply(`Hello`);
    }

    handleLogin = (ctx: ContextMessageUpdate) => {
        console.log(ctx);

    }

}
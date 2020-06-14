import Telegraph from 'telegraf';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Wechaty, Contact, Room, Friendship, RoomInvitation, Message } from 'wechaty';
import qr from 'qr-image';
import lang from './strings';
import { FriendshipType } from 'wechaty-puppet';
import * as TT from 'telegraf/typings/telegram-types';
import HTMLTemplates from './lib/HTMLTemplates';
import Logger from './lib/Logger';
import MiscHelper from './lib/MiscHelper';
import { TelegrafContext } from 'telegraf/typings/context';
import TelegramContext from 'telegraf/context';
import { handleFind, handleLock, handleUnlock, handleCurrent, handleTelegramMessage, handleWechatMessage } from './bot/index';

export interface BotOptions {
  token: string;
  wechatyToken?: string;
  socks5Proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  keepMsgs?: number;
}

export interface Client {
  wechat?: Wechaty;
  receiveGroups?: boolean;
  receiveOfficialAccount?: boolean;
  receiveSelf?: boolean;
  msgs: Map<number, Contact | Room>;
  currentContact?: Room | Contact;
  contactLocked?: boolean;
  wechatId?: string; // a flag to inidcate wechat client has logined
  initialized?: boolean; // a flag to indicate wechat event listeners have been hooked
}

export default class Bot {
  protected bot: Telegraph<TelegrafContext>;
  clients: Map<number, Client> = new Map(); // chat id => client
  keepMsgs: number;
  private recoverWechats = new Map<number, Wechaty>(); // tg chatid => wechaty

  protected beforeCheckUserList: ((ctx?: TelegrafContext) => Promise<boolean>)[] = [];
  protected pendingFriends = new Map<string, Friendship>();
  protected lastRoomInvitation: RoomInvitation = null;

  constructor({ token, socks5Proxy, keepMsgs }: BotOptions) {
    this.keepMsgs = keepMsgs === undefined ? 200 : Math.max(keepMsgs, 100) || 200;

    const agent = socks5Proxy ? (new SocksProxyAgent(`socks5://${socks5Proxy.host}:${socks5Proxy.port}`) as any) : undefined;

    this.bot = new Telegraph(token, {
      telegram: { agent }
    });

    const checkUser = (ctx: TelegrafContext, n: Function) => this.checkUser(ctx, n);
    const replyOk = (ctx: TelegrafContext) => ctx.reply('OK');

    const turnGroup = (ctx: TelegrafContext, n: Function, on: boolean) => {
      ctx['user'].receiveGroups = on;
      n();
    };

    const turnOfficial = (ctx: TelegrafContext, n: Function, on: boolean) => {
      ctx['user'].receiveOfficialAccount = on;
      n();
    };

    const turnSelf = (ctx: TelegrafContext, n: Function, on: boolean) => {
      ctx['user'].receiveSelf = on;
      n();
    };

    this.bot.start(this.handleStart);
    this.bot.command('stop', checkUser, this.handleLogout);
    this.bot.command('login', ctx => this.handleLogin(ctx));

    const turnGroupOn = (ctx: TelegrafContext, n: Function) => turnGroup(ctx, n, true);
    this.bot.command('groupon', checkUser, turnGroupOn, replyOk);

    const turnGroupOff = (ctx: TelegrafContext, n: Function) => turnGroup(ctx, n, false);
    this.bot.command('groupoff', checkUser, turnGroupOff, replyOk);

    const turnOfficialOn = (ctx: TelegrafContext, n: Function) => turnOfficial(ctx, n, true);
    this.bot.command('officialon', checkUser, turnOfficialOn, replyOk);

    const turnOfficialOff = (ctx: TelegrafContext, n: Function) => turnOfficial(ctx, n, false);
    this.bot.command('officialoff', checkUser, turnOfficialOff, replyOk);

    const turnSelfOn = (ctx: TelegrafContext, n: Function) => turnSelf(ctx, n, true);
    this.bot.command('selfon', checkUser, turnSelfOn, replyOk);

    const turnSelfOff = (ctx: TelegrafContext, n: Function) => turnSelf(ctx, n, false);
    this.bot.command('selfoff', checkUser, turnSelfOff, replyOk);

    this.bot.command('find', checkUser, this.handleFind);
    this.bot.command('lock', checkUser, this.handleLock);
    this.bot.command('unlock', checkUser, this.handleUnlock);
    this.bot.command('findandlock', checkUser, this.handleFind, this.handleLock);
    this.bot.command('current', checkUser, this.handleCurrent);
    this.bot.command('agree', checkUser, this.handleAgreeFriendship);
    this.bot.command('disagree', checkUser, this.handleDisagreeFriendship);
    this.bot.command('acceptroom', checkUser);
    this.bot.command('logout', checkUser, this.handleLogout);
    this.bot.help(ctx => ctx.reply(lang.help));

    this.bot.catch(err => {
      Logger.error('Ooops', err.message);
    });
  }

  handleFatalError = async (err: Error | number | NodeJS.Signals) => {
    Logger.error(`Bot Alert: ${err}`);

    const alert = HTMLTemplates.message({
      nickname: `[Bot Alert]`,
      message: `Fatal error happened:\n\n ${JSON.stringify(err)}\n\n Trying to recover...`
    });

    for (let [id, _] of this.clients) {
      await this.bot.telegram.sendMessage(id, alert, { parse_mode: 'HTML' });
    }
  };

  async launch() {
    this.bot.on('message', (ctx: TelegrafContext, n: Function) => this.checkUser(ctx, n), this.handleTelegramMessage);

    await this.bot.launch();
    Logger.info(`Bot is running`);

    await this.recoverSessions();
  }

  async recoverSessions() {
    const files = await MiscHelper.listTmpFile(`leavexchat.`);
    const ids = files
      .map(f => f.split('.')[1])
      .filter(s => s)
      .map(s => Number.parseInt(s));

    Logger.info(`Recovering ${ids.length} sessions...`);

    await Promise.all(
      ids.map(async chatid => {
        const client = this.createClient(chatid);
        const { wechat } = client;

        wechat.once('login', async user => {
          client.wechatId = user.id;

          const alert = HTMLTemplates.message({
            nickname: `[Bot Info]`,
            message: lang.login.sessionOK
          });

          await this.bot.telegram.sendMessage(chatid, alert, { parse_mode: 'HTML' });

          const ctx = new TelegramContext({ message: { chat: { id: chatid } } } as TT.Update, this.bot.telegram);
          await this.handleLogin(ctx);

          this.recoverWechats.delete(chatid);
        });

        const deleteWechaty = async () => {
          wechat.removeAllListeners();

          this.clients.delete(chatid);
          this.recoverWechats.delete(chatid);

          const alert = HTMLTemplates.message({
            nickname: `[Bot Alert]`,
            message: lang.login.sessionLost
          });

          await this.bot.telegram.sendMessage(chatid, alert, { parse_mode: 'HTML' });
          await wechat.stop();

          await MiscHelper.deleteTmpFile(`leavexchat.${chatid}`);
        };

        wechat.once('scan', async _ => await deleteWechaty());
        wechat.once('error', async _ => await deleteWechaty());

        this.recoverWechats.set(chatid, wechat);
        await wechat.start();
      })
    );
  }

  async exit() {
    for (let [_, client] of this.clients) {
      await client.wechat?.logout();
      await client.wechat?.stop();
    }
  }

  protected handleStart = async (ctx: TelegrafContext) => {
    await ctx.reply(lang.welcome).catch();
    await ctx.reply(lang.help);
  };

  private createClient(chatid: number) {
    if (this.clients.has(chatid)) return this.clients.get(chatid);

    let wechat = this.recoverWechats.get(chatid) || new Wechaty({ name: `telegram_${chatid})}` });
    let client: Client = {
      wechat,
      msgs: new Map(),
      receiveGroups: true,
      receiveOfficialAccount: true
    };

    this.clients.set(chatid, client);

    return client;
  }

  protected async handleLogin(ctx: TelegrafContext) {
    for (let c of this.beforeCheckUserList) {
      if (!(await c(ctx))) return;
    }

    const id = ctx.chat.id;
    let qrcodeCache = '';
    if (this.clients.has(id) && this.clients.get(id)?.initialized) {
      let user = this.clients.get(id);
      if (user.wechatId) {
        ctx.reply(lang.login.logined(user.wechat?.userSelf().name()));
        return;
      }

      ctx.reply(lang.login.retry);
      return;
    }

    const client = this.createClient(id);
    const { wechat } = client;
    wechat.removeAllListeners(); // clear all listeners if it is a recovered session

    let loginTimer: NodeJS.Timeout;

    let qrMessage: TT.MessagePhoto | void = undefined;

    const removeQRMessage = async () => {
      if (!qrMessage) return;
      await this.bot.telegram.deleteMessage(id, qrMessage.message_id);
      qrMessage = undefined;
    };

    const deleteWechat = async ({ clean }: { clean: boolean } = { clean: true }) => {
      this.clients.delete(id);
      wechat?.removeAllListeners();
      await wechat?.stop().catch();
      await removeQRMessage();
      if (clean) await MiscHelper.deleteTmpFile(`leavexchat.${id}`);
    };

    const handleQrcode = async (qrcode: string) => {
      if (qrcode === qrcodeCache) return;
      qrcodeCache = qrcode;

      if (client.wechatId) return;

      if (!loginTimer) {
        loginTimer = setTimeout(async () => {
          await deleteWechat();
          ctx.reply(lang.message.timeout);
          await removeQRMessage();
        }, 3 * 60 * 1000);
      }

      await removeQRMessage();
      qrMessage = await ctx.replyWithPhoto({ source: qr.image(qrcode) }).catch(() => deleteWechat());
    };

    wechat?.on('scan', handleQrcode);

    wechat?.once('login', async user => {
      this.clients.get(id).wechatId = user.id;
      await ctx.reply(lang.login.logined(user.name()));
      clearTimeout(loginTimer);
      wechat?.removeListener('scan', handleQrcode);
      await removeQRMessage();

      // create chat tmp id
      await MiscHelper.createTmpFile(`leavexchat.${id}`);
    });

    wechat?.on('friendship', async req => {
      let hello = req.hello();
      let contact = req.contact();
      let name = contact.name();

      if (req.type() === FriendshipType.Receive) {
        let avatar = await (await contact.avatar()).toStream();
        await ctx.replyWithPhoto({ source: avatar }, { caption: `${hello}, /agree ${name} or /disagree ${name}` });

        this.pendingFriends.set(name.toLowerCase(), req);
      }
    });

    wechat?.on('room-invite', async invitation => {
      let inviter = (await invitation.inviter()).name();
      let topic = await invitation.roomTopic();

      await ctx.reply(`${lang.message.inviteRoom(inviter, topic)} /acceptroom`);
    });

    wechat?.on('logout', async user => {
      await deleteWechat();
      await ctx.reply(lang.login.logouted(user.name()));
    });

    wechat?.on('error', async error => {
      Logger.warn(error.message);
      await ctx.reply(lang.message.error);
      await deleteWechat({ clean: false });
      await this.handleLogin(ctx);
    });

    wechat?.on('message', msg => this.handleWechatMessage(msg, ctx));

    client.initialized = true;

    // check whether the user has logined
    if (client.wechatId) return;

    await ctx.reply(lang.login.request);
    await wechat?.start();
  }

  protected async checkUser(ctx: TelegrafContext, next: Function) {
    for (let c of this.beforeCheckUserList) {
      if (!(await c(ctx))) return;
    }

    if (!ctx) return next ? next() : undefined;

    let id = ctx.chat.id;
    let user = this.clients.get(id);
    if (!user) return;

    ctx['user'] = user;
    next(ctx);
  }

  protected handleLogout = async (ctx: TelegrafContext) => {
    let user = ctx['user'] as Client;
    if (!user) return;

    try {
      this.clients.delete(ctx.chat.id);
      user.wechat?.removeAllListeners();
    } catch (error) {}

    await user.wechat?.logout().catch(reason => Logger.error(reason));
    await user.wechat?.stop().catch(reason => Logger.error(reason));
    ctx.reply(lang.login.bye);
  };

  protected handleAcceptRoomInvitation = async () => {
    this.lastRoomInvitation?.accept();
    this.lastRoomInvitation = null;
  };

  protected handleAgreeFriendship = async (ctx: TelegrafContext) => {
    let [, id] = ctx.message.text.split(' ');

    if (this.pendingFriends.size === 1) {
      for (let [key, req] of this.pendingFriends) {
        await req.accept();
        await ctx.reply(`${key} OK`);
      }

      this.pendingFriends.clear();
      return;
    }

    if (!id) {
      await ctx.reply(lang.commands.agree);
      return;
    }

    let req = this.pendingFriends.get(id.toLowerCase());
    await req?.accept();
    this.pendingFriends.delete(id.toLowerCase());

    await ctx.reply('OK');
  };

  protected handleDisagreeFriendship = async (ctx: TelegrafContext) => {
    let [, id] = ctx.message.text.split(' ');
    if (!id) {
      await ctx.reply(lang.commands.disagree);
      return;
    }

    this.pendingFriends.delete(id.toLowerCase());
    await ctx.reply('OK');
  };

  protected handleFind = handleFind;
  protected handleLock = handleLock;
  protected handleUnlock = handleUnlock;
  protected handleCurrent = handleCurrent;
  protected handleTelegramMessage = handleTelegramMessage;
  protected handleWechatMessage = (msg: Message, ctx: TelegrafContext) => handleWechatMessage(this, msg, ctx);
}

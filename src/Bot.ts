import * as TT from 'telegraf/typings/telegram-types';

import { Contact, Friendship, Message, Room, RoomInvitation, Wechaty } from 'wechaty';
import Telegraph, { Markup, Telegraf } from 'telegraf';
import {
  handleCurrent,
  handleFind,
  handleForwardTo,
  handleLock,
  handleMute,
  handleTelegramMessage,
  handleUnlock,
  handleUnmute,
  handleWechatMessage
} from './bot/index';

import { FriendshipType } from 'wechaty-puppet';
import HTMLTemplates from './lib/HTMLTemplates';
import { HttpsProxyAgent } from 'https-proxy-agent';
import Logger from './lib/Logger';
import MiscHelper from './lib/MiscHelper';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { TelegrafContext } from 'telegraf/typings/context';
import TelegramContext from 'telegraf/context';
import crypto from 'crypto';
import dayjs from 'dayjs';
import { findContact } from './bot/HandleFindX';
import lang from './strings';
import qr from 'qr-image';
import { readFile } from './bot/UpdateTmpFile';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export interface BotOptions {
  token: string;
  padplusToken?: string;
  socks5Proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  httpProxy?: {
    host: string;
    port: number;
  };
  keepMsgs?: number;
  silent?: boolean;
}

export interface Client {
  wechat?: Wechaty;
  receiveGroups?: boolean;
  receiveOfficialAccount?: boolean;
  receiveSelf?: boolean;
  msgs: Map<number, { contact: Contact | Room; wxmsg: Message }>; // telegram msgid => wx msg/contact
  currentContact?: Room | Contact;
  contactLocked?: boolean;
  wechatId?: string; // a flag to inidcate wechat client has logined
  initialized?: boolean; // a flag to indicate wechat event listeners have been hooked

  botId: string;
  firstMsgId?: any;
  muteList: string[];
}

export default class Bot {
  clients: Map<number, Client> = new Map(); // chat id => client
  keepMsgs: number;
  options: BotOptions;

  protected bot: Telegraph<TelegrafContext>;
  protected botSelf: TT.User;
  protected beforeCheckUserList: ((ctx?: TelegrafContext) => Promise<boolean>)[] = [];
  protected pendingFriends = new Map<string, Friendship>();
  protected lastRoomInvitation: RoomInvitation = null;
  private recoverWechats = new Map<number, Wechaty>(); // tg chatid => wechaty

  readonly id: string;
  readonly uptime = dayjs();

  constructor(options: BotOptions) {
    this.options = options;

    const botid = crypto
      .createHash('sha256')
      .update(options.token || options.padplusToken)
      .digest()
      .toString('hex')
      .substring(0, 4);

    this.id = `leavexchat_${botid}.`;

    const { token, socks5Proxy, keepMsgs, httpProxy } = options;
    this.keepMsgs = keepMsgs === undefined ? 200 : Math.max(keepMsgs, 100) || 200;

    const socks5agent: any = socks5Proxy ? new SocksProxyAgent(`socks5://${socks5Proxy.host}:${socks5Proxy.port}`) : undefined;
    const agent: any = httpProxy ? new HttpsProxyAgent(`http://${httpProxy.host}:${httpProxy.port}`) : undefined;

    this.bot = new Telegraph(token, {
      telegram: { agent: agent || socks5agent }
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
    this.bot.command('shutdown', _ => process.exit(0));

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

    const handleUpTime = (ctx: TelegrafContext) => {
      ctx.replyWithHTML(`<code>${this.uptime.toISOString()}  [${dayjs().from(this.uptime, true)}]</code>`, {
        reply_to_message_id: ctx['user'].firstMsgId
      });
    };
    this.bot.command('uptime', checkUser, handleUpTime);

    this.bot.command('find', checkUser, this.handleFind);
    this.bot.command('lock', checkUser, this.handleLock);
    this.bot.command('unlock', checkUser, this.handleUnlock);
    this.bot.command('findandlock', checkUser, this.handleFind, this.handleLock);
    this.bot.command('current', checkUser, this.handleCurrent);
    this.bot.command('agree', checkUser, this.handleAgreeFriendship);
    this.bot.command('disagree', checkUser, this.handleDisagreeFriendship);
    this.bot.command('acceptroom', checkUser);
    this.bot.command('forward', checkUser, this.handleForward);
    this.bot.command('forwardto', checkUser, this.handleForward);
    this.bot.command('mute', checkUser, this.handleMute);
    this.bot.command('unmute', checkUser, this.handleUnmute);
    this.bot.command('logout', checkUser, this.handleLogout);
    this.bot.help(ctx => ctx.reply(lang.help));
    this.bot.on('callback_query', checkUser, ctx => {
      if (ctx.message.text === 'agree') {
        this.handleAgreeFriendship(ctx);
      } else {
        this.handleDisagreeFriendship(ctx);
      }
    });

    this.bot.catch(err => {
      Logger.error('Ooops', err.message);
    });
  }

  handleFatalError = async (err: Error | number | NodeJS.Signals) => Logger.error(`Bot Alert: ${err}`);

  sendSystemMessage = async (msg: string) => {
    if (this.options.silent) return;

    const alert = HTMLTemplates.message({
      nickname: `[Bot Alert]`,
      message: msg
    });

    for (let [id, _] of this.clients) {
      await this.bot.telegram.sendMessage(id, alert, { parse_mode: 'HTML' });
    }
  };

  async launch() {
    this.bot.on('message', (ctx: TelegrafContext, n: Function) => this.checkUser(ctx, n), this.handleTelegramMessage);

    await this.bot.launch();
    this.botSelf = await this.bot.telegram.getMe();
    Logger.info(`Bot is running`);

    await this.recoverSessions();
  }

  async recoverSessions() {
    const files = await MiscHelper.listTmpFile(this.id);
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

          const ctx = new TelegramContext({ message: { chat: { id: chatid } } } as TT.Update, this.bot.telegram);
          await this.handleLogin(ctx);

          const alert = `<code>${lang.login.sessionOK}</code>`;
          await this.bot.telegram.sendMessage(chatid, alert, { parse_mode: 'HTML' });

          const lastDump = await readFile(`${this.id}${chatid}`);
          if (lastDump.recentContact && lastDump.recentContact.name) {
            const { found, foundName } = await findContact(lastDump.recentContact.name, wechat);
            client.currentContact = found;
            client.contactLocked = lastDump.recentContact.locked;

            if (found) {
              await ctx.reply(client.contactLocked ? lang.message.contactLocked(foundName) : lang.message.contactFound(foundName));
            } else {
              client.contactLocked = false;
            }
          }

          client.muteList = lastDump.muteList || [];

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

          await MiscHelper.deleteTmpFile(`${this.id}${chatid}`);
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

    let wechat =
      this.recoverWechats.get(chatid) ||
      new Wechaty({
        name: `telegram_${chatid})}`,
        puppet: this.options.padplusToken ? require('wechaty-puppet-padplus').PuppetPadplus({ token: this.options.padplusToken }) : undefined
      });
    let client: Client = {
      wechat,
      msgs: new Map(),
      receiveGroups: true,
      receiveOfficialAccount: true,
      muteList: [],
      botId: this.id
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
      if (clean) await MiscHelper.deleteTmpFile(`${this.id}${id}`);
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
      await MiscHelper.createTmpFile(`${this.id}${id}`);
    });

    wechat?.on('friendship', async req => {
      let hello = req.hello();
      let contact = req.contact();
      let name = contact.name();

      if (req.type() === FriendshipType.Receive) {
        let avatar = await (await contact.avatar()).toStream();

        const buttons = Markup.inlineKeyboard([[Markup.callbackButton('Agree', 'agree')], [Markup.callbackButton('Ignore', 'disagree')]], {
          columns: 2
        });

        await ctx.replyWithPhoto(
          { source: avatar },
          { caption: `[${lang.contact.friend}]\n\n${hello}`, parse_mode: 'MarkdownV2', reply_markup: buttons }
        );

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
  };

  protected handleDisagreeFriendship = async (ctx: TelegrafContext) => {
    let [, id] = ctx.message.text.split(' ');

    if (this.pendingFriends.size === 1) {
      this.pendingFriends.clear();
      return;
    }

    if (!id) {
      await ctx.reply(lang.commands.disagree);
      return;
    }

    this.pendingFriends.delete(id.toLowerCase());
    await ctx.reply('OK');
  };

  protected handleFind = (ctx: TelegrafContext, next: Function) => handleFind(this, ctx, next);
  protected handleLock = (ctx: TelegrafContext) => handleLock(ctx);
  protected handleUnlock = (ctx: TelegrafContext) => handleUnlock(ctx);
  protected handleMute = (ctx: TelegrafContext) => handleMute(ctx);
  protected handleUnmute = (ctx: TelegrafContext) => handleUnmute(ctx);
  protected handleCurrent = handleCurrent;
  protected handleForward = handleForwardTo;
  protected handleTelegramMessage = (ctx: TelegrafContext) => handleTelegramMessage(ctx, { ...this.options, bot: this.botSelf });
  protected handleWechatMessage = (msg: Message, ctx: TelegrafContext) => handleWechatMessage(this, msg, ctx);
}

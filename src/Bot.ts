import {
  Contact,
  Friendship,
  Message,
  Room,
  RoomInvitation,
  Wechaty,
  WechatyBuilder,
} from 'wechaty';
import { Context, Markup, Telegraf } from 'telegraf';
import {
  Message as TTMessage,
  Update as TTUpdate,
  UserFromGetMe,
} from 'telegraf/typings/core/types/typegram';
import {
  handleCurrent,
  handleFind,
  handleForwardTo,
  handleLock,
  handleMute,
  handleNameOnly,
  handleSoundOnly,
  handleTelegramMessage,
  handleUnlock,
  handleUnmute,
  handleWechatMessage,
} from './bot/index';

// import { Context } from 'telegraf/typings/context';
import HTMLTemplates from './lib/HTMLTemplates';
import { HttpsProxyAgent } from 'https-proxy-agent';
import Logger from './lib/Logger';
import MiscHelper from './lib/MiscHelper';
import { SocksProxyAgent } from 'socks-proxy-agent';
import crypto from 'crypto';
import dayjs from 'dayjs';
import { findContact } from './bot/HandleFindX';
import lang from './strings';
import qr from 'qr-image';
import { readFile } from './bot/UpdateTmpFile';
import relativeTime from 'dayjs/plugin/relativeTime';

const { version } = require('../../package.json');

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
  soundOnlyList: string[];
  nameOnlyList: { [group: string]: string[] };
}

export default class Bot {
  clients: Map<number, Client> = new Map(); // chat id => client
  keepMsgs: number;
  options: BotOptions;

  protected bot: Telegraf<Context>;
  protected botSelf: UserFromGetMe;
  protected beforeCheckUserList: ((ctx?: Context) => Promise<boolean>)[] = [];
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
    this.keepMsgs =
      keepMsgs === undefined ? 200 : Math.max(keepMsgs, 100) || 200;

    const socks5agent: any = socks5Proxy
      ? new SocksProxyAgent(`socks5://${socks5Proxy.host}:${socks5Proxy.port}`)
      : undefined;
    const agent: any = httpProxy
      ? new HttpsProxyAgent(`http://${httpProxy.host}:${httpProxy.port}`)
      : undefined;

    this.bot = new Telegraf(token, {
      telegram: { agent: agent || socks5agent },
    });

    const checkUser = (ctx: Context, n: Function) => this.checkUser(ctx, n);
    const replyOk = (ctx: Context) => ctx.reply('OK');

    const turnGroup = (ctx: Context, n: Function, on: boolean) => {
      ctx['user'].receiveGroups = on;
      n();
    };

    const turnOfficial = (ctx: Context, n: Function, on: boolean) => {
      ctx['user'].receiveOfficialAccount = on;
      n();
    };

    const turnSelf = (ctx: Context, n: Function, on: boolean) => {
      ctx['user'].receiveSelf = on;
      n();
    };

    this.bot.start(this.handleStart);
    this.bot.command('version', (ctx) => ctx.reply(`Bot version: ${version}`));
    this.bot.command('stop', checkUser, this.handleLogout);
    this.bot.command('login', (ctx) => this.handleLogin(ctx));
    this.bot.command('shutdown', (_) => process.exit(0));

    const turnGroupOn = (ctx: Context, n: Function) => turnGroup(ctx, n, true);
    this.bot.command('groupon', checkUser, turnGroupOn, replyOk);

    const turnGroupOff = (ctx: Context, n: Function) =>
      turnGroup(ctx, n, false);
    this.bot.command('groupoff', checkUser, turnGroupOff, replyOk);

    const turnOfficialOn = (ctx: Context, n: Function) =>
      turnOfficial(ctx, n, true);
    this.bot.command('officialon', checkUser, turnOfficialOn, replyOk);

    const turnOfficialOff = (ctx: Context, n: Function) =>
      turnOfficial(ctx, n, false);
    this.bot.command('officialoff', checkUser, turnOfficialOff, replyOk);

    const turnSelfOn = (ctx: Context, n: Function) => turnSelf(ctx, n, true);
    this.bot.command('selfon', checkUser, turnSelfOn, replyOk);

    const turnSelfOff = (ctx: Context, n: Function) => turnSelf(ctx, n, false);
    this.bot.command('selfoff', checkUser, turnSelfOff, replyOk);

    const handleUpTime = (ctx: Context) => {
      ctx.replyWithHTML(
        `<code>${this.uptime.toISOString()}  [${dayjs().from(
          this.uptime,
          true
        )}]</code>`,
        {
          reply_to_message_id: ctx['user'].firstMsgId,
        }
      );
    };
    this.bot.command('uptime', checkUser, handleUpTime);

    this.bot.command('find', checkUser, this.handleFind);
    this.bot.command('lock', checkUser, this.handleLock);
    this.bot.command('unlock', checkUser, this.handleUnlock);
    this.bot.command(
      'findandlock',
      checkUser,
      this.handleFind,
      this.handleLock
    );
    this.bot.command('current', this.handleCurrent);
    this.bot.command('agree', checkUser, this.handleAgreeFriendship);
    this.bot.command('disagree', checkUser, this.handleDisagreeFriendship);
    this.bot.command('acceptroom', checkUser);
    this.bot.command('forward', checkUser, this.handleForward);
    this.bot.command('forwardto', checkUser, this.handleForward);
    this.bot.command('mute', checkUser, this.handleMute);
    this.bot.command('soundonly', checkUser, this.handleSoundOnly);
    this.bot.command('nameonly', checkUser, this.handleNameOnly);
    this.bot.command('unmute', checkUser, this.handleUnmute);
    this.bot.command('quitroom', checkUser, this.handleQuitRoom);
    this.bot.command('logout', checkUser, this.handleLogout);
    this.bot.help((ctx) => ctx.reply(lang.help));

    // this.bot.on('callback_query', checkUser, ctx => {
    //   if (ctx.callbackQuery.data === 'agree') {
    //     this.handleAgreeFriendship(ctx);
    //   } else {
    //     this.handleDisagreeFriendship(ctx);
    //   }

    //   ctx.answerCbQuery('', false);
    // });

    // this.bot.on('inline_query', checkUser, ctx => {
    //   const { inlineQuery } = ctx;

    //   if (inlineQuery.query === 'agree') {
    //     this.handleAgreeFriendship(ctx);
    //   } else {
    //     this.handleDisagreeFriendship(ctx);
    //   }
    // });

    // this.bot.action('agree', ctx => this.handleAgreeFriendship(ctx));
    // this.bot.action('disagree', this.handleDisagreeFriendship);

    this.bot.catch((err) => {
      Logger.error('Ooops', err?.['message']);
    });
  }

  handleFatalError = async (err: Error | number | NodeJS.Signals) =>
    Logger.error(`Bot Alert: ${err}`);

  sendSystemMessage = async (msg: string) => {
    if (this.options.silent) return;

    const alert = HTMLTemplates.message({
      nickname: `[Bot Alert]`,
      message: msg,
    });

    for (let [id, _] of this.clients) {
      await this.bot.telegram.sendMessage(id, alert, { parse_mode: 'HTML' });
    }
  };

  async launch() {
    this.bot.on(
      'message',
      (ctx: Context, n: Function) => this.checkUser(ctx, n),
      this.handleTelegramMessage
    );

    await this.bot.launch();
    this.botSelf = await this.bot.telegram.getMe();
    Logger.info(`Bot is running`);

    await this.recoverSessions();
  }

  async recoverSessions() {
    const files = await MiscHelper.listTmpFile(this.id);
    const ids = files
      .map((f) => f.split('.')[1])
      .filter((s) => s)
      .map((s) => Number.parseInt(s));

    Logger.info(`Recovering ${ids.length} sessions...`);

    await Promise.all(
      ids.map(async (chatid) => {
        const client = this.createClient(chatid);
        const { wechat } = client;

        wechat.once('login', async (user) => {
          client.wechatId = user.id;

          const ctx = new Context(
            { message: { chat: { id: chatid } } } as TTUpdate,
            this.bot.telegram,
            this.botSelf
          );
          await this.handleLogin(ctx);

          const alert = `<code>${lang.login.sessionOK}</code>`;
          await this.bot.telegram.sendMessage(chatid, alert, {
            parse_mode: 'HTML',
          });

          const lastDump = await readFile(`${this.id}${chatid}`);
          if (lastDump.recentContact && lastDump.recentContact.name) {
            const { found, foundName } = await findContact(
              lastDump.recentContact.name,
              wechat
            );
            client.currentContact = found;
            client.contactLocked = lastDump.recentContact.locked;

            if (found) {
              await ctx.reply(
                client.contactLocked
                  ? lang.message.contactLocked(foundName)
                  : lang.message.contactFound(foundName)
              );
            } else {
              client.contactLocked = false;
            }
          }

          client.muteList = lastDump.muteList || [];
          client.soundOnlyList = lastDump.soundOnly || [];
          client.nameOnlyList = lastDump.namesOnly || {};

          this.recoverWechats.delete(chatid);
        });

        const deleteWechaty = async () => {
          // wechat?.removeAllListeners();

          this.clients.delete(chatid);
          this.recoverWechats.delete(chatid);

          const alert = HTMLTemplates.message({
            nickname: `[Bot Alert]`,
            message: lang.login.sessionLost,
          });

          await this.bot.telegram.sendMessage(chatid, alert, {
            parse_mode: 'HTML',
          });

          await wechat?.stop();
          await MiscHelper.deleteTmpFile(`${this.id}${chatid}`);
        };

        wechat.once('scan', async (_) => await deleteWechaty());
        wechat.once('error', async (_) => await deleteWechaty());

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

  protected handleStart = async (ctx: Context) => {
    await ctx.reply(lang.welcome).catch();
    await ctx.reply(lang.help);
  };

  private createClient(chatid: number) {
    if (this.clients.has(chatid)) return this.clients.get(chatid);

    let wechat =
      this.recoverWechats.get(chatid) ||
      WechatyBuilder.build({
        name: `telegram_${chatid})}`,
        puppet: 'wechaty-puppet-wechat',
      });

    let client: Client = {
      wechat,
      msgs: new Map(),
      receiveGroups: true,
      receiveOfficialAccount: true,
      muteList: [],
      soundOnlyList: [],
      nameOnlyList: {},
      botId: this.id,
    };

    this.clients.set(chatid, client);

    return client;
  }

  protected async handleLogin(ctx: Context) {
    for (let c of this.beforeCheckUserList) {
      if (!(await c(ctx))) return;
    }

    const id = ctx?.chat?.id;
    let qrcodeCache = '';
    if (this.clients.has(id) && this.clients.get(id)?.initialized) {
      let user = this.clients.get(id);
      if (user.wechatId) {
        ctx.reply(lang.login.logined(user.wechat.name?.() || ''));
        return;
      }

      ctx.reply(lang.login.retry);
      return;
    }

    const client = this.createClient(id);
    const { wechat } = client;
    // wechat.removeAllListeners(); // clear all listeners if it is a recovered session

    let loginTimer: NodeJS.Timeout;

    let qrMessage: TTMessage | void = undefined;

    const removeQRMessage = async () => {
      if (!qrMessage) return;
      await this.bot.telegram.deleteMessage(id, qrMessage.message_id);
      qrMessage = undefined;
    };

    const deleteWechat = async (
      { clean }: { clean: boolean } = { clean: true }
    ) => {
      this.clients.delete(id);
      // wechat?.removeAllListeners();

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
      qrMessage = await ctx
        .replyWithPhoto({ source: qr.image(qrcode) })
        .catch(() => deleteWechat());
    };

    wechat?.on('scan', handleQrcode);

    wechat?.once('login', async (user) => {
      this.clients.get(id).wechatId = user.id;
      await ctx.reply(lang.login.logined(user.name()));
      clearTimeout(loginTimer);
      wechat?.off('scan', handleQrcode);

      await removeQRMessage();

      // create chat tmp id
      await MiscHelper.createTmpFile(`${this.id}${id}`);
    });

    wechat?.on('friendship', async (req) => {
      let hello = req.hello();
      let contact = req.contact();
      let name = contact.name();

      if (req.type() === 2) {
        let avatar = await (await contact.avatar()).toStream();

        // const buttons = Markup.inlineKeyboard([Markup.callbackButton('Agree', 'agree'), Markup.callbackButton('Ignore', 'disagree')], {
        //   columns: 2
        // });

        await ctx.replyWithPhoto(
          { source: avatar },
          {
            caption: `[${lang.contact.friend}]\n\n${hello}`,
            parse_mode: 'MarkdownV2',
            reply_markup: undefined,
          }
        );

        this.pendingFriends.set(name.toLowerCase(), req);
      }
    });

    wechat?.on('room-invite', async (invitation) => {
      let inviter = (await invitation.inviter()).name();
      let topic = await invitation.topic();

      await ctx.reply(`${lang.message.inviteRoom(inviter, topic)} /acceptroom`);
    });

    wechat?.on('logout', async (user) => {
      await deleteWechat();
      await ctx.reply(lang.login.logouted(user.name()));
    });

    wechat?.on('error', async (error) => {
      Logger.warn(error.message);
      await ctx.reply(lang.message.error);
      // await deleteWechat({ clean: false });
      // await this.handleLogin(ctx);
      process.exit(0);
    });

    wechat?.on('message', (msg) => this.handleWechatMessage(msg, ctx));

    client.initialized = true;

    // check whether the user has logined
    if (client.wechatId) return;

    await ctx.reply(lang.login.request);
    await wechat?.start();
  }

  protected async checkUser(ctx: Context, next: Function) {
    for (let c of this.beforeCheckUserList) {
      if (!(await c(ctx))) return;
    }

    if (!ctx) return next ? next() : undefined;

    let id = ctx?.chat?.id;
    let user = this.clients?.get(id);
    if (!user) return;

    ctx['user'] = user;
    next(ctx);
  }

  protected handleLogout = async (ctx: Context) => {
    let user = ctx['user'] as Client;
    if (!user) return;

    try {
      this.clients.delete(ctx?.chat?.id);
      user.wechat?.reset();
    } catch (error) {}

    await user.wechat?.logout().catch((reason) => Logger.error(reason));
    await user.wechat?.stop().catch((reason) => Logger.error(reason));
    ctx.reply(lang.login.bye);
  };

  handleQuitRoom = async (ctx: Context) => {
    let user = ctx['user'] as Client;
    if (!user) return;

    let room = user.currentContact as Room;
    let topic = await room['topic']?.();
    await room['quit']?.();
    ctx.reply(`${topic} 👋`);
  };

  protected handleAcceptRoomInvitation = async () => {
    this.lastRoomInvitation?.accept();
    this.lastRoomInvitation = null;
  };

  protected handleAgreeFriendship = async (ctx: Context) => {
    for (let [key, req] of this.pendingFriends) {
      await req.accept();
    }

    this.pendingFriends.clear();

    // let [, id] = ctx.message?.text?.split(' ');

    // if (!id) {
    //   await ctx.reply(lang.commands.agree);
    //   return;
    // }

    // let req = this.pendingFriends.get(id.toLowerCase());
    // await req?.accept();
    // this.pendingFriends.delete(id.toLowerCase());
  };

  protected handleDisagreeFriendship = async (ctx: Context) => {
    this.pendingFriends.clear();

    // let [, id] = ctx.message?.text?.split(' ');

    // if (!id) {
    //   await ctx.reply(lang.commands.disagree);
    //   return;
    // }

    // this.pendingFriends.delete(id.toLowerCase());
    await ctx.reply('OK');
  };

  protected handleFind = (ctx: Context, next: Function) =>
    handleFind(this, ctx, next);
  protected handleLock = (ctx: Context) => handleLock(ctx);
  protected handleUnlock = (ctx: Context) => handleUnlock(ctx);
  protected handleMute = (ctx: Context) => handleMute(ctx);
  protected handleSoundOnly = (ctx: Context) => handleSoundOnly(ctx);
  protected handleNameOnly = (ctx: Context) => handleNameOnly(ctx);
  protected handleUnmute = (ctx: Context) => handleUnmute(ctx);
  protected handleCurrent = (ctx: Context) => handleCurrent(ctx);
  protected handleForward = handleForwardTo;
  protected handleTelegramMessage = (ctx: Context) =>
    handleTelegramMessage(ctx, { ...this.options, bot: this.botSelf });
  protected handleWechatMessage = (msg: Message, ctx: Context) =>
    handleWechatMessage(this, msg, ctx);
}

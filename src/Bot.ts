import Telegraph from 'telegraf';
import SocksAgent from 'socks5-https-client/lib/Agent';
import { Wechaty, Message, Contact, Room, FileBox, Friendship, RoomInvitation } from 'wechaty';
import { PuppetPadplus } from 'wechaty-puppet-padplus';
import qr from 'qr-image';
import lang from './strings';
import { ContactType, FriendshipType, MessageType } from 'wechaty-puppet';
import * as TT from 'telegraf/typings/telegram-types';
import axios from 'axios';
import download from 'download';
import fs from 'fs';
import path from 'path';
import tempfile from 'tempfile';
import HTMLTemplates from './lib/HTMLTemplates';
import Logger from './lib/Logger';
import * as XMLParser from './lib/XmlParser';
import { AllHtmlEntities } from 'html-entities';
import { TelegrafContext } from 'telegraf/typings/context';

const html = new AllHtmlEntities();

interface MessageUI {
  url: string;
  avatarDir: string;
}

export interface BotOptions {
  token: string;
  wechatyToken?: string;
  socks5Proxy?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  msgui?: MessageUI;
  keepMsgs?: number;
}

interface Client {
  wechat?: Wechaty;
  receiveGroups?: boolean;
  receiveOfficialAccount?: boolean;
  receiveSelf?: boolean;
  msgs: Map<number, Contact | Room>;
  currentContact?: Room | Contact;
  contactLocked?: boolean;
  wechatId?: string;
}

export default class Bot {
  protected bot: Telegraph<TelegrafContext>;
  protected clients: Map<number, Client> = new Map(); // chat id => client
  protected msgui: MessageUI;
  protected keeyMsgs: number;
  private token: string;
  private wechatyToken?: string;
  protected beforeCheckUserList: ((ctx?: TelegrafContext) => Promise<boolean>)[] = [];
  protected pendingFriends = new Map<string, Friendship>();
  protected lastRoomInvitation: RoomInvitation = null;

  constructor({ token, socks5Proxy, msgui, keepMsgs, wechatyToken }: BotOptions) {
    this.token = token;
    this.wechatyToken = wechatyToken;
    this.msgui = msgui;
    this.keeyMsgs = keepMsgs === undefined ? 200 : Math.max(keepMsgs, 100) || 200;

    let agent = socks5Proxy
      ? new SocksAgent({
          socksHost: socks5Proxy.host,
          socksPort: socks5Proxy.port,
          socksUsername: socks5Proxy.username,
          socksPassword: socks5Proxy.password
        })
      : undefined;

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

  launch() {
    this.bot.on('message', (ctx: TelegrafContext, n: Function) => this.checkUser(ctx, n), this.handleTelegramMessage);
    this.bot.launch().then(() => Logger.info(`Bot is running`));

    const handleFatalError = async (err: Error | number | NodeJS.Signals) => {
      for (let [id, _] of this.clients) {
        await this.bot.telegram.sendMessage(id, `Fatal error happened:\n\n ${JSON.stringify(err)}\n\n Trying to restart...`);
      }
    };

    process.on('exit', handleFatalError);

    //catches ctrl+c event
    process.on('SIGINT', handleFatalError);

    // catches "kill pid" (for example: nodemon restart)
    process.on('SIGUSR1', handleFatalError);
    process.on('SIGUSR2', handleFatalError);

    //catches uncaught exceptions
    process.on('uncaughtException', handleFatalError);
    process.on('unhandledRejection', handleFatalError);
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

  protected async handleLogin(ctx: TelegrafContext) {
    for (let c of this.beforeCheckUserList) {
      if (!(await c(ctx))) return;
    }

    let id = ctx.chat.id;
    let qrcodeCache = '';
    if (this.clients.has(id)) {
      let user = this.clients.get(id);
      if (user.wechatId) {
        ctx.reply(lang.login.logined(user.wechat?.userSelf().name()));
        return;
      }

      ctx.reply(lang.login.retry);
      return;
    }

    ctx.reply(lang.login.request);

    let puppet: any = this.wechatyToken
      ? new PuppetPadplus({
          token: this.wechatyToken
        })
      : undefined;

    if (puppet) {
      Logger.info('You are using wechaty-puppet-padplus');
    }

    let wechat = new Wechaty({ puppet, name: `telegram_${ctx.chat.id})}` });
    let client: Client = {
      wechat,
      msgs: new Map(),
      receiveGroups: true,
      receiveOfficialAccount: true
    };
    this.clients.set(ctx.chat.id, client);
    let loginTimer: NodeJS.Timeout;

    let qrMessage: TT.MessagePhoto | void = undefined;

    const removeQRMessage = async () => {
      if (!qrMessage) return;
      await this.bot.telegram.deleteMessage(ctx.chat.id, qrMessage.message_id);
      qrMessage = undefined;
    };

    const deleteWechat = async () => {
      Logger.info('login timeout');
      this.clients.delete(id);
      wechat?.removeAllListeners();
      await wechat?.stop().catch();
      await removeQRMessage();
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
      ctx.reply(lang.message.error);
      await deleteWechat();
    });

    // wechat?.puppet.on('error', async () => {
    //     ctx.reply(lang.message.error);
    //     await deleteWechat();
    // });

    wechat?.on('message', msg => this.handleWechatMessage(msg, ctx));

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

  protected handleFind = async (ctx: TelegrafContext, next: Function) => {
    let contents = ctx.message.text.split(' ');
    contents.shift();

    let name = contents.reduce((p, c) => `${p} ${c}`);
    if (!name) {
      ctx.reply(lang.commands.find);
      return;
    }

    name = name.trim();
    const regexp = new RegExp(name, 'ig');
    let user = ctx['user'] as Client;

    let found: Contact | Room | undefined;
    let foundName = '';
    try {
      found = (await user.wechat?.Contact.find({ name: regexp })) || (await user.wechat?.Contact.find({ alias: regexp }));
      const alias = await found?.alias();
      foundName = alias ? `${found?.name()} (${alias})` : found?.name();
    } catch (error) {
      Logger.error(error.message);
      return;
    }

    if (!found) {
      found = await user.wechat?.Room.find({ topic: regexp });
      foundName = await found?.topic();
    }

    if (!found) {
      ctx.reply(lang.message.contactNotFound);
      return;
    }

    let info = user.contactLocked ? ` [${lang.message.contactLocked('').trim()}]` : '';
    await ctx.reply(lang.message.contactFound(`${foundName}`) + info).catch();
    user.currentContact = found;

    if (next) next();
  };

  protected handleLock = async (ctx: TelegrafContext) => {
    let user = ctx['user'] as Client;
    if (!user.currentContact) return;
    if (user.contactLocked) return;
    user.contactLocked = true;
    ctx.reply(lang.message.contactLocked((user.currentContact as Contact).name()));
  };

  protected handleUnlock = async (ctx: TelegrafContext) => {
    let user = ctx['user'] as Client;
    if (!user.currentContact) return;
    if (!user.contactLocked) return;
    user.contactLocked = false;
    ctx.reply(lang.message.contactUnlocked((user.currentContact as Contact).name()));
  };

  protected handleCurrent = async (ctx: TelegrafContext) => {
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

    let info = user.contactLocked ? ` [${lang.message.contactLocked('').trim()}]` : '';

    ctx.reply(lang.message.current(name) + info);
  };

  protected handleAcceptRoomInvitation = async (ctx: TelegrafContext) => {
    this.lastRoomInvitation?.accept();
    this.lastRoomInvitation = null;
  };

  protected handleAgreeFriendship = async (ctx: TelegrafContext) => {
    let [_, id] = ctx.message.text.split(' ');

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
    let [_, id] = ctx.message.text.split(' ');
    if (!id) {
      await ctx.reply(lang.commands.disagree);
      return;
    }

    this.pendingFriends.delete(id.toLowerCase());
    await ctx.reply('OK');
  };

  protected handleTelegramMessage = async (ctx: TelegrafContext) => {
    let msg = ctx.message;
    let user = ctx['user'] as Client;
    if (msg.text && msg.text.startsWith('/find')) return;

    let contact = user.currentContact;
    if (msg.reply_to_message) {
      contact = user.msgs.get(msg.reply_to_message.message_id);
    }

    if (!contact) return;

    let file = msg.audio || msg.video || (msg.photo && msg.photo[0]);
    if (file && file.file_size <= 50 * 1024 * 1024) {
      return;
      try {
        let url = `https://api.telegram.org/bot${this.token}/getFile?file_id=${file.file_id}`;
        let resp = await axios.get(url);
        if (!resp.data || !resp.data.ok) return;

        let filePath = resp.data.result.file_path;
        url = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
        let ext = path.extname(filePath);
        let distFile = tempfile(ext);
        fs.writeFileSync(distFile, await download(url));

        // Not available on default puppet

        await contact.say(FileBox.fromFile(distFile));
        // await contact.say(FileBox.fromStream(await download(url) as any, file.file_id));
        // await contact.say(FileBox.fromStream(got.stream(url), file.file_id));
      } catch (error) {
        Logger.error(error.message);
      }
      return;
    }

    if (msg.text) await contact.say(msg.text);
    if (!user.contactLocked) user.currentContact = contact;
  };

  protected async handleWechatMessage(msg: Message, ctx: TelegrafContext) {
    let id = ctx.chat.id;
    let user = this.clients.get(id);

    let from = msg.from();
    let room = msg.room();
    let type = msg.type() as any;
    let text = msg
      .text()
      .replace(/\<br\/\>/g, ' \n')
      .replace(/<[^>]*>?/gm, '');

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
        nickname = `${nickname}` + (room ? ` [${await room.topic()}]` : '');
        sent = await ctx.replyWithHTML(HTMLTemplates.message({ nickname, message: text }));
        break;

      case MessageType.Attachment:
        try {
          let xml = html.decode(msg.text());
          let markdown = from.type() === ContactType.Official ? XMLParser.parseOffical(xml) : XMLParser.parseAttach(xml);
          sent = await ctx.replyWithMarkdown(HTMLTemplates.markdown({ nickname, content: markdown }));
        } catch (error) {}

        break;

      // case MessageType.Money:
      //     sent = await ctx.replyWithHTML(HTMLTemplates.message({ nickname, message: lang.message.money }));
      //     break;

      case MessageType.Audio:
        let audio = await msg.toFileBox();
        let duration = audio.metadata['duration'] as number;
        sent = (await ctx.replyWithVoice({ source: await audio.toStream() }, { caption, duration })) as TT.Message;
        break;

      case MessageType.Image:
        let image = await msg.toFileBox();
        // sent = (image.mimeType || '').toLowerCase().includes('gif') ? await ctx.replyWithVideo({ source: await image.toStream() }) : await ctx.replyWithPhoto({ source: await image.toStream() }, { caption });
        sent = await ctx.replyWithPhoto({ source: await image.toStream() }, { caption });
        break;

      case MessageType.Video:
        let video = await msg.toFileBox();
        sent = await ctx.replyWithVideo({ source: await video.toStream() }, {
          caption
        } as any);
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
      user.msgs.delete(countToDelete);
      countToDelete--;
    } while (countToDelete > 0);
  }
}

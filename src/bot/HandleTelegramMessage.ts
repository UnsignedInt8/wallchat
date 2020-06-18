import axios from 'axios';
import download from 'download';
import fs from 'fs';
import path from 'path';
import tempfile from 'tempfile';
import Logger from '../lib/Logger';
import { Client } from '../Bot';
import { TelegrafContext } from 'telegraf/typings/context';
import { FileBox } from 'wechaty';
import { BotOptions } from '../Bot';
import { HttpsProxyAgent } from 'https-proxy-agent';
import lang from '../strings';
import MiscHelper from '../lib/MiscHelper';
import sharp from 'sharp';
import * as TT from 'telegraf/typings/telegram-types';
import HTMLTemplates from '../lib/HTMLTemplates';

interface IHandleTelegramMessage extends BotOptions {
  bot: TT.User;
}

export default async (ctx: TelegrafContext, { token, httpProxy, bot }: IHandleTelegramMessage) => {
  let msg = ctx.message;
  let user = ctx['user'] as Client;
  if (msg.text && msg.text.startsWith('/find')) return;

  let contact = user.currentContact;
  if (msg.reply_to_message) {
    contact = user.msgs.get(msg.reply_to_message.message_id)?.contact;
  }

  if (!contact) return;

  let file = msg.audio || msg.video || (msg.photo && msg.photo[0]) || msg.voice || msg.document || msg.sticker;
  if (file && file.file_size <= 50 * 1024 * 1024) {
    let tries = 3;
    do {
      tries--;

      try {
        let url = `https://api.telegram.org/bot${token}/getFile?file_id=${file.file_id}`;
        let httpsAgent = httpProxy ? new HttpsProxyAgent(`http://${httpProxy.host}:${httpProxy.port}`) : undefined;
        let resp = await axios.get(url, { httpsAgent, proxy: false, timeout: 10 * 1000 });
        if (!resp.data || !resp.data.ok) return;

        let filePath = resp.data.result.file_path;
        url = `https://api.telegram.org/file/bot${token}/${filePath}`;
        let ext = path.extname(filePath);
        let distFile = tempfile(ext);
        if (ext === '.tgs') {
          await ctx.reply(lang.message.msgNotSupported);
          return;
        }

        await new Promise(async resolve => fs.writeFile(distFile, await download(url), () => resolve()));

        if (msg.sticker) {
          const pngfile = tempfile('.png');
          await sharp(distFile)
            .toFormat('png', { palette: true })
            .toFile(pngfile);

          distFile = pngfile;
        }

        await contact.say(FileBox.fromFile(distFile));
        if (msg.caption && msg.forward_from?.id !== bot.id) await contact.say(msg.caption);

        if (!user.contactLocked) user.currentContact = contact;

        MiscHelper.deleteFile(distFile);
        return;
      } catch (error) {
        const alert = HTMLTemplates.message({
          nickname: `[Bot Alert]`,
          message: tries > 0 ? lang.message.trySendingFile : lang.message.sendingFileFailed
        });

        await ctx.replyWithHTML(alert, { reply_to_message_id: msg.message_id });
        Logger.error(error.message);
      }
    } while (tries > 0);
  }

  if (msg.text) await contact.say(msg.text);
  if (!user.contactLocked) user.currentContact = contact;
};

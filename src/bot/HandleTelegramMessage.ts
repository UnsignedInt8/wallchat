import * as TT from 'telegraf/typings/telegram-types';

import { Contact, FileBox, Room } from 'wechaty';

import { BotOptions } from '../Bot';
import { Client } from '../Bot';
import { HttpsProxyAgent } from 'https-proxy-agent';
import Logger from '../lib/Logger';
import MiscHelper from '../lib/MiscHelper';
import { TelegrafContext } from 'telegraf/typings/context';
import axios from 'axios';
import ce from 'command-exists';
import download from 'download';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import lang from '../strings';
import path from 'path';
import sharp from 'sharp';
import tempfile from 'tempfile';

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

  if (!contact) {
    ctx.reply(lang.message.noCurrentContact);
    return;
  }

  let file = msg.audio || msg.video || (msg.photo && msg.photo[0]) || msg.voice || msg.document || msg.sticker;
  if (file && file.file_size <= 50 * 1024 * 1024) {
    let tries = 3;

    do {
      tries--;

      try {
        let url = `https://api.telegram.org/bot${token}/getFile?file_id=${file.file_id}`;
        let httpsAgent = httpProxy ? new HttpsProxyAgent(`http://${httpProxy.host}:${httpProxy.port}`) : undefined;

        const proxyAxios = axios.create({ proxy: false, httpsAgent, httpAgent: httpsAgent, timeout: 10 * 1000 });
        let resp = await proxyAxios.get(url);
        if (!resp.data || !resp.data.ok) return;

        let filePath = resp.data.result.file_path;
        url = `https://api.telegram.org/file/bot${token}/${filePath}`;
        let ext = path.extname(filePath);
        let distFile = tempfile(ext);
        if (ext === '.tgs') {
          await ctx.reply(lang.message.msgNotSupported);
          return;
        }

        await new Promise<void>(async resolve => fs.writeFile(distFile, await download(url), () => resolve()));

        if (msg.sticker) {
          const pngfile = tempfile('.png');
          await sharp(distFile)
            .toFormat('png')
            .toFile(pngfile);

          distFile = pngfile;
        }

        if (msg.voice && ce.sync('ffmpeg')) {
          const outputFile = tempfile('.mp3');

          await new Promise<void>(resolve => {
            ffmpeg(distFile)
              .toFormat('mp3')
              .saveToFile(outputFile)
              .on('end', () => resolve());
          });

          distFile = outputFile;
        }

        await contact.say(FileBox.fromFile(distFile));
        if (msg.caption && msg.forward_from?.id !== bot.id) await contact.say(msg.caption);

        const name = contact instanceof Contact ? contact.name() : contact instanceof Room ? await contact.topic() : '';
        await ctx.reply(lang.message.sendingSucceed(name), { reply_to_message_id: msg.message_id });

        if (!user.contactLocked) user.currentContact = contact;

        MiscHelper.deleteFile(distFile);
        return;
      } catch (error) {
        if (tries > 0) continue;

        await ctx.reply(lang.message.sendingFileFailed, { reply_to_message_id: msg.message_id });
        Logger.error(error.message);
      }
    } while (tries > 0);
  }

  if (msg.text) await contact.say(msg.text);
  if (!user.contactLocked) user.currentContact = contact;
};

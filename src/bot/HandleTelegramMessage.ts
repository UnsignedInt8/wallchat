import * as TT from 'telegraf/typings/telegram-types';

import { Contact, Room } from 'wechaty';
import { Message, UserFromGetMe } from 'telegraf/typings/core/types/typegram';

import { BotOptions } from '../Bot';
import { Client } from '../Bot';
import { Context } from 'telegraf/typings/context';
import { FileBox } from 'file-box';
import { HttpsProxyAgent } from 'https-proxy-agent';
import Logger from '../lib/Logger';
import MiscHelper from '../lib/MiscHelper';
import { Telegraf } from 'telegraf';
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
  bot: UserFromGetMe;
}

export default async (
  ctx: Context,
  { token, httpProxy, bot }: IHandleTelegramMessage
) => {
  let msg = ctx.message as Message;
  let user = ctx['user'] as Client;

  if (
    (msg as Message.TextMessage).text &&
    (msg as Message.TextMessage).text.startsWith('/find')
  ) {
    return;
  }

  let contact = user.currentContact;
  if ((msg as Message.TextMessage).reply_to_message) {
    contact = user.msgs.get(
      (msg as Message.TextMessage).reply_to_message.message_id
    )?.contact;
  }

  if (!contact) {
    ctx.reply(lang.message.noCurrentContact);
    return;
  }

  let file =
    (msg as Message.AudioMessage).audio ||
    (msg as Message.VideoMessage).video ||
    ((msg as Message.PhotoMessage).photo &&
      (msg as Message.PhotoMessage).photo[0]) ||
    (msg as Message.VoiceMessage).voice ||
    (msg as Message.DocumentMessage).document ||
    (msg as Message.StickerMessage).sticker;
  if (file && file.file_size <= 50 * 1024 * 1024) {
    let tries = 3;

    do {
      tries--;

      try {
        let url = `https://api.telegram.org/bot${token}/getFile?file_id=${file.file_id}`;
        let httpsAgent = httpProxy
          ? new HttpsProxyAgent(`http://${httpProxy.host}:${httpProxy.port}`)
          : undefined;

        const proxyAxios = axios.create({
          proxy: false,
          httpsAgent,
          httpAgent: httpsAgent,
          timeout: 10 * 1000,
        });
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

        await new Promise<void>(async (resolve) =>
          fs.writeFile(distFile, await download(url), () => resolve())
        );

        if ((msg as Message.StickerMessage).sticker) {
          const pngfile = tempfile('.png');
          await sharp(distFile)
            .resize(20, undefined, {
              fit: 'cover',
              background: { r: 255, g: 255, b: 255, alpha: 0 },
            })
            .toFormat('png')
            .toFile(pngfile);

          distFile = pngfile;
        }

        if ((msg as Message.VoiceMessage).voice && ce.sync('ffmpeg')) {
          const outputFile = tempfile('.mp3');

          await new Promise<void>((resolve) => {
            ffmpeg(distFile)
              .toFormat('mp3')
              .saveToFile(outputFile)
              .on('end', () => resolve());
          });

          distFile = outputFile;
        }

        await contact.say(FileBox.fromFile(distFile));
        if (
          (msg as Message.CaptionableMessage).caption &&
          (msg as Message.TextMessage).forward_from?.id !== bot.id
        )
          await contact.say((msg as Message.CaptionableMessage).caption);

        const name =
          (contact as Contact)['name']?.() ||
          (await (contact as Room)['topic']?.()) ||
          '';

        await ctx.reply(lang.message.sendingSucceed(name), {
          reply_to_message_id: msg.message_id,
        });

        if (!user.contactLocked) user.currentContact = contact;

        MiscHelper.deleteFile(distFile);
        return;
      } catch (error) {
        if (tries > 0) continue;

        await ctx.reply(lang.message.sendingFileFailed, {
          reply_to_message_id: msg.message_id,
        });
        Logger.error(error.message);
      }
    } while (tries > 0);
  }

  if ((msg as Message.TextMessage).text) {
    await contact.say((msg as Message.TextMessage).text);
  }

  if (!user.contactLocked) user.currentContact = contact;
};

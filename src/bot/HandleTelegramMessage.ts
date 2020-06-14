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

export default async (ctx: TelegrafContext, { token, httpProxy }: BotOptions) => {
  let msg = ctx.message;
  let user = ctx['user'] as Client;
  if (msg.text && msg.text.startsWith('/find')) return;

  let contact = user.currentContact;
  if (msg.reply_to_message) {
    contact = user.msgs.get(msg.reply_to_message.message_id);
  }

  if (!contact) return;

  let file = msg.audio || msg.video || (msg.photo && msg.photo[0]) || msg.voice || msg.document;
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

        await new Promise(async resolve => fs.writeFile(distFile, await download(url), () => resolve()));

        await contact.say(FileBox.fromFile(distFile));
        if (!user.contactLocked) user.currentContact = contact;

        return;
      } catch (error) {
        await contact.say(tries > 0 ? lang.message.trySendingFile : lang.message.sendingFileFailed);
        Logger.error(error.message);
      }
    } while (tries > 0);
  }

  if (msg.text) await contact.say(msg.text);
  if (!user.contactLocked) user.currentContact = contact;
};

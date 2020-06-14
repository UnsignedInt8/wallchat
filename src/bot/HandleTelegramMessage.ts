import axios from 'axios';
import download from 'download';
import fs from 'fs';
import path from 'path';
import tempfile from 'tempfile';
import Logger from '../lib/Logger';
import { Client } from '../Bot';
import { TelegrafContext } from 'telegraf/typings/context';
import { FileBox } from 'wechaty';

export default async (ctx: TelegrafContext) => {
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

      await new Promise(async resolve => {
        fs.writeFile(distFile, await download(url), () => {
          resolve();
        });
      });

      // Not available on default puppet

      await contact.say(FileBox.fromFile(distFile));
    } catch (error) {
      Logger.error(error.message);
    }
    return;
  }

  if (msg.text) await contact.say(msg.text);
  if (!user.contactLocked) user.currentContact = contact;
};

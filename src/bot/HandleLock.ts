import Bot, { Client } from '../Bot';
import { Contact, Room } from 'wechaty';

import { Context } from 'telegraf/typings/context';
import { Message } from 'telegraf/typings/core/types/typegram';
import lang from '../strings';
import { writeFile } from './UpdateTmpFile';

export default async (ctx: Context) => {
  let user = ctx['user'] as Client;
  const msg = ctx.message as Message.TextMessage;

  if (!user.currentContact) {
    if (!msg?.reply_to_message) return;

    let wxmsg = user.msgs.get(msg.reply_to_message.message_id);
    if (!wxmsg) return;

    user.currentContact = wxmsg?.contact;
    user.contactLocked = false;
  }

  if (user.contactLocked) return;
  user.contactLocked = true;

  let name = '';
  let save = '';

  const alias = (await (user.currentContact as Contact)['alias']?.()) ?? '';
  name =
    (user.currentContact as Contact)['name']?.() ||
    (await (user.currentContact as Room)['topic']?.()) ||
    '';

  save = alias || name;
  name = alias ? `${name} (${alias})` : name;

  await writeFile(`${user.botId}${ctx?.chat?.id}`, {
    recentContact: { name: save, locked: true },
  });

  await ctx.reply(lang.message.contactLocked(name));
};

import Bot, { Client } from '../Bot';
import { Contact, Room } from 'wechaty';

import { Context } from 'telegraf/typings/context';
import { Message } from 'telegraf/typings/core/types/typegram';
import lang from '../strings';
import { writeFile } from './UpdateTmpFile';

export default async (ctx: Context) => {
  const msg = ctx.message as Message.TextMessage;
  const user = ctx['user'] as Client;

  if (!msg) return;

  if (!msg.reply_to_message && !user.currentContact) {
    await ctx.reply(lang.message.noQuoteMessage);
    return;
  }

  const id = ctx?.chat?.id;
  const wxmsg = user.msgs.get(msg.reply_to_message?.message_id)?.wxmsg;

  const room = wxmsg?.room() ?? user.currentContact;

  const name =
    (await (room as Room)['topic']?.()) || (room as Contact)['name']?.();

  if (user.soundOnlyList.includes(name)) {
    await ctx.reply(lang.message.soundOnlyRoom(name));
    return;
  }

  user.soundOnlyList.push(name);
  await ctx.reply(lang.message.soundOnlyRoom(name));
  await writeFile(`${user.botId}${id}`, { soundOnly: user.soundOnlyList });
};

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

  const id = ctx.chat.id;
  const wxmsg = user.msgs.get(msg.reply_to_message?.message_id)?.wxmsg;

  const room = wxmsg?.room?.();

  if (!room) return;

  const topic = await room.topic();

  const names = user.nameOnlyList[topic] || [];
  const onlyUser = wxmsg.talker().name();

  if (names.includes(onlyUser)) {
    ctx.reply('OK');
    return;
  }

  names.push(onlyUser);

  user.nameOnlyList[topic] = names;

  await ctx.reply(lang.message.nameOnly(onlyUser));
  await writeFile(`${user.botId}${id}`, { namesOnly: user.nameOnlyList });
};

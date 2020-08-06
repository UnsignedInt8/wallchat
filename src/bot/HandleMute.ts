import { TelegrafContext } from 'telegraf/typings/context';
import Bot, { Client } from '../Bot';
import lang from '../strings';
import { writeFile } from './UpdateTmpFile';
import { Room } from 'wechaty';

export default async (ctx: TelegrafContext) => {
  const msg = ctx.message;
  const user = ctx['user'] as Client;

  if (!msg) return;

  if (!msg.reply_to_message && !user.currentContact) {
    await ctx.reply(lang.message.noQuoteMessage);
    return;
  }

  const id = ctx.chat.id;
  const wxmsg = user.msgs.get(msg.reply_to_message?.message_id)?.wxmsg;

  const room = wxmsg?.room() ?? user.currentContact;
  const topic = room instanceof Room ? await room.topic() : room.name();
  if (user.muteList.includes(topic)) {
    await ctx.reply(lang.message.muteRoom(topic));
    return;
  }

  user.muteList.push(topic);
  await ctx.reply(lang.message.muteRoom(topic));
  await writeFile(`${user.botId}${id}`, { muteList: user.muteList });
};

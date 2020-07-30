import { TelegrafContext } from 'telegraf/typings/context';
import Bot, { Client } from '../Bot';
import lang from '../strings';
import { writeFile } from './UpdateTmpFile';

export default async (ctx: TelegrafContext) => {
  const msg = ctx.message;
  if (!msg) return;
  if (!msg.reply_to_message) {
    await ctx.reply(lang.message.noQuoteMessage);
    return;
  }

  const id = ctx.chat.id;
  const user = ctx['user'] as Client;

  const wxmsg = user.msgs.get(msg.reply_to_message.message_id)?.wxmsg;
  if (!wxmsg) return;

  const room = wxmsg.room();
  const topic = await room.topic();
  if (user.muteList.includes(topic)) {
    await ctx.reply(lang.message.muteRoom(topic));
    return;
  }

  user.muteList.push(topic);
  await ctx.reply(lang.message.muteRoom(topic));
  await writeFile(`${user.botId}${id}`, { muteList: user.muteList });
};

import { Client } from '../Bot';
import { Context } from 'telegraf/typings/context';
import { Message } from 'telegraf/typings/core/types/typegram';
import lang from '../strings';
import { writeFile } from './UpdateTmpFile';

export default async (ctx: Context) => {
  const msg = ctx.message as Message.TextMessage;
  if (!msg) return;

  const id = ctx.chat.id;
  const user = ctx['user'] as Client;

  let contents = msg.text.split(' ');
  contents.shift();

  let name = contents.reduce((p, c) => `${p} ${c}`, '').trim();

  if (name) {
    const index = user.muteList.indexOf(name);

    if (index === -1) {
      await ctx.reply(lang.message.contactNotFound);
      return;
    }

    user.muteList.splice(index, 1);
    await ctx.reply(lang.message.unmuteRoom(name));
  } else {
    await ctx.reply(lang.message.unmuteRoom(user.muteList));
    user.muteList = [];
  }

  await writeFile(`${user.botId}${id}`, { muteList: user.muteList });
};

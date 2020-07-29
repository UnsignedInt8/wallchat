import { TelegrafContext } from 'telegraf/typings/context';
import Bot, { Client } from '../Bot';
import lang from '../strings';
import { writeFile } from './UpdateTmpFile';

export default async (self: Bot, ctx: TelegrafContext) => {
  const msg = ctx.message;
  if (!msg) return;

  const id = ctx.chat.id;

  let contents = ctx.message.text.split(' ');
  contents.shift();

  let name = contents.reduce((p, c) => `${p} ${c}`, '').trim();

  if (name) {
    const index = self.muteList.indexOf(name);

    if (index === -1) {
      await ctx.reply(lang.message.contactNotFound);
      return;
    }

    self.muteList.splice(index, 1);
    await ctx.reply(lang.message.unmuteRoom(name));
  } else {
    await ctx.reply(lang.message.unmuteRoom(self.muteList));
    self.muteList = [];
  }

  await writeFile(`${self.id}${id}`, { muteList: self.muteList });
};

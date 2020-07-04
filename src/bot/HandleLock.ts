import { TelegrafContext } from 'telegraf/typings/context';
import Bot, { Client } from '../Bot';
import lang from '../strings';
import { Contact, Room } from 'wechaty';
import { writeFile } from './UpdateTmpFile';

export default async (self: Bot, ctx: TelegrafContext) => {
  let user = ctx['user'] as Client;
  if (!user.currentContact) return;
  if (user.contactLocked) return;
  user.contactLocked = true;

  let name = '';
  let save = '';
  if (user.currentContact instanceof Contact) {
    const alias = await user.currentContact.alias();
    save = name = user.currentContact.name();
    name = alias ? `${name} (${alias})` : name;
  } else if (user.currentContact instanceof Room) {
    save = name = await user.currentContact.topic();
  }

  await writeFile(`${self.id}${ctx.chat.id}`, { recentContact: { name: save, locked: true } });

  await ctx.reply(lang.message.contactLocked(name));
};

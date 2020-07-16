import { TelegrafContext } from 'telegraf/typings/context';
import Bot, { Client } from '../Bot';
import lang from '../strings';
import { Contact, Room } from 'wechaty';
import { writeFile } from './UpdateTmpFile';

export default async (self: Bot, ctx: TelegrafContext) => {
  let user = ctx['user'] as Client;
  if (!user.currentContact) return;
  if (!user.contactLocked) return;
  user.contactLocked = false;

  let name = '';
  if (user.currentContact instanceof Contact) {
    name = user.currentContact.name();
  } else if (user.currentContact instanceof Room) {
    name = await user.currentContact.topic();
  }

  await writeFile(`${self.id}${ctx.chat.id}`, { recentContact: { name, locked: false } });

  ctx.reply(lang.message.contactUnlocked(name));
};

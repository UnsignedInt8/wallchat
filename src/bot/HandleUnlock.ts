import { TelegrafContext } from 'telegraf/typings/context';
import { Client } from '../Bot';
import lang from '../strings';
import { Contact, Room } from 'wechaty';

export default async (ctx: TelegrafContext) => {
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

  ctx.reply(lang.message.contactUnlocked(name));
};

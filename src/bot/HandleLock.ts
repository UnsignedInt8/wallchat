import { TelegrafContext } from 'telegraf/typings/context';
import { Client } from '../Bot';
import lang from '../strings';
import { Contact } from 'wechaty';

export default async (ctx: TelegrafContext) => {
  let user = ctx['user'] as Client;
  if (!user.currentContact) return;
  if (user.contactLocked) return;
  user.contactLocked = true;
  ctx.reply(lang.message.contactLocked((user.currentContact as Contact).name()));
};

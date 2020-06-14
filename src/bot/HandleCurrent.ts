import { TelegrafContext } from 'telegraf/typings/context';
import { Client } from '../Bot';
import lang from '../strings';
import { Contact, Room } from 'wechaty';

export default async (ctx: TelegrafContext) => {
  let user = ctx['user'] as Client;
  if (!user.currentContact) {
    ctx.reply(lang.message.noCurrentContact);
    return;
  }

  let name: string;
  try {
    name = (user.currentContact as Contact).name();
  } catch (error) {
    name = await (user.currentContact as Room).topic();
  }

  let info = user.contactLocked ? ` [${lang.message.contactLocked('').trim()}]` : '';

  ctx.reply(lang.message.current(name) + info);
};

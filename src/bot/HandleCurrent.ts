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

  let name = '';
  if (user.currentContact instanceof Contact) {
    const alias = await user.currentContact.alias();
    name = user.currentContact.name();
    name = alias ? `${name} (${alias})` : name;
  } else if (user.currentContact instanceof Room) {
    name = await user.currentContact.topic();
  }

  let info = user.contactLocked ? ` [${lang.message.contactLocked('').trim()}]` : '';

  const sent = await ctx.reply(lang.message.current(name) + info);
  user.msgs.set(sent.message_id, { contact: user.currentContact, wxmsg: undefined });
};

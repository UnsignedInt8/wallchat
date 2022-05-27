import { Contact, Room } from 'wechaty';

import { Client } from '../Bot';
import { Context } from 'telegraf/typings/context';
import lang from '../strings';

export default async (ctx: Context) => {
  let user = ctx['user'] as Client;
  if (!user.currentContact) {
    ctx.reply(lang.message.noCurrentContact);
    return;
  }

  let name = '';

  const alias = (await (user.currentContact as Contact)['alias']?.()) ?? '';
  name =
    (await (user.currentContact as Contact)['name']?.()) ||
    (await (user.currentContact as Room)['topic']?.()) ||
    '';

  name = alias ? `${name} (${alias})` : name;

  let info = user.contactLocked
    ? ` [${lang.message.contactLocked('').trim()}]`
    : '';

  const sent = await ctx.reply(lang.message.current(name) + info);
  user.msgs.set(sent.message_id, {
    contact: user.currentContact,
    wxmsg: undefined,
  });
};

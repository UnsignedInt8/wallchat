import { Contact, Room, Wechaty } from 'wechaty';

import Bot from '../Bot';
import { Client } from '../Bot';
import { Context } from 'telegraf/typings/context';
import Logger from '../lib/Logger';
import { Message } from 'telegraf/typings/core/types/typegram';
import lang from '../strings';
import { writeFile } from './UpdateTmpFile';

export default async (self: Bot, ctx: Context, next: Function) => {
  let contents = (ctx.message as Message.TextMessage).text.split(' ');
  contents.shift();

  let name = contents.reduce((p, c) => `${p} ${c}`, '').trim();
  if (!name) {
    ctx.reply(lang.commands.find);
    return;
  }

  name = name.trim();

  let user = ctx['user'] as Client;
  const { found, foundName } = await findContact(name, user.wechat);

  if (!found) {
    ctx.reply(lang.message.contactNotFound);
    return;
  }

  let info = user.contactLocked
    ? ` [${lang.message.contactLocked('').trim()}]`
    : '';

  let sent = await ctx.reply(lang.message.contactFound(`${foundName}`) + info);

  user.currentContact = found;

  user.msgs.set(sent.message_id, { contact: found, wxmsg: undefined });

  const wname =
    (found as Contact)['name']?.() || (await (found as Room)['topic']?.());

  await writeFile(`${self.id}${ctx?.chat?.id}`, {
    recentContact: { name: wname, locked: user.contactLocked },
  });

  if (next) next();
};

export async function findContact(query: string, wechat: Wechaty) {
  const regexp = new RegExp(query, 'ig');

  let found: Contact | Room | undefined;
  let foundName = '';
  try {
    found =
      (await wechat?.Contact.find({ alias: regexp })) ||
      (await wechat?.Contact.find({ name: regexp }));

    const alias = await found?.alias();
    foundName = alias ? `${found?.name()} (${alias})` : found?.name();
  } catch (error) {
    Logger.error(error.message);
    return { found, foundName };
  }

  if (!found) {
    found = await wechat?.Room.find({ topic: regexp });
    foundName = await found?.topic();
  }

  if (!found) {
    return { found, foundName };
  }

  return { found, foundName };
}

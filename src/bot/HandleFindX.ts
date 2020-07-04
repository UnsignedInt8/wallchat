import { TelegrafContext } from 'telegraf/typings/context';
import { Client } from '../Bot';
import lang from '../strings';
import { Contact, Room, Wechaty } from 'wechaty';
import Logger from '../lib/Logger';
import { writeFile } from './UpdateTmpFile';
import Bot from '../Bot';

export default async (self: Bot, ctx: TelegrafContext, next: Function) => {
  let contents = ctx.message.text.split(' ');
  contents.shift();

  let name = contents.reduce((p, c) => `${p} ${c}`, '').trim();
  if (!name) {
    ctx.reply(lang.commands.find);
    return;
  }

  name = name.trim();

  let user = ctx['user'] as Client;
  const { found, foundName } = await findContact(name, user.wechat);

  // const regexp = new RegExp(name, 'ig');

  // let found: Contact | Room | undefined;
  // let foundName = '';
  // try {
  //   found = (await user.wechat?.Contact.find({ name: regexp })) || (await user.wechat?.Contact.find({ alias: regexp }));

  //   const alias = await found?.alias();
  //   foundName = alias ? `${found?.name()} (${alias})` : found?.name();
  // } catch (error) {
  //   Logger.error(error.message);
  //   return;
  // }

  // if (!found) {
  //   found = await user.wechat?.Room.find({ topic: regexp });
  //   foundName = await found?.topic();
  // }

  if (!found) {
    ctx.reply(lang.message.contactNotFound);
    return;
  }

  let info = user.contactLocked ? ` [${lang.message.contactLocked('').trim()}]` : '';
  let sent = await ctx.reply(lang.message.contactFound(`${foundName}`) + info).catch();
  user.currentContact = found;

  user.msgs.set(sent.message_id, { contact: found, wxmsg: undefined });
  await writeFile(`${self.id}${ctx.chat.id}`, {
    recentContact: { name: (found as Contact)?.name() || (await (found as Room)?.topic()), locked: user.contactLocked }
  });

  if (next) next();
};

export async function findContact(query: string, wechat: Wechaty) {
  const regexp = new RegExp(query, 'ig');

  let found: Contact | Room | undefined;
  let foundName = '';
  try {
    found = (await wechat?.Contact.find({ name: regexp })) || (await wechat?.Contact.find({ alias: regexp }));

    const alias = await found?.alias();
    foundName = alias ? `${found?.name()} (${alias})` : found?.name();
  } catch (error) {
    Logger.error(error.message);
    return undefined;
  }

  if (!found) {
    found = await wechat?.Room.find({ topic: regexp });
    foundName = await found?.topic();
  }

  if (!found) {
    return undefined;
  }

  return { found, foundName };
}

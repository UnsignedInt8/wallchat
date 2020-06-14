import { TelegrafContext } from 'telegraf/typings/context';
import { Client } from '../Bot';
import lang from '../strings';
import { Contact, Room } from 'wechaty';
import Logger from '../lib/Logger';

export default async (ctx: TelegrafContext, next: Function) => {
  let contents = ctx.message.text.split(' ');
  contents.shift();

  let name = contents.reduce((p, c) => `${p} ${c}`, '');
  if (!name) {
    ctx.reply(lang.commands.find);
    return;
  }

  name = name.trim();
  const regexp = new RegExp(name, 'ig');
  let user = ctx['user'] as Client;

  let found: Contact | Room | undefined;
  let foundName = '';
  try {
    found = (await user.wechat?.Contact.find({ name: regexp })) || (await user.wechat?.Contact.find({ alias: regexp }));

    const alias = await found?.alias();
    foundName = alias ? `${found?.name()} (${alias})` : found?.name();
  } catch (error) {
    Logger.error(error.message);
    return;
  }

  if (!found) {
    found = await user.wechat?.Room.find({ topic: regexp });
    foundName = await found?.topic();
  }

  if (!found) {
    ctx.reply(lang.message.contactNotFound);
    return;
  }

  let info = user.contactLocked ? ` [${lang.message.contactLocked('').trim()}]` : '';
  await ctx.reply(lang.message.contactFound(`${foundName}`) + info).catch();
  user.currentContact = found;

  if (next) next();
};

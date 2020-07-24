import { TelegrafContext } from 'telegraf/typings/context';
import Bot, { Client } from '../Bot';
import lang from '../strings';
import { Contact, Room } from 'wechaty';
import { writeFile } from './UpdateTmpFile';
import MiscHelper from '../lib/MiscHelper';

export default async (self: Bot, ctx: TelegrafContext) => {
  let user = ctx['user'] as Client;
  if (!user.currentContact) return;
  if (!user.contactLocked) return;
  user.contactLocked = false;

  const name = await MiscHelper.getFriendlyName(user.currentContact);

  await writeFile(`${self.id}${ctx.chat.id}`, { recentContact: { name, locked: false } });

  ctx.reply(lang.message.contactUnlocked(name));
};

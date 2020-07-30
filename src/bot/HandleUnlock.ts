import { TelegrafContext } from 'telegraf/typings/context';
import { Client } from '../Bot';
import lang from '../strings';
import { writeFile } from './UpdateTmpFile';
import MiscHelper from '../lib/MiscHelper';

export default async (ctx: TelegrafContext) => {
  let user = ctx['user'] as Client;
  if (!user.currentContact) return;
  if (!user.contactLocked) return;
  user.contactLocked = false;

  const name = await MiscHelper.getFriendlyName(user.currentContact);

  await writeFile(`${user.botId}${ctx.chat.id}`, { recentContact: { name, locked: false } });

  ctx.reply(lang.message.contactUnlocked(name));
};

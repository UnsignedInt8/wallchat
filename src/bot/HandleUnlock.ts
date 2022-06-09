import { Client } from '../Bot';
import { Context } from 'telegraf/typings/context';
import MiscHelper from '../lib/MiscHelper';
import lang from '../strings';
import { writeFile } from './UpdateTmpFile';

export default async (ctx: Context) => {
  let user = ctx['user'] as Client;
  if (!user.currentContact) return;
  if (!user.contactLocked) return;
  user.contactLocked = false;

  const name = await MiscHelper.getFriendlyName(user.currentContact);

  await writeFile(`${user.botId}${ctx?.chat?.id}`, {
    recentContact: { name, locked: false },
  });

  ctx.reply(lang.message.contactUnlocked(name));
};

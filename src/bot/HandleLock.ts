import { TelegrafContext } from 'telegraf/typings/context';
import Bot, { Client } from '../Bot';
import lang from '../strings';
import { Contact, Room } from 'wechaty';
import { writeFile } from './UpdateTmpFile';

export default async (ctx: TelegrafContext) => {
  let user = ctx['user'] as Client;
  if (!user.currentContact) {
    if (!ctx.message?.reply_to_message) return;

    let wxmsg = user.msgs.get(ctx.message.reply_to_message.message_id);
    if (!wxmsg) return;

    user.currentContact = wxmsg?.contact;
    user.contactLocked = false;
  }

  if (user.contactLocked) return;
  user.contactLocked = true;

  let name = '';
  let save = '';
  if (user.currentContact instanceof Contact) {
    const alias = await user.currentContact.alias();
    name = user.currentContact.name();
    save = alias || name;
    name = alias ? `${name} (${alias})` : name;
  } else if (user.currentContact instanceof Room) {
    save = name = await user.currentContact.topic();
  }

  await writeFile(`${user.botId}${ctx.chat.id}`, { recentContact: { name: save, locked: true } });

  await ctx.reply(lang.message.contactLocked(name));
};

import { Client } from '../Bot';
import { Context } from 'telegraf/typings/context';
import { Message } from 'telegraf/typings/core/types/typegram';
import MiscHelper from '../lib/MiscHelper';
import lang from '../strings';

export default async (ctx: Context) => {
  const msg = ctx.message as Message.TextMessage;
  if (!msg) return;
  if (!msg.reply_to_message) {
    await ctx.reply(lang.message.noQuoteMessage);
    return;
  }

  const contents = msg.text.split(' ');
  contents.shift();

  const to = contents.reduce((p, c) => `${p} ${c}`, '').trim();
  const user = ctx['user'] as Client;

  let target = user.currentContact;

  if (to) {
    const regexp = new RegExp(to, 'ig');
    target =
      (await user.wechat?.Contact.find({ name: regexp })) ||
      (await user.wechat?.Contact.find({ alias: regexp }));

    if (!target) {
      await ctx.reply(lang.message.contactNotFound);
      return;
    }
  }

  const wxmsg = user.msgs.get(msg.reply_to_message.message_id)?.wxmsg;
  if (!wxmsg) return;

  await wxmsg.forward(target);

  const name = await MiscHelper.getFriendlyName(target || user.currentContact);
  await ctx.reply(lang.message.msgForward(name), {
    reply_to_message_id: msg.reply_to_message.message_id,
  });
};

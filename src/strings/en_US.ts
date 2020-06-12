export default {
  welcome: `Welcome, I'm a wechat message transferring bot.`,
  login: {
    request: `I'm requesting Wechat Login QRCode for you, please wait a moment`,
    logined: (name: string) => `Congratulations! ${name} has logined`,
    logouted: (name: string) => `${name} has logouted`,
    retry: `Please scan the QRCode and try again`,
    bye: 'Bye',
  },
  message: {
    redpacket: 'A red packet',
    money: 'Transferred some money to you',
    contactNotFound: 'Contact not found',
    contactFound: (name: string) => `${name} is current contact`,
    contactLocked: (name: string) => `${name} is locked`,
    contactUnlocked: (name: string) => `${name} is unlocked`,
    noCurrentContact: `No current contact`,
    current: (name: string) => `Current contact: ${name}`,
    timeout: 'Login timeout, bye',
    error: 'Some errors happen, try again please',
    inviteRoom: (inviter: string, room: string) => `${inviter} invites you to join: ${room}`
  },
  commands: {
    find: '/find name|alias',
    agree: '/agree name',
    disagree: '/disagreee name'
  },
  help: `Command reference:
/start - Start bot
/login - Login Wechat
/logout - Logout Wechat
/groupon - Receive group messages
/groupoff - Stop receiving group messages
/officialon - Receive official account messages
/officialoff - Stop receiving official account messages
/selfon - Receive self messages
/selfoff - Stop receiving self messages
/texton - Just text message (default)
/textoff - Show you rich-type message
/find - Find a contact and set as current contact (Case sensitive) [/find name]
/lock - Lock current contact
/unlock - Unlock current contact
/findandlock - Find and lock contact (Case sensitive) [/find name]
/current - Show current contact
/agree - Agree with current friendship request
/disagree - Disagree with current friendship request
/help - Show this help page`
};

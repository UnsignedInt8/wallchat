export default {
    welcome: `Welcome, I'm a wechat message transferring bot.`,
    login: {
        request: `I'm requesting the Wechat QRCode for you, please wait a moment`,
        logined: (name: string) => `Congratulations! ${name} has logined`,
        logouted: (name: string) => `${name} has logouted`,
        retry: `Please scan the QRCode and try again`,
        bye: 'Bye',
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
/help - Show this help page`,
}
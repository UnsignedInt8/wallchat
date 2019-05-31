export default {
    welcome: {

    },
    login: {
        request: 'Bot is requesting Wechat QRCode, please wait a moment',
        logined: (name: string) => `Congratulations! ${name} has logined`,
        logouted: (name: string) => `${name} has logouted`,
    },
}
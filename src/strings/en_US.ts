export default {
    welcome: {

    },
    login: {
        request: `I'm requesting the Wechat QRCode for you, please wait a moment`,
        logined: (name: string) => `Congratulations! ${name} has logined`,
        logouted: (name: string) => `${name} has logouted`,
        retry: `Please scan the QRCode and try again`,
        bye: 'Bye',
    },
}
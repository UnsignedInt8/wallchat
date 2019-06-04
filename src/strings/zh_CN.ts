export default {
    welcome: `欢迎使用`,
    login: {
        request: `正在请求 WeChat 登录二维码，请稍等`,
        logined: (name: string) => `${name} 已经登陆`,
        logouted: (name: string) => `${name} 已登出`,
        retry: `请扫描二维码`,
        bye: 'Bye',
    },
    message: {
        redpacket: '发送了一个红包',
        money: '向你转了一笔账',
        contactNotFound: '未找到联系人',
        contactFound: (name: string) => `${name} 已是当前联系人`,
        contactLocked: (name: string) => `${name} 已锁定`,
        contactUnlocked: (name: string) => `${name} 已取消锁定`,
        noCurrentContact: '无当前联系人',
        current: (name: string) => `当前联系人 ${name}`,
        timeout: '登录超时，Bye',
    },
    help: `命令说明:
/start - 启动会话
/login - 请求登录
/logout - 登出WeChat
/groupon - 开启接收群消息
/groupoff - 关闭接收群消息
/officialon - 开启接收公众号消息（不推荐）
/officialoff - 关闭接收公众号消息
/selfon - 开启接收自己的消息
/selfoff - 关闭接收自己的消息
/texton - 启用文本模式
/textoff - 关闭文本模式（需要服务器端支持） 
/find - 查找联系人并设置为当前联系人（区分大小写） [/find 昵称|备注]
/lock - 锁定当前联系人
/unlock - 取消锁定当前联系人
/findandlock - 查找并锁定为当前联系人（区分大小写） [/find 昵称|备注]
/current - 显示当前联系人
/help - 显示帮助`,
}
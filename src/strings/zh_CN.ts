export default {
  welcome: '欢迎使用',
  nowelcome: '不欢迎使用',
  login: {
    request: '正在请求 WeChat 登录二维码，请稍等',
    logined: (name: string) => `${name} 已经登录`,
    logouted: (name: string) => `${name} 已登出`,
    retry: '请扫描二维码',
    bye: 'Bye',
    sessionOK: '[会话恢复 🥳 消息引用已被重置]',
    sessionLost: '无法恢复微信会话，请重新登录 /login',
  },
  message: {
    redpacket: '发送了一个红包',
    money: '向你转了一笔账',
    noQuoteMessage: '请先引用一条微信消息',
    msgForward: (name: string) => `消息已转发给: ${name}`,
    contactNotFound: '未找到联系人',
    contactFound: (name: string) => `${name} 已是当前联系人`,
    contactLocked: (name: string) => `${name} 已锁定`,
    contactUnlocked: (name: string) => `${name} 已取消锁定`,
    noCurrentContact: '该消息无对应联系人',
    current: (name: string) => `当前联系人 ${name}`,
    notSupportedMsg: '向你发送了一条 Bot 不支持的消息',
    timeout: '登录超时，Bye',
    error: 'WeChat 遇到错误，请重试',
    inviteRoom: (inviter: string, room: string) =>
      `${inviter} 邀请你加入: ${room}`,
    trySendingFile: '文件发送失败，Bot 尝试重发......',
    sendingSucceed: (receipt?: string) =>
      `发送成功 🥳 ${receipt ? `[To: ${receipt}]` : ''}`,
    sendingFileFailed: '发送文件失败，墙太高了 🧱',
    msgNotSupported: '不支持发送该类型消息',
    muteRoom: (room: string) => `${room} 已静音`,
    soundOnlyRoom: (room: string) => `${room} 仅声音模式`,
    nameOnly: (user: string) => `仅 ${user} 模式`,
    unmuteRoom: (room?: string | string[]) =>
      `${room ? `${room} ` : '全部消息'}已启用`,
  },
  contact: {
    card: '联系人卡片',
    friend: '新好友申请',
    nickname: '昵称',
    gender: '性别',
    city: '城市',
    province: '省份',
    wechatid: '微信号',
    applying: '申请消息',
    1: '男',
    2: '女',
    0: '未知',
  },
  commands: {
    find: '/find 昵称|备注',
    agree: '/agree 名称',
    disagree: '/disagreee 名称',
  },
  help: `命令说明:
/start - 启动会话
/login - 请求登录
/logout - 登出WeChat
/groupon - 开启接收群消息
/groupoff - 关闭接收群消息
/officialon - 开启接收公众号消息
/officialoff - 关闭接收公众号消息
/selfon - 开启接收自己的消息
/selfoff - 关闭接收自己的消息
/find - 查找并设置为当前联系人 [/find 昵称|备注]
/lock - 锁定当前联系人
/unlock - 取消锁定当前联系人
/findandlock - 查找并锁定为当前联系人 [/find 昵称|备注]
/current - 显示当前联系人
/agree - 同意好友请求 [/agree reqid]
/disagree - 忽略好友请求 [/disagree reqid]
/acceptroom - 接受群邀请
/help - 显示帮助`,
};

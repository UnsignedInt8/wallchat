# LeaveXChat

[![Powered by Wechaty](https://img.shields.io/badge/Powered%20By-Wechaty-blue.svg)](https://github.com/Wechaty/wechaty)

使用 Telegram Bot 接收 WeChat 文字、语音、图片、视频消息

## 安装准备

1. 安装 Node.js 10+  官网: https://nodejs.org
2. 访问 https://t.me/BotFather, 申请你的 `bot token`

## 快速开始

Linux 使用前需要安装如下依赖:

CentOS 7
```
yum install pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 ipa-gothic-fonts xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi xorg-x11-utils xorg-x11-fonts-cyrillic xorg-x11-fonts-Type1 xorg-x11-fonts-misc -y
```

Ubuntu
```
apt-get update && \ 
     apt-get install -yq --no-install-recommends \ 
     libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \ 
     libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \ 
     libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \ 
     libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \ 
     libnss3 
```

开始:

```bash
$> npm i -g leavexchat-bot
$> leavexchat-bot
$> 输入 token, Done!
```

由于中国用户无法直接访问 Telegram，所以需要在配置文件中指定 SOCKS5 代理:

```
$> leavexchat-bot -c ./config.json
```

`config.json` 请参照 [config-example.json](./config-example.json) 填写。

## 自行编译

```bash
$> git clone https://github.com/UnsignedInt8/leavexchat-bot.git  
$> cd leavexchat-bot  
$> npm i 
$> npm run build 
$> node build/main/index.js # 无需配置文件
$> 输入 token, Done!
```

```bash
# 使用配置文件方式
$> node build/main/index.js -c config.json
```

## 作者的用法

2.0 版本已经加入了 wechat **会话恢复**功能。要发挥该特性，就需要进程守护，推荐使用 forever

```
$> npm i -g forever

$> git clone https://github.com/UnsignedInt8/leavexchat-bot.git  
$> cd leavexchat-bot  
$> npm i 
$> npm run build 

$> forever build/main/index.js -c config.json
```

这样可以大幅降低扫码登录的频次

## Bot 命令

| 命令 | 说明 | 示例 |
|---|---|---|
|/start|启动会话|
|/login|请求登录|
|/logout|登出WeChat|
|/groupon|开启接收群消息|
|/groupoff|关闭接收群消息|
|/officialon|开启接收公众号消息|
|/officialoff|关闭接收公众号消息|
|/selfon|开启接收自己的消息|
|/selfoff|关闭接收自己的消息|
|/find|查找联系人并设置为当前联系人| /find ABC |
|/lock|锁定当前联系人|
|/unlock|取消锁定当前联系人|
|/findandlock|查找并锁定为当前联系人| /findandlock ABC |
|/current|显示当前联系人|
|/agree|同意好友请求| /agree [reqid] |
|/disagree|忽略好友请求| /disagree [reqid] |
|/help|显示帮助|

除了 `/find` 和 `/findandlock` 必须带有要查找的联系人名字，其它命令均可无参数

## 使用注意

1. 根据 Wechaty 说明，2017年6月之后注册的 Wechat 账号无法登陆网页版 Wechat，因此无法使用此 bot 代收消息

2. 为保证安全，bot 只会在自己的聊天记录保留最近 **200** 条消息 (默认 200)

3. 直接在 Telegram 里回复消息的对象**默认**是最近收到消息的发送者（个人或群），如果担心回复错了，请手动指定回复某条消息（最近 200 条以内）。可以手动 /lock /unlock 锁定当前联系人

4. 用于目前使用的 WeChat 的 web 版协议，因此**除了回复文字信息，图片、视频、语音等都暂时无法通过 bot 发送**

5. 如果使用VPS，WeChat 会检测到异地登陆，并发出提示。可以在本地运行该 bot，只需在配置文件里填写好 socks5 代理信息即可

## Telegram Bot 快捷命令支持

命令说明在[此处](./src/strings/BotFather.txt)，粘贴到 BotFather 中即可启用 Telegram Bot 输入框提示

## License

MPL-2.0

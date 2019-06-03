# LeaveXChat

使用 Telegram Bot 接收 WeChat 文字、语音、图片、视频消息

## 安装准备

1. 安装 Node.js 10+  官网: https://nodejs.org
2. 访问 https://t.me/BotFather, 申请你的 `bot token`

## 快速开始 -- 个人桌面端 

```bash
$> npm i -g leavexchat-bot
$> leavexchat-bot
$> 输入 token, Done!
```

## 快速开始 -- 服务器端

```bash
$> git clone https://github.com/UnsignedInt8/leavexchat-bot.git  
$> cd leavexchat-bot  
$> npm i 
$> npm run build 
$> node build/main/index.js 
$> 输入 token, Done!
```

```bash
# 使用配置文件方式
$> node build/main/index.js -c config.json
```

## 进阶使用

1. Clone 仓库
```bash
git clone https://github.com/UnsignedInt8/leavexchat-bot.git
```

2. 安装依赖并编译
```bash
cd leavexchat-bot
npm install
npm run build
```

3. 访问 [leavexchat-web-ui](https://github.com/UnsignedInt8/leavexchat-web-ui/), 该工程是用于将消息转化为图片发送。 编译后使用 http-server 运行 http 服务。记下 static 目录的绝对路径，并填写好配置文件，更多请访问[leavexchat-web-ui](https://github.com/UnsignedInt8/leavexchat-web-ui/)

4. 重命名 `config-example.json` 为 `config.json`，并配置好 token 与其它信息。在 `avatarDir` 中填写好 static 目录的绝对路径

5. 运行
```
node build/main/index.js -c config.json
```

## Bot 命令

| 命令 | 说明 |
|---|---|
|/start|启动会话|
|/login|请求登录|
|/logout|登出WeChat|
|/groupon|开启接收群消息|
|/groupoff|关闭接收群消息|
|/officialon|开启接收公众号消息（现在是鸡肋）|
|/officialoff|关闭接收公众号消息|
|/selfon|开启接收自己的消息|
|/selfoff|关闭接收自己的消息|
|/texton|启用文本模式（默认，推荐）|
|/textoff|关闭文本模式（需要服务器端支持）|
|/find|查找联系人并设置为最近联系人（区分大小写）|
|/lock|锁定最近联系人|
|/unlock|取消锁定最近联系人|
|/findandlock|查找并锁定联系人|
|/current|显示当前联系人|
|/help|显示帮助|

## 使用注意

1. 根据 Wechaty 说明，2017年6月之后注册的 Wechat 账号无法登陆网页版 Wechat，因此无法使用此 bot 代收消息

2. 为保证安全，bot 只会在自己的聊天记录保留最近 `300` 条消息 (默认 300)

3. 直接在 Telegram 里回复消息的对象是最近收到消息的发送者（个人或群），如果担心回复错了，请手动指定回复某条消息（最近 `300` 条以内）

4. 用于目前使用的 WeChat 的 web 版协议，因此**除了回复文字信息，图片、视频、语音等都暂时无法通过 bot 发送**

5. 如果使用VPS，WeChat 会检测到异地登陆，并发出提示。可以在本地运行该 bot，只需在配置文件里填写好 socks5 代理信息即可

## 服务器端的部署

##### CentOS 7

如果需要在 CentOS 7 部署，并启用 web-ui，就需要安装以下依赖

```
yum install pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 ipa-gothic-fonts xorg-x11-fonts-100dpi xorg-x11-fonts-75dpi xorg-x11-utils xorg-x11-fonts-cyrillic xorg-x11-fonts-Type1 xorg-x11-fonts-misc -y

# Fonts
https://medium.com/source-words/how-to-manually-install-update-and-uninstall-fonts-on-linux-a8d09a3853b0
```

##### Ubuntu 

如果需要在 Ubuntu 部署，并启用 web-ui，就需要安装以下依赖
```
sudo apt-get install gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

# Fonts
http://ubuntuhandbook.org/index.php/2016/05/manually-install-fonts-ubuntu-16-04/
```

## 感谢

感谢 [Wechaty](https://github.com/Chatie/wechaty/) 开源项目提供的底层支持

## License

MPL-2.0
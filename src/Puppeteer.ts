import takeScreenshot from "./lib/TakeScreenshot";

(async () => {
    let data = `n=特朗普·川普&s=Make America Great Again&m=[发送了一个表情，请在手机上查看]&a=kUuht00m_400x400.jpg`;
    data = Buffer.from(data, 'utf-8').toString('base64');
    const url = `http://localhost:8080/?$${data}`;
    await takeScreenshot({ url, savePath: 'element.png' });
    process.exit();
})();


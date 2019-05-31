import takeScreenshot from "./lib/TakeScreenshot";

(async () => {
    const url = 'http://localhost:3001/?n=%E7%89%B9%E6%9C%97%E6%99%AE%C2%B7%E5%B7%9D%E6%99%AE&s=%E5%AF%8C%E5%BC%BA%20%E6%B0%91%E4%B8%BB%20%E6%96%87%E6%98%8E%20%E5%92%8C%E8%B0%90%20%E8%87%AA%E7%94%B1%20%E5%B9%B3%E7%AD%89%20%E5%85%AC%E6%AD%A3%20%E6%B3%95%E6%B2%BB%20%E7%88%B1%E5%9B%BD%20%E6%95%AC%E4%B8%9A%20%E8%AF%9A%E4%BF%A1%20%E5%8F%8B%E5%96%84&m=每次微信收到消息，我们都可以得到一个消息变量，代表了我们收到的消息。消息类型可以为文字、图片、视频、链接分享、联系人等。';
    await takeScreenshot({ url, savePath: 'element.png' });
    process.exit();
})();


import puppeteer from 'puppeteer';

let browser: puppeteer.Browser;

export default async function takeScreenshot({ url, savePath }: { url: string, savePath?: string }) {
    if (!browser) browser = await puppeteer.launch({ args: ['--no-sandbox'] });

    const page = await browser.newPage();
    await page.setViewport({ width: 500, height: 1200, deviceScaleFactor: 3 });
    await page.goto(url);

    try {
        const result = await screenshotDOMElement(page, { selector: '#container', path: savePath });
        return result;
    } catch (error) {
        return Buffer.alloc(0);
    } finally {
        page.close();
    }
}

async function screenshotDOMElement(page: puppeteer.Page, opts: { padding?: number, path?: string, selector: string }) {
    const padding = 'padding' in opts ? opts.padding : 0;
    const path = 'path' in opts ? opts.path : null;
    const selector = opts.selector;

    if (!selector)
        throw Error('Please provide a selector.');

    const rect = await page.evaluate(selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const { x, y, width, height } = element.getBoundingClientRect();
        return { left: x, top: y, width, height, id: element.id };
    }, selector);

    if (!rect)
        throw Error(`Could not find element that matches selector: ${selector}.`);

    return await page.screenshot({
        type: 'png',
        path,
        clip: {
            x: rect.left - padding,
            y: rect.top - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2
        }
    });
}

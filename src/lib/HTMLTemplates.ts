export default class HTMLTemplates {

    static message({ nickname, message }: { nickname: string, message: string }) {
        const html = `<code>${nickname}</code>\n\n${message}`;
        return html;
    }

    static markdown({ nickname, content }: { nickname: string, content: string }) {
        return `\`${nickname}\`\n\n${content}`;
    }
}
export default class HTMLTemplates {

    static message({ nickname, message }: { nickname: string, message: string }) {
        const html = `<code>${nickname}</code>
----------
${message}`;
        return html;
    }
}
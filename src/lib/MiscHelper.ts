import * as fs from 'fs';
import got from 'got';

export default class MiscHelper {
    static async fileExists(path: string) {
        return new Promise<boolean>(resolve => {
            fs.exists(path, exists => resolve(exists));
        });
    }

    static async download(url: string, path: string) {
        return new Promise<boolean>(async resolve => {
            if (await this.fileExists(path)) resolve(true);
            got.stream(url).pipe(fs.createWriteStream(path)).end(resolve(true));
        });
    }

    static async deleteFile(path: string) {
        return new Promise(resolve => {
            fs.unlink(path, err => resolve());
        });
    }

}
import * as fs from 'fs';

export default class MiscHelper {
    static async fileExists(path: string) {
        return new Promise<boolean>(resolve => {
            fs.exists(path, exists => resolve(exists));
        });
    }
}
import * as fs from 'fs';
import got from 'got';
import touch from 'touch';
import tmpDir from 'temp-dir';
import path from 'path';
import { Room, Contact } from 'wechaty';

export default class MiscHelper {
  static async fileExists(path: string) {
    try {
      await fs.promises.stat(path);
      return true;
    } catch (error) {
      return false;
    }
  }

  static async download(url: string, path: string) {
    return new Promise<boolean>(async resolve => {
      if (await this.fileExists(path)) resolve(true);
      got
        .stream(url)
        .pipe(fs.createWriteStream(path))
        .end(resolve(true));
    });
  }

  static async deleteFile(path: string) {
    return new Promise<void>(resolve => fs.unlink(path, _ => resolve()));
  }

  static async createTmpFile(filename: string) {
    const filepath = path.join(tmpDir, filename);

    try {
      await touch(filepath);
    } catch (error) {}
  }

  static async listTmpFile(startsWith: string) {
    return new Promise<string[]>(resolve => {
      fs.readdir(tmpDir, (err, files) => {
        if (err) {
          resolve([]);
          return;
        }

        resolve(files.filter(f => f.startsWith(startsWith)));
      });
    });
  }

  static async deleteTmpFile(filename: string) {
    const filepath = path.join(tmpDir, filename);
    await this.deleteFile(filepath);
  }

  static async getFriendlyName(contact: Contact | Room) {
    if (contact instanceof Contact) {
      return contact.name();
    } else if (contact instanceof Room) {
      return await contact.topic();
    }

    return '';
  }
}

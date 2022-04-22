import fs from 'fs';
import path from 'path';
import tmpDir from 'temp-dir';

interface ITmpFile {
  recentContact?: { name: string; locked?: boolean };
  muteList?: string[];
  soundOnly?: string[];
}

/**
 *
 * @param filename botId.chatId
 * @param content
 */
export async function writeFile(filename: string, content: ITmpFile) {
  const filepath = path.join(tmpDir, filename);
  const origin = await readFile(filename);

  return new Promise<void>((resolve) => {
    fs.writeFile(
      filepath,
      JSON.stringify({ ...origin, ...content }),
      { encoding: 'utf8' },
      () => resolve()
    );
  });
}

export function readFile(filename: string) {
  const filepath = path.join(tmpDir, filename);

  return new Promise<ITmpFile>((resolve) => {
    fs.readFile(filepath, { encoding: 'utf8' }, (err, data) => {
      let content: ITmpFile = {};

      try {
        content = JSON.parse(data);
      } catch (error) {}

      resolve(content);
    });
  });
}

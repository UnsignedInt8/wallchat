import fs from 'fs';

interface ITmpFile {
  recentContact?: { name: string; locked?: boolean };
}

export function writeFile(path: string, content: ITmpFile) {
  return new Promise(resolve => {
    fs.writeFile(path, JSON.stringify(content), { encoding: 'utf8' }, () => resolve());
  });
}

export function readFile(path: string) {
  return new Promise<ITmpFile>(resolve => {
    fs.readFile(path, { encoding: 'utf8' }, (err, data) => {
      let content: ITmpFile = {};

      try {
        content = JSON.parse(data);
      } catch (error) {}

      resolve(content);
    });
  });
}

import dayjs from 'dayjs';

export default class Logger {
  static info(...msg: any[]) {
    this.log('info', ...msg);
  }

  static warn(...objs: any[]) {
    this.log('warn', ...objs);
  }

  static error(...objs: any[]) {
    this.log('error', ...objs);
  }

  static log(level: string, ...msg: any[]) {
    let info = msg.join(' ');
    console.log(`${dayjs().format('HH:mm:ss')} ${level.toUpperCase()} ${info}`);
  }
}

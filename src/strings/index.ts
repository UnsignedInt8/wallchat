import en_US from './en_US';
import zh_CN from './zh_CN';

export function getLang(lang = 'zh-cn') {
  return lang === 'zh-cn' ? zh_CN : en_US;
}

export default zh_CN;

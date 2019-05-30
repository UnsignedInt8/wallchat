import commander from 'commander';
import fs from 'fs';
import Bot from './Bot';

let program = commander
    .option('-c, --config <path>', 'Configruation File Path', String)
    .parse(process.argv);

let json = fs.readFileSync(program.config, { encoding: 'utf8' });
let { token, socks5Proxy } = JSON.parse(json);

new Bot({ token, socks5Proxy });
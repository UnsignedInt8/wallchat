import commander from 'commander';
import fs from 'fs';
import Bot from './Bot';

let program = commander
    .option('-c, --config <path>', 'Configruation File Path', String)
    .parse(process.argv);

let json = fs.readFileSync(program.config, { encoding: 'utf8' });
let config = JSON.parse(json);

let bot = new Bot(config);

process.on('SIGINT', async () => {
    await bot.exit();
    console.log('all users exited');
    process.exit();
});

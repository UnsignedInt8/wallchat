import commander from 'commander';
import fs from 'fs';
import Bot from './Bot';
import Logger from './lib/Logger';
import inquirer from 'inquirer';

let program = commander
    .option('-c, --config [path]', 'Configruation File Path', String)
    .parse(process.argv);

let bot: Bot;

if (program.config) {
    let json = fs.readFileSync(program.config, { encoding: 'utf8' });
    let config = JSON.parse(json);
    bot = new Bot(config);
} else {
    (async () => {
        let { token } = await inquirer.prompt({ name: 'token', message: 'Bot Token:', type: 'input', }) as { token: string };
        bot = new Bot({ token });
    })();
}

process.on('SIGINT', async () => {
    await bot.exit();
    Logger.info('all users exited');
    process.exit();
});

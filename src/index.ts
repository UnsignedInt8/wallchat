#!/usr/bin/env node

import commander from 'commander';
import fs from 'fs';
import Bot, { BotOptions } from './Bot';
import Logger from './lib/Logger';
import inquirer from 'inquirer';

// Called directly
if (require.main === module) {
  let program = commander.option('-c, --config [path]', 'Configruation File Path', String).parse(process.argv);

  let bot: Bot;

  if (program.config) {
    let json = fs.readFileSync(program.config, { encoding: 'utf8' });
    let config = JSON.parse(json);
    bot = new Bot(config);
    bot.launch();
  } else {
    (async () => {
      try {
        let { token } = (await inquirer.prompt({ name: 'token', message: 'Bot Token:', type: 'input' })) as { token: string };
        bot = new Bot({ token: token.trim() });
        bot.launch();
      } catch (error) {
        Logger.error(error.message);
        process.exit(1);
      }
    })();
  }

  const exit = process.exit;
  const hookExit: any = async (code?: number) => {
    Logger.error(`process.exit called with code: ${code}`);
    await bot.handleFatalError('SIGABRT');
    return exit(code);
  };

  process.exit = hookExit;

  //catches uncaught exceptions
  process.on('uncaughtException', bot.handleFatalError);
  process.on('unhandledRejection', bot.handleFatalError);

  // https://blog.heroku.com/best-practices-nodejs-errors
  process.once('beforeExit', bot.handleFatalError);

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', bot.handleFatalError);
  process.on('SIGUSR2', bot.handleFatalError);
}

export { Bot, Logger, BotOptions };

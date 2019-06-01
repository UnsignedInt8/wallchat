#! /bin/bash

rm -rf ./build
rm -rf ./leavexchat-bot
npm run build
mkdir leavexchat-bot
mv build leavexchat-bot
cp config-example.json package.json leavexchat-bot/ 
tar -czf leavexchat-bot.tar.gz ./leavexchat-bot

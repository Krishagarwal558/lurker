const {
  Client,
  GatewayIntentBits,
  Partials,
  Events
} = require('discord.js');

const config = require('./config');
const logger = require('./utils/logger');
require('./database/connection');

const readyEvent = require('./events/ready');
const messageCreateEvent = require('./events/messageCreate');

if (!config.discord.token) {
  logger.error('Missing DISCORD_TOKEN. Add it to your .env file.');
  process.exit(1);
}

if (!config.groq.apiKey) {
  logger.error('Missing GROQ_API_KEY. Add it to your .env file.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once(Events.ClientReady, (readyClient) => {
  readyEvent.execute(readyClient).catch((error) => {
    logger.error('Ready event failed:', error);
  });
});

client.on(Events.MessageCreate, (message) => {
  messageCreateEvent.execute(message).catch((error) => {
    logger.error('Message event failed:', error);
  });
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exitCode = 1;
});

client.login(config.discord.token).catch((error) => {
  logger.error('Discord login failed:', error);
  process.exit(1);
});

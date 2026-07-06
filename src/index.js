const {
  Client,
  GatewayIntentBits,
  Partials,
  Events
} = require('discord.js');

const config = require('./config');
const logger = require('./utils/logger');
const { startHealthServer } = require('./utils/healthServer');

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.MessageContent
];

if (config.bot.enablePresenceIntent) {
  intents.push(GatewayIntentBits.GuildPresences);
} else {
  logger.info('Presence intent disabled. Target Gremlin background checks will use recent chat activity.');
}

const client = new Client({
  intents,
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

startHealthServer(client);

async function startBot() {
  if (!config.discord.token) {
    logger.error('Missing DISCORD_TOKEN. Add it to your environment variables.');
    return;
  }

  if (!config.groq.apiKey) {
    logger.error('Missing GROQ_API_KEY. Add it to your environment variables.');
    return;
  }

  require('./database/connection');
  const readyEvent = require('./events/ready');
  const messageCreateEvent = require('./events/messageCreate');

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

  await client.login(config.discord.token);
}

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
});

startBot().catch((error) => {
  logger.error('Bot startup failed:', error);
});

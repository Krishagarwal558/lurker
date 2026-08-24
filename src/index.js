const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');

const config = require('./config');
const { getDatabase, closeDatabase } = require('./database/connection');
const readyEvent = require('./events/ready');
const messageCreateEvent = require('./events/messageCreate');
const interactionCreateEvent = require('./events/interactionCreate');
const { startDashboardServer } = require('./server/dashboardServer');
const logger = require('./utils/logger');

// Initialize database
getDatabase();

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMessageReactions
];

if (config.bot.enablePresenceIntent) {
  intents.push(GatewayIntentBits.GuildPresences);
}

const client = new Client({
  intents,
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User]
});

// Event Binding
client.once(Events.ClientReady, () => readyEvent.execute(client));
client.on(Events.MessageCreate, (message) => messageCreateEvent.execute(message));
client.on(Events.InteractionCreate, (interaction) => interactionCreateEvent.execute(interaction));

// Start Dashboard & Health Server
startDashboardServer(client);

// Connect to Discord
if (config.discord.token) {
  logger.info('Connecting Lurker v2 to Discord Gateway...');
  client.login(config.discord.token).catch((error) => {
    logger.error('Failed to log in to Discord:', error.message);
    logger.warn('Please check your DISCORD_TOKEN in .env');
  });
} else {
  logger.warn('No DISCORD_TOKEN found in .env. Running in Dashboard / Standalone Mode.');
}

// Graceful Shutdown
function handleShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    client.destroy();
  } catch {}
  closeDatabase();
  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = client;

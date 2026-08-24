const { ActivityType } = require('discord.js');

const { registerSlashCommands } = require('../commands/slashRegistry');
const { startChatReviver } = require('../utils/reviver');
const { startTargetGremlinWatcher } = require('../utils/targetGremlinWatcher');
const logger = require('../utils/logger');

async function execute(client) {
  logger.success(`Logged in as ${client.user.tag} (ID: ${client.user.id})`);

  // Set natural gamer / member status
  client.user.setPresence({
    activities: [
      {
        name: 'the chat flow',
        type: ActivityType.Watching
      }
    ],
    status: 'online'
  });

  // Deploy slash commands
  await registerSlashCommands(client);

  // Start background schedulers
  startChatReviver(client);
  startTargetGremlinWatcher(client);
}

module.exports = {
  execute
};

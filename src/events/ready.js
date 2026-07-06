const repositories = require('../database/repositories');
const logger = require('../utils/logger');
const { startChatReviver } = require('../utils/reviver');
const { startTargetGremlinWatcher } = require('../utils/targetGremlinWatcher');

async function execute(client) {
  for (const guild of client.guilds.cache.values()) {
    repositories.upsertGuild(guild);
  }

  logger.info(`Logged in as ${client.user.tag} in ${client.guilds.cache.size} guild(s).`);
  startChatReviver(client);
  startTargetGremlinWatcher(client);
}

module.exports = {
  execute
};

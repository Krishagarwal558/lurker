const config = require('../config');
const userCommands = require('./userCommands');
const { adminCommands } = require('./adminCommands');
const logger = require('../utils/logger');

const commands = new Map();

function registerCommand(cmd) {
  commands.set(cmd.name.toLowerCase(), cmd);
  if (Array.isArray(cmd.aliases)) {
    for (const alias of cmd.aliases) {
      commands.set(alias.toLowerCase(), cmd);
    }
  }
}

for (const cmd of userCommands) {
  registerCommand(cmd);
}

for (const cmd of adminCommands) {
  registerCommand(cmd);
}

function parseCommand(content, prefix = config.discord.prefix) {
  if (!content || !content.startsWith(prefix)) return null;
  const trimmed = content.slice(prefix.length).trim();
  if (!trimmed) return null;

  const [rawName, ...args] = trimmed.split(/\s+/);
  const commandName = rawName.toLowerCase();
  const command = commands.get(commandName);

  if (!command) return null;

  return {
    command,
    commandName,
    args
  };
}

async function handleCommand(message) {
  const parsed = parseCommand(message.content, config.discord.prefix);
  if (!parsed) return false;

  try {
    await parsed.command.execute({
      message,
      args: parsed.args,
      commandName: parsed.commandName
    });
    return true;
  } catch (error) {
    logger.error(`Error executing prefix command [${parsed.commandName}]:`, error);
    return false;
  }
}

module.exports = {
  commands,
  handleCommand,
  parseCommand
};

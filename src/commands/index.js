const config = require('../config');
const { safeReply } = require('../utils/discord');
const userCommands = require('./userCommands');
const { adminCommands } = require('./adminCommands');

const commands = new Map();

for (const command of [...userCommands, ...adminCommands]) {
  commands.set(command.name, command);
  for (const alias of command.aliases || []) {
    commands.set(alias, command);
  }
}

function parseCommand(content) {
  if (!content.startsWith(config.discord.prefix)) return null;
  const withoutPrefix = content.slice(config.discord.prefix.length).trim();
  if (!withoutPrefix) return null;

  const [commandName, ...args] = withoutPrefix.split(/\s+/);
  return {
    commandName: commandName.toLowerCase(),
    args
  };
}

async function handleCommand(message) {
  const parsed = parseCommand(message.content || '');
  if (!parsed) return false;

  const command = commands.get(parsed.commandName);
  if (!command) {
    await safeReply(message, `unknown command. try \`${config.discord.prefix}help\``);
    return true;
  }

  await command.execute({
    message,
    args: parsed.args,
    commandName: parsed.commandName
  });

  return true;
}

module.exports = {
  commands,
  handleCommand
};

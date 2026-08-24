const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');

const slashCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot responsiveness and WebSocket latency'),

  new SlashCommandBuilder()
    .setName('memory')
    .setDescription('Manage or inspect server memories')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View saved memories for a user')
        .addUserOption((opt) => opt.setName('user').setDescription('Target user (leave empty for yourself)'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('forget')
        .setDescription('Forget a memory by ID, text, or all')
        .addStringOption((opt) => opt.setName('target').setDescription('Memory ID, "all", or text keyword').setRequired(true))
        .addUserOption((opt) => opt.setName('user').setDescription('Target user (admins only)'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Explicitly add a memory')
        .addStringOption((opt) => opt.setName('text').setDescription('What Lurker should remember').setRequired(true))
        .addUserOption((opt) => opt.setName('user').setDescription('Target user'))
    ),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View message statistics and server chatter activity')
    .addUserOption((opt) => opt.setName('user').setDescription('Target user to inspect')),

  new SlashCommandBuilder()
    .setName('vibe')
    .setDescription('Perform an AI Vibe Check on yourself or another member')
    .addUserOption((opt) => opt.setName('user').setDescription('Target user')),

  new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Deliver a lighthearted, witty AI roast')
    .addUserOption((opt) => opt.setName('user').setDescription('Target user')),

  new SlashCommandBuilder()
    .setName('lore')
    .setDescription('Inspect or record server lore and running inside jokes')
    .addSubcommand((sub) =>
      sub.setName('view').setDescription('View saved server lore and memes')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Record a new piece of server lore')
        .addStringOption((opt) => opt.setName('title').setDescription('Title or meme name').setRequired(true))
        .addStringOption((opt) => opt.setName('story').setDescription('Details or quote').setRequired(true))
    ),

  new SlashCommandBuilder()
    .setName('hottake')
    .setDescription('Ignite an interactive hot take debate in chat with live voting buttons'),

  new SlashCommandBuilder()
    .setName('affinity')
    .setDescription('Check your relationship rapport and sentiment tag with Lurker')
    .addUserOption((opt) => opt.setName('user').setDescription('Target user')),

  new SlashCommandBuilder()
    .setName('personality')
    .setDescription('Inspect Lurker’s current active mood schedule and personality roulette'),

  new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Server administrator controls for Lurker')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('ai')
        .setDescription('Enable, disable, or inspect natural ambient AI chat')
        .addStringOption((opt) =>
          opt
            .setName('state')
            .setDescription('Desired AI state')
            .setRequired(true)
            .addChoices(
              { name: 'On', value: 'on' },
              { name: 'Off', value: 'off' },
              { name: 'Status', value: 'status' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('replychance')
        .setDescription('Adjust ambient reply sensitivity (e.g. 15% or 0.15)')
        .addStringOption((opt) => opt.setName('chance').setDescription('Percentage (e.g. 20%)').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('cooldown')
        .setDescription('Set channel or user message cooldown in seconds')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Target cooldown type')
            .setRequired(true)
            .addChoices(
              { name: 'Channel', value: 'channel' },
              { name: 'User', value: 'user' }
            )
        )
        .addIntegerOption((opt) => opt.setName('seconds').setDescription('Cooldown duration in seconds').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('blacklist')
        .setDescription('Block ambient talk in a channel')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' },
              { name: 'List', value: 'list' }
            )
        )
        .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to target'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('whitelist')
        .setDescription('Restrict ambient talk to specific whitelisted channels')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action')
            .setRequired(true)
            .addChoices(
              { name: 'Add', value: 'add' },
              { name: 'Remove', value: 'remove' },
              { name: 'Clear', value: 'clear' },
              { name: 'List', value: 'list' }
            )
        )
        .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to target'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('gremlin')
        .setDescription('Configure secret rivalry target gremlin mode')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action')
            .setRequired(true)
            .addChoices(
              { name: 'Set Target', value: 'set' },
              { name: 'Off', value: 'off' },
              { name: 'Status', value: 'status' }
            )
        )
        .addUserOption((opt) => opt.setName('user').setDescription('Target member'))
    )
];

async function registerSlashCommands(client) {
  try {
    const rawCommands = slashCommands.map((cmd) => cmd.toJSON());
    logger.info(`Deploying ${rawCommands.length} application (slash) commands to Discord...`);

    if (client.application) {
      await client.application.commands.set(rawCommands);
      logger.success(`Successfully registered ${rawCommands.length} global slash commands!`);
    }
  } catch (error) {
    logger.warn('Slash command registration note:', error.message);
  }
}

module.exports = {
  registerSlashCommands,
  slashCommands
};

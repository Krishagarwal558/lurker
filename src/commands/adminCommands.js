const { PermissionFlagsBits } = require('discord.js');

const repositories = require('../database/repositories');
const { safeReply } = require('../utils/discord');
const { parseChanceInput, percent } = require('../utils/text');

function isAdmin(member) {
  if (!member) return false;
  return member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild);
}

async function requireAdmin(message) {
  if (isAdmin(message.member)) return true;
  await safeReply(message, 'you need Manage Server for that');
  return false;
}

function selectedChannel(message) {
  return message.mentions.channels.first() || message.channel;
}

function formatChannelList(message, rows) {
  if (!rows.length) return 'none';
  return rows
    .map((row) => {
      const channel = message.guild.channels.cache.get(row.channel_id);
      return channel ? `<#${channel.id}>` : row.channel_id;
    })
    .join(', ');
}

const ai = {
  name: 'ai',
  aliases: ['enableai', 'disableai'],
  description: 'Enable, disable, or check natural chat.',
  async execute({ message, args, commandName }) {
    if (!(await requireAdmin(message))) return;

    let action = args[0]?.toLowerCase();
    if (commandName === 'enableai') action = 'on';
    if (commandName === 'disableai') action = 'off';

    if (!action || action === 'status') {
      const settings = repositories.getGuildSettings(message.guild.id);
      await safeReply(message, `natural chat is ${settings.aiEnabled ? 'on' : 'off'}`);
      return;
    }

    if (['on', 'enable', 'enabled', 'true'].includes(action)) {
      repositories.setGuildAiEnabled(message.guild.id, true);
      await safeReply(message, 'natural chat is on');
      return;
    }

    if (['off', 'disable', 'disabled', 'false'].includes(action)) {
      repositories.setGuildAiEnabled(message.guild.id, false);
      await safeReply(message, 'natural chat is off');
      return;
    }

    await safeReply(message, 'use `!ai on`, `!ai off`, or `!ai status`');
  }
};

const replyChance = {
  name: 'replychance',
  aliases: ['chance', 'replypercent'],
  description: 'Change ambient reply chance.',
  async execute({ message, args }) {
    if (!(await requireAdmin(message))) return;

    const chance = parseChanceInput(args[0]);
    if (chance === null) {
      await safeReply(message, 'use `!replychance 15%` or `!replychance 0.15`');
      return;
    }

    repositories.setReplyChance(message.guild.id, chance);
    await safeReply(message, `ambient reply chance is now ${percent(chance)}`);
  }
};

const cooldown = {
  name: 'cooldown',
  aliases: ['cooldowns'],
  description: 'Change channel or user cooldown.',
  async execute({ message, args }) {
    if (!(await requireAdmin(message))) return;

    const type = args[0]?.toLowerCase();
    const seconds = Number(args[1]);

    if (!['channel', 'user'].includes(type) || !Number.isFinite(seconds) || seconds < 0 || seconds > 3600) {
      await safeReply(message, 'use `!cooldown channel 60` or `!cooldown user 25`');
      return;
    }

    repositories.setCooldown(message.guild.id, type, Math.round(seconds));
    await safeReply(message, `${type} cooldown is now ${Math.round(seconds)}s`);
  }
};

const blacklist = {
  name: 'blacklist',
  aliases: ['blacklistchannel'],
  description: 'Block ambient chat in a channel.',
  async execute({ message, args }) {
    if (!(await requireAdmin(message))) return;

    const action = args[0]?.toLowerCase() || 'list';
    if (action === 'list') {
      const rows = repositories.listChannelsByFlag(message.guild.id, 'blacklisted');
      await safeReply(message, `blacklisted channels: ${formatChannelList(message, rows)}`);
      return;
    }

    const channel = selectedChannel(message);
    if (['add', 'on', 'enable', 'yes'].includes(action)) {
      repositories.setChannelBlacklist(message.guild.id, channel.id, true);
      await safeReply(message, `ambient chat blocked in <#${channel.id}>`);
      return;
    }

    if (['remove', 'off', 'disable', 'clear'].includes(action)) {
      repositories.setChannelBlacklist(message.guild.id, channel.id, false);
      await safeReply(message, `ambient chat allowed in <#${channel.id}>`);
      return;
    }

    await safeReply(message, 'use `!blacklist add #channel`, `!blacklist remove #channel`, or `!blacklist list`');
  }
};

const whitelist = {
  name: 'whitelist',
  aliases: ['whitelistchannel'],
  description: 'Limit ambient chat to chosen channels.',
  async execute({ message, args }) {
    if (!(await requireAdmin(message))) return;

    const action = args[0]?.toLowerCase() || 'list';
    if (action === 'list') {
      const rows = repositories.listChannelsByFlag(message.guild.id, 'whitelisted');
      await safeReply(message, `whitelisted channels: ${formatChannelList(message, rows)}`);
      return;
    }

    if (action === 'clear') {
      repositories.clearWhitelist(message.guild.id);
      await safeReply(message, 'whitelist cleared');
      return;
    }

    const channel = selectedChannel(message);
    if (['add', 'on', 'enable', 'yes'].includes(action)) {
      repositories.setChannelWhitelist(message.guild.id, channel.id, true);
      await safeReply(message, `ambient chat limited to include <#${channel.id}>`);
      return;
    }

    if (['remove', 'off', 'disable'].includes(action)) {
      repositories.setChannelWhitelist(message.guild.id, channel.id, false);
      await safeReply(message, `<#${channel.id}> removed from whitelist`);
      return;
    }

    await safeReply(message, 'use `!whitelist add #channel`, `!whitelist remove #channel`, `!whitelist clear`, or `!whitelist list`');
  }
};

module.exports = {
  adminCommands: [ai, replyChance, cooldown, blacklist, whitelist],
  isAdmin
};

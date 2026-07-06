const config = require('../config');
const repositories = require('../database/repositories');
const memoryService = require('../memory/memoryService');
const { currentMoodPersonality, listPersonalities, personalities } = require('../ai/personalities');
const { isAdmin } = require('./adminCommands');
const { safeReply } = require('../utils/discord');
const { percent } = require('../utils/text');

function mentionedOrAuthor(message) {
  const mentioned = message.mentions.users.find((user) => !user.bot);
  return mentioned || message.author;
}

function clipped(content) {
  return content.length > 1900 ? `${content.slice(0, 1890)}...` : content;
}

const ping = {
  name: 'ping',
  aliases: [],
  description: 'Check latency.',
  async execute({ message }) {
    const latency = Date.now() - message.createdTimestamp;
    await safeReply(message, `pong ${latency}ms`);
  }
};

const memory = {
  name: 'memory',
  aliases: ['memories'],
  description: 'Show saved memory.',
  async execute({ message }) {
    const target = mentionedOrAuthor(message);
    const rows = memoryService.userMemories(message.guild.id, target.id, 20);
    const name = target.id === message.author.id ? 'you' : target.username;
    await safeReply(message, clipped(`memory for ${name}:\n${memoryService.formatMemoryList(rows)}`));
  }
};

const stats = {
  name: 'stats',
  aliases: [],
  description: 'Show message stats.',
  async execute({ message }) {
    const target = mentionedOrAuthor(message);
    const userStats = repositories.getUserStats(message.guild.id, target.id);
    const guildStats = repositories.getGuildStats(message.guild.id);
    const name = target.id === message.author.id ? 'you' : target.username;

    await safeReply(message, [
      `stats for ${name}:`,
      `messages: ${userStats.totalMessages}`,
      `mentions: ${userStats.botMentions}`,
      `replies: ${userStats.botReplies}`,
      `reactions: ${userStats.botReactions}`,
      `server messages tracked: ${guildStats.totalMessages}`,
      `active users tracked: ${guildStats.activeUsers}`
    ].join('\n'));
  }
};

const forget = {
  name: 'forget',
  aliases: [],
  description: 'Forget a saved memory.',
  async execute({ message, args }) {
    const canModerate = isAdmin(message.member);
    const mentioned = message.mentions.users.find((user) => !user.bot);
    const cleanedArgs = args.filter((arg) => !/^<@!?\d+>$/.test(arg));

    if (!cleanedArgs.length) {
      await safeReply(message, 'use `!forget 12`, `!forget all`, or `!forget pizza`');
      return;
    }

    if (cleanedArgs[0].toLowerCase() === 'all') {
      const target = mentioned || message.author;
      const result = repositories.deleteAllMemoriesForUser({
        guildId: message.guild.id,
        userId: target.id,
        requesterId: message.author.id,
        canModerate
      });

      if (result.reason === 'forbidden') {
        await safeReply(message, 'you can only forget your own stuff');
        return;
      }

      await safeReply(message, `forgot ${result.deleted} memories`);
      return;
    }

    const maybeId = Number(cleanedArgs[0]);
    if (Number.isInteger(maybeId) && maybeId > 0) {
      const result = repositories.deleteMemoryById({
        guildId: message.guild.id,
        memoryId: maybeId,
        requesterId: message.author.id,
        canModerate
      });

      if (result.reason === 'missing') {
        await safeReply(message, 'could not find that memory');
        return;
      }

      if (result.reason === 'forbidden') {
        await safeReply(message, 'you can only forget your own stuff');
        return;
      }

      await safeReply(message, `forgot memory #${maybeId}`);
      return;
    }

    const text = cleanedArgs.join(' ').trim();
    const deleted = repositories.deleteMemoriesByText({
      guildId: message.guild.id,
      requesterId: message.author.id,
      text,
      canModerate
    });

    await safeReply(message, `forgot ${deleted} matching memories`);
  }
};

const personality = {
  name: 'personality',
  aliases: ['personalities'],
  description: 'Show personality weights.',
  async execute({ message }) {
    if (config.bot.personalityMode === 'mood') {
      const current = currentMoodPersonality();
      const lines = config.bot.moodSchedule.map((slot) => {
        const item = personalities[slot.personality];
        return `${slot.startHour}:00-${slot.endHour}:00 ${item?.label || slot.personality}`;
      });

      await safeReply(message, `current mood: ${current.label}\n${lines.join('\n')}`);
      return;
    }

    const totalWeight = Object.values(config.bot.personalityWeights)
      .reduce((sum, weight) => sum + weight, 0);

    const lines = listPersonalities().map((item) => {
      const weight = config.bot.personalityWeights[item.id] || 0;
      return `${item.label}: ${percent(weight / totalWeight)}`;
    });

    await safeReply(message, `personality roulette:\n${lines.join('\n')}`);
  }
};

const help = {
  name: 'help',
  aliases: ['commands'],
  description: 'Show commands.',
  async execute({ message }) {
    await safeReply(message, [
      'commands:',
      '`!memory [@user]`',
      '`!stats [@user]`',
      '`!forget <id|text|all>`',
      '`!ping`',
      '`!personality`',
      '`!help`',
      '',
      'admin:',
      '`!ai on|off|status`',
      '`!replychance 15%`',
      '`!cooldown channel 60`',
      '`!cooldown user 25`',
      '`!blacklist add|remove|list #channel`',
      '`!whitelist add|remove|clear|list #channel`',
      '`!gremlin @user|off|status`'
    ].join('\n'));
  }
};

module.exports = [
  memory,
  stats,
  forget,
  ping,
  personality,
  help
];

const config = require('../config');
const repositories = require('../database/repositories');
const memoryService = require('../memory/memoryService');
const affinityService = require('../memory/affinityService');
const loreGraphService = require('../memory/loreGraphService');
const hotTakeService = require('../memory/hotTakeService');
const responseGenerator = require('../ai/responseGenerator');
const { currentMoodPersonality, listPersonalities, personalities } = require('../ai/personalities');
const { isAdmin } = require('./adminCommands');
const { safeReply, safeSend, createEmbed, createHotTakeActionRow } = require('../utils/discord');
const { percent, cleanMessageContent } = require('../utils/text');

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
  description: 'Show saved memory for a user.',
  async execute({ message }) {
    const target = mentionedOrAuthor(message);
    const rows = memoryService.userMemories(message.guild.id, target.id, 20);
    const name = target.id === message.author.id ? 'you' : target.username;
    await safeReply(message, clipped(`memory for ${name}:\n${memoryService.formatMemoryList(rows)}`));
  }
};

const stats = {
  name: 'stats',
  aliases: ['userstats', 'serverstats'],
  description: 'Show message stats.',
  async execute({ message }) {
    const target = mentionedOrAuthor(message);
    const userStats = repositories.getUserStats(message.guild.id, target.id);
    const guildStats = repositories.getGuildStats(message.guild.id);
    const affinity = affinityService.getUserAffinity(message.guild.id, target.id);
    const name = target.id === message.author.id ? 'you' : target.username;

    await safeReply(message, [
      `📊 stats for ${name}:`,
      `messages: ${userStats.totalMessages}`,
      `mentions: ${userStats.botMentions}`,
      `replies: ${userStats.botReplies}`,
      `reactions: ${userStats.botReactions}`,
      `rapport / affinity: ${affinity.affinity_score > 0 ? '+' : ''}${affinity.affinity_score} (${affinity.sentiment_tag})`,
      '',
      `server totals: ${guildStats.totalMessages} messages tracked across ${guildStats.activeUsers} chatters`
    ].join('\n'));
  }
};

const forget = {
  name: 'forget',
  aliases: ['delete_memory'],
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
  aliases: ['personalities', 'mood'],
  description: 'Show personality weights and active mood.',
  async execute({ message }) {
    if (config.bot.personalityMode === 'mood') {
      const current = currentMoodPersonality();
      const lines = config.bot.moodSchedule.map((slot) => {
        const item = personalities[slot.personality];
        return `${slot.startHour}:00-${slot.endHour}:00: ${item?.label || slot.personality}`;
      });

      await safeReply(message, `🎭 current mood: **${current.label}**\n${lines.join('\n')}`);
      return;
    }

    const totalWeight = Object.values(config.bot.personalityWeights)
      .reduce((sum, weight) => sum + weight, 0);

    const lines = listPersonalities().map((item) => {
      const weight = config.bot.personalityWeights[item.id] || 0;
      return `${item.label}: ${percent(weight / totalWeight)}`;
    });

    await safeReply(message, `🎲 personality roulette:\n${lines.join('\n')}`);
  }
};

const vibe = {
  name: 'vibe',
  aliases: ['vibecheck'],
  description: 'Get an AI vibe check.',
  async execute({ message }) {
    const target = mentionedOrAuthor(message);
    const userStats = repositories.getUserStats(message.guild.id, target.id);
    const recentMessages = repositories.getRecentMessages(message.guild.id, message.channel.id, 10);
    const targetName = target.id === message.author.id ? 'you' : target.username;

    const evaluation = await responseGenerator.generateVibeCheck({
      botName: message.client.user.username,
      guildName: message.guild.name,
      targetName,
      recentMessages,
      stats: userStats
    });

    await safeReply(message, `✨ **Vibe Check on ${targetName}:**\n${evaluation}`);
  }
};

const roast = {
  name: 'roast',
  aliases: ['cook'],
  description: 'Playful AI roast.',
  async execute({ message }) {
    const target = mentionedOrAuthor(message);
    const targetName = target.id === message.author.id ? 'yourself' : target.username;
    const memories = repositories.getMemoriesForUser(message.guild.id, target.id, 8);
    const recentMessages = repositories.getRecentMessages(message.guild.id, message.channel.id, 10);

    const roastText = await responseGenerator.generateRoast({
      botName: message.client.user.username,
      guildName: message.guild.name,
      targetName,
      memories,
      recentMessages
    });

    await safeReply(message, roastText);
  }
};

const lore = {
  name: 'lore',
  aliases: ['serverlore'],
  description: 'View or add server lore and running jokes.',
  async execute({ message, args }) {
    if (args[0]?.toLowerCase() === 'add') {
      const content = args.slice(1).join(' ').trim();
      if (!content) {
        await safeReply(message, 'use `!lore add <title>: <story / joke>`');
        return;
      }
      const [title, ...rest] = content.split(':');
      const body = rest.join(':').trim() || title;
      const added = loreGraphService.addLore({
        guildId: message.guild.id,
        category: 'lore',
        title: title.slice(0, 50).trim(),
        content: body,
        createdBy: message.author.id
      });
      await safeReply(message, `📖 Saved to server lore: **${added.title}**`);
      return;
    }

    const loreList = loreGraphService.getRelevantLore(message.guild.id, 10);
    await safeReply(message, `📜 **Server Lore & Memes:**\n\n${loreGraphService.formatLoreList(loreList)}`);
  }
};

const hottake = {
  name: 'hottake',
  aliases: ['debate', 'take'],
  description: 'Trigger a spicy hot take debate with vote buttons.',
  async execute({ message }) {
    const recentMessages = repositories.getRecentMessages(message.guild.id, message.channel.id, 10);
    const result = hotTakeService.maybeStartHotTake({
      guildId: message.guild.id,
      channelId: message.channel.id,
      recentMessages
    }) || {
      topic: 'Coffee > Tea',
      stance: 'Coffee > Tea',
      opener: 'hot take but',
      content: 'hot take but\n\nCoffee > Tea'
    };

    const row = createHotTakeActionRow(result.topic);
    if (message.channel && typeof message.channel.send === 'function') {
      await message.channel.send({
        content: result.content,
        components: [row]
      });
    }
  }
};

const affinity = {
  name: 'affinity',
  aliases: ['rapport', 'friendship'],
  description: 'Check relationship affinity with Lurker.',
  async execute({ message }) {
    const target = mentionedOrAuthor(message);
    const aff = affinityService.getUserAffinity(message.guild.id, target.id);
    const name = target.id === message.author.id ? 'Your' : `${target.username}'s`;

    await safeReply(message, `🤝 ${name} Relationship: **${aff.sentiment_tag}** (Affinity Score: ${aff.affinity_score > 0 ? '+' : ''}${aff.affinity_score}, Interactions: ${aff.total_interactions})`);
  }
};

const help = {
  name: 'help',
  aliases: ['commands'],
  description: 'Show commands.',
  async execute({ message }) {
    await safeReply(message, [
      '🤖 **Lurker v2 Commands:**',
      '',
      '**User Commands:**',
      '`!memory [@user]` - View saved memories',
      '`!stats [@user]` - Message & affinity stats',
      '`!forget <id|all|text>` - Forget a memory',
      '`!affinity [@user]` - Check your rapport with Lurker',
      '`!vibe [@user]` - Run an AI vibe check',
      '`!roast [@user]` - Playful AI roast',
      '`!lore [add <title: desc>]` - View or record server lore',
      '`!hottake` - Start an interactive hot take debate',
      '`!personality` - View active mood & personality schedule',
      '`!ping` - Check bot response latency',
      '',
      '**Admin Commands (Manage Server required):**',
      '`!ai on|off|status` - Toggle ambient AI chatting',
      '`!replychance 15%` - Adjust ambient response sensitivity',
      '`!cooldown channel 60` - Channel rate limit',
      '`!cooldown user 25` - User rate limit',
      '`!blacklist add|remove|list #channel` - Block ambient talk in channel',
      '`!whitelist add|remove|clear|list #channel` - Restrict ambient talk to specific channels',
      '`!gremlin @user|off|status` - Secret rivalry target mode',
      '',
      '💡 *Lurker also supports modern Slash Commands! Type `/` to see all interactive commands.*'
    ].join('\n'));
  }
};

module.exports = [
  ping,
  memory,
  stats,
  forget,
  personality,
  vibe,
  roast,
  lore,
  hottake,
  affinity,
  help
];

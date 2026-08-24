const config = require('../config');
const repositories = require('../database/repositories');
const memoryService = require('../memory/memoryService');
const affinityService = require('../memory/affinityService');
const loreGraphService = require('../memory/loreGraphService');
const hotTakeService = require('../memory/hotTakeService');
const responseGenerator = require('../ai/responseGenerator');
const { currentMoodPersonality, listPersonalities, personalities } = require('../ai/personalities');
const { isAdmin, isOwnerOrAdmin } = require('../commands/adminCommands');
const { createHotTakeActionRow, safeReply } = require('../utils/discord');
const { parseChanceInput, percent } = require('../utils/text');
const logger = require('../utils/logger');

async function handleSlashCommand(interaction) {
  const { commandName, guild, user, member, channel } = interaction;
  if (!guild) {
    return interaction.reply({ content: 'Commands can only be used in servers.', ephemeral: true });
  }

  // 1. /ping
  if (commandName === 'ping') {
    const latency = Date.now() - interaction.createdTimestamp;
    return interaction.reply({ content: `🏓 Pong! Latency: \`${latency}ms\` | WebSocket: \`${interaction.client.ws.ping}ms\`` });
  }

  // 2. /memory
  if (commandName === 'memory') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'view') {
      const target = interaction.options.getUser('user') || user;
      const rows = memoryService.userMemories(guild.id, target.id, 20);
      const name = target.id === user.id ? 'your' : `${target.username}'s`;
      return interaction.reply({
        content: `🧠 **Saved memories for ${name}:**\n${memoryService.formatMemoryList(rows)}`,
        ephemeral: false
      });
    }

    if (sub === 'add') {
      const text = interaction.options.getString('text');
      const target = interaction.options.getUser('user') || user;
      const type = memoryService.classifyMemory(text);
      const saved = repositories.saveMemory({
        guildId: guild.id,
        userId: target.id,
        type,
        content: text,
        createdBy: user.id
      });
      return interaction.reply({ content: `✅ Saved memory #${saved.id} for <@${target.id}>: "${text}"` });
    }

    if (sub === 'forget') {
      const canModerate = isAdmin(member);
      const targetParam = interaction.options.getString('target');
      const targetUser = interaction.options.getUser('user') || user;

      if (targetParam.toLowerCase() === 'all') {
        const result = repositories.deleteAllMemoriesForUser({
          guildId: guild.id,
          userId: targetUser.id,
          requesterId: user.id,
          canModerate
        });
        if (result.reason === 'forbidden') {
          return interaction.reply({ content: 'You can only wipe your own memories.', ephemeral: true });
        }
        return interaction.reply({ content: `🧹 Wiped ${result.deleted} memories for <@${targetUser.id}>.` });
      }

      const maybeId = Number(targetParam);
      if (Number.isInteger(maybeId) && maybeId > 0) {
        const result = repositories.deleteMemoryById({
          guildId: guild.id,
          memoryId: maybeId,
          requesterId: user.id,
          canModerate
        });
        if (result.reason === 'missing') return interaction.reply({ content: 'Memory not found.', ephemeral: true });
        if (result.reason === 'forbidden') return interaction.reply({ content: 'You can only delete your own memories.', ephemeral: true });
        return interaction.reply({ content: `🗑️ Deleted memory #${maybeId}.` });
      }

      const deleted = repositories.deleteMemoriesByText({
        guildId: guild.id,
        requesterId: user.id,
        text: targetParam,
        canModerate
      });
      return interaction.reply({ content: `🗑️ Removed ${deleted} matching memories.` });
    }
  }

  // 3. /stats
  if (commandName === 'stats') {
    const target = interaction.options.getUser('user') || user;
    const userStats = repositories.getUserStats(guild.id, target.id);
    const guildStats = repositories.getGuildStats(guild.id);
    const aff = affinityService.getUserAffinity(guild.id, target.id);
    const name = target.id === user.id ? 'You' : target.username;

    return interaction.reply({
      content: [
        `📊 **Activity Stats for ${name}:**`,
        `• Messages Sent: **${userStats.totalMessages}**`,
        `• Bot Mentions: **${userStats.botMentions}**`,
        `• Bot Replies: **${userStats.botReplies}**`,
        `• Reactions: **${userStats.botReactions}**`,
        `• Rapport / Affinity: **${aff.affinity_score > 0 ? '+' : ''}${aff.affinity_score}** (${aff.sentiment_tag})`,
        '',
        `🌐 *Server Total: ${guildStats.totalMessages} messages from ${guildStats.activeUsers} tracked users.*`
      ].join('\n')
    });
  }

  // 4. /vibe
  if (commandName === 'vibe') {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || user;
    const userStats = repositories.getUserStats(guild.id, target.id);
    const recentMessages = repositories.getRecentMessages(guild.id, channel.id, 10);
    const targetName = target.id === user.id ? 'you' : target.username;

    const evaluation = await responseGenerator.generateVibeCheck({
      botName: interaction.client.user.username,
      guildName: guild.name,
      targetName,
      recentMessages,
      stats: userStats
    });

    return interaction.editReply({ content: `✨ **Vibe Check on ${target.username}:**\n${evaluation}` });
  }

  // 5. /roast
  if (commandName === 'roast') {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') || user;
    const targetName = target.id === user.id ? 'yourself' : target.username;
    const memories = repositories.getMemoriesForUser(guild.id, target.id, 8);
    const recentMessages = repositories.getRecentMessages(guild.id, channel.id, 10);

    const roastText = await responseGenerator.generateRoast({
      botName: interaction.client.user.username,
      guildName: guild.name,
      targetName,
      memories,
      recentMessages
    });

    return interaction.editReply({ content: roastText });
  }

  // 6. /lore
  if (commandName === 'lore') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'view') {
      const loreList = loreGraphService.getRelevantLore(guild.id, 10);
      return interaction.reply({ content: `📜 **Server Lore & Memes:**\n\n${loreGraphService.formatLoreList(loreList)}` });
    }

    if (sub === 'add') {
      const title = interaction.options.getString('title');
      const story = interaction.options.getString('story');
      const added = loreGraphService.addLore({
        guildId: guild.id,
        category: 'lore',
        title,
        content: story,
        createdBy: user.id
      });
      return interaction.reply({ content: `📖 **Recorded in Server Lore:** #${added.id} **${title}**` });
    }
  }

  // 7. /hottake
  if (commandName === 'hottake') {
    const recentMessages = repositories.getRecentMessages(guild.id, channel.id, 10);
    const result = hotTakeService.maybeStartHotTake({
      guildId: guild.id,
      channelId: channel.id,
      recentMessages
    }) || {
      topic: 'Coffee > Tea',
      stance: 'Coffee > Tea',
      opener: 'hot take but',
      content: 'hot take but\n\nCoffee > Tea'
    };

    const row = createHotTakeActionRow(result.topic);
    return interaction.reply({
      content: result.content,
      components: [row]
    });
  }

  // 8. /affinity
  if (commandName === 'affinity') {
    const target = interaction.options.getUser('user') || user;
    const aff = affinityService.getUserAffinity(guild.id, target.id);
    const name = target.id === user.id ? 'Your' : `${target.username}'s`;
    return interaction.reply({
      content: `🤝 **${name} Affinity Status:**\n• Relationship: **${aff.sentiment_tag}**\n• Score: **${aff.affinity_score > 0 ? '+' : ''}${aff.affinity_score}**\n• Total Interactions: **${aff.total_interactions}**`
    });
  }

  // 9. /personality
  if (commandName === 'personality') {
    if (config.bot.personalityMode === 'mood') {
      const current = currentMoodPersonality();
      const lines = config.bot.moodSchedule.map((slot) => {
        const item = personalities[slot.personality];
        return `• ${slot.startHour}:00-${slot.endHour}:00: **${item?.label || slot.personality}**`;
      });
      return interaction.reply({ content: `🎭 Current Mood: **${current.label}**\n\n**Schedule:**\n${lines.join('\n')}` });
    }

    const totalWeight = Object.values(config.bot.personalityWeights).reduce((sum, w) => sum + w, 0);
    const lines = listPersonalities().map((item) => {
      const weight = config.bot.personalityWeights[item.id] || 0;
      return `• ${item.label}: ${percent(weight / totalWeight)}`;
    });
    return interaction.reply({ content: `🎲 **Personality Roulette:**\n${lines.join('\n')}` });
  }

  // 10. /admin
  if (commandName === 'admin') {
    if (!isAdmin(member)) {
      return interaction.reply({ content: 'You need Manage Server permissions to run admin commands.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'ai') {
      const state = interaction.options.getString('state');
      if (state === 'status') {
        const settings = repositories.getGuildSettings(guild.id);
        return interaction.reply({ content: `Ambient AI chat is currently: **${settings.aiEnabled ? 'ENABLED' : 'DISABLED'}**` });
      }
      const enable = state === 'on';
      repositories.setGuildAiEnabled(guild.id, enable);
      return interaction.reply({ content: `Ambient AI chat is now **${enable ? 'ENABLED' : 'DISABLED'}**.` });
    }

    if (sub === 'replychance') {
      const chanceStr = interaction.options.getString('chance');
      const val = parseChanceInput(chanceStr);
      if (val === null) {
        return interaction.reply({ content: 'Invalid percentage. Use e.g. `15%` or `0.15`.', ephemeral: true });
      }
      repositories.setReplyChance(guild.id, val);
      return interaction.reply({ content: `Ambient reply sensitivity is now set to **${percent(val)}**.` });
    }

    if (sub === 'cooldown') {
      const type = interaction.options.getString('type');
      const seconds = interaction.options.getInteger('seconds');
      repositories.setCooldown(guild.id, type, seconds);
      return interaction.reply({ content: `**${type}** cooldown set to **${seconds}s**.` });
    }

    if (sub === 'blacklist') {
      const action = interaction.options.getString('action');
      const targetChan = interaction.options.getChannel('channel') || channel;

      if (action === 'list') {
        const rows = repositories.listChannelsByFlag(guild.id, 'blacklisted');
        const list = rows.length ? rows.map((r) => `<#${r.channel_id}>`).join(', ') : 'none';
        return interaction.reply({ content: `🚫 **Blacklisted Channels:** ${list}` });
      }

      const isAdd = action === 'add';
      repositories.setChannelBlacklist(guild.id, targetChan.id, isAdd);
      return interaction.reply({ content: `Channel <#${targetChan.id}> ambient chat is now **${isAdd ? 'BLOCKED' : 'ALLOWED'}**.` });
    }

    if (sub === 'whitelist') {
      const action = interaction.options.getString('action');
      const targetChan = interaction.options.getChannel('channel') || channel;

      if (action === 'list') {
        const rows = repositories.listChannelsByFlag(guild.id, 'whitelisted');
        const list = rows.length ? rows.map((r) => `<#${r.channel_id}>`).join(', ') : 'none';
        return interaction.reply({ content: `⭐ **Whitelisted Channels:** ${list}` });
      }

      if (action === 'clear') {
        repositories.clearWhitelist(guild.id);
        return interaction.reply({ content: 'Whitelist cleared. Ambient chat is allowed across all non-blacklisted channels.' });
      }

      const isAdd = action === 'add';
      repositories.setChannelWhitelist(guild.id, targetChan.id, isAdd);
      return interaction.reply({ content: `Channel <#${targetChan.id}> whitelist status: **${isAdd ? 'ADDED' : 'REMOVED'}**.` });
    }

    if (sub === 'gremlin') {
      if (!isOwnerOrAdmin(member, user.id)) {
        return interaction.reply({ content: 'Only Administrators or Bot Owner can configure Gremlin target.', ephemeral: true });
      }

      const action = interaction.options.getString('action');
      const targetUser = interaction.options.getUser('user');

      if (action === 'status') {
        const settings = repositories.getTargetGremlinSettings(guild.id);
        const daily = repositories.getTargetGremlinDaily(guild.id);
        const targetStr = settings.target_user_id ? `<@${settings.target_user_id}>` : 'None';
        return interaction.reply({
          content: `🎯 **Target Gremlin Status:**\n• Active Target: ${targetStr}\n• Mode: **${settings.enabled ? 'ON' : 'OFF'}**\n• Today's Roasts: **${daily.roast_count}/${config.bot.maxDailyRoasts}**\n• Mentions: **${daily.mention_count}/${config.bot.maxMentionsPerDay}**`
        });
      }

      if (action === 'off') {
        repositories.disableTargetGremlin(guild.id);
        return interaction.reply({ content: 'Target Gremlin mode has been disabled.' });
      }

      if (action === 'set') {
        if (!targetUser) return interaction.reply({ content: 'Please provide a target user.', ephemeral: true });
        repositories.setTargetGremlinTarget(guild.id, targetUser.id);
        return interaction.reply({ content: `🎯 Noted. <@${targetUser.id}> is now under active surveillance.` });
      }
    }
  }
}

async function handleButtonInteraction(interaction) {
  const { customId, guild, channel, user } = interaction;
  if (!customId.startsWith('hottake:')) return;

  const [, action, encodedTopic] = customId.split(':');
  const topic = decodeURIComponent(encodedTopic || '');

  const tally = hotTakeService.voteOnHotTake({
    guildId: guild.id,
    channelId: channel.id,
    topic,
    userId: user.id,
    voteType: action
  });

  const emoji = action === 'agree' ? '🟢' : action === 'disagree' ? '🔴' : '⚔️';
  await interaction.reply({
    content: `${emoji} You voted **${action.toUpperCase()}** on: *"${topic}"*\n📊 Current Votes: Agree: **${tally.agree || 0}** | Cap: **${tally.disagree || 0}** | Debating: **${tally.argue || 0}**`,
    ephemeral: true
  });
}

async function execute(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
    }
  } catch (error) {
    logger.error('Interaction handler error:', error);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: 'An unexpected error occurred while executing that interaction.', ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: 'An unexpected error occurred while executing that interaction.', ephemeral: true }).catch(() => {});
    }
  }
}

module.exports = {
  execute
};

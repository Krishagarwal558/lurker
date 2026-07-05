const cron = require('node-cron');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

const config = require('../config');
const repositories = require('../database/repositories');
const responseGenerator = require('../ai/responseGenerator');
const logger = require('./logger');
const { safeSend } = require('./discord');

let started = false;

function canSendIn(channel, member) {
  const permissions = channel.permissionsFor(member);
  return Boolean(permissions?.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages
  ]));
}

function isSupportedChannel(channel) {
  return channel?.isTextBased?.() &&
    [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type);
}

async function runReviver(client) {
  const now = Date.now();

  for (const guild of client.guilds.cache.values()) {
    const settings = repositories.getGuildSettings(guild.id);
    if (!settings.aiEnabled) continue;

    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me) continue;

    await guild.channels.fetch().catch(() => null);

    let sentInGuild = false;
    for (const channel of guild.channels.cache.values()) {
      if (sentInGuild) break;
      if (!isSupportedChannel(channel)) continue;
      if (!canSendIn(channel, me)) continue;
      if (!repositories.isAmbientChannelAllowed(guild.id, channel.id)) continue;

      const channelState = repositories.getChannelSettings(guild.id, channel.id);
      if (!channelState.lastActivityAt) {
        repositories.touchChannel(guild.id, channel.id);
        continue;
      }

      const inactiveMs = now - channelState.lastActivityAt;
      const targetMs = channelState.inactivityTargetMinutes * 60 * 1000;
      const reviverGapMs = config.bot.reviverMinGapMinutes * 60 * 1000;

      if (inactiveMs < targetMs) continue;
      if (channelState.lastReviverAt && now - channelState.lastReviverAt < reviverGapMs) continue;

      const recentStarters = repositories.getRecentStarters(guild.id, channel.id, 10);
      const starter = await responseGenerator.generateReviverStarter({
        botName: client.user.username,
        guildName: guild.name,
        channelName: channel.name,
        recentStarters
      });

      const sent = await safeSend(channel, starter);
      if (!sent) continue;

      repositories.addReviverStarter({
        guildId: guild.id,
        channelId: channel.id,
        starter
      });

      repositories.markChannelRevived(guild.id, channel.id, starter);
      repositories.addConversationMessage({
        guildId: guild.id,
        channelId: channel.id,
        userId: client.user.id,
        username: client.user.username,
        isBot: true,
        content: starter,
        messageId: sent.id,
        personality: 'reviver'
      });

      logger.info(`Revived #${channel.name} in ${guild.name}: ${starter}`);
      sentInGuild = true;
    }
  }
}

function startChatReviver(client) {
  if (started) return;
  started = true;

  cron.schedule(config.bot.reviverCron, () => {
    runReviver(client).catch((error) => {
      logger.error('Chat reviver failed:', error);
    });
  });

  logger.info(`Chat reviver scheduled: ${config.bot.reviverCron}`);
}

module.exports = {
  runReviver,
  startChatReviver
};

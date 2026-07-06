const { ChannelType, PermissionFlagsBits } = require('discord.js');

const config = require('../config');
const repositories = require('../database/repositories');
const responseGenerator = require('../ai/responseGenerator');
const targetGremlinService = require('../memory/targetGremlinService');
const logger = require('./logger');
const { safeSend, safeTyping } = require('./discord');

let started = false;
let timer = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function limitWords(content, maxWords) {
  const words = String(content || '').split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return content;
  return words.slice(0, maxWords).join(' ');
}

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

function triggerChanceFor(member, lastTargetMessage) {
  const now = Date.now();
  const recentlySpoke = lastTargetMessage &&
    now - lastTargetMessage.created_at <= 10 * 60 * 1000;

  if (recentlySpoke) return config.bot.recentMessageTriggerChance;
  if (!config.bot.enablePresenceIntent) {
    const somewhatRecent = lastTargetMessage &&
      now - lastTargetMessage.created_at <= 30 * 60 * 1000;

    return somewhatRecent ? config.bot.baseTriggerChance : 0;
  }

  const status = member.presence?.status;
  if (status === 'offline') return 0;
  if (status === 'online' || status === 'idle' || status === 'dnd') {
    return config.bot.onlineTriggerChance;
  }

  const somewhatRecent = lastTargetMessage &&
    now - lastTargetMessage.created_at <= 30 * 60 * 1000;

  return somewhatRecent ? config.bot.baseTriggerChance : 0;
}

async function chooseChannel(guild, member, lastTargetMessage) {
  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!me) return null;

  const candidates = [];
  if (lastTargetMessage?.channel_id) candidates.push(lastTargetMessage.channel_id);

  const active = repositories.getMostActiveRecentChannel(guild.id, Date.now() - 30 * 60 * 1000);
  if (active?.channel_id) candidates.push(active.channel_id);

  for (const channelId of [...new Set(candidates)]) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!isSupportedChannel(channel)) continue;
    if (!canSendIn(channel, me)) continue;
    if (!repositories.isAmbientChannelAllowed(guild.id, channel.id)) continue;
    return channel;
  }

  return null;
}

async function runTargetGremlinCheck(client) {
  if (!config.bot.enableTargetGremlin) return;
  const nextCheckAt = Date.now() + config.bot.checkIntervalMinutes * 60 * 1000;

  for (const guild of client.guilds.cache.values()) {
    repositories.setTargetGremlinNextCheck(guild.id, nextCheckAt);

    const settings = targetGremlinService.getSettings(guild.id);
    if (!settings.enabled || !settings.targetUserId) continue;
    if (!targetGremlinService.canRoast(guild.id, false)) continue;

    const member = await guild.members.fetch(settings.targetUserId).catch(() => null);
    if (!member) continue;

    const lastTargetMessage = repositories.getLastUserMessage(guild.id, settings.targetUserId);
    const probability = triggerChanceFor(member, lastTargetMessage);
    if (probability <= 0 || Math.random() >= probability) continue;

    const channel = await chooseChannel(guild, member, lastTargetMessage);
    if (!channel) continue;

    const action = targetGremlinService.createAction({
      guildId: guild.id,
      trigger: 'background',
      targetUserId: settings.targetUserId,
      targetName: member.displayName,
      allowMention: true
    });
    if (!action) continue;

    const recentMessages = repositories.getRecentMessages(
      guild.id,
      channel.id,
      config.bot.maxContextMessages
    );

    const fallback = targetGremlinService.fallbackContent(action);
    const generated = await responseGenerator.generateGremlinReply({
      botName: client.user.username,
      guildName: guild.name,
      channelName: channel.name || 'chat',
      targetName: member.displayName,
      trigger: action.trigger,
      template: action.template,
      currentMessage: '',
      recentMessages,
      mentionAllowed: action.mentionAllowed,
      targetMention: action.targetMention,
      maxWords: action.maxWords,
      fallback
    });
    const content = limitWords(generated, action.maxWords);

    await safeTyping(channel);
    await wait(1200);
    const sent = await safeSend(
      channel,
      content,
      action.mentionAllowed ? [action.targetUserId] : []
    );
    if (!sent) continue;

    targetGremlinService.recordAction(guild.id, action, true);
    repositories.addConversationMessage({
      guildId: guild.id,
      channelId: channel.id,
      userId: client.user.id,
      username: client.user.username,
      isBot: true,
      content,
      messageId: sent.id,
      personality: 'target_gremlin'
    });

    logger.info(`Target Gremlin fired in #${channel.name} for ${guild.name}`);
  }
}

function startTargetGremlinWatcher(client) {
  if (started) return;
  started = true;

  const intervalMs = config.bot.checkIntervalMinutes * 60 * 1000;
  timer = setInterval(() => {
    runTargetGremlinCheck(client).catch((error) => {
      logger.error('Target Gremlin check failed:', error);
    });
  }, intervalMs);

  const presenceNote = config.bot.enablePresenceIntent
    ? 'with presence checks'
    : 'using recent chat activity only';
  logger.info(`Target Gremlin scheduled every ${config.bot.checkIntervalMinutes} minute(s), ${presenceNote}.`);
}

module.exports = {
  runTargetGremlinCheck,
  startTargetGremlinWatcher
};

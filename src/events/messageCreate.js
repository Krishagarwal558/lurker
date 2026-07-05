const config = require('../config');
const repositories = require('../database/repositories');
const memoryService = require('../memory/memoryService');
const responseGenerator = require('../ai/responseGenerator');
const cooldowns = require('../utils/cooldowns');
const logger = require('../utils/logger');
const { handleCommand } = require('../commands');
const { chance, pick } = require('../utils/random');
const { cleanMessageContent } = require('../utils/text');
const { scoreConversation } = require('../utils/conversationScorer');
const { safeReact, safeReply, safeTyping } = require('../utils/discord');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typingDelay(content) {
  const estimated = (String(content || '').length / config.bot.typingCharsPerSecond) * 1000;
  return Math.min(config.bot.typingMaxMs, Math.max(config.bot.typingMinMs, estimated));
}

async function isReplyToBot(message) {
  const referencedId = message.reference?.messageId;
  if (!referencedId) return false;

  const cached = message.channel.messages.cache.get(referencedId);
  if (cached) return cached.author.id === message.client.user.id;

  const fetched = await message.channel.messages.fetch(referencedId).catch(() => null);
  return fetched?.author?.id === message.client.user.id;
}

function isBotMentioned(message) {
  const botId = message.client.user.id;
  return message.mentions.users.has(botId) || new RegExp(`<@!?${botId}>`).test(message.content || '');
}

function displayName(message) {
  return message.member?.displayName || message.author.globalName || message.author.username;
}

async function sendGeneratedReply({
  message,
  mentioned,
  repliedToBot,
  memorySaved,
  memoryAsked,
  recentMessages,
  decisionReasons = []
}) {
  const memories = memoryAsked
    ? memoryService.userMemories(message.guild.id, message.author.id, 20)
    : memoryService.relevantMemories(message.guild.id, message.author.id, 16);

  const contextMessages = recentMessages || repositories.getRecentMessages(
    message.guild.id,
    message.channel.id,
    config.bot.maxContextMessages
  );

  await safeTyping(message.channel);

  const result = await responseGenerator.generateChatReply({
    botName: message.client.user.username,
    guildName: message.guild.name,
    channelName: message.channel.name || 'chat',
    authorName: displayName(message),
    currentMessage: cleanMessageContent(message),
    recentMessages: contextMessages,
    memories,
    mentioned,
    repliedToBot,
    memorySaved,
    memoryAsked,
    decisionReasons
  });

  await sleep(typingDelay(result.content));
  const sent = await safeReply(message, result.content);
  if (!sent) return null;

  repositories.addConversationMessage({
    guildId: message.guild.id,
    channelId: message.channel.id,
    userId: message.client.user.id,
    username: message.client.user.username,
    isBot: true,
    content: result.content,
    messageId: sent.id,
    personality: result.personality.id
  });

  repositories.recordBotReply({
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channel.id
  });

  return sent;
}

async function sendEmojiOnlyReply({ message, recentMessages }) {
  await safeTyping(message.channel);

  const content = await responseGenerator.generateEmojiOnlyReply({
    botName: message.client.user.username,
    guildName: message.guild.name,
    channelName: message.channel.name || 'chat',
    currentMessage: cleanMessageContent(message),
    recentMessages
  });

  await sleep(typingDelay(content));
  const sent = await safeReply(message, content);
  if (!sent) return null;

  repositories.addConversationMessage({
    guildId: message.guild.id,
    channelId: message.channel.id,
    userId: message.client.user.id,
    username: message.client.user.username,
    isBot: true,
    content,
    messageId: sent.id,
    personality: 'emoji_only'
  });

  repositories.recordBotReply({
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channel.id
  });

  return sent;
}

async function execute(message) {
  if (!message.guild || message.author.bot) return;

  repositories.upsertGuild(message.guild);
  repositories.upsertUser(message.author, message.member);
  repositories.touchChannel(message.guild.id, message.channel.id);

  const mentioned = isBotMentioned(message);
  const repliedToBot = await isReplyToBot(message);

  repositories.recordUserMessage({
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channel.id,
    mentionedBot: mentioned
  });

  const handledCommand = await handleCommand(message);
  if (handledCommand) return;

  const cleanedContent = cleanMessageContent(message);
  repositories.addConversationMessage({
    guildId: message.guild.id,
    channelId: message.channel.id,
    userId: message.author.id,
    username: displayName(message),
    isBot: false,
    content: cleanedContent || '[non-text message]',
    messageId: message.id
  });

  const memoryResult = memoryService.saveMemoryFromMessage(message);
  const memoryAsked = memoryService.isAskingWhatRemember(cleanedContent);
  const forced = mentioned || repliedToBot || memoryResult.saved || memoryAsked;
  const guildSettings = repositories.getGuildSettings(message.guild.id);
  const ambientAllowed = repositories.isAmbientChannelAllowed(message.guild.id, message.channel.id);

  if (!guildSettings.aiEnabled) {
    if (forced) await safeReply(message, 'chat is paused here rn');
    return;
  }

  if (!forced && !ambientAllowed) return;

  const recentMessages = repositories.getRecentMessages(
    message.guild.id,
    message.channel.id,
    config.bot.maxContextMessages
  );
  let decisionReasons = [];

  if (!forced) {
    if (!cooldowns.canTalk(message.guild.id, message.channel.id, message.author.id, guildSettings)) {
      return;
    }

    const signals = repositories.getChannelConversationSignals(
      message.guild.id,
      message.channel.id,
      message.client.user.id
    );

    const botNames = [
      message.client.user.username,
      message.client.user.globalName,
      message.guild.members.me?.displayName
    ].filter(Boolean);

    const decision = scoreConversation({
      content: cleanedContent,
      message,
      recentMessages,
      signals,
      guildSettings,
      botNames
    });

    logger.debug(
      `Ambient score ${decision.score}/${decision.threshold} in #${message.channel.name}: ${decision.reasons.join(', ')}`
    );

    if (!decision.shouldReply) {
      if (decision.score > 0 && chance(config.bot.reactionChance)) {
        const emoji = pick(config.bot.reactionEmojis);
        const reacted = await safeReact(message, emoji);
        if (reacted) {
          cooldowns.markTalk(message.guild.id, message.channel.id, message.author.id, guildSettings);
          repositories.recordBotReaction({
            guildId: message.guild.id,
            userId: message.author.id,
            channelId: message.channel.id
          });
        }
      }
      return;
    }

    if (chance(config.bot.reactionChance)) {
      const emoji = pick(config.bot.reactionEmojis);
      const reacted = await safeReact(message, emoji);
      if (reacted) {
        cooldowns.markTalk(message.guild.id, message.channel.id, message.author.id, guildSettings);
        repositories.recordBotReaction({
          guildId: message.guild.id,
          userId: message.author.id,
          channelId: message.channel.id
        });
        return;
      }
    }

    if (chance(config.bot.emojiOnlyChance)) {
      try {
        await sendEmojiOnlyReply({ message, recentMessages });
        cooldowns.markTalk(message.guild.id, message.channel.id, message.author.id, guildSettings);
      } catch (error) {
        logger.error('Emoji-only reply failed:', error);
      }
      return;
    }

    decisionReasons = decision.reasons;
  }

  try {
    await sendGeneratedReply({
      message,
      mentioned,
      repliedToBot,
      memorySaved: memoryResult.saved,
      memoryAsked,
      recentMessages,
      decisionReasons
    });

    cooldowns.markTalk(message.guild.id, message.channel.id, message.author.id, guildSettings);
  } catch (error) {
    logger.error('Generated reply failed:', error);
    if (forced) {
      await safeReply(message, memoryResult.saved ? 'bet, remembered' : 'my brain lagged, say that again');
    }
  }
}

module.exports = {
  execute
};

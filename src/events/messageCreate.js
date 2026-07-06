const config = require('../config');
const repositories = require('../database/repositories');
const memoryService = require('../memory/memoryService');
const hotTakeService = require('../memory/hotTakeService');
const targetGremlinService = require('../memory/targetGremlinService');
const responseGenerator = require('../ai/responseGenerator');
const cooldowns = require('../utils/cooldowns');
const logger = require('../utils/logger');
const { handleCommand } = require('../commands');
const { chance, pick } = require('../utils/random');
const { cleanMessageContent } = require('../utils/text');
const { scoreConversation } = require('../utils/conversationScorer');
const { safeReact, safeReply, safeSend, safeTyping } = require('../utils/discord');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typingDelay(content) {
  const estimated = (String(content || '').length / config.bot.typingCharsPerSecond) * 1000;
  return Math.min(config.bot.typingMaxMs, Math.max(config.bot.typingMinMs, estimated));
}

function limitWords(content, maxWords) {
  const words = String(content || '').split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return content;
  return words.slice(0, maxWords).join(' ');
}

function withTimeout(promise, timeoutMs, label) {
  let settled = false;
  let timer;

  return new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      settled = true;
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) return;
        clearTimeout(timer);
        settled = true;
        resolve(value);
      })
      .catch((error) => {
        if (settled) {
          logger.warn(`${label} failed after timeout:`, error.message);
          return;
        }
        clearTimeout(timer);
        settled = true;
        reject(error);
      });
  });
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

function fallbackReplyContent({ memorySaved, memoryAsked }) {
  if (memorySaved) return 'bet, remembered';
  if (memoryAsked) return 'my brain lagged, ask again';
  return 'wait my brain froze, say that again';
}

function recordBotReplyMessage({ message, sent, content, personality }) {
  repositories.addConversationMessage({
    guildId: message.guild.id,
    channelId: message.channel.id,
    userId: message.client.user.id,
    username: message.client.user.username,
    isBot: true,
    content,
    messageId: sent.id,
    personality
  });

  repositories.recordBotReply({
    guildId: message.guild.id,
    userId: message.author.id,
    channelId: message.channel.id
  });
}

async function sendGeneratedReply({
  message,
  mentioned,
  repliedToBot,
  memorySaved,
  memoryAsked,
  activeHotTake,
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

  const result = await withTimeout(responseGenerator.generateChatReply({
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
    activeHotTake,
    decisionReasons
  }), config.bot.replyTimeoutMs, 'Groq reply generation');

  const content = activeHotTake ? limitWords(result.content, 15) : result.content;
  await sleep(typingDelay(content));
  const sent = await safeReply(message, content);
  if (!sent) return null;

  recordBotReplyMessage({
    message,
    sent,
    content,
    personality: result.personality.id
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

  recordBotReplyMessage({
    message,
    sent,
    content,
    personality: 'emoji_only'
  });

  return sent;
}

async function sendFallbackReply({ message, memorySaved, memoryAsked }) {
  const content = fallbackReplyContent({ memorySaved, memoryAsked });
  const sent = await safeReply(message, content);
  if (!sent) return null;

  recordBotReplyMessage({
    message,
    sent,
    content,
    personality: 'fallback'
  });

  return sent;
}

async function displayNameForUser(message, userId) {
  const member = message.guild.members.cache.get(userId) ||
    await message.guild.members.fetch(userId).catch(() => null);
  if (member) return member.displayName;

  const user = message.client.users.cache.get(userId) ||
    await message.client.users.fetch(userId).catch(() => null);
  return user?.username || 'this guy';
}

async function sendTargetGremlinReply({ message, action, recentMessages, allowReact }) {
  if (allowReact && targetGremlinService.shouldReactInstead(action)) {
    const emoji = pick(['💀', '👀']);
    const reacted = await safeReact(message, emoji);
    if (reacted) {
      targetGremlinService.recordAction(message.guild.id, action, true);
      repositories.recordBotReaction({
        guildId: message.guild.id,
        userId: message.author.id,
        channelId: message.channel.id
      });
      return message;
    }
  }

  const fallback = targetGremlinService.fallbackContent(action);
  await safeTyping(message.channel);

  let content = fallback;
  try {
    content = await withTimeout(responseGenerator.generateGremlinReply({
      botName: message.client.user.username,
      guildName: message.guild.name,
      channelName: message.channel.name || 'chat',
      targetName: action.targetName,
      trigger: action.trigger,
      template: action.template,
      currentMessage: cleanMessageContent(message),
      recentMessages,
      mentionAllowed: false,
      targetMention: action.targetMention,
      maxWords: action.maxWords,
      fallback
    }), config.bot.replyTimeoutMs, 'Gremlin reply generation');
  } catch (error) {
    logger.warn('Gremlin reply fell back:', error.message);
  }

  content = limitWords(content, action.maxWords);
  await sleep(typingDelay(content));
  const sent = await safeReply(message, content);
  if (!sent) return null;

  targetGremlinService.recordAction(message.guild.id, action, true);
  recordBotReplyMessage({
    message,
    sent,
    content,
    personality: 'target_gremlin'
  });

  return sent;
}

async function sendAutonomousChannelMessage({ message, content, personality }) {
  await safeTyping(message.channel);
  await sleep(typingDelay(content));
  const sent = await safeSend(message.channel, content);
  if (!sent) return null;

  repositories.addConversationMessage({
    guildId: message.guild.id,
    channelId: message.channel.id,
    userId: message.client.user.id,
    username: message.client.user.username,
    isBot: true,
    content,
    messageId: sent.id,
    personality
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
  repositories.incrementHotTakeMessageCount(message.guild.id, message.channel.id);

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

  const gremlinSettings = targetGremlinService.getSettings(message.guild.id);
  if (gremlinSettings.enabled && gremlinSettings.targetUserId) {
    const targetName = await displayNameForUser(message, gremlinSettings.targetUserId);
    const gremlinAction = targetGremlinService.evaluateMessage({
      message,
      content: cleanedContent,
      mentioned,
      repliedToBot,
      targetName
    });

    if (gremlinAction &&
      (forced || cooldowns.canTalk(message.guild.id, message.channel.id, message.author.id, guildSettings))) {
      const sent = await sendTargetGremlinReply({
        message,
        action: gremlinAction,
        recentMessages,
        allowReact: !forced
      });
      if (sent) cooldowns.markTalk(message.guild.id, message.channel.id, message.author.id, guildSettings);
      return;
    }
  }

  let activeHotTake = hotTakeService.getActiveHotTake(message.guild.id, message.channel.id);
  let hotTakeRelated = activeHotTake
    ? hotTakeService.isRelatedToHotTake(cleanedContent, activeHotTake, repliedToBot)
    : false;

  if (activeHotTake && hotTakeService.debateLooksDead(activeHotTake, hotTakeRelated)) {
    repositories.clearActiveHotTake(message.guild.id, message.channel.id);
    activeHotTake = null;
    hotTakeRelated = false;
  }

  if (activeHotTake && hotTakeRelated) {
    const debateUpdate = hotTakeService.registerDebateMessage({
      guildId: message.guild.id,
      channelId: message.channel.id,
      content: cleanedContent,
      active: activeHotTake
    });

    activeHotTake = debateUpdate.active;
    if (debateUpdate.switched) {
      const sent = await sendAutonomousChannelMessage({
        message,
        content: debateUpdate.content,
        personality: 'hot_take_switch'
      });
      if (sent) cooldowns.markTalk(message.guild.id, message.channel.id, message.author.id, guildSettings);
      return;
    }
  }

  if (!forced &&
    !activeHotTake &&
    cooldowns.canTalk(message.guild.id, message.channel.id, message.author.id, guildSettings)) {
    const hotTake = hotTakeService.maybeStartHotTake({
      guildId: message.guild.id,
      channelId: message.channel.id,
      recentMessages
    });

    if (hotTake) {
      const sent = await sendAutonomousChannelMessage({
        message,
        content: hotTake.content,
        personality: 'hot_take'
      });
      if (sent) cooldowns.markTalk(message.guild.id, message.channel.id, message.author.id, guildSettings);
      return;
    }
  }

  if (!forced) {
    if (!cooldowns.canTalk(message.guild.id, message.channel.id, message.author.id, guildSettings)) {
      return;
    }

    if (activeHotTake && hotTakeRelated) {
      if (!hotTakeService.argumentShouldReply()) return;
      decisionReasons = ['hot take argument mode'];
    } else {

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

      decisionReasons = decision.reasons;
    }

    if (!activeHotTake && chance(config.bot.reactionChance)) {
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

    if (!activeHotTake && chance(config.bot.emojiOnlyChance)) {
      try {
        await sendEmojiOnlyReply({ message, recentMessages });
        cooldowns.markTalk(message.guild.id, message.channel.id, message.author.id, guildSettings);
      } catch (error) {
        logger.error('Emoji-only reply failed:', error);
      }
      return;
    }
  }

  try {
    await sendGeneratedReply({
      message,
      mentioned,
      repliedToBot,
      memorySaved: memoryResult.saved,
      memoryAsked,
      activeHotTake: hotTakeRelated ? activeHotTake : null,
      recentMessages,
      decisionReasons
    });

    cooldowns.markTalk(message.guild.id, message.channel.id, message.author.id, guildSettings);
  } catch (error) {
    logger.error('Generated reply failed:', error);
    if (forced) {
      const sent = await sendFallbackReply({
        message,
        memorySaved: memoryResult.saved,
        memoryAsked
      });
      if (sent) cooldowns.markTalk(message.guild.id, message.channel.id, message.author.id, guildSettings);
    }
  }
}

module.exports = {
  execute
};

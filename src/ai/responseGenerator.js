const config = require('../config');
const providerFactory = require('./providerFactory');
const {
  buildChatMessages,
  buildEmojiOnlyMessages,
  buildGremlinMessages,
  buildReviverMessages,
  buildRoastMessages,
  buildVibeCheckMessages
} = require('./promptBuilder');
const { choosePersonality } = require('./personalities');
const { chance, pick } = require('../utils/random');
const {
  freshEmojiOnlyReply,
  freshFallback,
  isTooSimilarToRecentBotReply
} = require('../utils/repetitionGuard');
const { sanitizeAiOutput } = require('../utils/text');
const logger = require('../utils/logger');

async function generateChatReply(input) {
  const personality = choosePersonality();
  const messages = buildChatMessages({
    ...input,
    personality,
    imperfectionHint: chance(config.bot.imperfectionChance)
  });

  let raw = '';
  try {
    raw = await providerFactory.chat(messages);
  } catch (error) {
    logger.warn('AI generation failed in generateChatReply:', error.message);
    return {
      content: freshFallback(input.recentMessages || []),
      personality,
      bubbles: [freshFallback(input.recentMessages || [])]
    };
  }

  const firstReply = sanitizeAiOutput(raw);
  if (!firstReply) {
    const fallback = freshFallback(input.recentMessages || []);
    return { content: fallback, personality, bubbles: [fallback] };
  }

  if (!isTooSimilarToRecentBotReply(firstReply, input.recentMessages || [])) {
    return {
      content: firstReply,
      personality
    };
  }

  // Retry once with slightly higher temperature for fresh angle
  const retryMessages = [
    ...messages,
    { role: 'assistant', content: firstReply },
    {
      role: 'user',
      content: 'That is too similar to something you already said. Give a completely fresh short reply with a different phrasing.'
    }
  ];

  try {
    const retryRaw = await providerFactory.chat(retryMessages, {
      temperature: Math.min(1.2, config.ai.groq.temperature + 0.15)
    });
    const retryReply = sanitizeAiOutput(retryRaw);

    return {
      content: isTooSimilarToRecentBotReply(retryReply, input.recentMessages || [])
        ? freshFallback(input.recentMessages || [])
        : retryReply,
      personality
    };
  } catch (error) {
    return {
      content: freshFallback(input.recentMessages || []),
      personality
    };
  }
}

async function generateEmojiOnlyReply(input) {
  const allowedReplies = config.bot.emojiOnlyReplies;
  const messages = buildEmojiOnlyMessages({
    ...input,
    allowedReplies
  });

  try {
    const raw = await providerFactory.chat(messages, {
      maxTokens: 12,
      temperature: 0.8
    });

    const cleaned = sanitizeAiOutput(raw, 30);
    if (!allowedReplies.includes(cleaned)) {
      return freshEmojiOnlyReply(allowedReplies, input.recentMessages || []);
    }

    return isTooSimilarToRecentBotReply(cleaned, input.recentMessages || [])
      ? freshEmojiOnlyReply(allowedReplies, input.recentMessages || [])
      : cleaned;
  } catch (error) {
    return freshEmojiOnlyReply(allowedReplies, input.recentMessages || []);
  }
}

async function generateReviverStarter(input) {
  const messages = buildReviverMessages(input);

  try {
    const raw = await providerFactory.chat(messages, {
      maxTokens: 40,
      temperature: 1.0
    });
    const starter = sanitizeAiOutput(raw, 120);
    const recentAsMessages = (input.recentStarters || []).map((content) => ({
      is_bot: true,
      content
    }));

    if (!isTooSimilarToRecentBotReply(starter, recentAsMessages)) {
      return starter;
    }
  } catch (error) {
    logger.debug('Reviver AI starter failed, using fallback pool.');
  }

  const recent = new Set((input.recentStarters || []).map((s) => s.toLowerCase()));
  const fresh = config.bot.reviverFallbackStarters.filter((s) => !recent.has(s.toLowerCase()));
  return pick(fresh.length ? fresh : config.bot.reviverFallbackStarters);
}

async function generateGremlinReply(input) {
  const messages = buildGremlinMessages(input);

  try {
    const raw = await providerFactory.chat(messages, {
      maxTokens: 50,
      temperature: 1.05
    });
    const content = sanitizeAiOutput(raw, 160);

    return isTooSimilarToRecentBotReply(content, input.recentMessages || [])
      ? input.fallback
      : content;
  } catch (error) {
    return input.fallback;
  }
}

async function generateVibeCheck(input) {
  const messages = buildVibeCheckMessages(input);
  try {
    const raw = await providerFactory.chat(messages, { maxTokens: 60, temperature: 0.9 });
    return sanitizeAiOutput(raw, 180);
  } catch (error) {
    return `${input.targetName} vibe level: 99% chaos, 1% focused.`;
  }
}

async function generateRoast(input) {
  const messages = buildRoastMessages(input);
  try {
    const raw = await providerFactory.chat(messages, { maxTokens: 50, temperature: 1.0 });
    return sanitizeAiOutput(raw, 160);
  } catch (error) {
    return `${input.targetName} spawned with 100% CPU usage and zero context.`;
  }
}

module.exports = {
  generateChatReply,
  generateEmojiOnlyReply,
  generateGremlinReply,
  generateReviverStarter,
  generateRoast,
  generateVibeCheck
};

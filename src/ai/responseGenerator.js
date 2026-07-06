const config = require('../config');
const groqClient = require('./groqClient');
const {
  buildChatMessages,
  buildEmojiOnlyMessages,
  buildGremlinMessages,
  buildReviverMessages
} = require('./promptBuilder');
const { choosePersonality } = require('./personalities');
const { chance, pick } = require('../utils/random');
const {
  freshEmojiOnlyReply,
  freshFallback,
  isTooSimilarToRecentBotReply
} = require('../utils/repetitionGuard');
const { sanitizeAiOutput } = require('../utils/text');

async function generateChatReply(input) {
  const personality = choosePersonality();
  const messages = buildChatMessages({
    ...input,
    personality,
    imperfectionHint: chance(config.bot.imperfectionChance)
  });

  const raw = await groqClient.chat(messages);
  const firstReply = sanitizeAiOutput(raw);
  if (!isTooSimilarToRecentBotReply(firstReply, input.recentMessages || [])) {
    return {
      content: firstReply,
      personality
    };
  }

  const retryMessages = [
    ...messages,
    { role: 'assistant', content: firstReply },
    {
      role: 'user',
      content: 'That is too similar to something you already said. Give a fresher short reply. Keep it friendly and casual.'
    }
  ];

  const retryRaw = await groqClient.chat(retryMessages, {
    temperature: Math.min(1.2, config.groq.temperature + 0.15)
  });
  const retryReply = sanitizeAiOutput(retryRaw);

  return {
    content: isTooSimilarToRecentBotReply(retryReply, input.recentMessages || [])
      ? freshFallback(input.recentMessages || [])
      : retryReply,
    personality
  };
}

async function generateEmojiOnlyReply(input) {
  const allowedReplies = config.bot.emojiOnlyReplies;
  const messages = buildEmojiOnlyMessages({
    ...input,
    allowedReplies
  });

  const raw = await groqClient.chat(messages, {
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
}

async function generateReviverStarter(input) {
  const messages = buildReviverMessages(input);

  try {
    const raw = await groqClient.chat(messages, {
      maxTokens: 40,
      temperature: 1
    });
    const starter = sanitizeAiOutput(raw, 120);
    const recentAsMessages = input.recentStarters.map((content) => ({
      is_bot: true,
      content
    }));
    if (!isTooSimilarToRecentBotReply(starter, recentAsMessages)) {
      return starter;
    }
  } catch (error) {
  }

  const recent = new Set(input.recentStarters.map((starter) => starter.toLowerCase()));
  const fresh = config.bot.reviverFallbackStarters
    .filter((starter) => !recent.has(starter.toLowerCase()));
  return pick(fresh.length ? fresh : config.bot.reviverFallbackStarters);
}

async function generateGremlinReply(input) {
  const messages = buildGremlinMessages(input);

  try {
    const raw = await groqClient.chat(messages, {
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

module.exports = {
  generateEmojiOnlyReply,
  generateChatReply,
  generateGremlinReply,
  generateReviverStarter
};

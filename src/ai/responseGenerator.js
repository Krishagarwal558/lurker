const config = require('../config');
const groqClient = require('./groqClient');
const {
  buildChatMessages,
  buildEmojiOnlyMessages,
  buildReviverMessages
} = require('./promptBuilder');
const { choosePersonality } = require('./personalities');
const { chance, pick } = require('../utils/random');
const { sanitizeAiOutput } = require('../utils/text');

async function generateChatReply(input) {
  const personality = choosePersonality();
  const messages = buildChatMessages({
    ...input,
    personality,
    imperfectionHint: chance(config.bot.imperfectionChance)
  });

  const raw = await groqClient.chat(messages);
  return {
    content: sanitizeAiOutput(raw),
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
  return allowedReplies.includes(cleaned) ? cleaned : pick(allowedReplies);
}

async function generateReviverStarter(input) {
  const messages = buildReviverMessages(input);

  try {
    const raw = await groqClient.chat(messages, {
      maxTokens: 40,
      temperature: 1
    });
    return sanitizeAiOutput(raw, 120);
  } catch (error) {
    const recent = new Set(input.recentStarters.map((starter) => starter.toLowerCase()));
    const fresh = config.bot.reviverFallbackStarters
      .filter((starter) => !recent.has(starter.toLowerCase()));
    return pick(fresh.length ? fresh : config.bot.reviverFallbackStarters);
  }
}

module.exports = {
  generateEmojiOnlyReply,
  generateChatReply,
  generateReviverStarter
};

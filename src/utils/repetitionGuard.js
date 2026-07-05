const config = require('../config');
const { pick } = require('./random');

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s?]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  const normalized = normalize(text);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 1);
}

function similarity(a, b) {
  const aTokens = new Set(tokens(a));
  const bTokens = new Set(tokens(b));
  if (!aTokens.size || !bTokens.size) return normalize(a) === normalize(b) ? 1 : 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }

  return overlap / Math.max(aTokens.size, bTokens.size);
}

function recentBotMessages(messages, lookback = config.bot.duplicateLookbackMessages) {
  return messages
    .filter((message) => message.is_bot)
    .slice(-lookback)
    .map((message) => message.content);
}

function isTooSimilarToRecentBotReply(content, recentMessages) {
  const recentBotReplies = recentBotMessages(recentMessages);
  const normalized = normalize(content);
  const trimmed = String(content || '').trim();
  if (!normalized) {
    return Boolean(trimmed) && recentBotReplies.some((reply) => {
      return String(reply || '').trim() === trimmed;
    });
  }

  return recentBotReplies.some((reply) => {
    const other = normalize(reply);
    return other === normalized ||
      other.includes(normalized) ||
      normalized.includes(other) ||
      similarity(content, reply) >= config.bot.duplicateSimilarityThreshold;
  });
}

function freshFallback(recentMessages) {
  const recent = new Set(recentBotMessages(recentMessages).map(normalize));
  const options = config.bot.freshFallbackReplies
    .filter((reply) => !recent.has(normalize(reply)));

  return pick(options.length ? options : config.bot.freshFallbackReplies);
}

function freshEmojiOnlyReply(allowedReplies, recentMessages) {
  const recent = new Set(recentBotMessages(recentMessages).map(normalize));
  const options = allowedReplies.filter((reply) => !recent.has(normalize(reply)));
  return pick(options.length ? options : allowedReplies);
}

module.exports = {
  freshEmojiOnlyReply,
  freshFallback,
  isTooSimilarToRecentBotReply,
  normalize,
  similarity
};

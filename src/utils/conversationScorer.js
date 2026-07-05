const config = require('../config');
const { containsKeyword } = require('./text');

const LOW_SIGNAL = /^(yeah|yea|ya|yep|nope|same|ok|okay|lol|lmao|lmfao|fr|true|real|hmm|huh|bruh)$/i;
const QUESTION_START = /^(who|what|when|where|why|how|which|should|can|could|would|is|are|do|does|did|anyone|koi|kaise|kyu)\b/i;

function isQuestion(content) {
  return content.includes('?') || QUESTION_START.test(content.trim());
}

function recentlyActiveHumans(recentMessages) {
  return new Set(
    recentMessages
      .filter((message) => !message.is_bot)
      .map((message) => message.user_id)
  ).size;
}

function containsBotNickname(content, botNames) {
  const lower = content.toLowerCase();
  return botNames.some((name) => {
    if (!name || name.length < 3) return false;
    const escaped = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
}

function thresholdFor(settings) {
  const base = config.bot.decisionScoreThreshold;
  const replyChanceNudge = Math.round((settings.replyChance - config.bot.replyChance) * 100);
  return Math.max(5, Math.min(95, base - replyChanceNudge));
}

function scoreConversation({
  content,
  message,
  recentMessages,
  signals,
  guildSettings,
  botNames
}) {
  const weights = config.bot.decisionScores;
  const reasons = [];
  let score = 0;

  function add(points, reason) {
    score += points;
    reasons.push(`${points > 0 ? '+' : ''}${points} ${reason}`);
  }

  if (containsKeyword(content)) {
    const keywordScale = config.bot.keywordReplyChance > 0
      ? guildSettings.keywordReplyChance / config.bot.keywordReplyChance
      : 1;
    add(Math.round(weights.keyword * keywordScale), 'keyword');
  }
  if (isQuestion(content)) add(weights.question, 'question');

  const activeHumans = recentlyActiveHumans(recentMessages);
  if (activeHumans >= config.bot.activeConversationUsers) {
    add(weights.activeConversation, `${activeHumans} people chatting`);
  }

  if (!signals.lastBotAt || Date.now() - signals.lastBotAt > 10 * 60 * 1000) {
    add(weights.botQuiet, 'bot quiet for a while');
  }

  if (containsBotNickname(content, botNames)) {
    add(weights.nickname, 'bot nickname');
  }

  if (signals.messagesSinceLastBot >= config.bot.fomoMessageCount) {
    add(weights.fomo, `${signals.messagesSinceLastBot} messages since bot spoke`);
  }

  if (signals.lastBotAt && Date.now() - signals.lastBotAt < 45 * 1000) {
    add(weights.recentBot, 'bot spoke recently');
  }

  if (signals.lastTriggerUserId === message.author.id) {
    add(weights.sameUser, 'same user triggered last reply');
  }

  if (LOW_SIGNAL.test(content.trim())) {
    add(weights.lowSignal, 'low-signal message');
  }

  const threshold = thresholdFor(guildSettings);
  return {
    score,
    threshold,
    shouldReply: score >= threshold,
    reasons,
    activeHumans,
    messagesSinceLastBot: signals.messagesSinceLastBot
  };
}

module.exports = {
  scoreConversation
};

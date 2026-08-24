const config = require('../config');
const { containsKeyword } = require('./text');

const LOW_SIGNAL = /^(yeah|yea|ya|yep|nope|same|ok|okay|lol|lmao|lmfao|fr|true|real|hmm|huh|bruh|k|w|l)$/i;
const QUESTION_START = /^(who|what|when|where|why|how|which|should|can|could|would|is|are|do|does|did|anyone|koi|kaise|kyu|kya)\b/i;
const HYPE_PATTERN = /(!{2,}|\b(lmao|omg|no way|yoooo|bruhh|wtf|holy)\b)/i;

function isQuestion(content) {
  const trimmed = String(content || '').trim();
  return trimmed.includes('?') || QUESTION_START.test(trimmed);
}

function recentlyActiveHumans(recentMessages = []) {
  return new Set(
    recentMessages
      .filter((message) => !message.is_bot)
      .map((message) => message.user_id)
  ).size;
}

function containsBotNickname(content, botNames = []) {
  const lower = String(content || '').toLowerCase();
  return botNames.some((name) => {
    if (!name || name.length < 3) return false;
    const escaped = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
}

function thresholdFor(settings) {
  const base = config.bot.decisionScoreThreshold;
  const currentReplyChance = settings.replyChance ?? config.bot.replyChance;
  const replyChanceNudge = Math.round((currentReplyChance - config.bot.replyChance) * 100);
  return Math.max(5, Math.min(95, base - replyChanceNudge));
}

function scoreConversation({
  content,
  message,
  recentMessages = [],
  signals = {},
  guildSettings = {},
  botNames = []
}) {
  const weights = config.bot.decisionScores;
  const reasons = [];
  let score = 0;

  function add(points, reason) {
    score += points;
    reasons.push(`${points > 0 ? '+' : ''}${points} ${reason}`);
  }

  // 1. Keyword check
  if (containsKeyword(content)) {
    const currentKeywordChance = guildSettings.keywordReplyChance ?? config.bot.keywordReplyChance;
    const keywordScale = config.bot.keywordReplyChance > 0
      ? currentKeywordChance / config.bot.keywordReplyChance
      : 1;
    add(Math.round(weights.keyword * keywordScale), 'keyword match');
  }

  // 2. Question check
  if (isQuestion(content)) {
    add(weights.question, 'question asked');
  }

  // 3. Active group chat dynamics
  const activeHumans = recentlyActiveHumans(recentMessages);
  if (activeHumans >= config.bot.activeConversationUsers) {
    add(weights.activeConversation, `${activeHumans} active chatters`);
  }

  // 4. Bot quiet for > 10 minutes
  if (!signals.lastBotAt || Date.now() - signals.lastBotAt > 10 * 60 * 1000) {
    add(weights.botQuiet, 'bot quiet');
  }

  // 5. Bot nickname mentioned directly
  if (containsBotNickname(content, botNames)) {
    add(weights.nickname, 'bot nickname in chat');
  }

  // 6. FOMO boost after chat has been moving without bot
  if ((signals.messagesSinceLastBot || 0) >= config.bot.fomoMessageCount) {
    add(weights.fomo, `${signals.messagesSinceLastBot} msgs since bot spoke`);
  }

  // 7. Hype detection
  if (HYPE_PATTERN.test(content)) {
    add(weights.hypeSignal || 15, 'high energy / hype chat');
  }

  // Deductions
  // 8. Bot spoke very recently (< 45s)
  if (signals.lastBotAt && Date.now() - signals.lastBotAt < 45 * 1000) {
    add(weights.recentBot, 'spoke recently (-)');
  }

  // 9. Same user triggered the last bot reply
  if (message && signals.lastTriggerUserId === message.author?.id) {
    add(weights.sameUser, 'same user triggered last (-)');
  }

  // 10. Low-signal messages ("yeah", "lol", "ok")
  if (LOW_SIGNAL.test(String(content || '').trim())) {
    add(weights.lowSignal, 'low-signal short msg (-)');
  }

  const threshold = thresholdFor(guildSettings);
  return {
    score,
    threshold,
    shouldReply: score >= threshold,
    reasons,
    activeHumans,
    messagesSinceLastBot: signals.messagesSinceLastBot || 0
  };
}

module.exports = {
  isQuestion,
  recentlyActiveHumans,
  scoreConversation
};

const config = require('../config');
const repositories = require('../database/repositories');
const topics = require('../../hot_takes.json');
const { chance, pick, randomInt } = require('../utils/random');

const OPENERS = [
  'lowkey hot take',
  'highkey...',
  'idc what anyone says',
  'am i the only one that thinks',
  'im gonna get cooked for this',
  'this might be controversial but',
  "yall aren't ready for this",
  "i've been thinking...",
  'hear me out',
  'watch everyone disagree',
  'hot take but',
  'respectfully',
  'this is probably my worst opinion'
];

const AGREEMENT = /\b(facts|true|agreed|agree|same|valid|real|yes|yeah|yep|fr|exactly|correct|based|fair|w take|so true)\b/i;
const DISAGREEMENT = /\b(no|nah|wrong|cap|disagree|bad take|l take|not true|never|false|trash take)\b/i;
const SHORT_RELATED = /\b(coffee|tea|pizza|windows|linux|minecraft|valorant|anime|movie|food|sleep|gym|exam|college|coding|ketchup|fries)\b/i;

function minutes(ms) {
  return ms * 60 * 1000;
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s>]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function importantTokens(text) {
  return normalize(text)
    .split(' ')
    .filter((token) => token.length >= 4 && !['this', 'that', 'than', 'with', 'from', 'they', 'them', 'your'].includes(token));
}

function lowercaseFirst(text) {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function withoutPeriod(text) {
  return String(text || '').replace(/[.!?]+$/, '').trim();
}

function oppositeTopic(topic) {
  const clean = withoutPeriod(topic);

  if (clean.includes(' > ')) {
    const [left, right] = clean.split(' > ').map((part) => part.trim());
    if (left && right) return `${right} > ${left}`;
  }

  const betterThan = clean.match(/^(.+?) (?:is |are )?better than (.+)$/i);
  if (betterThan) return `${betterThan[2]} is better than ${lowercaseFirst(betterThan[1])}`;

  if (/overrated/i.test(clean)) return clean.replace(/overrated/i, 'underrated');
  if (/underrated/i.test(clean)) return clean.replace(/underrated/i, 'overrated');
  if (/ belongs on /i.test(clean)) return clean.replace(/ belongs on /i, ' does not belong on ');
  if (/ ruins /i.test(clean)) return clean.replace(/ ruins /i, ' improves ');
  if (/ does not need /i.test(clean)) return clean.replace(/ does not need /i, ' absolutely needs ');
  if (/ matters/i.test(clean)) return clean.replace(/ matters/i, ' does not matter');
  if (/ is not /i.test(clean)) return clean.replace(/ is not /i, ' is ');

  return `nah, ${lowercaseFirst(clean)} is not it`;
}

function stanceFor(topic, side) {
  return side === 'support' ? withoutPeriod(topic) : oppositeTopic(topic);
}

function oppositeStance(active) {
  const support = stanceFor(active.topic, 'support');
  return active.stance === support ? stanceFor(active.topic, 'oppose') : support;
}

function formatHotTake(opener, stance) {
  return `${opener}\n\n${stance}`;
}

function formatSideSwitch(stance) {
  const opener = pick([
    'actually never mind',
    'wait no',
    'nvm i changed my mind',
    'hold on actually'
  ]);
  return `${opener}\n\n${stance}`;
}

function recentHumanMessages(recentMessages) {
  return recentMessages.filter((message) => !message.is_bot);
}

function serverActiveRecently(recentMessages) {
  const cutoff = Date.now() - minutes(config.bot.hotTakeActiveRecentMinutes);
  const humans = recentHumanMessages(recentMessages)
    .filter((message) => !message.created_at || message.created_at >= cutoff);
  const distinctHumans = new Set(humans.map((message) => message.user_id));
  return humans.length >= config.bot.hotTakeMinimumRecentMessages && distinctHumans.size >= 2;
}

function selectFreshTopic(guildId) {
  let used = new Set(repositories.getUsedHotTakeTopics(guildId));

  if (used.size >= topics.length) {
    repositories.clearUsedHotTakeTopics(guildId);
    used = new Set();
  }

  const unused = topics.filter((topic) => !used.has(topic));
  const topic = pick(unused.length ? unused : topics);
  repositories.markHotTakeTopicUsed(guildId, topic);
  return topic;
}

function selectFreshOpener(guildId) {
  const recent = new Set(repositories.getRecentHotTakeOpeners(guildId, OPENERS.length - 1));
  const options = OPENERS.filter((opener) => !recent.has(opener));
  const opener = pick(options.length ? options : OPENERS);
  repositories.recordHotTakeOpener(guildId, opener);
  return opener;
}

function maybeStartHotTake({ guildId, channelId, recentMessages }) {
  if (!config.bot.enableHotTakes) return null;
  if (getActiveHotTake(guildId, channelId)) return null;

  const state = repositories.getHotTakeChannelState(guildId, channelId);
  if (state.messages_since_hot_take < config.bot.minimumMessagesBetweenHotTakes) return null;

  const latestHotTakeAt = repositories.getLatestHotTakeAt(guildId);
  if (latestHotTakeAt && Date.now() - latestHotTakeAt < minutes(config.bot.minimumMinutesBetweenHotTakes)) {
    return null;
  }

  if (!serverActiveRecently(recentMessages)) return null;
  if (!chance(config.bot.hotTakeProbability / 100)) return null;

  const topic = selectFreshTopic(guildId);
  const opener = selectFreshOpener(guildId);
  const side = pick(['support', 'oppose']);
  const stance = stanceFor(topic, side);
  const duration = randomInt(10, Math.max(10, config.bot.argumentDurationMinutes + 5));
  const activeUntil = Date.now() + minutes(duration);

  repositories.markHotTakeStarted({
    guildId,
    channelId,
    topic,
    stance,
    opener,
    activeUntil
  });

  return {
    topic,
    stance,
    opener,
    content: formatHotTake(opener, stance),
    activeUntil
  };
}

function getActiveHotTake(guildId, channelId) {
  const active = repositories.getActiveHotTake(guildId, channelId);
  if (!active) return null;

  if (Date.now() > active.active_until) {
    repositories.clearActiveHotTake(guildId, channelId);
    return null;
  }

  return active;
}

function isRelatedToHotTake(content, active, repliedToBot) {
  if (!active) return false;
  if (repliedToBot) return true;
  if (AGREEMENT.test(content) || DISAGREEMENT.test(content)) return true;
  if (SHORT_RELATED.test(content)) return true;

  const words = new Set(importantTokens(content));
  if (!words.size) return false;

  return importantTokens(`${active.topic} ${active.stance}`).some((token) => words.has(token));
}

function debateLooksDead(active, related) {
  if (!active || related) return false;
  return Date.now() - active.last_activity_at > minutes(6);
}

function registerDebateMessage({ guildId, channelId, content, active }) {
  if (AGREEMENT.test(content) && !active.switched_sides) {
    const count = repositories.incrementHotTakeAgreement(guildId, channelId);
    if (count >= config.bot.hotTakeAgreementSwitchCount) {
      const stance = oppositeStance(active);
      const updated = repositories.switchActiveHotTakeStance(guildId, channelId, stance);
      return {
        switched: true,
        active: updated,
        content: formatSideSwitch(stance)
      };
    }
  } else {
    repositories.touchActiveHotTake(guildId, channelId);
  }

  return { switched: false, active: getActiveHotTake(guildId, channelId), content: null };
}

function argumentShouldReply() {
  return chance(config.bot.argumentReplyChance / 100);
}

module.exports = {
  argumentShouldReply,
  debateLooksDead,
  getActiveHotTake,
  isRelatedToHotTake,
  maybeStartHotTake,
  registerDebateMessage
};

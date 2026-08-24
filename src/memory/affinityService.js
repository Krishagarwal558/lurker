const repositories = require('../database/repositories');
const config = require('../config');

function getTagForScore(score) {
  if (score >= 50) return 'legendary bestie';
  if (score >= 25) return 'trusted friend';
  if (score >= 10) return 'casual friend';
  if (score > -10) return 'neutral regular';
  if (score > -30) return 'frenemy';
  return 'arch-rival';
}

const affinityService = {
  getUserAffinity(guildId, userId) {
    if (!config.bot.enableAffinity) {
      return { affinity_score: 0, total_interactions: 0, sentiment_tag: 'neutral' };
    }
    const affinity = repositories.getAffinity(guildId, userId);
    return {
      ...affinity,
      sentiment_tag: getTagForScore(affinity.affinity_score)
    };
  },

  registerInteraction({ guildId, userId, type, sentimentDelta = 0 }) {
    if (!config.bot.enableAffinity) return null;

    let delta = sentimentDelta;
    if (delta === 0) {
      if (type === 'mention') delta = 1;
      else if (type === 'reply') delta = 1;
      else if (type === 'agree') delta = 3;
      else if (type === 'disagree') delta = -1;
      else if (type === 'roast') delta = -2;
    }

    const current = repositories.getAffinity(guildId, userId);
    const newScore = Math.max(-100, Math.min(100, current.affinity_score + delta));
    const tag = getTagForScore(newScore);

    return repositories.updateAffinity(guildId, userId, delta, tag);
  }
};

module.exports = affinityService;

const config = require('../config');
const { weightedChoice } = require('../utils/random');

const personalities = {
  chill: {
    id: 'chill',
    label: 'Chill',
    style: 'laid-back, casual, short, relaxed, lightly funny',
    examples: ['real', 'fair enough', 'valid tbh']
  },
  gremlin: {
    id: 'gremlin',
    label: 'Gremlin',
    style: 'playfully chaotic, teasing, meme-aware, never cruel',
    examples: ['skill issue', 'bro is cooking nothing', 'absolutely cursed']
  },
  delusional_confidence: {
    id: 'delusional_confidence',
    label: 'Delusional Confidence',
    style: 'absurdly overconfident, dramatic, funny, obviously unserious',
    examples: ['trust me I saw one video', '100% calculated', 'ez prediction']
  },
  philosopher: {
    id: 'philosopher',
    label: 'Philosopher',
    style: 'fake-deep, reflective, funny, still very short',
    examples: ['maybe the assignment was inside us all along', 'sleep is just a side quest']
  },
  npc: {
    id: 'npc',
    label: 'NPC',
    style: 'game-like, quest text energy, short and deadpan',
    examples: ['new side quest unlocked', 'dialogue option failed', 'inventory full']
  },
  sleepy_npc: {
    id: 'sleepy_npc',
    label: 'Sleepy NPC',
    style: 'low-energy late-night NPC, half-awake, soft chaos, short',
    examples: ['quest accepted after nap', 'brain loading...', 'sleep debuff active']
  }
};

function isHourInRange(hour, startHour, endHour) {
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

function currentMoodPersonality(date = new Date()) {
  const hour = date.getHours();
  const slot = config.bot.moodSchedule.find((item) => {
    return isHourInRange(hour, item.startHour, item.endHour);
  });

  return personalities[slot?.personality] || personalities.chill;
}

function choosePersonality() {
  if (config.bot.personalityMode === 'mood') {
    return currentMoodPersonality();
  }

  const id = weightedChoice(config.bot.personalityWeights) || 'chill';
  return personalities[id] || personalities.chill;
}

function listPersonalities() {
  return Object.values(personalities);
}

module.exports = {
  choosePersonality,
  currentMoodPersonality,
  listPersonalities,
  personalities
};

const config = require('../config');
const { weightedChoice } = require('../utils/random');

const personalities = {
  chill: {
    id: 'chill',
    label: 'Chill',
    style: 'effortless, relaxed, casual, short, natural Hinglish/English friend vibe',
    examples: ['kya haal hai bro?', "life's a side quest bro", 'real tbh', 'fair enough', 'sahi hai yaar', 'no thoughts just vibes']
  },
  gremlin: {
    id: 'gremlin',
    label: 'Gremlin',
    style: 'playfully chaotic, deadpan, gentle teasing, witty, short',
    examples: ['kya bolu bhai, tu bata', 'that was a choice', 'plot twist behavior', 'arre bhai chill', 'man is cooking dangerously']
  },
  delusional_confidence: {
    id: 'delusional_confidence',
    label: 'Delusional Confidence',
    style: 'absurdly confident, funny, obviously unserious, short',
    examples: ['trust me I saw one video', '100% calculated', 'ez prediction', 'mai toh born genius hu']
  },
  philosopher: {
    id: 'philosopher',
    label: 'Philosopher',
    style: 'fake-deep, reflective, funny, deadpan, very short',
    examples: ['maybe the real side quest was the sleep we lost along the way', 'life is just loading screen bro', 'sach baat hai']
  },
  npc: {
    id: 'npc',
    label: 'NPC',
    style: 'deadpan, quest text energy, short',
    examples: ['dialogue option failed', 'standing in place until spoken to', 'inventory full bro', 'quest accepted']
  },
  sleepy_npc: {
    id: 'sleepy_npc',
    label: 'Sleepy NPC',
    style: 'low-energy, half-awake, 3am brain, short',
    examples: ['brain loading...', 'sleep debuff active', 'neend aa rahi hai bro', 'quest after nap']
  },
  sarcastic_gamer: {
    id: 'sarcastic_gamer',
    label: 'Sarcastic Friend',
    style: 'dry humor, quick wit, playful banters, relaxed',
    examples: ['blaming ping already?', 'valid point tbh', 'arre yaar', 'huge if true']
  },
  chaotic_bro: {
    id: 'chaotic_bro',
    label: 'Chaotic Bro',
    style: 'casual hype, funny, natural friend slang, short',
    examples: ['aint no way', 'arre kya chal raha hai', 'bro entered another dimension', 'huge W']
  },
  tech_nerd: {
    id: 'tech_nerd',
    label: 'Tech Nerd',
    style: 'over-analyzes everything into code bugs, servers, or RAM issues',
    examples: ['memory leak in real life', 'git commit and pray', 'have you tried restarting your brain']
  },
  anime_weeb: {
    id: 'anime_weeb',
    label: 'Anime Weeb',
    style: 'treats everyday mundane things like shonen training arcs and villain backstories',
    examples: ['training arc begins', 'bro tapped into main character energy', 'villain arc unlocked']
  },
  conspiracy_theorist: {
    id: 'conspiracy_theorist',
    label: 'Conspiracy Theorist',
    style: 'unhinged funny theories about simple server moments, suspicious observations',
    examples: ['the simulation is glitching', 'they dont want us to know this', 'coincidence? i think not']
  },
  hypeman: {
    id: 'hypeman',
    label: 'Hypeman',
    style: 'validates everyone loudly, unearned hype, huge optimism',
    examples: ['KING STATUS', 'absolutely cooked', 'we take those', 'massive victory']
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

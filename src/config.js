require('dotenv').config();

const path = require('node:path');

function numberFromEnv(name, fallback, min, max) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function boolFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    prefix: process.env.COMMAND_PREFIX || '!'
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    timeoutMs: numberFromEnv('GROQ_TIMEOUT_MS', 12000, 2000, 60000),
    maxTokens: numberFromEnv('GROQ_MAX_TOKENS', 90, 20, 300),
    temperature: numberFromEnv('GROQ_TEMPERATURE', 0.95, 0, 2),
    maxRetries: numberFromEnv('GROQ_MAX_RETRIES', 2, 0, 5)
  },

  database: {
    path: process.env.DATABASE_PATH
      ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
      : path.join(process.cwd(), 'data', 'bot.sqlite')
  },

  server: {
    port: numberFromEnv('PORT', 8080, 1, 65535)
  },

  bot: {
    defaultAiEnabled: boolFromEnv('AI_ENABLED', true),
    replyChance: numberFromEnv('REPLY_CHANCE', 0.15, 0, 1),
    keywordReplyChance: numberFromEnv('KEYWORD_REPLY_CHANCE', 0.35, 0, 1),
    channelCooldownSeconds: numberFromEnv('CHANNEL_COOLDOWN_SECONDS', 60, 0, 3600),
    userCooldownSeconds: numberFromEnv('USER_COOLDOWN_SECONDS', 25, 0, 3600),
    maxContextMessages: numberFromEnv('MAX_CONTEXT_MESSAGES', 15, 1, 50),
    reactionChance: numberFromEnv('REACTION_CHANCE', 0.05, 0, 1),
    emojiOnlyChance: numberFromEnv('EMOJI_ONLY_CHANCE', 0.08, 0, 1),
    imperfectionChance: numberFromEnv('IMPERFECTION_CHANCE', 0.08, 0, 1),
    maxReplyLength: numberFromEnv('MAX_REPLY_LENGTH', 240, 40, 2000),
    typingMinMs: numberFromEnv('TYPING_MIN_MS', 1800, 0, 10000),
    typingMaxMs: numberFromEnv('TYPING_MAX_MS', 4500, 500, 15000),
    typingCharsPerSecond: numberFromEnv('TYPING_CHARS_PER_SECOND', 8, 1, 80),
    reviverCron: process.env.REVIVER_CRON || '*/5 * * * *',
    reviverMinMinutes: numberFromEnv('REVIVER_MIN_MINUTES', 45, 5, 1440),
    reviverMaxMinutes: numberFromEnv('REVIVER_MAX_MINUTES', 90, 5, 1440),
    reviverMinGapMinutes: numberFromEnv('REVIVER_MIN_GAP_MINUTES', 45, 5, 1440),
    decisionScoreThreshold: numberFromEnv('DECISION_SCORE_THRESHOLD', 35, 0, 100),
    activeConversationUsers: numberFromEnv('ACTIVE_CONVERSATION_USERS', 3, 2, 20),
    fomoMessageCount: numberFromEnv('FOMO_MESSAGE_COUNT', 60, 5, 500),

    decisionScores: {
      keyword: 20,
      question: 25,
      activeConversation: 15,
      botQuiet: 15,
      nickname: 10,
      fomo: 30,
      recentBot: -30,
      sameUser: -20,
      lowSignal: -15
    },

    personalityWeights: {
      chill: 40,
      gremlin: 25,
      delusional_confidence: 15,
      philosopher: 10,
      npc: 10
    },

    personalityMode: process.env.PERSONALITY_MODE || 'mood',

    moodSchedule: [
      { startHour: 4, endHour: 11, personality: 'philosopher' },
      { startHour: 11, endHour: 15, personality: 'chill' },
      { startHour: 15, endHour: 19, personality: 'gremlin' },
      { startHour: 19, endHour: 23, personality: 'delusional_confidence' },
      { startHour: 23, endHour: 4, personality: 'sleepy_npc' }
    ],

    keywords: [
      'valorant',
      'minecraft',
      'gym',
      'college',
      'exam',
      'coding',
      'food',
      'sleep',
      'discord',
      'anime',
      'movie'
    ],

    reactionEmojis: ['💀', '😭', '🔥', '🗿', '👀', '😂'],
    emojiOnlyReplies: ['💀', '😭', '🗿', '👀', '😂', 'fr??', 'nahhh', 'wait what'],

    reviverFallbackStarters: [
      'important question',
      "what's everyone's hottest take",
      'who keeps stealing all the braincells',
      "today's side quest",
      'drop the most random thought rn',
      'what are we pretending to understand today',
      'tiny debate: best midnight snack?',
      'who is winning the sleep schedule war'
    ]
  }
};

module.exports = config;

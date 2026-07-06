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
    ownerId: process.env.OWNER_ID || '',
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
    duplicateLookbackMessages: numberFromEnv('DUPLICATE_LOOKBACK_MESSAGES', 12, 3, 50),
    duplicateSimilarityThreshold: numberFromEnv('DUPLICATE_SIMILARITY_THRESHOLD', 0.72, 0.4, 1),
    replyTimeoutMs: numberFromEnv('REPLY_TIMEOUT_MS', 10000, 2000, 60000),
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

    enableHotTakes: boolFromEnv('ENABLE_HOT_TAKES', true),
    hotTakeProbability: numberFromEnv('HOT_TAKE_PROBABILITY', 45, 0, 100),
    argumentReplyChance: numberFromEnv('ARGUMENT_REPLY_CHANCE', 65, 0, 100),
    argumentDurationMinutes: numberFromEnv('ARGUMENT_DURATION_MINUTES', 15, 1, 120),
    minimumMessagesBetweenHotTakes: numberFromEnv('MINIMUM_MESSAGES_BETWEEN_HOT_TAKES', 35, 1, 500),
    minimumMinutesBetweenHotTakes: numberFromEnv('MINIMUM_MINUTES_BETWEEN_HOT_TAKES', 180, 1, 10080),
    hotTakeActiveRecentMinutes: numberFromEnv('HOT_TAKE_ACTIVE_RECENT_MINUTES', 8, 1, 60),
    hotTakeMinimumRecentMessages: numberFromEnv('HOT_TAKE_MINIMUM_RECENT_MESSAGES', 6, 1, 50),
    hotTakeAgreementSwitchCount: numberFromEnv('HOT_TAKE_AGREEMENT_SWITCH_COUNT', 2, 1, 10),

    enableTargetGremlin: boolFromEnv('ENABLE_TARGET_GREMLIN', true),
    targetUserId: process.env.TARGET_USER_ID || '',
    checkIntervalMinutes: numberFromEnv('CHECK_INTERVAL_MINUTES', 20, 1, 1440),
    baseTriggerChance: numberFromEnv('BASE_TRIGGER_CHANCE', 0.45, 0, 1),
    onlineTriggerChance: numberFromEnv('ONLINE_TRIGGER_CHANCE', 0.65, 0, 1),
    recentMessageTriggerChance: numberFromEnv('RECENT_MESSAGE_TRIGGER_CHANCE', 0.90, 0, 1),
    mentionChance: numberFromEnv('MENTION_CHANCE', 0.25, 0, 1),
    replyChanceDuringGremlin: numberFromEnv('REPLY_CHANCE_DURING_GREMLIN', 0.70, 0, 1),
    gremlinArgumentReplyChance: numberFromEnv('GREMLIN_ARGUMENT_REPLY_CHANCE', 0.90, 0, 1),
    defenderReplyChance: numberFromEnv('DEFENDER_REPLY_CHANCE', 0.25, 0, 1),
    maxDailyRoasts: numberFromEnv('MAX_DAILY_ROASTS', 10, 0, 100),
    maxMentionsPerDay: numberFromEnv('MAX_MENTIONS_PER_DAY', 2, 0, 20),

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
      'where did the focus go',
      "today's side quest",
      'drop the most random thought rn',
      'what are we pretending to understand today',
      'tiny debate: best midnight snack?',
      'who is winning the sleep schedule war'
    ],

    freshFallbackReplies: [
      'real tbh',
      'valid honestly',
      'okay wait, plot twist',
      'chat is entering lore mode',
      'fair enough',
      'that checks out somehow',
      'i respect the chaos'
    ]
  }
};

module.exports = config;

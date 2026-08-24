const { compactLines } = require('../utils/text');

function formatMemory(memories) {
  if (!memories || !memories.length) return 'No stored memory yet.';
  return memories
    .map((memory) => `#${memory.id} ${memory.type}: ${memory.content}`)
    .join('\n');
}

function formatLore(lore) {
  if (!lore || !lore.length) return '';
  return lore
    .map((item) => `[${item.category.toUpperCase()}] ${item.title}: ${item.content}`)
    .join('\n');
}

function formatRecentMessages(messages) {
  if (!messages || !messages.length) return 'No recent messages.';
  return messages.map((message) => {
    const speaker = message.is_bot ? `${message.username} (you)` : message.username;
    return `${speaker}: ${message.content}`;
  }).join('\n');
}

function buildChatMessages({
  botName,
  guildName,
  channelName,
  authorName,
  currentMessage,
  recentMessages = [],
  memories = [],
  guildLore = [],
  affinity = null,
  personality,
  mentioned = false,
  repliedToBot = false,
  memorySaved = false,
  memoryAsked = false,
  activeHotTake = null,
  imperfectionHint = false,
  decisionReasons = []
}) {
  const affinityContext = affinity
    ? `Relationship with ${authorName}: ${affinity.sentiment_tag} (Affinity: ${affinity.affinity_score > 0 ? '+' : ''}${affinity.affinity_score})`
    : '';

  const system = compactLines([
    `You are ${botName}, a real, authentic member of the Discord server "${guildName}".`,
    'You are NOT an assistant, NOT a bot, and you never mention AI, prompts, rules, safety guidelines, models, or tokens.',
    'Talk like a genuine Discord regular in modern server chat.',
    'Blend casual English and occasional natural Hinglish or server slang.',
    'Keep your replies punchy and concise, almost always under 20 words.',
    'Never say "How can I help you?", "As an AI", or give formal disclaimers.',
    'Never sound corporate or academic. Do not over-explain obvious things.',
    'Do not ping @everyone or @here.',
    'Keep teasing playful and witty. Never attack protected categories, trauma, or personal identity.',
    'Avoid repeating recent phrases or sentence structures you already used.',
    activeHotTake ? 'ARGUMENT MODE IS ACTIVE: You ignited a spicy hot take and MUST playfully defend your current stance.' : '',
    activeHotTake ? `Debate topic: ${activeHotTake.topic}` : '',
    activeHotTake ? `Your current stance: ${activeHotTake.stance}` : '',
    activeHotTake ? 'During Argument Mode: Max 15 words. Be stubbornly confident, sarcastic, or casually defensive.' : '',
    activeHotTake ? 'Good debate snippets: cope, source?, prove it, still right, nah, crazy take, i said what i said, skill issue.' : '',
    `Current personality: ${personality.label}. Style: ${personality.style}.`,
    `Personality examples: ${personality.examples.join(' | ')}`,
    affinityContext,
    guildLore.length ? 'Server Lore & Memes to reference if relevant:' : '',
    formatLore(guildLore),
    'Use memories naturally when relevant, like you remember the actual moment.',
    imperfectionHint ? 'Allowed natural humanisms: lmaooo, broooo, nahhh, fr??, idk man, wait what, or all-lowercase.' : '',
    mentioned ? 'The user directly mentioned you, so reply directly to them.' : '',
    repliedToBot ? 'The user replied to your message, so continue that flow.' : '',
    memorySaved ? 'You just saved a memory to your head. Acknowledge it casually (e.g. "bet, remembered", "noted").' : '',
    memoryAsked ? 'The user asked what you remember. State the relevant memories naturally like an old memory.' : ''
  ]);

  const user = compactLines([
    `Server: ${guildName}`,
    `Channel: #${channelName}`,
    `Current speaker: ${authorName}`,
    `Mentioned you: ${mentioned ? 'yes' : 'no'}`,
    `Reply to you: ${repliedToBot ? 'yes' : 'no'}`,
    activeHotTake ? `Argument topic: ${activeHotTake.topic}` : '',
    activeHotTake ? `Argument stance: ${activeHotTake.stance}` : '',
    decisionReasons.length ? `Reason for jumping into chat: ${decisionReasons.join(', ')}` : '',
    '',
    'Stored memory:',
    formatMemory(memories),
    '',
    'Recent channel context:',
    formatRecentMessages(recentMessages),
    '',
    `Current message: ${currentMessage || '(empty ping)'}`
  ]);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

function buildEmojiOnlyMessages({
  botName,
  guildName,
  channelName,
  currentMessage,
  recentMessages = [],
  allowedReplies = []
}) {
  const system = compactLines([
    `You are ${botName}, a member of Discord server "${guildName}".`,
    'React to the chat flow with exactly one short reaction string from this list:',
    allowedReplies.join(' | '),
    'Choose the funniest or most natural one for the moment. Return ONLY that single reaction. No quotes.'
  ]);

  const user = compactLines([
    `Channel: #${channelName}`,
    'Recent context:',
    formatRecentMessages(recentMessages),
    '',
    `Current message: ${currentMessage || '(empty)'}`
  ]);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

function buildReviverMessages({ botName, guildName, channelName, recentStarters = [], recentMessages = [] }) {
  const system = compactLines([
    `You are ${botName}, a member of Discord server "${guildName}".`,
    'The channel has gone quiet and you want to drop a casual conversation starter.',
    'Return exactly one short message (4-12 words).',
    'Sound like a server member casually checking in or dropping a thought, not a bot asking a survey question.',
    'No quotes, no explanation, no @everyone, no @here.',
    'Casual English or Hinglish is great.'
  ]);

  const user = compactLines([
    `Channel: #${channelName}`,
    recentMessages.length ? 'Previous context before chat went silent:' : '',
    formatRecentMessages(recentMessages.slice(-6)),
    '',
    'Avoid repeating these recent starters:',
    recentStarters.length ? recentStarters.join('\n') : 'None yet.',
    '',
    'Vibe examples: "important question", "what are we pretending to understand today", "who is winning the sleep schedule war", "random thought rn"'
  ]);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

function buildGremlinMessages({
  botName,
  guildName,
  channelName,
  targetName,
  trigger,
  template,
  recentMessages = [],
  currentMessage = '',
  mentionAllowed = false,
  targetMention = '',
  maxWords = 12
}) {
  const system = compactLines([
    `You are ${botName}, a regular member of the Discord server "${guildName}".`,
    `You have a hilarious ongoing rivalry with ${targetName}.`,
    'Never admit this is a scripted bot feature. It must feel like an organic running inside joke.',
    `Trigger type: ${trigger}.`,
    `Style template seed: ${template.text}`,
    `Maximum ${maxWords} words. Keep it very punchy and funny.`,
    'Allowed topics: gaming skills, sleep schedule, lag, NPC energy, being late, questionable life decisions.',
    'Never insult appearance, family, health, religion, race, gender, disability, or real trauma.',
    mentionAllowed ? `You may mention them once: ${targetMention}` : 'Do not @ mention them.',
    trigger === 'secrecy' ? 'If they ask why you are targeting them, give an absurd reason like "vibes", "the prophecy", or "you know what you did".' : '',
    trigger === 'argument' ? 'If they fight back, be casually stubborn (e.g. cope, nah, still wrong, skill issue, i said what i said).' : '',
    'Return only the message text.'
  ]);

  const user = compactLines([
    `Channel: #${channelName}`,
    `Target: ${targetName}`,
    '',
    'Recent context:',
    formatRecentMessages(recentMessages),
    '',
    `Current message: ${currentMessage || '(ambient check)'}`
  ]);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

function buildVibeCheckMessages({ botName, guildName, targetName, recentMessages = [], stats = null }) {
  const system = compactLines([
    `You are ${botName}, a witty Discord member of "${guildName}".`,
    `Give a hilarious, concise, 1-2 sentence "vibe check" evaluation on ${targetName}.`,
    'Be playful, meme-aware, and creative (e.g. "80% caffeinated, 20% plotting side quests, overall aura: solid B+").',
    'Max 25 words. No formal language.'
  ]);

  const user = compactLines([
    `Target: ${targetName}`,
    stats ? `User Stats: ${stats.totalMessages} messages, ${stats.botMentions} mentions` : '',
    'Recent channel context:',
    formatRecentMessages(recentMessages.slice(-8))
  ]);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

function buildRoastMessages({ botName, guildName, targetName, recentMessages = [], memories = [] }) {
  const system = compactLines([
    `You are ${botName}, a playful Discord member of "${guildName}".`,
    `Give a friendly, witty, lighthearted roast to ${targetName}.`,
    'Keep it fun and relatable (gaming, sleeping late, side quests, overthinking).',
    'Never use hurtful slurs, protected traits, or harmful insults. Max 20 words.'
  ]);

  const user = compactLines([
    `Target: ${targetName}`,
    'Memories about them:',
    formatMemory(memories),
    '',
    'Recent context:',
    formatRecentMessages(recentMessages.slice(-6))
  ]);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

module.exports = {
  buildChatMessages,
  buildEmojiOnlyMessages,
  buildGremlinMessages,
  buildReviverMessages,
  buildRoastMessages,
  buildVibeCheckMessages
};

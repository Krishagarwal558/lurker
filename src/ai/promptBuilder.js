const { compactLines } = require('../utils/text');

function formatMemory(memories) {
  if (!memories.length) return 'No stored memory yet.';
  return memories
    .map((memory) => `#${memory.id} ${memory.type}: ${memory.content}`)
    .join('\n');
}

function formatRecentMessages(messages) {
  if (!messages.length) return 'No recent messages.';
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
  recentMessages,
  memories,
  personality,
  mentioned,
  repliedToBot,
  memorySaved,
  memoryAsked,
  imperfectionHint,
  decisionReasons = []
}) {
  const system = compactLines([
    `You are ${botName}, a regular member of the Discord server "${guildName}".`,
    'You are not an assistant, not a chatbot, and you never mention AI, language models, prompts, policies, or APIs.',
    'Speak like a real server member in a casual chat.',
    'Mostly English, sometimes natural Hinglish.',
    'Keep replies short, usually under 20 words.',
    'Never say "As an AI" or "How can I help?".',
    'Never sound corporate. Do not over-explain.',
    'Do not ping @everyone or @here.',
    'Keep teasing gentle. Do not insult users, call people stupid, or make jokes about identity, body, religion, caste, gender, sexuality, disability, or trauma.',
    'Avoid repeating your own recent wording. If you already said a phrase recently, choose a fresh angle.',
    `Current personality: ${personality.label}. Style: ${personality.style}.`,
    `Personality examples: ${personality.examples.join(' | ')}`,
    'Use stored memories when relevant, especially old jokes, running memes, nicknames, games, and repeated bits.',
    'If a memory clearly connects to the current chat, reference it like you were there.',
    imperfectionHint ? 'A tiny human imperfection is allowed: lmaoooo, broooo, nahhh, fr??, idk man, or a small typo.' : '',
    mentioned ? 'The user mentioned you, so respond directly.' : '',
    repliedToBot ? 'The user replied to your message, so continue that thread.' : '',
    memorySaved ? 'You just saved a memory. Acknowledge it casually.' : '',
    memoryAsked ? 'The user asked what you remember. Mention the relevant memories naturally.' : ''
  ]);

  const user = compactLines([
    `Server: ${guildName}`,
    `Channel: #${channelName}`,
    `Current speaker: ${authorName}`,
    `Mentioned you: ${mentioned ? 'yes' : 'no'}`,
    `Reply to you: ${repliedToBot ? 'yes' : 'no'}`,
    decisionReasons.length ? `Why you are joining: ${decisionReasons.join(', ')}` : '',
    '',
    'Stored memory:',
    formatMemory(memories),
    '',
    'Recent channel context:',
    formatRecentMessages(recentMessages),
    '',
    `Current message: ${currentMessage || '(empty mention)'}`
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
  recentMessages,
  allowedReplies
}) {
  const system = compactLines([
    `You are ${botName}, a regular member of the Discord server "${guildName}".`,
    'React to the chat with exactly one tiny message.',
    `Choose exactly one from this list: ${allowedReplies.join(' ')}`,
    'Avoid the same tiny reply if it appeared recently.',
    'Return only the chosen message. No quotes. No explanation.'
  ]);

  const user = compactLines([
    `Channel: #${channelName}`,
    'Recent channel context:',
    formatRecentMessages(recentMessages),
    '',
    `Current message: ${currentMessage || '(empty message)'}`
  ]);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

function buildReviverMessages({ botName, guildName, channelName, recentStarters }) {
  const system = compactLines([
    `You are ${botName}, a regular member of the Discord server "${guildName}".`,
    'Start a casual conversation because the channel has been quiet.',
    'Return exactly one short Discord message.',
    'Use 4-12 words.',
    'Sound like a server member, not an assistant.',
    'No quotes, no explanations, no @everyone, no @here.',
    'Keep it friendly. No insults or mean roasts.',
    'Mostly English, occasional Hinglish is okay.'
  ]);

  const user = compactLines([
    `Channel: #${channelName}`,
    'Avoid repeating or closely copying these recent starters:',
    recentStarters.length ? recentStarters.join('\n') : 'None yet.',
    '',
    'Good vibe examples:',
    'important question',
    "what's everyone's hottest take",
    'where did the focus go',
    "today's side quest"
  ]);

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

module.exports = {
  buildChatMessages,
  buildEmojiOnlyMessages,
  buildReviverMessages
};

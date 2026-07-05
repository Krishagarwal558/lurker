const repositories = require('../database/repositories');
const { cleanMessageContent } = require('../utils/text');

function classifyMemory(text) {
  const lower = text.toLowerCase();

  if (/(call me|nickname|aka|my name is|naam|naam hai)/i.test(lower)) return 'nickname';
  if (/(inside joke|joke between us|server joke)/i.test(lower)) return 'inside_joke';
  if (/(meme|running bit|braincells|side quest|lore)/i.test(lower)) return 'running_meme';
  if (/(favorite|favourite|fav).*(game|valorant|minecraft)|\b(valorant|minecraft)\b/i.test(lower)) {
    return 'favorite_game';
  }
  if (/(anime|movie|coding|food|gym|college|exam|sleep|topic|music)/i.test(lower)) {
    return 'favorite_topic';
  }

  return 'general';
}

function extractRememberText(content) {
  const match = content.match(/\bremember(?:\s+that|\s+this|:)?\s+(.+)/i);
  if (!match) return null;

  return match[1]
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '')
    .trim()
    .slice(0, 500);
}

function extractNickname(text) {
  const patterns = [
    /(?:call me|nickname is|my nickname is|aka|my name is|naam hai)\s+["']?([^"',.;!?]+)/i,
    /["']([^"']{1,40})["']/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().slice(0, 40);
  }

  return null;
}

function firstMentionedHuman(message) {
  return message.mentions.users.find((user) => {
    return !user.bot && user.id !== message.author.id;
  });
}

function isAskingWhatRemember(content) {
  return /\bwhat do you remember\b/i.test(content) ||
    /\bwhat.*remember.*about\b/i.test(content) ||
    /\bshow.*memory\b/i.test(content);
}

function saveMemoryFromMessage(message) {
  const cleaned = cleanMessageContent(message);
  const memoryText = extractRememberText(cleaned);
  if (!memoryText || memoryText.length < 3) {
    return { saved: false, memory: null };
  }

  const mentionedUser = firstMentionedHuman(message);
  const targetUserId = mentionedUser?.id || message.author.id;
  const type = classifyMemory(memoryText);
  const memory = repositories.saveMemory({
    guildId: message.guild.id,
    userId: targetUserId,
    type,
    content: memoryText,
    createdBy: message.author.id,
    sourceMessageId: message.id
  });

  if (type === 'nickname') {
    const nickname = extractNickname(memoryText);
    if (nickname) {
      repositories.upsertNickname({
        guildId: message.guild.id,
        userId: targetUserId,
        nickname,
        sourceMessageId: message.id
      });
    }
  }

  return { saved: true, memory };
}

function relevantMemories(guildId, userId, limit = 16) {
  return repositories.getRelevantMemories(guildId, userId, limit);
}

function userMemories(guildId, userId, limit = 20) {
  return repositories.getMemoriesForUser(guildId, userId, limit);
}

function formatMemoryList(memories) {
  if (!memories.length) return 'nothing saved yet';
  return memories
    .map((memory) => `#${memory.id} ${memory.type.replaceAll('_', ' ')}: ${memory.content}`)
    .join('\n');
}

module.exports = {
  formatMemoryList,
  isAskingWhatRemember,
  relevantMemories,
  saveMemoryFromMessage,
  userMemories
};

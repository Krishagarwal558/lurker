const config = require('../config');

const bannedAssistantPhrases = [
  /as an ai/gi,
  /as a language model/gi,
  /i am an ai/gi,
  /i'm an ai/gi,
  /how can i help\??/gi,
  /how may i assist\??/gi
];

function cleanMessageContent(message) {
  let content = message.content || '';

  for (const [id, user] of message.mentions.users) {
    const displayName = message.guild?.members.cache.get(id)?.displayName || user.username;
    content = content.replace(new RegExp(`<@!?${id}>`, 'g'), `@${displayName}`);
  }

  for (const [id, channel] of message.mentions.channels) {
    content = content.replace(new RegExp(`<#${id}>`, 'g'), `#${channel.name}`);
  }

  return content.replace(/\s+/g, ' ').trim();
}

function sanitizeAiOutput(text, maxLength = config.bot.maxReplyLength) {
  if (!text) return 'real';

  let output = String(text)
    .replace(/^[\s"'`]+|[\s"'`]+$/g, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^bot\s*:\s*/i, '')
    .replace(/^assistant\s*:\s*/i, '')
    .replace(/@everyone/gi, '@ everyone')
    .replace(/@here/gi, '@ here')
    .trim();

  for (const phrase of bannedAssistantPhrases) {
    output = output.replace(phrase, '').trim();
  }

  if (!output) return 'real';
  if (output.length <= maxLength) return output;

  const clipped = output.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 40 ? lastSpace : maxLength).trim()}...`;
}

function containsKeyword(content) {
  const lower = String(content || '').toLowerCase();
  return config.bot.keywords.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
}

function parseChanceInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (raw.endsWith('%')) {
    const percent = Number(raw.slice(0, -1));
    return Number.isFinite(percent) ? Math.min(1, Math.max(0, percent / 100)) : null;
  }

  const number = Number(raw);
  if (!Number.isFinite(number)) return null;
  return number > 1 ? Math.min(1, Math.max(0, number / 100)) : Math.min(1, Math.max(0, number));
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function compactLines(lines) {
  return lines.filter(Boolean).join('\n');
}

module.exports = {
  cleanMessageContent,
  compactLines,
  containsKeyword,
  parseChanceInput,
  percent,
  sanitizeAiOutput
};

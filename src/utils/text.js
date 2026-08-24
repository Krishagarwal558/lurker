const config = require('../config');

function cleanMessageContent(message) {
  if (!message) return '';
  let content = message.content || '';

  // Strip bot user mentions
  if (message.client?.user?.id) {
    content = content.replace(new RegExp(`<@!?${message.client.user.id}>`, 'g'), '');
  }

  // Remove excessive whitespace
  return content.replace(/\s+/g, ' ').trim();
}

function compactLines(lines) {
  return lines.filter((line) => typeof line === 'string' && line.trim().length > 0).join('\n');
}

function containsKeyword(text) {
  const lower = String(text || '').toLowerCase();
  const keywords = config.bot?.keywords || [];
  return keywords.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
  });
}

function sanitizeAiOutput(text, maxChars = config.bot?.maxReplyLength || 280) {
  if (!text) return '';

  let sanitized = String(text)
    // Strip assistant preambles / thoughts
    .replace(/^(as an ai|as an assistant|here is a reply|here's a response|reply:)\s*/i, '')
    .replace(/^["'“”‘’](.*)["'“”‘’]$/s, '$1')
    .replace(/@everyone/g, '@\u200Beveryone')
    .replace(/@here/g, '@\u200Bhere')
    .replace(/<@&\d+>/g, '[role mention]')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip markdown code fences if model accidentally wrapped output in ```
  sanitized = sanitized.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();

  if (sanitized.length > maxChars) {
    sanitized = sanitized.slice(0, maxChars).trim();
    // Try to cut at last punctuation/word boundary
    const lastPunct = sanitized.search(/[.!?][^.!?]*$/);
    if (lastPunct > maxChars * 0.6) {
      sanitized = sanitized.slice(0, lastPunct + 1);
    }
  }

  return sanitized;
}

function parseChanceInput(input) {
  if (!input) return null;
  const str = String(input).trim();
  if (str.endsWith('%')) {
    const val = Number(str.slice(0, -1));
    if (Number.isFinite(val) && val >= 0 && val <= 100) return val / 100;
  }
  const val = Number(str);
  if (Number.isFinite(val) && val >= 0 && val <= 1) return val;
  if (Number.isFinite(val) && val > 1 && val <= 100) return val / 100;
  return null;
}

function percent(decimal) {
  return `${Math.round(Number(decimal || 0) * 100)}%`;
}

module.exports = {
  cleanMessageContent,
  compactLines,
  containsKeyword,
  parseChanceInput,
  percent,
  sanitizeAiOutput
};

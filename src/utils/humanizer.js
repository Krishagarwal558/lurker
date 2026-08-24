const config = require('../config');
const { chance, randomInt } = require('./random');

function calculateTypingDelay(content) {
  const chars = String(content || '').length;
  // Natural jitter in typing speed between 7 and 12 chars per second
  const cps = randomInt(7, 11);
  const baseDelay = (chars / cps) * 1000;
  return Math.min(config.bot.typingMaxMs, Math.max(config.bot.typingMinMs, baseDelay));
}

function splitIntoBubbles(content) {
  if (!content) return [];
  const text = String(content).trim();

  // If multi-bubble disabled or roll fails, keep single message
  if (!config.bot.enableMultiBubble || !chance(config.bot.multiBubbleChance)) {
    return [text];
  }

  // Check for explicit double-newlines
  if (text.includes('\n\n')) {
    const parts = text.split('\n\n').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2 && parts.length <= 3) {
      return parts;
    }
  }

  // Check for 2 distinct sentences (e.g. "wait hold on. did you actually do that?")
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length === 2) {
    const s1 = sentences[0].trim();
    const s2 = sentences[1].trim();
    if (s1.length >= 5 && s2.length >= 5 && s1.length + s2.length <= 160) {
      return [s1, s2];
    }
  }

  return [text];
}

module.exports = {
  calculateTypingDelay,
  splitIntoBubbles
};

const test = require('node:test');
const assert = require('node:assert');

const { scoreConversation, isQuestion } = require('../src/utils/conversationScorer');

test('Conversation Scorer: question detection', () => {
  assert.strictEqual(isQuestion('what do you think about this?'), true);
  assert.strictEqual(isQuestion('why are servers crashing'), true);
  assert.strictEqual(isQuestion('anyone playing valorant tonight'), true);
  assert.strictEqual(isQuestion('just chilling here'), false);
});

test('Conversation Scorer: score calculation with keywords and active humans', () => {
  const result = scoreConversation({
    content: 'who is up for some valorant right now?',
    message: { author: { id: 'user-1' } },
    recentMessages: [
      { user_id: 'user-1', is_bot: false },
      { user_id: 'user-2', is_bot: false },
      { user_id: 'user-3', is_bot: false }
    ],
    signals: {
      lastBotAt: null,
      messagesSinceLastBot: 70
    },
    guildSettings: {
      replyChance: 0.15,
      keywordReplyChance: 0.35
    },
    botNames: ['Lurker']
  });

  assert.strictEqual(result.shouldReply, true);
  assert.ok(result.score >= result.threshold);
  assert.ok(result.reasons.some((r) => r.includes('question')));
  assert.ok(result.reasons.some((r) => r.includes('keyword')));
});

test('Conversation Scorer: low signal deduction prevents spam replies', () => {
  const result = scoreConversation({
    content: 'lol',
    message: { author: { id: 'user-1' } },
    recentMessages: [{ user_id: 'user-1', is_bot: false }],
    signals: {
      lastBotAt: Date.now() - 10000,
      messagesSinceLastBot: 2
    },
    guildSettings: {
      replyChance: 0.15,
      keywordReplyChance: 0.35
    },
    botNames: ['Lurker']
  });

  assert.strictEqual(result.shouldReply, false);
});

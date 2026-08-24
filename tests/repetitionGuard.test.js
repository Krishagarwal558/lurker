const test = require('node:test');
const assert = require('node:assert');

const { isTooSimilarToRecentBotReply, similarity } = require('../src/utils/repetitionGuard');

test('Repetition Guard: similarity calculation', () => {
  const sim1 = similarity('real tbh', 'real tbh');
  assert.strictEqual(sim1, 1);

  const sim2 = similarity('hello world today', 'goodbye universe tomorrow');
  assert.strictEqual(sim2, 0);
});

test('Repetition Guard: flags repetitive bot messages', () => {
  const recentMessages = [
    { is_bot: true, content: 'real tbh honestly' },
    { is_bot: false, content: 'what do you think' }
  ];

  assert.strictEqual(isTooSimilarToRecentBotReply('real tbh honestly', recentMessages), true);
  assert.strictEqual(isTooSimilarToRecentBotReply('completely different topic here', recentMessages), false);
});

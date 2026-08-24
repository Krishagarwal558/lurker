const test = require('node:test');
const assert = require('node:assert');

const { calculateTypingDelay, splitIntoBubbles } = require('../src/utils/humanizer');

test('Humanizer: calculateTypingDelay produces valid bounded delay', () => {
  const shortDelay = calculateTypingDelay('hi');
  assert.ok(shortDelay >= 1800);

  const longDelay = calculateTypingDelay('a'.repeat(200));
  assert.ok(longDelay <= 4500);
});

test('Humanizer: splitIntoBubbles handles empty and normal input', () => {
  assert.deepStrictEqual(splitIntoBubbles(''), []);
  const bubbles = splitIntoBubbles('single short thought');
  assert.ok(bubbles.length >= 1);
});

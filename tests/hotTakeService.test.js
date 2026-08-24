const test = require('node:test');
const assert = require('node:assert');

const { oppositeTopic, stanceFor, isRelatedToHotTake } = require('../src/memory/hotTakeService');

test('Hot Take Service: computes opposite topics and stances', () => {
  assert.strictEqual(oppositeTopic('Tea > Coffee'), 'Coffee > Tea');
  assert.strictEqual(oppositeTopic('Dark mode is overrated.'), 'Dark mode is underrated');
  assert.strictEqual(oppositeTopic('Pineapple belongs on pizza.'), 'Pineapple does not belong on pizza');
});

test('Hot Take Service: stanceFor helper', () => {
  const topic = 'Tea > Coffee';
  assert.strictEqual(stanceFor(topic, 'support'), 'Tea > Coffee');
  assert.strictEqual(stanceFor(topic, 'oppose'), 'Coffee > Tea');
});

test('Hot Take Service: relation detection', () => {
  const active = {
    topic: 'Pineapple belongs on pizza.',
    stance: 'Pineapple belongs on pizza.'
  };

  assert.strictEqual(isRelatedToHotTake('pizza', active, false), true);
  assert.strictEqual(isRelatedToHotTake('i agree with you', active, false), true);
  assert.strictEqual(isRelatedToHotTake('totally cap', active, false), true);
  assert.strictEqual(isRelatedToHotTake('random message without connection', active, false), false);
});

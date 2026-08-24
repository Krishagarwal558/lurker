const test = require('node:test');
const assert = require('node:assert');

const { classifyMemory, isAskingWhatRemember } = require('../src/memory/memoryService');

test('Memory Service: classify memory types accurately', () => {
  assert.strictEqual(classifyMemory('call me clutch king'), 'nickname');
  assert.strictEqual(classifyMemory('my nickname is Neo'), 'nickname');
  assert.strictEqual(classifyMemory('our running joke about pineapple on pizza'), 'inside_joke');
  assert.strictEqual(classifyMemory('the legendary server lore about the crash'), 'running_meme');
  assert.strictEqual(classifyMemory('my favorite game is valorant'), 'favorite_game');
  assert.strictEqual(classifyMemory('loves coding in rust and python'), 'favorite_topic');
  assert.strictEqual(classifyMemory('prefers sleeping early'), 'favorite_topic');
});

test('Memory Service: detects "what do you remember" queries', () => {
  assert.strictEqual(isAskingWhatRemember('what do you remember about me'), true);
  assert.strictEqual(isAskingWhatRemember('show my memory list'), true);
  assert.strictEqual(isAskingWhatRemember('what do you remember'), true);
  assert.strictEqual(isAskingWhatRemember('hello how are you'), false);
});

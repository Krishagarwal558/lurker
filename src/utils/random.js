function chance(probability) {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  return Math.random() < probability;
}

function pick(items) {
  if (!items || !items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function weightedChoice(weights) {
  const entries = Object.entries(weights || {});
  const total = entries.reduce((sum, [, weight]) => sum + Number(weight || 0), 0);
  if (total <= 0) return entries[0]?.[0] || null;

  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= Number(weight || 0);
    if (roll <= 0) return key;
  }

  return entries[entries.length - 1]?.[0] || null;
}

function shuffle(array) {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

module.exports = {
  chance,
  pick,
  randomFloat,
  randomInt,
  shuffle,
  weightedChoice
};

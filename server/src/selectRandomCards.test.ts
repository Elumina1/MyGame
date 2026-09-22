import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRandomCards } from './selectRandomCards.js';

test('selects unique cards without changing the pool', () => {
  const pool = Object.freeze(Array.from({ length: 127 }, (_, index) => Object.freeze({ id: String(index) })));
  const before = [...pool];
  const chosen = selectRandomCards(pool, 24);
  assert.equal(chosen.length, 24);
  assert.equal(new Set(chosen.map(card => card.id)).size, 24);
  assert.deepEqual(pool, before);
});

test('rejects a pool smaller than the requested count', () => {
  assert.throws(() => selectRandomCards([{ id: 'axe' }], 24));
});

test('rejects duplicate IDs', () => {
  assert.throws(() => selectRandomCards([{ id: 'axe' }, { id: 'axe' }], 1));
});

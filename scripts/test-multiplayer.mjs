import assert from 'node:assert/strict';
import { io } from '../client/node_modules/socket.io-client/build/esm/index.js';

const url = process.env.TEST_URL ?? 'http://127.0.0.1:3001';
const sockets = [];
async function client() {
  const socket = io(url, { reconnection: false });
  sockets.push(socket);
  socket.latest = undefined;
  socket.on('state', state => { socket.latest = state; });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  return socket;
}
function state(socket, predicate, timeout = 3000) {
  if (socket.latest && predicate(socket.latest)) return Promise.resolve(socket.latest);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off('state', check); reject(new Error('state timeout')); }, timeout);
    const check = value => { if (predicate(value)) { clearTimeout(timer); socket.off('state', check); resolve(value); } };
    socket.on('state', check);
  });
}
function error(socket, action, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`missing error for ${action}`)), 3000);
    socket.once('errorMessage', message => { clearTimeout(timer); resolve(message); });
    socket.emit(action, payload);
  });
}
async function create(themeId, suffix) {
  const first = await client();
  const token = `first-${suffix}-token`;
  const created = new Promise(resolve => first.once('created', resolve));
  first.emit('create', { token, nickname: 'Alex', themeId });
  const { code } = await created;
  const initial = await state(first, value => value.code === code);
  const second = await client();
  const secondToken = `second-${suffix}-token`;
  second.emit('join', { code, token: secondToken, nickname: 'Max' });
  await state(second, value => value.phase === 'selecting');
  await state(first, value => value.phase === 'selecting');
  return { first, second, code, token, secondToken, initial };
}
async function play(room) {
  let { first, second } = room;
  const { token, secondToken } = room;
  const [cardA, cardB] = first.latest.theme.cards;
  first.emit('select', { token, cardId: cardA.id });
  await state(first, value => value.me.secret === cardA.id);
  second.emit('select', { token: secondToken, cardId: cardB.id });
  await state(second, value => value.me.secret === cardB.id);
  assert.equal(first.latest.players[1].secret, undefined);
  assert.equal(second.latest.players[0].secret, undefined);
  first.emit('ready', { token });
  second.emit('ready', { token: secondToken });
  await state(first, value => value.phase === 'waiting_for_question');
  if (first.latest.theme.id === 'dota2') {
    const all = (await import('../server/src/dotaHeroes.json', { with: { type: 'json' } })).default;
    const outside = all.find(hero => !first.latest.theme.cards.some(card => card.id === hero.id));
    assert.match(await error(first, 'guess', { token, cardId: outside.id }), /нельзя угадывать/);
  }
  first.emit('askQuestion', { token, question: 'Ближний бой?' });
  await state(second, value => value.phase === 'waiting_for_answer');
  const cardsBeforeReconnect = second.latest.theme.cards.map(card => card.id);
  second.disconnect();
  second = await client();
  room.second = second;
  second.emit('join', { code: room.code, token: secondToken, nickname: 'Max' });
  await state(second, value => value.phase === 'waiting_for_answer');
  assert.deepEqual(second.latest.theme.cards.map(card => card.id), cardsBeforeReconnect);
  second.emit('answerQuestion', { token: secondToken, answer: 'yes' });
  await state(first, value => value.phase === 'waiting_for_question' && value.rounds[0]?.answer === 'yes');
  assert.equal(first.latest.turn, secondToken);
  second.emit('guess', { token: secondToken, cardId: cardB.id });
  await state(first, value => value.turn === token && value.lastEvent?.startsWith('Не угадали'));
  first.emit('guess', { token, cardId: cardB.id });
  await state(second, value => value.phase === 'finished');
  await state(first, value => value.phase === 'finished');
  assert.equal(first.latest.winner, token);
  assert.equal(first.latest.players[1].secret, cardB.id);
  return { cardA, cardB };
}

try {
  const malformed = await client();
  assert.ok(await error(malformed, 'create', null));
  malformed.disconnect();
  const dota = await create('dota2', 'dota');
  const ids = dota.first.latest.theme.cards.map(card => card.id);
  assert.equal(ids.length, 24);
  assert.equal(new Set(ids).size, 24);
  assert.deepEqual(dota.second.latest.theme.cards.map(card => card.id), ids);
  assert.ok(dota.first.latest.theme.cards.every(card => card.image?.startsWith('/assets/dota/heroes/')));
  const outside = (await import('../server/src/dotaHeroes.json', { with: { type: 'json' } })).default.find(hero => !ids.includes(hero.id));
  assert.ok(outside);
  assert.match(await error(dota.first, 'select', { token: dota.token, cardId: outside.id }), /Недопустимая/);
  const extra = await create('dota2', 'extra');
  assert.equal(extra.first.latest.theme.cards.length, 24);
  assert.notEqual(extra.code, dota.code);
  extra.first.disconnect(); extra.second.disconnect();
  const reconnectA = await client();
  reconnectA.emit('join', { code: dota.code, token: dota.token, nickname: 'Alex' });
  await state(reconnectA, value => value.code === dota.code);
  assert.deepEqual(reconnectA.latest.theme.cards.map(card => card.id), ids);
  dota.first.disconnect();
  const reconnectB = await client();
  reconnectB.emit('join', { code: dota.code, token: dota.secondToken, nickname: 'Max' });
  await state(reconnectB, value => value.code === dota.code);
  assert.deepEqual(reconnectB.latest.theme.cards.map(card => card.id), ids);
  dota.second.disconnect();
  dota.first = reconnectA; dota.second = reconnectB;
  await play(dota);
  const activeSecond = dota.second;
  const rematchState = state(reconnectA, value => value.phase === 'selecting' && !value.me.secret);
  reconnectA.emit('rematch', { token: dota.token });
  const next = await rematchState;
  const nextIds = next.theme.cards.map(card => card.id);
  assert.equal(nextIds.length, 24);
  assert.equal(new Set(nextIds).size, 24);
  assert.notDeepEqual(nextIds, ids);
  await state(activeSecond, value => value.phase === 'selecting' && value.theme.cards[0].id === nextIds[0]);
  activeSecond.emit('rematch', { token: dota.secondToken });
  assert.deepEqual(activeSecond.latest.theme.cards.map(card => card.id), nextIds);
  assert.equal(next.rounds.length, 0);
  const animals = await create('animals', 'animals');
  assert.equal(animals.first.latest.theme.cards.length, 24);
  await play(animals);
  animals.first.emit('rematch', { token: animals.token });
  await state(animals.first, value => value.phase === 'selecting' && !value.me.secret);
  assert.equal(animals.first.latest.theme.cards.length, 24);
  console.log('PASS: Dota 2 rooms, shared 24, validation, reconnect, question, guess, victory, rematch; Animals regression');
} finally {
  sockets.forEach(socket => socket.disconnect());
}

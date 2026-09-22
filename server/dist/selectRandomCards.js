import { randomInt } from 'node:crypto';
export function selectRandomCards(pool, count) {
    if (!Number.isInteger(count) || count < 1 || pool.length < count)
        throw new Error('Invalid card count');
    if (new Set(pool.map(card => card.id)).size !== pool.length)
        throw new Error('Duplicate card IDs in pool');
    const copy = [...pool];
    for (let index = 0; index < count; index++) {
        const next = randomInt(index, copy.length);
        [copy[index], copy[next]] = [copy[next], copy[index]];
    }
    return copy.slice(0, count);
}

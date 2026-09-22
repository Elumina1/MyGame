import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const output = join(root, 'client/public/assets/dota/heroes');
const dataPath = join(root, 'server/src/dotaHeroes.json');
const response = await fetch('https://www.dota2.com/datafeed/herolist?language=english');
if (!response.ok) throw new Error(`Dota hero list: HTTP ${response.status}`);
const source = (await response.json()).result?.data?.heroes;
if (!Array.isArray(source) || source.length < 24) throw new Error('Invalid Dota hero list');
const heroes = source.map(hero => {
  const id = String(hero.name ?? '').replace(/^npc_dota_hero_/, '');
  const name = hero.name_english_loc;
  if (!Number.isInteger(hero.id) || !/^[a-z0-9_]+$/.test(id) || typeof name !== 'string' || !name.trim()) throw new Error(`Invalid hero record: ${JSON.stringify(hero)}`);
  return { id, name: name.trim(), image: `/assets/dota/heroes/${id}.png` };
});
if (new Set(heroes.map(hero => hero.id)).size !== heroes.length) throw new Error('Duplicate hero IDs');
await mkdir(output, { recursive: true });
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
let downloaded = 0;
const failures = [];
for (let offset = 0; offset < heroes.length; offset += 8) {
  await Promise.all(heroes.slice(offset, offset + 8).map(async hero => {
    const file = join(output, `${hero.id}.png`);
    try {
      const existing = await readFile(file).catch(() => null);
      if (existing?.subarray(0, 8).equals(png) && existing.length > 1000) return;
      const url = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${hero.id}.png`;
      const image = await fetch(url);
      if (!image.ok) throw new Error(`HTTP ${image.status}`);
      const bytes = Buffer.from(await image.arrayBuffer());
      if (bytes.length < 1000 || !bytes.subarray(0, 8).equals(png)) throw new Error('Not a valid PNG');
      await writeFile(file, bytes);
      downloaded++;
    } catch (error) { failures.push(`${hero.id}: ${error.message}`); }
  }));
  process.stdout.write(`\rChecked ${Math.min(offset + 8, heroes.length)}/${heroes.length}`);
}
console.log();
if (failures.length) throw new Error(`Portrait errors:\n${failures.join('\n')}`);
for (const hero of heroes) {
  const file = join(output, `${hero.id}.png`);
  const bytes = await readFile(file);
  if (bytes.length < 1000 || !bytes.subarray(0, 8).equals(png)) throw new Error(`Invalid portrait: ${hero.id}`);
}
await writeFile(dataPath, `${JSON.stringify(heroes, null, 2)}\n`);
console.log(`${heroes.length} heroes, ${downloaded} new portraits, ${(await Promise.all(heroes.map(hero => stat(join(output, `${hero.id}.png`))))).reduce((sum, file) => sum + file.size, 0)} bytes`);

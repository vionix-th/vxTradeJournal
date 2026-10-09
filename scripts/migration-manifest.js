import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { migrationDefinitions } from '../src/application/schema-evolution.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');
export async function migrationManifest(definitions = migrationDefinitions) {
  const result = {};
  for (const step of definitions) {
    const sources = {};
    for (const path of [...new Set([step.sourcePath, ...(step.dependencies || [])])].sort()) sources[path] = hash(await readFile(path));
    result[step.id] = hash(JSON.stringify(sources));
  }
  return result;
}
export async function verifyMigrationManifest() {
  const expected = `${JSON.stringify(await migrationManifest(), null, 2)}\n`;
  const file = new URL('../src/config/migrations.json', import.meta.url);
  if (await readFile(file, 'utf8') !== expected) throw new Error('Migration checksums are stale. Run npm run schema:manifest and review immutable migration changes.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) await verifyMigrationManifest();
  else await writeFile(new URL('../src/config/migrations.json', import.meta.url), `${JSON.stringify(await migrationManifest(), null, 2)}\n`);
}

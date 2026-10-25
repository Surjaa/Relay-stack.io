// Confirms every element id used in main.js exists in index.html.
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const have = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const used = new Set([...js.matchAll(/\$\('#([^']+)'\)/g)].map((m) => m[1]));
const missing = [...used].filter((id) => !have.has(id));
console.log(missing.length ? `MISSING: ${missing.join(', ')}` : `All ${used.size} ids present.`);
process.exitCode = missing.length ? 1 : 0;

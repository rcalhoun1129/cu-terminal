/* Extracts the dataset from your local reference HTML into gitignored JSON for the React app:
     app/data/cu-data.restricted.json         (Node tools / tests)
     app/public/data/cu-data.restricted.json  (served to the app at runtime)
   Dataset-specific data-quality notes are captured from the original engine's output (dqNotes).
   Usage: npm run extract  [-- path/to/reference.html]                                         */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReference, deriveDqNotes, REFERENCE_HTML } from './reference-engine.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ? path.resolve(process.argv[2]) : REFERENCE_HTML;
const ref = readReference(file);
const dqNotes = deriveDqNotes(ref);

const out = { ...ref.data, dqNotes };
const json = JSON.stringify(out);
for (const dir of [path.resolve(here, '../data'), path.resolve(here, '../public/data')]) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'cu-data.restricted.json'), json);
}
console.log(`Extracted ${out.players.length} players · ${out.episodes.length} episodes · ${dqNotes.length} DQ notes → app/data and app/public/data (gitignored)`);

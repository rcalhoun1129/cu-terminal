/* Loads the ORIGINAL engine from the local reference HTML (gitignored) and runs it in a Node VM.
   Used by the extractor and by the parity test. Nothing from the reference file is ever committed. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REFERENCE_HTML = process.env.CU_REFERENCE_HTML || path.resolve(here, '../../reference/cu-buyside-capital-manager.html');

export const hasReference = () => fs.existsSync(REFERENCE_HTML);

export function readReference(file = REFERENCE_HTML) {
  const html = fs.readFileSync(file, 'utf8');
  const a = html.indexOf('window.CU_DATA =');
  if (a < 0) throw new Error('window.CU_DATA not found in ' + file);
  const b = html.indexOf('};</script>', a);
  const data = JSON.parse(html.slice(a + 'window.CU_DATA ='.length, b + 1));
  const s0 = html.indexOf('<script>', b) + '<script>'.length;
  const s1 = html.indexOf('/* =====================================================================\n   Chart primitives', s0);
  if (s1 < 0) throw new Error('engine block boundary not found');
  return { data, engineSrc: html.slice(s0, s1) };
}

/** Run the original engine with the given settings. Returns {M, S} from inside the VM. */
export function runOriginal({ data, engineSrc }, settings = {}) {
  const ctx = vm.createContext({ window: { CU_DATA: structuredClone(data) }, console, Date, Math, JSON, Map, Set, Object, Array, Number, String, isFinite, isNaN, RegExp, encodeURIComponent });
  vm.runInContext(engineSrc, ctx, { filename: 'reference-engine.js' });
  vm.runInContext(`(function(o){ const {assume, ...rest} = o; Object.assign(S, rest); if (o.view) S.filters.view = o.view; Object.assign(S.assume, assume||{}); buildModel(); })`, ctx)(settings);
  return vm.runInContext('({M, S, fx: {bands, bandOf, quote, bandPool}})', ctx);
}

/** Dataset-specific fixed data-quality notes, captured from the original engine (see engine/dq.ts slots). */
export function deriveDqNotes(ref) {
  const dq = runOriginal(ref).M.A.dq;
  if (!/^FY26-27/.test(dq[3].item) || dq[12].area !== 'Historical vs current conflict') throw new Error('Unexpected data-quality layout in the reference engine');
  const strip = ({ sev, area, item, detail, pid, eid }) => ({ sev, area, item, detail, ...(pid ? { pid } : {}), ...(eid ? { eid } : {}) });
  return [{ ...strip(dq[2]), slot: 1 }, ...dq.slice(4, 12).map((x) => ({ ...strip(x), slot: 2 }))];
}

import type { CuData } from './types';
import { generateSample } from './sample/generate';

export type DataSource = 'restricted' | 'file' | 'sample';
export interface LoadedData { data: CuData; source: DataSource; label: string }

/** The source workbook keys the live-offer block by the prospect's name; expose it as `drive.liveOffer` (found by shape). */
export function normalizeDataset(data: CuData): CuData {
  const d = data.drive as unknown as Record<string, unknown>;
  if (d && !d.liveOffer) {
    const k = Object.keys(d).find((key) => { const v = d[key] as Record<string, unknown> | null; return !!v && typeof v === 'object' && 'bspNil' in v && 'activation' in v; });
    if (k) { const { [k]: block, ...rest } = d; data = { ...data, drive: { ...rest, liveOffer: block } as unknown as CuData['drive'] }; }
  }
  return data;
}

/** Restricted dataset produced by `npm run extract` (gitignored); falls back to the synthetic sample. */
export async function loadDataset(): Promise<LoadedData> {
  try {
    const r = await fetch('data/cu-data.restricted.json', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      const data = (await r.json()) as CuData;
      if (Array.isArray(data.players) && Array.isArray(data.episodes)) return { data: normalizeDataset(data), source: 'restricted', label: 'Local restricted dataset' };
    }
  } catch { /* fall through to sample */ }
  return { data: generateSample(), source: 'sample', label: 'Synthetic sample dataset' };
}

/** Accepts the extracted JSON or the original single-file HTML app (window.CU_DATA is read in the browser; nothing is uploaded). */
export async function parseDatasetFile(file: File): Promise<LoadedData> {
  const text = await file.text();
  let data: CuData;
  if (/\.html?$/i.test(file.name) || text.trimStart().startsWith('<')) {
    const a = text.indexOf('window.CU_DATA =');
    if (a < 0) throw new Error('This HTML file does not contain window.CU_DATA.');
    const b = text.indexOf('};</script>', a);
    data = JSON.parse(text.slice(a + 'window.CU_DATA ='.length, b + 1));
  } else data = JSON.parse(text);
  if (!Array.isArray(data.players) || !Array.isArray(data.episodes) || !data.controls) throw new Error('Not a CU Buy-Side dataset.');
  return { data: normalizeDataset(data), source: 'file', label: file.name };
}

import { describe, expect, it } from 'vitest';
import { generateSample } from '../sample/generate';
import { buildModel } from '../../engine/model';
import { DEFAULT_ENGINE } from '../../engine/settings';

describe('synthetic sample dataset', () => {
  const data = generateSample();
  it('is deterministic', () => { expect(JSON.stringify(generateSample())).toEqual(JSON.stringify(data)); });
  it('builds a complete model', () => {
    const M = buildModel(data, DEFAULT_ENGINE);
    expect(M.h[2026].size).toBeGreaterThan(30);
    expect(Number.isFinite(M.committed[2026])).toBe(true);
    expect(M.A.cubsmi.price[2026].v).not.toBeNull();
    expect(M.A.tape.length).toBeGreaterThan(50);
    expect(M.A.dq[2].area).toBe('Sample data');
    for (const s of [2025, 2026]) expect(M.committed[s]).toBeLessThan(M.caps[s]);
  });
});

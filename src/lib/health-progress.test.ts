import { describe, expect, it } from 'vitest';
import { overallProgress } from './health-progress';
import type { StrengthSeries } from './health';
const series = (id: string, values: Array<[string,number]>): StrengthSeries => ({ id, name: id, metric: 'load', reps: Number(id.split(':').at(-1)), points: values.map(([date,value]) => ({date,value})) });
describe('overall exercise progression', () => {
  it('counts each exercise once using its most frequently repeated rep count', () => {
    const result = overallProgress([
      series('bench:8', [['2026-10-12',50],['2026-10-20',55],['2026-11-01',60]]),
      series('bench:6', [['2026-10-14',70],['2026-10-24',50]]),
      series('row:8', [['2026-10-12',100],['2026-11-01',90]]),
    ], '2026-11-07',4);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].series.id).toBe('bench:8');
    expect(result.median).toBeCloseTo(5);
    expect(result.improving).toBe(1); expect(result.declining).toBe(1);
  });
  it('does not compare across rep counts, invent missing days, or include dates outside the window', () => {
    const result = overallProgress([
      series('bench:8', [['2026-10-10',50],['2026-10-22',55]]),
      series('bench:6', [['2026-10-23',60]]),
      series('row:8', [['2026-11-08',70]]),
    ], '2026-11-07',4);
    expect(result.rows).toEqual([]); expect(result.median).toBeNull(); expect(result.unpaired).toBe(1);
  });
  it('treats tiny changes as steady and preserves real negative changes', () => {
    const result = overallProgress([
      series('bench:8', [['2026-10-11',100],['2026-11-07',100.4]]),
      series('row:8', [['2026-10-11',100],['2026-11-07',90]]),
    ],'2026-11-07',4);
    expect(result.steady).toBe(1); expect(result.declining).toBe(1); expect(result.median).toBeCloseTo(-4.8);
  });
  it('uses the longer period when selected and ignores invalid zero baselines', () => {
    const data = [series('bench:8',[['2026-09-01',40],['2026-10-22',50]]),series('row:8',[['2026-10-12',0],['2026-10-22',50]])];
    expect(overallProgress(data,'2026-11-07',4).rows).toHaveLength(0);
    expect(overallProgress(data,'2026-11-07',12).median).toBe(25);
  });
});

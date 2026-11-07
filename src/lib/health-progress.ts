import { dayOffset, type StrengthSeries } from './health';

export interface ExerciseProgress {
  series: StrengthSeries;
  first: number;
  last: number;
  percent: number;
  days: number;
}
/** One comparison per exercise, at its most frequently logged matching rep count. */
export function overallProgress(series: StrengthSeries[], today: string, weeks: number) {
  const start = dayOffset(today, -(weeks * 7 - 1));
  const exercises = new Set<string>();
  const comparisons = new Map<string, ExerciseProgress>();
  for (const item of series) {
    const points = item.points.filter(p => p.date >= start && p.date <= today).sort((a,b) => a.date.localeCompare(b.date));
    if (!points.length) continue;
    const key = item.id.includes(':') ? item.id.slice(0, item.id.lastIndexOf(':')) : item.id;
    exercises.add(key);
    if (points.length < 2 || points[0].value <= 0) continue;
    const first = points[0].value, last = points.at(-1)!.value;
    const candidate = { series: { ...item, points }, first, last, percent: (last / first - 1) * 100, days: points.length };
    const previous = comparisons.get(key);
    if (!previous || candidate.days > previous.days || (candidate.days === previous.days && points.at(-1)!.date > previous.series.points.at(-1)!.date)) comparisons.set(key, candidate);
  }
  const rows = [...comparisons.values()].sort((a,b) => b.percent - a.percent);
  const sorted = rows.map(r => r.percent).sort((a,b) => a-b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length ? (sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2) : null;
  return { rows, median, improving: rows.filter(r => r.percent > 0.5).length, steady: rows.filter(r => Math.abs(r.percent) <= 0.5).length, declining: rows.filter(r => r.percent < -0.5).length, unpaired: exercises.size - rows.length };
}

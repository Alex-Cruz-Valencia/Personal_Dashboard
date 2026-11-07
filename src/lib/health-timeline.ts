import { dayOffset, type HealthJournal, type TrainingData } from './health';
import type { NutritionData } from './nutrition';

/** Join by the viewer's local calendar date; sources retain their own missing states. */
export function healthWeek(endDate: string, training: TrainingData, journal: HealthJournal, nutrition: NutritionData) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = dayOffset(endDate, i - 6);
    const checkin = journal.days[date];
    return { date, workouts: training.workouts.filter(w => w.date === date),
      trainingAvailable: training.source !== 'unavailable',
      nutrition: nutrition.status === 'connected' ? nutrition.days[date] ?? null : null,
      sleep: checkin?.sleep ?? null, energy: checkin?.energy ?? null,
      water: journal.waterDays?.[date] ?? checkin?.water ?? null,
    };
  });
}

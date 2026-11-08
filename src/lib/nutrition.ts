/** Shared view model: absent diary data is unknown, never zero intake. */
export interface NutritionTotals { calories: number; protein: number; carbohydrate: number; fat: number }
export interface NutritionMeal { id: string; name: string; meal: string; description: string; totals: NutritionTotals }
export interface NutritionDay { mealsLoaded?: boolean; date: string; totals: NutritionTotals; meals: NutritionMeal[] }
export interface NutritionData {
  status: 'not_configured' | 'authorization_required' | 'disabled' | 'unavailable' | 'connected';
  days: Record<string, NutritionDay>;
}
export interface NutritionGoals { protein: number | null; calories: number | null; carbohydrate?: number | null; fat?: number | null }
/** User-provided goals, not inferred dietary recommendations. */
export const PERSONAL_NUTRITION_GOALS: NutritionGoals = { protein: 200, calories: 2600 };
export const EMPTY_NUTRITION_GOALS: NutritionGoals = { protein: null, calories: null };
export function validNutritionGoals(value: unknown): value is NutritionGoals {
  if (!value || typeof value !== 'object') return false;
  const v = value as NutritionGoals;
  const valid = (n: unknown, max: number) => n === null || (typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= max);
  return valid(v.protein, 1000) && valid(v.calories, 20000) && (v.carbohydrate === undefined || valid(v.carbohydrate, 3000)) && (v.fat === undefined || valid(v.fat, 1000));
}

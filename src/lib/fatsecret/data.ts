import 'server-only';
import { config, features } from '@/lib/config';
import type { NutritionData } from '@/lib/nutrition';

/** App credentials alone cannot read a member diary. No remote calls or invented intake. */
export function getFatSecretNutrition(): NutritionData {
  if (!config.fatsecret.clientId || !config.fatsecret.clientSecret) return { status: 'not_configured', days: {} };
  return { status: features.fatsecret ? 'authorization_required' : 'disabled', days: {} };
}

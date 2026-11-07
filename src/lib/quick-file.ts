/**
 * The label behind the one-click "Reference files" button on each email: the
 * place most mail gets filed. Matched by name, ignoring case and spacing, so it
 * appears only when the account has that label (never a dead button).
 */

const NAMES = ["reference files", "reference"];
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function referenceLabel<T extends { name: string }>(labels: readonly T[] | null): T | null {
  if (!labels) return null;
  for (const n of NAMES) {
    const hit = labels.find((l) => norm(l.name) === n);
    if (hit) return hit;
  }
  return null;
}

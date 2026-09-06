import type { SliceSource } from "@/lib/types";

/**
 * A small marker for a card whose live source is configured but currently
 * failing, so it's quietly showing sample data. Renders nothing for `live`
 * (working) or `off` (nothing configured — sample data is expected).
 */
export function StaleTag({ source }: { source: SliceSource }) {
  if (source !== "mock") return null;
  return (
    <span
      className="stale-tag"
      title="Live data is unavailable right now — showing sample data."
    >
      Sample
    </span>
  );
}

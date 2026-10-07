import type { SliceSource } from "@/lib/types";

/**
 * A small marker for a card whose live source is configured but currently
 * failing, so it's quietly showing sample data. Renders nothing for `live`
 * (working) or `off` (nothing configured — sample data is expected).
 *
 * With `reconnect`, the failure is a dead Google connection rather than an
 * outage, so the marker becomes a link that starts the consent flow again.
 */
export function StaleTag({ source, reconnect }: { source: SliceSource; reconnect?: boolean }) {
  if (source !== "mock") return null;
  if (reconnect) {
    return (
      <a
        className="stale-tag stale-tag--link"
        href="/api/auth/google"
        title="Google sign-in expired — showing sample data until you reconnect."
      >
        Reconnect Google
      </a>
    );
  }
  return (
    <span
      className="stale-tag"
      title="Live data is unavailable right now — showing sample data."
    >
      Sample
    </span>
  );
}

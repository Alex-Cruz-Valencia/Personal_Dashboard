import type { WeekDay } from "@/lib/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** What tomorrow holds, in a few words ("3 events · 5 tasks"), or null when neither source is readable. */
export function tomorrowSummary(day: WeekDay | null): string | null {
  if (!day) return null;
  const parts = [
    day.events ? plural(day.events.length, "event") : null,
    day.tasks ? plural(day.tasks.length, "task") : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * The quiet end of the day, below the last hour: a sleepy little scene and a
 * way into tomorrow. Purely decorative apart from the button.
 */
export function EndOfDay({ tomorrow, onPlan }: { tomorrow: WeekDay | null; onPlan: (button: HTMLElement) => void }) {
  const summary = tomorrowSummary(tomorrow);
  return (
    <div className="vcal__eod">
      <svg className="eod__art" viewBox="0 0 240 120" role="img" aria-label="A small house on a hill under the moon, lights on, stars out">
        <g className="eod__stars" fill="var(--ink-soft)">
          <circle className="eod__star" cx="28" cy="26" r="1.6" style={{ animationDelay: "0s" }} />
          <circle className="eod__star" cx="64" cy="12" r="1.2" style={{ animationDelay: "1.1s" }} />
          <circle className="eod__star" cx="96" cy="34" r="1.5" style={{ animationDelay: "2.2s" }} />
          <circle className="eod__star" cx="176" cy="20" r="1.3" style={{ animationDelay: "0.6s" }} />
          <circle className="eod__star" cx="214" cy="40" r="1.6" style={{ animationDelay: "1.7s" }} />
          <circle className="eod__star" cx="150" cy="8" r="1.1" style={{ animationDelay: "2.8s" }} />
        </g>
        <path d="M150 22a15 15 0 1 0 16 20 12 12 0 0 1-16-20z" fill="var(--ink-faint)" opacity="0.9" />
        <g className="eod__zs" fill="var(--ink-faint)" fontFamily="var(--font-display)" fontWeight="700">
          <text className="eod__z" x="172" y="30" fontSize="9">z</text>
          <text className="eod__z eod__z--b" x="181" y="21" fontSize="12">z</text>
        </g>
        <path d="M0 96c40-22 84-26 124-14 40 12 80 8 116-10v48H0z" fill="var(--surface-2)" />
        <path d="M0 108c50-14 96-12 140-4 36 6 70 4 100-4v20H0z" fill="var(--line)" opacity="0.7" />
        <g>
          <rect x="86" y="70" width="30" height="22" rx="2" fill="var(--ink-faint)" opacity="0.55" />
          <path d="M82 71l19-17 19 17z" fill="var(--ink-soft)" opacity="0.7" />
          <rect className="eod__window" x="94" y="77" width="8" height="8" rx="1" fill="var(--p2)" />
          <rect x="107" y="80" width="6" height="12" rx="1" fill="var(--surface)" opacity="0.6" />
        </g>
      </svg>
      <p className="eod__title">That&apos;s the day.</p>
      {summary ? <p className="eod__sub">Tomorrow: {summary}</p> : <p className="eod__sub">Nothing left but rest.</p>}
      {tomorrow ? (
        <button type="button" className="vcal__btn eod__plan" onClick={(e) => onPlan(e.currentTarget)}>
          Plan tomorrow →
        </button>
      ) : null}
    </div>
  );
}

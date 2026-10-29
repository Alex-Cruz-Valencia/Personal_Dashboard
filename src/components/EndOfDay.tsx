import type { WeekDay } from "@/lib/types";

/** x, y, radius, twinkle delay (s) in the 600x320 drawing: all in the sky above the hills. */
const STARS: [number, number, number, number][] = [
  [34, 38, 1.8, 0], [86, 92, 1.3, 1.2], [140, 30, 1.5, 2.4], [196, 70, 1.2, 0.6], [248, 22, 1.6, 1.8],
  [302, 84, 1.3, 3], [356, 40, 1.7, 0.9], [410, 96, 1.2, 2.1], [452, 26, 1.4, 3.3], [560, 110, 1.6, 1.5],
  [584, 36, 1.2, 2.7], [60, 150, 1.2, 0.3], [330, 150, 1.1, 1.9], [420, 150, 1.3, 2.5], [250, 130, 1.1, 3.6],
];

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
      <svg
        className="eod__art"
        viewBox="0 0 600 320"
        preserveAspectRatio="xMidYMax slice"
        role="img"
        aria-label="A night sky over rolling hills, a small house with its light on, the moon, and stars"
      >
        <defs>
          <linearGradient id="eod-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0.16 }} />
          </linearGradient>
        </defs>
        <rect width="600" height="320" fill="url(#eod-sky)" />
        <g fill="var(--ink-soft)">
          {STARS.map(([x, y, r, d]) => (
            <circle key={`${x}-${y}`} className="eod__star" cx={x} cy={y} r={r} style={{ animationDelay: `${d}s` }} />
          ))}
        </g>
        {/* Moon, house and trees sit in the middle of the drawing: a narrow space crops the sides. */}
        <g transform="translate(-70 0)">
          <path d="M486 58a24 24 0 1 0 26 32 19 19 0 0 1-26-32z" fill="var(--ink-faint)" opacity="0.9" />
          <g fill="var(--ink-faint)" fontFamily="var(--font-display)" fontWeight="700">
            <text className="eod__z" x="520" y="64" fontSize="13">z</text>
            <text className="eod__z eod__z--b" x="533" y="49" fontSize="17">z</text>
          </g>
        </g>
        <path d="M0 230c70-26 140-30 215-12 70 17 130 18 200-2 60-17 120-14 185 6v98H0z" fill="var(--surface-2)" opacity="0.75" />
        <path d="M0 262c90-24 170-22 250-6 80 16 150 14 350-8v72H0z" fill="var(--surface-2)" />
        <path d="M0 292c120-14 230-10 330 0 90 9 190 8 270-6v34H0z" fill="var(--line)" opacity="0.8" />
        <g transform="translate(-60 0)">
          <path d="M440 266l11-26 11 26z" fill="var(--ink-soft)" opacity="0.45" />
          <path d="M458 270l9-21 9 21z" fill="var(--ink-soft)" opacity="0.35" />
          <path d="M520 272l10-24 10 24z" fill="var(--ink-soft)" opacity="0.4" />
        </g>
        <g transform="translate(60 0)">
          <rect x="108" y="236" width="50" height="34" rx="3" fill="var(--ink-faint)" opacity="0.6" />
          <path d="M101 238l32-28 32 28z" fill="var(--ink-soft)" opacity="0.75" />
          <rect x="146" y="214" width="8" height="16" fill="var(--ink-soft)" opacity="0.7" />
          <rect className="eod__window" x="118" y="246" width="13" height="13" rx="1.5" fill="var(--p2)" />
          <rect x="140" y="251" width="10" height="19" rx="1.5" fill="var(--surface)" opacity="0.6" />
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

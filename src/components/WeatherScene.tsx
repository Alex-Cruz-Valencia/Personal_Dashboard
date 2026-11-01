import type { CSSProperties } from "react";
import type { SkyTime } from "@/lib/day-part";
import type { Sky } from "@/lib/types";
import { MeteorField } from "./MeteorField";

/** Wind this strong (mph) adds drifting streaks on top of whatever the sky is doing. */
export const BREEZY_MPH = 15;

const COUNT = { drizzle: 14, rain: 30, storm: 44, snow: 26 } as const;

/** Evenly scattered, but the same on server and client (no Math.random in render). */
const spread = (i: number, k: number) => ((i * k) % 97) / 97;


/** Slow, soft bands of sunlight that drift across the page now and then, then leave it alone. */
const BEAMS = [
  { w: 170, a: 16, c: 61, d: -8 },
  { w: 260, a: 20, c: 83, d: -47 },
];

/** Shooting stars inside the weather card itself (the page's own are only seen between cards). */
const CARD_METEORS = [
  { x: 18, y: 6, a: 24, c: 17, d: -3, l: 90 },
  { x: 64, y: 4, a: 150, c: 23, d: -12, l: 80 },
  { x: 92, y: 14, a: 156, c: 31, d: -21, l: 100 },
];

/** Fair-weather clouds: top %, width px, opacity, seconds to cross, start offset. */
const PUFFS = [
  { y: 8, w: 260, o: 0.75, c: 150, d: -40 },
  { y: 38, w: 180, o: 0.55, c: 210, d: -130 },
];
const CARD_PUFFS = [
  { y: 6, w: 150, o: 0.55, c: 120, d: -30 },
  { y: 34, w: 100, o: 0.4, c: 170, d: -110 },
];

/** A loose V, in px inside the flock's box; each bird keeps its own wingbeat. */
const FLOCK = [
  { x: 52, y: 20, f: 0.42 },
  { x: 34, y: 10, f: 0.5 },
  { x: 36, y: 31, f: 0.46 },
  { x: 14, y: 2, f: 0.38 },
  { x: 17, y: 37, f: 0.54 },
];

function Puff({ y, w, o, c, d }: (typeof PUFFS)[number]) {
  return (
    <svg className="scene__puff" viewBox="0 0 200 74" style={{ "--y": `${y}%`, "--w": `${w}px`, "--o": o, "--c": c, "--d": `${d}s` } as CSSProperties}>
      <circle cx="52" cy="50" r="24" />
      <circle cx="90" cy="34" r="33" />
      <circle cx="132" cy="44" r="27" />
      <circle cx="164" cy="56" r="17" />
      <rect x="30" y="52" width="150" height="22" rx="11" />
    </svg>
  );
}

function Flock({ y, c, d }: { y: number; c: number; d: number }) {
  return (
    <div className="scene__flock" style={{ "--y": `${y}%`, "--c": c, "--d": `${d}s` } as CSSProperties}>
      {FLOCK.map((b) => (
        <svg key={b.x + b.y} className="scene__bird" viewBox="0 0 16 7" style={{ "--x": `${b.x}px`, "--y": `${b.y}px`, "--f": b.f } as CSSProperties}>
          <path d="M1 5Q4.5 0 8 5Q11.5 0 15 5" />
        </svg>
      ))}
    </div>
  );
}

function Particles({ n, className }: { n: number; className: string }) {
  return Array.from({ length: n }, (_, i) => (
    <i
      key={i}
      className={className}
      style={
        {
          "--x": `${(spread(i, 37) * 100).toFixed(1)}%`,
          "--d": `${(-spread(i, 53) * 6).toFixed(2)}s`,
          "--t": `${(0.9 + spread(i, 29) * 0.9).toFixed(2)}`,
          "--s": spread(i, 71).toFixed(2),
        } as CSSProperties
      }
    />
  ));
}

/**
 * Quiet animated backdrop for the weather card: rain falls, wind streaks glide,
 * the sun breathes. Purely decorative (aria-hidden, pointer-events none) and
 * pure CSS, so it costs no JS once rendered and stops under reduced motion.
 */
export function WeatherScene({
  sky,
  isDay,
  variant = "card",
  celestial = true,
  fenced = true,
  time,
}: {
  sky: Sky;
  isDay: boolean;
  variant?: "card" | "page";
  /** Draw the sun / moon. Only the weather card does; other cards borrow the rest of the scene. */
  celestial?: boolean;
  /** The page's meteors hide behind its cards; the ambient screen has none to hide behind. */
  fenced?: boolean;
  /** ⚙ Sky → Time of day: paints the sky for this part of the day. Left out, the sky stays plain. */
  time?: SkyTime;
}) {
  const { windMph } = sky;
  // Sky themes show the sky itself: cloud cover and fog never draw over it. Plain keeps them.
  const kind = time && (sky.kind === "partly" || sky.kind === "cloudy" || sky.kind === "fog") ? "clear" : sky.kind;
  // The page-wide scene covers the whole viewport, so it needs more of everything.
  const k = variant === "page" ? 3 : 1;
  const wet = kind === "drizzle" || kind === "rain" || kind === "storm";
  const windy = windMph >= BREEZY_MPH;
  // Partly cloudy keeps the clear sky (sun, beams) with a couple of clouds passing. At night the
  // stars, meteors and moon always show, whatever the weather, with no clouds; rain and snow still fall.
  const open = kind === "clear" || kind === "partly";
  // Morning through afternoon, under sky themes. Rain, fog and snow already fill the sky.
  const daylight = time?.part === "morning" || time?.part === "noon" || time?.part === "afternoon";

  return (
    <div
      className={`scene scene--${kind} ${isDay ? "scene--day" : "scene--night"}${variant === "page" ? " scene--page" : ""}`}
      data-part={time?.part}
      style={time ? ({ "--sun-x": `${time.sunX}%`, "--sun-y": `${time.sunY}%` } as CSSProperties) : undefined}
      aria-hidden
    >
      {open && isDay ? (
        <>
          <span className="scene__wash" />
          {/* The sun and the moon are the weather card's: the page behind never repeats them. */}
          {variant === "card" && celestial ? (
            <div className="scene__sun">
              <span className="scene__rays" />
              <span className="scene__orb" />
            </div>
          ) : null}
        </>
      ) : null}
      {variant === "page" && open && isDay
        ? BEAMS.map((b, i) => (
            <span key={i} className="scene__beam" style={{ "--w": `${b.w}px`, "--a": `${b.a}deg`, "--c": b.c, "--d": `${b.d}s` } as CSSProperties} />
          ))
        : null}
      {!isDay ? (
        <>
          {variant === "page" ? <MeteorField fenced={fenced} /> : null}
          {variant === "card" && celestial
            ? CARD_METEORS.map((m, i) => (
                <span
                  key={i}
                  className="scene__meteor"
                  style={{ "--x": `calc(${m.x}% - ${m.l}px)`, "--y": `${m.y}%`, "--a": `${m.a}deg`, "--c": m.c, "--d": `${m.d}s`, "--l": `${m.l}px` } as CSSProperties}
                />
              ))
            : null}
          {variant === "card" && celestial ? <span className="scene__moon" /> : null}
          <Particles n={14 * (variant === "page" ? 5 : 1)} className="scene__star" />
        </>
      ) : null}
      {/* Clouds and mist are soft blurred blobs: by day only. Nights stay a clean starry sky. */}
      {isDay && (kind === "partly" || kind === "cloudy" || kind === "fog" || wet || kind === "snow") ? (
        <>
          <span className="scene__cloud scene__cloud--a" />
          <span className="scene__cloud scene__cloud--b" />
          {kind === "cloudy" || kind === "fog" ? <span className="scene__cloud scene__cloud--c" /> : null}
        </>
      ) : null}
      {daylight && kind === "clear"
        ? (variant === "page" ? PUFFS : CARD_PUFFS).map((p) => <Puff key={p.y} {...p} />)
        : null}
      {daylight && open ? (
        variant === "page" ? (
          <>
            <Flock y={18} c={70} d={-6} />
            <Flock y={58} c={95} d={-50} />
          </>
        ) : celestial ? (
          <Flock y={2} c={60} d={-8} />
        ) : null
      ) : null}
      {kind === "fog" && isDay ? (
        <>
          <span className="scene__mist scene__mist--a" />
          <span className="scene__mist scene__mist--b" />
        </>
      ) : null}
      {wet ? <Particles n={COUNT[kind as "drizzle" | "rain" | "storm"] * k} className="scene__drop" /> : null}
      {kind === "storm" ? <span className="scene__flash" /> : null}
      {kind === "snow" ? <Particles n={COUNT.snow * k} className="scene__flake" /> : null}
      {windy ? <Particles n={(windMph >= 25 ? 9 : 5) * (variant === "page" ? 2 : 1)} className="scene__gust" /> : null}
    </div>
  );
}

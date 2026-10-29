import type { CSSProperties } from "react";
import type { Sky } from "@/lib/types";

/** Wind this strong (mph) adds drifting streaks on top of whatever the sky is doing. */
export const BREEZY_MPH = 15;

const COUNT = { drizzle: 14, rain: 30, storm: 44, snow: 26 } as const;

/** Evenly scattered, but the same on server and client (no Math.random in render). */
const spread = (i: number, k: number) => ((i * k) % 97) / 97;

/**
 * Occasional shooting stars: each one crosses the sky for a second or two, then waits out a
 * long, different cycle, so they come "here and there" without a rhythm. x/y are start points
 * (% of the viewport), a the angle, c the cycle in seconds, d a head start, l the length (px).
 */
const METEORS = [
  { x: 6, y: 5, a: 24, c: 21, d: -4, l: 120 },
  { x: 38, y: 3, a: 30, c: 27, d: -13, l: 100 },
  { x: 64, y: 9, a: 27, c: 34, d: -22, l: 140 },
  { x: 18, y: 24, a: 22, c: 41, d: -31, l: 130 },
  { x: 52, y: 28, a: 29, c: 47, d: -9, l: 110 },
];

/** Slow, soft bands of sunlight that drift across the page now and then, then leave it alone. */
const BEAMS = [
  { w: 170, a: 16, c: 61, d: -8 },
  { w: 260, a: 20, c: 83, d: -47 },
];

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
export function WeatherScene({ sky, isDay, variant = "card" }: { sky: Sky; isDay: boolean; variant?: "card" | "page" }) {
  const { kind, windMph } = sky;
  // The page-wide scene covers the whole viewport, so it needs more of everything.
  const k = variant === "page" ? 3 : 1;
  const wet = kind === "drizzle" || kind === "rain" || kind === "storm";
  const windy = windMph >= BREEZY_MPH;

  return (
    <div className={`scene scene--${kind} ${isDay ? "scene--day" : "scene--night"}${variant === "page" ? " scene--page" : ""}`} aria-hidden>
      {kind === "clear" && isDay ? (
        <>
          <span className="scene__wash" />
          <div className="scene__sun">
            <span className="scene__rays" />
            <span className="scene__orb" />
          </div>
        </>
      ) : null}
      {variant === "page" && kind === "clear" && isDay
        ? BEAMS.map((b, i) => (
            <span key={i} className="scene__beam" style={{ "--w": `${b.w}px`, "--a": `${b.a}deg`, "--c": b.c, "--d": `${b.d}s` } as CSSProperties} />
          ))
        : null}
      {kind === "clear" && !isDay ? (
        <>
          {variant === "page"
            ? METEORS.map((m, i) => (
                <span
                  key={i}
                  className="scene__meteor"
                  style={{ "--x": `${m.x}%`, "--y": `${m.y}%`, "--a": `${m.a}deg`, "--c": m.c, "--d": `${m.d}s`, "--l": `${m.l}px` } as CSSProperties}
                />
              ))
            : null}
          <span className="scene__moon" />
          <Particles n={14 * (variant === "page" ? 5 : 1)} className="scene__star" />
        </>
      ) : null}
      {kind === "cloudy" || kind === "fog" || wet || kind === "snow" ? (
        <>
          <span className="scene__cloud scene__cloud--a" />
          <span className="scene__cloud scene__cloud--b" />
          {kind === "cloudy" || kind === "fog" ? <span className="scene__cloud scene__cloud--c" /> : null}
        </>
      ) : null}
      {kind === "fog" ? (
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

import type { CSSProperties } from "react";
import type { Sky } from "@/lib/types";

/** Wind this strong (mph) adds drifting streaks on top of whatever the sky is doing. */
export const BREEZY_MPH = 15;

const COUNT = { drizzle: 14, rain: 30, storm: 44, snow: 26 } as const;

/** Evenly scattered, but the same on server and client (no Math.random in render). */
const spread = (i: number, k: number) => ((i * k) % 97) / 97;

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
export function WeatherScene({ sky, isDay }: { sky: Sky; isDay: boolean }) {
  const { kind, windMph } = sky;
  const wet = kind === "drizzle" || kind === "rain" || kind === "storm";
  const windy = windMph >= BREEZY_MPH;

  return (
    <div className={`scene scene--${kind} ${isDay ? "scene--day" : "scene--night"}`} aria-hidden>
      {kind === "clear" && isDay ? (
        <>
          <span className="scene__wash" />
          <div className="scene__sun">
            <span className="scene__rays" />
            <span className="scene__orb" />
          </div>
        </>
      ) : null}
      {kind === "clear" && !isDay ? (
        <>
          <span className="scene__moon" />
          <Particles n={14} className="scene__star" />
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
      {wet ? <Particles n={COUNT[kind as "drizzle" | "rain" | "storm"]} className="scene__drop" /> : null}
      {kind === "storm" ? <span className="scene__flash" /> : null}
      {kind === "snow" ? <Particles n={COUNT.snow} className="scene__flake" /> : null}
      {windy ? <Particles n={windMph >= 25 ? 9 : 5} className="scene__gust" /> : null}
    </div>
  );
}

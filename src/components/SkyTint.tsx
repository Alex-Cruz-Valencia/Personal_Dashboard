"use client";

import type { CSSProperties } from "react";
import type { TodayInfo } from "@/lib/types";
import { useNowSeconds } from "@/lib/use-now";

type RGB = [number, number, number];

/** [hour offset from sunrise/sunset, tint]. Night is deep blue, dawn rose, day pale sky, dusk amber-violet. */
const NIGHT: RGB = [58, 72, 140];
const DAWN: RGB = [244, 160, 140];
const DAY: RGB = [120, 190, 226];
const DUSK: RGB = [236, 150, 96];
const DUSK_HIGH: RGB = [150, 110, 190];

const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Two tint colours for the current hour, easing between night, dawn, day and dusk. */
export function skyTint(now: number, sunrise: number, sunset: number): [RGB, RGB] {
  const stops: [number, RGB, RGB][] = [
    [sunrise - 1.5, NIGHT, NIGHT],
    [sunrise, DAWN, DAWN],
    [sunrise + 2.5, DAY, DAWN],
    [sunset - 2.5, DAY, DAY],
    [sunset, DUSK, DUSK_HIGH],
    [sunset + 1.5, NIGHT, NIGHT],
  ];
  if (now <= stops[0][0]) return [NIGHT, NIGHT];
  for (let i = 1; i < stops.length; i++) {
    if (now <= stops[i][0]) {
      const [h0, a0, b0] = stops[i - 1];
      const [h1, a1, b1] = stops[i];
      const t = smooth((now - h0) / (h1 - h0));
      return [mix(a0, a1, t), mix(b0, b1, t)];
    }
  }
  return [NIGHT, NIGHT];
}

/**
 * A slow wash of colour behind the cards that follows the sun: night blue,
 * dawn rose, day sky, dusk amber. Only used with glass surfaces, where the
 * backdrop actually shows through.
 */
export function SkyTint({ today, sunrise, sunset, frozen }: { today: TodayInfo; sunrise: number; sunset: number; frozen: boolean }) {
  // Re-colour once a minute; the CSS transition makes it a glide, not a jump.
  const now = useNowSeconds(today, frozen, 60) / 3600;
  const [a, b] = skyTint(now, sunrise, sunset);
  return (
    <div
      className="skytint"
      aria-hidden
      style={{ "--sky-a": a.join(" "), "--sky-b": b.join(" ") } as CSSProperties}
    >
      <span className="skytint__blob skytint__blob--a" />
      <span className="skytint__blob skytint__blob--b" />
    </div>
  );
}

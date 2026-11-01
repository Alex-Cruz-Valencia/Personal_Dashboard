/** The sky's seven moods, all counted from today's real sunrise and sunset, never the clock. */
export const DAY_PARTS = ["dawn", "morning", "noon", "afternoon", "golden", "dusk", "night"] as const;
export type DayPart = (typeof DAY_PARTS)[number];

/** What a weather scene needs to follow the sun. Positions are % of the scene. */
export interface SkyTime {
  part: DayPart;
  sunX: number;
  sunY: number;
}

interface Sun {
  sunrise: number;
  sunset: number;
}

/** Twilight either side of sunrise, the low light before sunset, the afterglow past it (hours). */
const DAWN = 0.75;
const GOLDEN = 1.25;
const DUSK = 0.75;
/** "Noon" is the three hours around solar noon. */
const NOON = 1.5;

/** Which part of the day it is. Earlier checks win, so a very short day just loses its noon. */
export function dayPart(now: number, { sunrise, sunset }: Sun): DayPart {
  if (now < sunrise - DAWN || now >= sunset + DUSK) return "night";
  if (now < sunrise + DAWN) return "dawn";
  if (now >= sunset) return "dusk";
  if (now >= sunset - GOLDEN) return "golden";
  const solarNoon = (sunrise + sunset) / 2;
  if (now < solarNoon - NOON) return "morning";
  return now < solarNoon + NOON ? "noon" : "afternoon";
}

/** An hour inside a part, for previews: `/?part=golden` works wherever the viewer's sun happens to set. */
export function partHour(part: DayPart, { sunrise, sunset }: Sun): number {
  const solarNoon = (sunrise + sunset) / 2;
  const hours: Record<DayPart, number> = {
    dawn: sunrise,
    morning: (sunrise + DAWN + solarNoon - NOON) / 2,
    noon: solarNoon,
    afternoon: (solarNoon + NOON + sunset - GOLDEN) / 2,
    golden: sunset - GOLDEN / 2,
    dusk: sunset + DUSK / 2,
    night: (sunset + DUSK + 24) / 2,
  };
  return hours[part];
}

interface SkyPicks {
  skyTheme: "time" | "plain";
  skyPart: DayPart | "auto";
}

/** The hour the sky is showing: the real one, or the middle of the part picked under ⚙ Sky time. */
export function skyHour(now: number, sun: Sun, { skyTheme, skyPart }: SkyPicks): number {
  return skyTheme === "time" && skyPart !== "auto" ? partHour(skyPart, sun) : now;
}

/**
 * What a weather scene should draw right now. A part picked under ⚙ Sky time moves the sky to
 * that hour and nothing else: the clock, greeting and curve stay on the real time.
 */
export function sceneSky(now: number, sun: Sun, picks: SkyPicks) {
  const hour = skyHour(now, sun, picks);
  const time = picks.skyTheme === "time" ? skyTime(hour, sun) : undefined;
  // Night keeps the original sky: stars, meteors and moon with no theme over them.
  return { isDay: hour >= sun.sunrise && hour < sun.sunset, time: time?.part === "night" ? undefined : time };
}

/** The part, plus where the sun sits: rising on the left, high at noon, setting on the right. */
export function skyTime(now: number, sun: Sun): SkyTime {
  const span = Math.max(sun.sunset - sun.sunrise, 1);
  const t = Math.min(Math.max((now - sun.sunrise) / span, 0), 1);
  return {
    part: dayPart(now, sun),
    sunX: Math.round(8 + t * 84),
    sunY: Math.round(80 - Math.sin(t * Math.PI) * 80),
  };
}

/**
 * The "Brief" greeting card's weather: a few short lines that change what you'd do, instead of
 * a curve to read. Pure and server/client-safe. Each line is chosen only when it says something
 * (rain ahead, wind, strong sun, how much light is left, tomorrow once the day is winding down).
 */

import { formatHour } from "./format";
import { minutesLabel } from "./plan";
import type { AgendaEvent, Weather } from "./types";

export type BriefIcon = "rain" | "dry" | "wind" | "sun" | "sunset" | "sunrise" | "tomorrow";

export interface BriefLine {
  icon: BriefIcon;
  text: string;
  /** A second, quieter clause ("during Career & Life Design"). */
  note?: string;
}

/** High / low for the "Simple" card and the top of the brief. */
export function highLow(w: Weather): string | null {
  if (w.high == null || w.low == null) return null;
  return `H ${w.high}° · L ${w.low}°`;
}

/** The one-line rain-or-wind clause for the "Simple" card. */
export function simpleOutlook(w: Weather, use24: boolean): string {
  const parts: string[] = [];
  if (w.rainWindow) parts.push(`Rain ${span(w.rainWindow.start, w.rainWindow.end, use24)} (${w.rainWindow.chance}%)`);
  else parts.push(w.rainChance != null && w.rainChance >= 30 ? `${w.rainChance}% chance of rain` : "No rain expected");
  const windy = w.windPeak && w.windPeak.mph >= 15 ? w.windPeak.mph : w.sky.windMph >= 15 ? w.sky.windMph : null;
  parts.push(windy ? `Windy, up to ${windy} mph` : `Wind ${w.sky.windMph} mph`);
  return parts.join(" · ");
}

function span(start: number, end: number, use24: boolean): string {
  return `${formatHour(start, use24)}–${formatHour(end, use24)}`;
}

export function briefLines(w: Weather, agenda: AgendaEvent[], nowHour: number, use24: boolean): BriefLine[] {
  const lines: BriefLine[] = [];

  if (w.rainWindow) {
    const { start, end, chance } = w.rainWindow;
    // Rain is worth more when it lands on something you have to get to.
    const hit = agenda.find((e) => e.end - e.start < 12 && e.start < end && e.end > start && e.end > nowHour);
    lines.push({
      icon: "rain",
      text: `Rain ${start <= nowHour ? `until ${formatHour(end, use24)}` : span(start, end, use24)}, ${chance}%`,
      note: hit ? `during ${hit.name}` : undefined,
    });
  } else if (nowHour < w.sunset) {
    lines.push({ icon: "dry", text: "Dry the rest of the day" });
  }

  if (w.windPeak && w.windPeak.mph >= 15 && nowHour < w.windPeak.at + 1) {
    lines.push({ icon: "wind", text: `Windy around ${formatHour(w.windPeak.at, use24)}`, note: `${w.windPeak.mph} mph` });
  }
  if (w.uvPeak && nowHour < w.uvPeak.at + 1) {
    lines.push({ icon: "sun", text: `Strong sun around ${formatHour(w.uvPeak.at, use24)}`, note: `UV ${w.uvPeak.index}` });
  }

  if (nowHour < w.sunset) {
    const left = Math.round((w.sunset - nowHour) * 60);
    lines.push({
      icon: "sunset",
      text: `Sunset ${formatHour(w.sunset, use24)}`,
      note: left <= 180 ? `${minutesLabel(left)} of light left` : undefined,
    });
  } else {
    lines.push({ icon: "sunrise", text: `Sunrise ${formatHour(w.sunrise, use24)}` });
  }

  // From late afternoon, tomorrow matters more than what's left of today.
  if (w.tomorrow && (nowHour >= 17 || nowHour >= w.sunset)) {
    const t = w.tomorrow;
    lines.unshift({
      icon: "tomorrow",
      text: `Tomorrow ${t.high}° / ${t.low}°, ${t.condition.toLowerCase()}`,
      note: t.rainChance >= 30 ? `${t.rainChance}% rain` : undefined,
    });
  }

  return lines.slice(0, 4);
}

import { formatHour } from "./format";
import type { Weather, WeekDay } from "./types";

/** One line of the evening's look at tomorrow. */
export interface GlanceLine {
  kind: "first" | "weather" | "task";
  /** The label before the text, e.g. "First". */
  label: string;
  text: string;
}

/**
 * Tomorrow in three lines for the end-of-day card: when it starts, what to wear, and the one
 * task that matters most. Each line is left out when its source can't say anything.
 */
export function tomorrowGlance(day: WeekDay | null, forecast: Weather["tomorrow"], use24: boolean): GlanceLine[] {
  const lines: GlanceLine[] = [];

  // Banners and "free" holds don't start a day; the first real commitment does.
  const timed = (day?.events ?? []).filter((e) => !e.allDay && !e.free).sort((a, b) => a.start - b.start);
  const first = timed[0];
  if (first) {
    const more = timed.length > 1 ? ` · ${timed.length} events` : "";
    lines.push({ kind: "first", label: "First", text: `${formatHour(first.start, use24)} ${first.name}${more}` });
  } else if (day?.events) {
    lines.push({ kind: "first", label: "First", text: "Nothing booked" });
  }

  if (forecast) {
    const rain = forecast.rainChance >= 30 ? `, ${forecast.rainChance}% rain` : "";
    lines.push({ kind: "weather", label: "Weather", text: `${forecast.high}° / ${forecast.low}°, ${forecast.condition.toLowerCase()}${rain}` });
  }

  // Most urgent first, then the earliest time; the list's own order breaks ties.
  const top = [...(day?.tasks ?? [])].sort((a, b) => a.priority - b.priority || (a.dueHour ?? 24) - (b.dueHour ?? 24))[0];
  if (top) {
    const at = top.dueHour != null ? ` · ${formatHour(top.dueHour, use24)}` : "";
    const more = day!.tasks!.length > 1 ? ` (+${day!.tasks!.length - 1} more)` : "";
    lines.push({ kind: "task", label: "Top task", text: `${top.name}${at}${more}` });
  }

  return lines;
}

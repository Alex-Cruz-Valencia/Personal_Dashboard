/** Which events to alert for. Pure, so it can be tested without a browser. */

import { formatHour } from "./format";
import type { AgendaEvent } from "./types";

/** How long before an event its alert goes out. */
export const ALERT_MINUTES = 10;

/** Includes the start, so an event moved to a new time alerts again. */
export const alertKey = (iso: string, e: AgendaEvent) => `${iso}|${e.id ?? e.name}|${e.start}`;

/** Events starting within the next few minutes that haven't alerted. Free ones aren't commitments. */
export function dueAlerts(agenda: AgendaEvent[], nowHour: number, iso: string, sent: ReadonlySet<string>): AgendaEvent[] {
  const lead = ALERT_MINUTES / 60;
  return agenda.filter((e) => !e.free && !e.allDay && e.start >= nowHour && e.start - nowHour <= lead && !sent.has(alertKey(iso, e)));
}

export function alertBody(e: AgendaEvent, nowHour: number, use24: boolean): string {
  const minutes = Math.round((e.start - nowHour) * 60);
  const when = minutes <= 0 ? "Starting now" : `In ${minutes} min`;
  return [`${when}, ${formatHour(e.start, use24)}`, e.location].filter(Boolean).join(" · ");
}

/** Only a real https link opens from a notification click. */
export const safeLink = (url?: string) => (url && /^https:\/\//i.test(url) ? url : undefined);

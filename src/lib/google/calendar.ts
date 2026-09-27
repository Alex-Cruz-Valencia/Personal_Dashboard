/**
 * Phase 4 — Agenda via Google Calendar API v3 (read-only).
 */

import "server-only";
import { config } from "@/lib/config";
import { dayBoundsUtc, decimalHourForTimestamp } from "@/lib/time";
import type { AgendaEvent, EventKind } from "@/lib/types";
import { getGoogleAccessToken } from "./tokens";

interface GCalDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GCalEvent {
  id: string;
  summary?: string;
  location?: string;
  description?: string;
  hangoutLink?: string;
  htmlLink?: string;
  status?: string;
  start: GCalDateTime;
  end: GCalDateTime;
  attendees?: { email?: string; responseStatus?: string; self?: boolean }[];
  eventType?: string;
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
}

interface GCalListResponse {
  items: GCalEvent[];
}

const FOCUS_RE = /\b(focus|deep work|deep-work|heads?[- ]down|no meeting|writing|block)\b/i;

function classify(event: GCalEvent): EventKind {
  const summary = event.summary ?? "";
  if (event.eventType === "focusTime" || FOCUS_RE.test(summary)) return "focus";
  const others = (event.attendees ?? []).filter((a) => !a.self).length;
  if (others > 0 || event.hangoutLink || /zoom|meet|teams/i.test(event.location ?? "")) {
    return "meeting";
  }
  return "personal";
}

function whereText(event: GCalEvent, kind: EventKind): string {
  const others = (event.attendees ?? []).filter((a) => !a.self).length;
  if (event.hangoutLink) {
    return others > 0 ? `Google Meet · ${others + 1} people` : "Google Meet";
  }
  if (event.location) {
    return others > 0 ? `${event.location} · ${others + 1} people` : event.location;
  }
  if (kind === "meeting" && others > 0) return `${others + 1} people`;
  return kind === "focus" ? "Blocked" : "Personal";
}

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

/** Best video-call URL for the event, if any. */
function meetingLinkOf(event: GCalEvent): string | undefined {
  if (event.hangoutLink) return event.hangoutLink;
  const video = event.conferenceData?.entryPoints?.find(
    (p) => p.entryPointType === "video" && p.uri,
  );
  if (video?.uri) return video.uri;
  const inLocation = event.location?.match(URL_RE)?.[0];
  if (inLocation) return inLocation;
  return event.description?.match(URL_RE)?.[0];
}

/** Google returns description as HTML — flatten it to plain text. */
function toPlainText(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const text = html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, 800) : undefined;
}

/** One calendar's events for the day. Thrown errors are the caller's problem. */
async function fetchCalendarEvents(
  calendarId: string,
  token: string,
  timeMin: string,
  timeMax: string,
): Promise<GCalEvent[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "25");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`Google Calendar (${calendarId}) responded ${res.status}`);
  }
  const data = (await res.json()) as GCalListResponse;
  return data.items ?? [];
}

export async function getAgenda(
  todayIso: string,
  timezone: string,
): Promise<AgendaEvent[]> {
  const token = await getGoogleAccessToken();
  const { timeMin, timeMax } = dayBoundsUtc(todayIso, timezone);
  const calendarIds = config.google.calendarIds;

  // One failed/inaccessible shared calendar (revoked access, a typo'd id)
  // shouldn't blank out the whole agenda — merge whatever succeeded and log
  // the rest, the same way `dashboard-data.ts` degrades other sources.
  const results = await Promise.allSettled(
    calendarIds.map((id) => fetchCalendarEvents(id, token, timeMin, timeMax)),
  );

  const events: { calendarIndex: number; event: GCalEvent }[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      for (const event of result.value) events.push({ calendarIndex: i, event });
    } else if (process.env.NODE_ENV !== "production") {
      console.warn(`[calendar] ${calendarIds[i]} → skipped:`, (result.reason as Error).message);
    }
  });
  if (events.length === 0 && results.every((r) => r.status === "rejected")) {
    throw new Error("Every configured calendar failed");
  }

  return events
    .filter(
      ({ event: e }) => e.status !== "cancelled" && e.start?.dateTime && e.end?.dateTime,
    )
    .map<AgendaEvent>(({ calendarIndex, event: e }) => {
      const kind = classify(e);
      const others = (e.attendees ?? []).filter((a) => !a.self).length;
      return {
        // Event ids are only unique within their own calendar — prefix with
        // the calendar's index so two calendars can't collide.
        id: `${calendarIndex}:${e.id}`,
        name: e.summary?.trim() || "(busy)",
        where: whereText(e, kind),
        start: decimalHourForTimestamp(e.start.dateTime as string, todayIso, timezone),
        end: decimalHourForTimestamp(e.end.dateTime as string, todayIso, timezone),
        kind,
        location: e.location?.trim() || undefined,
        meetingLink: meetingLinkOf(e),
        description: toPlainText(e.description),
        attendeeCount: others > 0 ? others + 1 : undefined,
        htmlLink: e.htmlLink,
      };
    })
    .filter((e) => e.end > e.start)
    .sort((a, b) => a.start - b.start);
}

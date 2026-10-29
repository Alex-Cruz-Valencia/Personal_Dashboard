/**
 * Phase 4 — Agenda via Google Calendar API v3 (read/write on events).
 */

import "server-only";
import { config } from "@/lib/config";
import { dayBoundsUtc, decimalHourForTimestamp } from "@/lib/time";
import type { AgendaEvent, CalendarLegendItem, EventKind } from "@/lib/types";
import { googleFetch } from "./tokens";
import { colorFromHex, colorFromId, type EventColor } from "@/lib/event-colors";

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

/** Cache tag on agenda reads — mutations call `revalidateTag(CALENDAR_TAG)`. */
export const CALENDAR_TAG = "calendar";

interface GCalDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GCalEvent {
  id: string;
  /** Shared by every copy of the same invitation across calendars. */
  iCalUID?: string;
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
  /** Set only when the event has its own color ("1"–"11"); otherwise it shows its calendar's. */
  colorId?: string;
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
}

interface GCalListResponse {
  items: GCalEvent[];
}

interface GCalListEntry {
  id: string;
  deleted?: boolean;
  accessRole?: string;
  /** The calendar's color as the viewer set it, e.g. "#16a765". */
  backgroundColor?: string;
  summary?: string;
  /** The viewer's own rename of a calendar, when they've set one. */
  summaryOverride?: string;
  primary?: boolean;
}

interface GCalCalendarListResponse {
  items?: GCalListEntry[];
}

/**
 * Every calendar this account can see — including one shared from a
 * different Google account — minus `GOOGLE_CALENDAR_EXCLUDE_IDS`.
 * `freeBusyReader` is the lowest access role, so a "see only free/busy"
 * share is still included (its events just come back opaque; `classify()`
 * and the "(busy)" fallback already handle that).
 */
async function discoverCalendars(): Promise<{ id: string; color?: EventColor; label: string }[]> {
  // Writable calendars first: when the same event shows up on two calendars,
  // `dedupeEvents` keeps the first copy, and that should be one you can edit.
  const ROLE_RANK: Record<string, number> = { owner: 0, writer: 1, reader: 2, freeBusyReader: 3 };
  const url = new URL(`${CAL_BASE}/users/me/calendarList`);
  url.searchParams.set("minAccessRole", "freeBusyReader");

  const res = await googleFetch(url, {
    next: { revalidate: 300, tags: [CALENDAR_TAG] },
  });
  if (!res.ok) throw new Error(`Google CalendarList responded ${res.status}`);
  const data = (await res.json()) as GCalCalendarListResponse;

  const excluded = new Set(config.google.calendarExcludeIds.map((id) => id.toLowerCase()));
  return (data.items ?? [])
    .filter((c) => !c.deleted && !excluded.has(c.id.toLowerCase()))
    .sort((a, b) => (ROLE_RANK[a.accessRole ?? ""] ?? 4) - (ROLE_RANK[b.accessRole ?? ""] ?? 4))
    .map((c) => ({ id: c.id, color: colorFromHex(c.backgroundColor), label: calendarLabel(c) }));
}

/**
 * A short name for the legend: the viewer's own rename if any; the primary
 * calendar is "Personal"; another account's calendar is named by its domain
 * ("dartmouth.edu" → "Dartmouth", "dali.dartmouth.edu" → "DALI"); a shared
 * calendar by its title without "[TEAM]"-style tags.
 */
function calendarLabel(c: GCalListEntry): string {
  if (c.summaryOverride?.trim()) return c.summaryOverride.trim();
  if (c.primary) return "Personal";
  const at = c.id.indexOf("@");
  if (at > 0 && !/calendar\.google\.com$/.test(c.id)) {
    const domain = c.id.slice(at + 1).toLowerCase();
    if (domain === "gmail.com" || domain === "googlemail.com") return c.id.slice(0, at);
    const word = domain.split(".")[0];
    return word.length <= 4 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1);
  }
  return (c.summary ?? "Calendar").replace(/\[[^\]]*\]/g, "").trim() || "Calendar";
}

/** Google's built-in calendars (holidays, birthdays, week numbers) — not worth a legend entry. */
const BUILT_IN = /#(holiday|contacts|weeknum)@group\.v\.calendar\.google\.com$/;

/** Which color is which calendar, for the day calendar's legend. Reuses the cached calendar list. */
export async function getCalendarLegend(): Promise<CalendarLegendItem[]> {
  const seen = new Set<string>();
  return (await discoverCalendars())
    .filter((c) => c.color && !BUILT_IN.test(c.id))
    .filter((c) => (seen.has(c.label) ? false : (seen.add(c.label), true)))
    .map((c) => ({ label: c.label, color: c.color as EventColor }));
}

/** An event's color family: its own color if set, else its calendar's. */
function eventColor(e: GCalEvent, calendarColor: EventColor | undefined): EventColor | undefined {
  return colorFromId(e.colorId) ?? calendarColor;
}

/**
 * The same invitation on two connected calendars (yours + one shared with
 * you) comes back once per calendar, with the same `iCalUID`. Keep the first
 * copy of each (uid, start) — start is part of the key because a recurring
 * series shares one uid across its instances. Events without a uid are kept.
 */
function dedupeEvents<T extends { event: GCalEvent }>(events: T[]): T[] {
  const seen = new Set<string>();
  return events.filter(({ event: e }) => {
    if (!e.iCalUID) return true;
    const key = `${e.iCalUID}|${e.start?.dateTime ?? e.start?.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

/** One calendar's events for a time range. Thrown errors are the caller's problem. */
async function fetchCalendarEvents(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  { maxResults = 25, revalidate = 60 }: { maxResults?: number; revalidate?: number } = {},
): Promise<GCalEvent[]> {
  const url = new URL(`${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));

  const res = await googleFetch(url, {
    next: { revalidate, tags: [CALENDAR_TAG] },
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
  const { timeMin, timeMax } = dayBoundsUtc(todayIso, timezone);
  const calendars = await discoverCalendars();
  const calendarIds = calendars.map((c) => c.id);

  // One failed/inaccessible shared calendar (revoked access, a typo'd id)
  // shouldn't blank out the whole agenda — merge whatever succeeded and log
  // the rest, the same way `dashboard-data.ts` degrades other sources.
  const results = await Promise.allSettled(
    calendarIds.map((id) => fetchCalendarEvents(id, timeMin, timeMax)),
  );

  const events: { calendarId: string; calendarColor?: EventColor; event: GCalEvent }[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      for (const event of result.value) events.push({ calendarId: calendarIds[i], calendarColor: calendars[i].color, event });
    } else if (process.env.NODE_ENV !== "production") {
      console.warn(`[calendar] ${calendarIds[i]} → skipped:`, (result.reason as Error).message);
    }
  });
  if (results.length > 0 && results.every((r) => r.status === "rejected")) {
    throw new Error("Every discovered calendar failed");
  }

  return dedupeEvents(
    events.filter(
      ({ event: e }) => e.status !== "cancelled" && e.start?.dateTime && e.end?.dateTime,
    ),
  )
    .map<AgendaEvent>(({ calendarId, calendarColor, event: e }) => {
      const kind = classify(e);
      const others = (e.attendees ?? []).filter((a) => !a.self).length;
      return {
        // Event ids are only unique within their own calendar — the real
        // calendar id (not a positional index, which shifts if discovery
        // ever returns a different order) makes each id independently
        // resolvable for a later edit/delete. See `parseCompositeId`.
        id: compositeId(calendarId, e.id),
        name: e.summary?.trim() || "(busy)",
        where: whereText(e, kind),
        start: decimalHourForTimestamp(e.start.dateTime as string, todayIso, timezone),
        end: decimalHourForTimestamp(e.end.dateTime as string, todayIso, timezone),
        kind,
        color: eventColor(e, calendarColor),
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

/**
 * The week strip's data: several later days from ONE request per calendar (the
 * whole range at once), instead of a full `getAgenda` per day. That is roughly
 * (calendars) requests instead of (days x (1 + calendars)), which matters
 * because Google was cutting off the burst of parallel connections the
 * per-day version opened on every refresh.
 *
 * `dayIsos` are consecutive local dates. Returns one list per day, in order;
 * an event that spans days appears in each, clipped to that day (same clamping
 * as `getAgenda`). Only what the strip needs is filled in (times, name, kind).
 * Week-ahead data changes slowly, so it is cached longer than today's agenda.
 */
export async function getWeekAgendas(
  dayIsos: string[],
  timezone: string,
): Promise<AgendaEvent[][]> {
  const byDay: AgendaEvent[][] = dayIsos.map(() => []);
  if (dayIsos.length === 0) return byDay;

  const { timeMin } = dayBoundsUtc(dayIsos[0], timezone);
  const { timeMax } = dayBoundsUtc(dayIsos[dayIsos.length - 1], timezone);
  const calendars = await discoverCalendars();
  const calendarIds = calendars.map((c) => c.id);

  const results = await Promise.allSettled(
    calendarIds.map((id) =>
      fetchCalendarEvents(id, timeMin, timeMax, { maxResults: 250, revalidate: 300 }),
    ),
  );
  if (results.length > 0 && results.every((r) => r.status === "rejected")) {
    throw new Error("Every discovered calendar failed");
  }

  results.forEach((result, i) => {
    if (result.status !== "fulfilled") return;
    for (const e of result.value) {
      if (e.status === "cancelled" || !e.start?.dateTime || !e.end?.dateTime) continue;
      const startTs = e.start.dateTime;
      const endTs = e.end.dateTime;
      dayIsos.forEach((day, d) => {
        const start = decimalHourForTimestamp(startTs, day, timezone);
        const end = decimalHourForTimestamp(endTs, day, timezone);
        if (end <= start) return; // not on this day (both clamp to the same edge)
        byDay[d].push({
          id: compositeId(calendarIds[i], e.id),
          name: e.summary?.trim() || "(busy)",
          where: "",
          start,
          end,
          kind: classify(e),
          color: eventColor(e, calendars[i].color),
        });
      });
    }
  });
  return byDay.map((list) => list.sort((a, b) => a.start - b.start));
}

/* ---------- editing an event ---------- */

/** `AgendaEvent.id` is `<encoded calendar id>:<event id>` — see `getAgenda`. */
function compositeId(calendarId: string, eventId: string): string {
  return `${encodeURIComponent(calendarId)}:${eventId}`;
}

function parseCompositeId(id: string): { calendarId: string; eventId: string } {
  const sep = id.indexOf(":");
  // encodeURIComponent always escapes ":", so the first one found is
  // necessarily the separator, not part of the encoded calendar id.
  if (sep <= 0 || sep === id.length - 1) throw new Error("Malformed event id");
  return { calendarId: decodeURIComponent(id.slice(0, sep)), eventId: id.slice(sep + 1) };
}

function eventUrl(calendarId: string, eventId: string): string {
  // The id comes back from the browser, so it's encoded: a "/" or "?" in it
  // must not be able to point the request at a different Google resource.
  return `${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
}

/**
 * A 403 here has consistently meant "correctly-scoped token, self-organized
 * event, still rejected" in testing against a Google Workspace (school)
 * account — almost certainly a domain admin's API access-control policy
 * restricting Calendar writes for unverified apps, not anything this app's
 * OAuth flow or request shape can fix. Surfacing that distinction beats a
 * bare status code.
 */
function writeErrorMessage(action: string, status: number): string {
  if (status === 403) {
    return (
      `Google Calendar ${action} responded 403 (Forbidden). If your Google ` +
      `account is managed by a school or employer, this is usually their ` +
      `Workspace admin restricting third-party apps from editing Calendar — ` +
      `not something this app can work around.`
    );
  }
  return `Google Calendar ${action} responded ${status}`;
}

/**
 * Delete a single occurrence. `getAgenda` lists with `singleEvents=true`, so
 * `eventId` here already names one instance, not the recurring series — a
 * recurring event's other occurrences are untouched, matching Google
 * Calendar's own default "This event" behavior.
 */
export async function deleteEvent(id: string): Promise<void> {
  const { calendarId, eventId } = parseCompositeId(id);
  const res = await googleFetch(eventUrl(calendarId, eventId), {
    method: "DELETE",
  });
  // 410 means it's already gone (e.g. deleted elsewhere) — treat as success.
  if (!res.ok && res.status !== 410) {
    throw new Error(writeErrorMessage("delete", res.status));
  }
}

export interface EventTimePatch {
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM", 24-hour */
  time: string;
  timeZone: string;
}

export interface EventPatch {
  summary?: string;
  location?: string;
  description?: string;
  /** Rescheduling: both are required together (Google needs a valid pair). */
  start?: EventTimePatch;
  end?: EventTimePatch;
}

/** Same single-occurrence semantics as `deleteEvent`. */
export async function updateEvent(id: string, patch: EventPatch): Promise<void> {
  const { calendarId, eventId } = parseCompositeId(id);

  const body: Record<string, unknown> = {};
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.location !== undefined) body.location = patch.location;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.start) {
    body.start = { dateTime: `${patch.start.date}T${patch.start.time}:00`, timeZone: patch.start.timeZone };
  }
  if (patch.end) {
    body.end = { dateTime: `${patch.end.date}T${patch.end.time}:00`, timeZone: patch.end.timeZone };
  }

  const res = await googleFetch(eventUrl(calendarId, eventId), {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(writeErrorMessage("update", res.status));
}

export interface NewEvent {
  summary: string;
  description?: string;
  start: EventTimePatch;
  end: EventTimePatch;
}

/**
 * Create an event on the user's primary calendar — used by the Plan card's
 * "Block it" to put a task into an open gap. Returns the new event's
 * composite id (same shape `getAgenda` produces).
 */
export async function createEvent(input: NewEvent): Promise<string> {
  const res = await googleFetch(`${CAL_BASE}/calendars/primary/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: `${input.start.date}T${input.start.time}:00`, timeZone: input.start.timeZone },
      end: { dateTime: `${input.end.date}T${input.end.time}:00`, timeZone: input.end.timeZone },
    }),
  });
  if (!res.ok) throw new Error(writeErrorMessage("create", res.status));
  const created = (await res.json()) as { id: string };
  return compositeId("primary", created.id);
}

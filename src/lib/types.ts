import type { EventColor } from "./event-colors";
/**
 * Domain model for the Morning Dashboard.
 *
 * Every card renders from these types. The mock dataset in `mock-data.ts`
 * and each live integration (`weather/`, `tasks/`, `google/`, `anthropic/`)
 * produce the exact same shapes, so components never know or care where a
 * value came from.
 *
 * Times are **decimal hours in the viewer's local day**: 9.5 === 9:30am.
 * The day arc positions everything on that scale.
 */

/** 1 = urgent, 2 = normal, 3 = someday. Matches the task-list priority ramp. */
export type Priority = 1 | 2 | 3;

/** Drives the calendar color language across the arc, agenda and legend. */
export type EventKind = "meeting" | "focus" | "personal";

/** 1 = blocking someone, 2 = needs an answer, 3 = can wait. */
export type Urgency = 1 | 2 | 3;

export interface UserInfo {
  /** First name, used in the greeting. */
  name: string;
}

export interface TodayInfo {
  /** ISO date (YYYY-MM-DD) for the day being shown. */
  iso: string;
  /** Current time as a decimal hour (8.2 === 8:12am). */
  nowHour: number;
  /** IANA zone the dashboard is showing, so the live clock matches the server's day. */
  timezone: string;
}

/** What the sky is doing right now; drives the weather card's ambient scene. */
export interface Sky {
  /** "partly": some cloud, but the stars (or sun) still show. "cloudy" is overcast. */
  kind: "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "storm" | "snow";
  /** Current wind, mph. */
  windMph: number;
}

/** One hourly reading on the weather card's temperature curve. */
export interface HourlyTemp {
  /** Decimal hour of the local day (6 … 22 across the arc window). */
  h: number;
  /** Temperature, rounded °F. */
  t: number;
  /** The one thing worth knowing at that hour, e.g. "Fog thinning", "UV 8". */
  note: string;
}

export interface Weather {
  tempNow: number;
  /** Short human phrase, e.g. "Coastal fog, clearing by ten". */
  condition: string;
  /** Where the forecast is for, e.g. "San Francisco, CA" — reassurance it's local. */
  place: string;
  /** Sunrise / sunset as decimal hours, local time. */
  sunrise: number;
  sunset: number;
  /** One-line ambient footnote, e.g. "No rain expected · Wind 7 mph NW". */
  footnote: string;
  /** Current sky, for the ambient scene behind the card. */
  sky: Sky;
  /** Hourly temps across the day-arc window; drives the temperature curve. */
  hourly: HourlyTemp[];

  /* ---- for the simpler / briefing greeting cards (absent in older sample data) ---- */
  /** Today's high and low, °F. */
  high?: number;
  low?: number;
  /** "Feels like" right now, °F. */
  feelsLike?: number;
  /** Today's best chance of rain, %. */
  rainChance?: number;
  /** Rest of today: the next stretch with a real chance of rain (decimal hours), if any. */
  rainWindow?: { start: number; end: number; chance: number } | null;
  /** Rest of today: the strongest wind, mph, and when. */
  windPeak?: { mph: number; at: number };
  /** Rest of today: the peak UV index, when it's worth a mention (6+). */
  uvPeak?: { index: number; at: number } | null;
  /** Tomorrow at a glance. */
  tomorrow?: { high: number; low: number; condition: string; rainChance: number };
}

export interface Task {
  /** Stable id from the source system, when there is one. */
  id?: string;
  name: string;
  priority: Priority;
  /** Project or context label shown as a chip, e.g. "Kestrel". */
  meta: string;
  /** Display string for the due column: "11:00", "EOD", "Today", "—". */
  due: string;
  /** Decimal hour for the arc tick, or null when the task has no clock time. */
  dueHour: number | null;
  /** Whole days past its due date (1 = yesterday); absent when not overdue. */
  overdueDays?: number;

  /* ---- detail (shown in the click-to-expand editor; optional) ---- */
  /** Source project id, for the "move to project" control. */
  projectId?: string;
  /** Longer notes. */
  description?: string;
  /** Label names (without the leading @). */
  labels?: string[];
  /** True when the due date repeats. */
  isRecurring?: boolean;
  /** The repeat rule, e.g. "every saturday" — only when isRecurring. */
  recurrence?: string;
  /** Hard deadline (distinct from due), ISO date or null. */
  deadline?: string | null;
  /** Planned working time in minutes, or null. */
  durationMinutes?: number | null;

  /* ---- as Todoist shows it (the task row mirrors the Todoist app) ---- */
  /** Todoist's own P1–P4 (1 = red/urgent … 4 = none); `priority` collapses P2/P3. */
  todoistPriority?: 1 | 2 | 3 | 4;
  /** Section name within the project, shown as "Project / Section". */
  section?: string;
  /** The project's color as hex, for the "#" mark. */
  projectColor?: string;
  /** Section id, so "Move to…" can mark where the task is now. */
  sectionId?: string;
  /** The local day it's due, "YYYY-MM-DD" (absent with no due date). */
  dueDate?: string;
}

/** A Todoist project, for the task editor's "move to" control. */
export interface Project {
  id: string;
  name: string;
  /** The project's color as hex, for the "#" mark. */
  color?: string;
}

/** A Todoist section, for the task menu's "Move to…". */
export interface Section {
  id: string;
  name: string;
  projectId: string;
}

export interface AgendaEvent {
  id?: string;
  name: string;
  /** Location / video link / attendee summary, e.g. "Zoom · 6 people". */
  where: string;
  /** Start / end as decimal hours, local time. */
  start: number;
  end: number;
  kind: EventKind;
  /** The event's Google color family (its own, else its calendar's); absent for sample data. */
  color?: EventColor;

  /* ---- detail (shown in the click-to-expand card; optional) ---- */
  /** Physical location or room. */
  location?: string;
  /** Video-call URL (Meet / Zoom / Teams …). */
  meetingLink?: string;
  /** Plain-text description / agenda. */
  description?: string;
  /** Number of invitees. */
  attendeeCount?: number;
  /** Link to open the event in its source calendar. */
  htmlLink?: string;
}

export type RsvpStatus = "accepted" | "declined" | "tentative" | "needsAction";

export interface EventGuest {
  /** Their name when Google has one, else their email. */
  name: string;
  email?: string;
  status: RsvpStatus;
  organizer: boolean;
  self: boolean;
}

/** What the event card loads when it opens: too much to carry on every refresh. */
export interface EventDetails {
  /** "Weekly on Monday, 9 times"; absent for a one-off. */
  recurrence?: string;
  guests: EventGuest[];
  /** "10 minutes before". */
  reminders: string[];
  /** The calendar it's on. */
  calendar: string;
  /** You can change it here (not a read-only shared calendar). */
  canEdit: boolean;
  /** Your own answer, when you're on the guest list. */
  rsvp: RsvpStatus | null;
  /** The whole description; `AgendaEvent.description` is cut short. */
  description?: string;
}

export interface Reply {
  id?: string;
  /** Display name of the sender. */
  from: string;
  subject: string;
  /** Relative age string, e.g. "18h", "1d", "3d". */
  age: string;
  /** Short reason chip, e.g. "Blocking her", "Answer yes/no". */
  note: string;
  /** Still unread — shown with a small marker. */
  unread?: boolean;
  urgency: Urgency;
}

/** The visible span of the day on the arc. */
export interface ArcWindow {
  from: number;
  to: number;
}

/**
 * Per-slice provenance:
 * - `live` — a configured source answered
 * - `mock` — a configured source failed, so this is sample data (worth flagging)
 * - `off`  — nothing configured for this slice; sample data is expected
 */
export type SliceSource = "live" | "mock" | "off";

export interface SourceStatus {
  weather: SliceSource;
  tasks: SliceSource;
  calendar: SliceSource;
  email: SliceSource;
  summary: SliceSource;
}

/** An event as the week's expanded view draws it. */
/** The full event (location, link, notes…), so a click in the week opens the same card as today's calendar. */
export type WeekEvent = AgendaEvent;

/** A task due on a day of the week, for the expanded view. */
export interface WeekTask {
  id?: string;
  name: string;
  priority: Priority;
  /** Decimal hour when the task has a clock time. */
  dueHour: number | null;
}

/** One day of the week strip: how much of it is spoken for. */
export interface WeekDay {
  iso: string;
  /** "Wed". */
  name: string;
  /** Day of month, "28". */
  date: string;
  isToday: boolean;
  /** Hours of timed events, or null when that day's calendar couldn't be read. */
  bookedHours: number | null;
  eventCount: number | null;
  /** Todoist tasks due that day, or null when tasks aren't connected. */
  tasksDue: number | null;
  /** Booked + estimated task time is past the "heavy" line. */
  heavy: boolean;
  /** The day's events, for the expanded view (null when the calendar couldn't be read). */
  events: WeekEvent[] | null;
  /** The day's tasks, for the expanded view (null when tasks aren't connected). */
  tasks: WeekTask[] | null;
}

/** Everything one render of the dashboard needs. */
export interface DashboardData {
  user: UserInfo;
  today: TodayInfo;
  weather: Weather;
  /** One-sentence "shape of the day" note (AI-generated when configured). */
  dayNote: string;
  tasks: Task[];
  agenda: AgendaEvent[];
  replies: Reply[];
  arc: ArcWindow;
  /** The weather card's own window — same end as `arc`, an independently
   *  configurable start (see `DashboardSettings.weatherStart`). */
  weatherArc: ArcWindow;
  sources: SourceStatus;
  /** Google is configured but its stored connection is dead (revoked or
   *  expired refresh token) — the cards offer a "Reconnect" link. */
  googleReconnect: boolean;
  /** Today + the next six days; null when neither calendar nor tasks are connected. */
  week: WeekDay[] | null;
  /** AI features are available (model + Google both configured). */
  ai: boolean;
  /** Todoist is connected, so "Make task" on an email can write to it. */
  canAddTasks: boolean;
  /** Connected calendars and their color family, for the calendar's legend; empty when not live. */
  calendars: CalendarLegendItem[];
}

export interface CalendarLegendItem {
  /** "Personal", "Dartmouth", "DALI", "Evergreen 26F" … */
  label: string;
  color: EventColor;
}

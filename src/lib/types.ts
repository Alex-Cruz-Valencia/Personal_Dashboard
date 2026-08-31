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
  /** Hourly temps across the day-arc window; drives the temperature curve. */
  hourly: HourlyTemp[];
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
  urgency: Urgency;
}

/** The visible span of the day on the arc. */
export interface ArcWindow {
  from: number;
  to: number;
}

/** Which slices are backed by a live source vs. falling back to mock data. */
export interface SourceStatus {
  weather: "live" | "mock";
  tasks: "live" | "mock";
  calendar: "live" | "mock";
  email: "live" | "mock";
  summary: "live" | "mock";
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
  sources: SourceStatus;
}

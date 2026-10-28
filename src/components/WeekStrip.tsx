"use client";

import { useState, type CSSProperties } from "react";
import { formatHour, layoutOverlaps } from "@/lib/format";
import type { WeekDay, WeekEvent, WeekTask } from "@/lib/types";

/** A full bar is this many hours of booked + task time. */
const BAR_HOURS = 8;
/** Pixels per hour in the expanded grid. */
const HOUR_PX = 34;
/** Events at least this long are banners, not timed blocks. */
const ALL_DAY_HOURS = 12;
const MAX_TASKS_SHOWN = 5;
const PRIORITY_NAME = { 1: "Urgent", 2: "Normal", 3: "Someday" } as const;

const hoursLabel = (h: number) => (h < 0.1 ? "Open" : `${Math.round(h * 2) / 2}h booked`);

function describe(d: WeekDay): string {
  const parts = [`${d.name} ${d.date}`];
  if (d.bookedHours !== null) parts.push(hoursLabel(d.bookedHours));
  if (d.tasksDue !== null) parts.push(`${d.tasksDue} ${d.tasksDue === 1 ? "task" : "tasks"} due`);
  if (d.heavy) parts.push("heavy day");
  return parts.join(", ");
}

/**
 * The next seven days at a glance: how much of each is booked and how many
 * tasks fall due, with heavy days flagged in words. "Expand" opens the same
 * week as a calendar grid with each day's events and tasks. Informational only.
 */
export function WeekStrip({ days, use24 }: { days: WeekDay[]; use24: boolean }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const pickedDay = days.find((d) => d.iso === picked) ?? null;
  return (
    <section className={`card week${open ? " week--open" : ""}`} aria-label="This week">
      <div className="card__head">
        <h2 className="card__title">This week</h2>
        <div className="week__key">
          <span className="week__key-item week__key-item--booked">booked</span>
          <span className="week__key-item week__key-item--tasks">tasks due</span>
          <button type="button" className="week__expand" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>
      {open ? (
        <WeekGrid days={days} use24={use24} />
      ) : (
        <>
        <ol className="week__days">
          {days.map((d) => {
            const bookedPct = Math.min(100, ((d.bookedHours ?? 0) / BAR_HOURS) * 100);
            const taskPct = Math.min(100 - bookedPct, (((d.tasksDue ?? 0) * 0.5) / BAR_HOURS) * 100);
            return (
              <li
                key={d.iso}
                className={`week__day${d.isToday ? " week__day--today" : ""}${d.heavy ? " week__day--heavy" : ""}${picked === d.iso ? " week__day--picked" : ""}`}
              >
                <button
                  type="button"
                  className="week__daybtn"
                  aria-label={describe(d)}
                  aria-expanded={picked === d.iso}
                  aria-controls="week-daydetail"
                  onClick={() => setPicked(picked === d.iso ? null : d.iso)}
                >
                <div className="week__name">
                  {d.isToday ? "Today" : d.name} <span className="week__date">{d.date}</span>
                </div>
                <div className="week__bar" aria-hidden="true">
                  <i className="week__bar-booked" style={{ width: `${bookedPct}%` }} />
                  <i className="week__bar-tasks" style={{ width: `${taskPct}%` }} />
                </div>
                <div className="week__meta">{d.bookedHours === null ? "No calendar" : hoursLabel(d.bookedHours)}</div>
                <div className="week__meta">
                  {d.tasksDue === null ? "" : `${d.tasksDue} ${d.tasksDue === 1 ? "task" : "tasks"}`}
                </div>
                {d.heavy ? <div className="week__heavy">Heavy</div> : null}
                </button>
              </li>
            );
          })}
        </ol>
        {pickedDay ? <DayDetail day={pickedDay} use24={use24} onClose={() => setPicked(null)} /> : null}
        </>
      )}
    </section>
  );
}

const isAllDay = (e: WeekEvent) => e.end - e.start >= ALL_DAY_HOURS;

/** Seven columns: tasks due, all-day banners, then a time grid like a calendar's week view. */
function WeekGrid({ days, use24 }: { days: WeekDay[]; use24: boolean }) {
  const timed = days.flatMap((d) => (d.events ?? []).filter((e) => !isAllDay(e) && e.end > e.start));
  // Show 8am–6pm at least, stretching to cover whatever the week holds.
  const from = Math.max(0, Math.min(8, timed.length ? Math.floor(Math.min(...timed.map((e) => e.start))) : 8));
  const to = Math.min(24, Math.max(18, timed.length ? Math.ceil(Math.max(...timed.map((e) => e.end))) : 18));
  const y = (h: number) => (Math.min(Math.max(h, from), to) - from) * HOUR_PX;
  const marks: number[] = [];
  for (let h = from; h <= to; h++) marks.push(h);

  return (
    <div className="week__scroll">
      <div className="week__grid">
        <div className="week__corner" />
        {days.map((d) => (
          <div key={d.iso} className={`week__colhead${d.isToday ? " week__colhead--today" : ""}`} aria-label={describe(d)}>
            <span className="week__name">
              {d.isToday ? "Today" : d.name} <span className="week__date">{d.date}</span>
            </span>
            <span className="week__meta">
              {d.bookedHours === null ? "No calendar" : hoursLabel(d.bookedHours)}
              {d.heavy ? <b className="week__heavy">Heavy</b> : null}
            </span>
          </div>
        ))}

        <div className="week__rowlabel">Tasks</div>
        {days.map((d) => (
          <TaskCell key={d.iso} tasks={d.tasks} use24={use24} />
        ))}

        <div className="week__rowlabel">All day</div>
        {days.map((d) => (
          <div key={d.iso} className="week__cell">
            {(d.events ?? []).filter(isAllDay).map((e, i) => (
              <div key={e.id ?? `${e.name}${i}`} className={`week__banner week__ev--${e.kind}`} title={e.name}>
                {e.name}
              </div>
            ))}
          </div>
        ))}

        <div className="week__gutter" style={{ height: (to - from) * HOUR_PX }} aria-hidden="true">
          {marks.slice(1, -1).map((h) => (
            <span key={h} className="week__hour" style={{ top: y(h) }}>
              {formatHour(h, use24)}
            </span>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn key={d.iso} day={d} marks={marks} y={y} height={(to - from) * HOUR_PX} use24={use24} />
        ))}
      </div>
    </div>
  );
}

function TaskCell({ tasks, use24 }: { tasks: WeekTask[] | null; use24: boolean }) {
  if (tasks === null) return <div className="week__cell" />;
  const shown = tasks.slice(0, MAX_TASKS_SHOWN);
  return (
    <div className="week__cell">
      {shown.map((t, i) => (
        <div key={t.id ?? `${t.name}${i}`} className={`week__task week__task--p${t.priority}`} title={`${t.name} (${PRIORITY_NAME[t.priority]})`}>
          <i aria-hidden="true" />
          <span className="week__task-name">{t.name}</span>
          {t.dueHour !== null ? <span className="week__task-time">{formatHour(t.dueHour, use24)}</span> : null}
        </div>
      ))}
      {tasks.length > shown.length ? <div className="week__more">+{tasks.length - shown.length} more</div> : null}
    </div>
  );
}

function DayColumn({
  day,
  marks,
  y,
  height,
  use24,
}: {
  day: WeekDay;
  marks: number[];
  y: (h: number) => number;
  height: number;
  use24: boolean;
}) {
  const events = (day.events ?? []).filter((e) => !isAllDay(e) && e.end > e.start);
  const lanes = layoutOverlaps(events);
  return (
    <div className={`week__col${day.isToday ? " week__col--today" : ""}`} style={{ height }}>
      {marks.map((h) => (
        <div key={h} className="week__line" style={{ top: y(h) }} />
      ))}
      {events.map((e, i) => {
        const top = y(e.start);
        const h = Math.max(16, y(e.end) - top - 2);
        const { lane, lanes: n } = lanes[i];
        return (
          <div
            key={e.id ?? `${e.name}${i}`}
            className={`week__event week__ev--${e.kind}`}
            style={{ top, height: h, left: `calc(${(lane / n) * 100}% + 1px)`, width: `calc(${100 / n}% - 2px)` } as CSSProperties}
            title={`${e.name}, ${formatHour(e.start, use24)} to ${formatHour(e.end, use24)}`}
          >
            <span className="week__event-title">{e.name}</span>
            {h >= 34 ? <span className="week__event-time">{formatHour(e.start, use24)}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

const longDay = (d: WeekDay) =>
  new Date(`${d.iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

/** One picked day, in full: its agenda beside its tasks. Informational, like the rest of the week. */
function DayDetail({ day, use24, onClose }: { day: WeekDay; use24: boolean; onClose: () => void }) {
  const events = [...(day.events ?? [])].sort((a, b) => a.start - b.start);
  const tasks = day.tasks ?? [];
  const summary = [
    day.bookedHours === null ? null : hoursLabel(day.bookedHours),
    day.events === null ? null : `${events.length} ${events.length === 1 ? "event" : "events"}`,
    day.tasks === null ? null : `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`,
  ].filter(Boolean);
  return (
    <div className="weekday" id="week-daydetail" role="region" aria-label={`${longDay(day)} in detail`}>
      <div className="weekday__head">
        <h3 className="weekday__title">{day.isToday ? "Today" : longDay(day)}</h3>
        <span className="weekday__sum">{summary.join(" · ")}</span>
        <button type="button" className="week__expand weekday__close" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="weekday__cols">
        <section className="weekday__col" aria-label="Agenda">
          <h4 className="weekday__h">Agenda</h4>
          {day.events === null ? (
            <p className="weekday__empty">Calendar isn&apos;t connected.</p>
          ) : events.length === 0 ? (
            <p className="weekday__empty">Nothing scheduled.</p>
          ) : (
            <ul className="weekday__list">
              {events.map((e, i) => (
                <li key={e.id ?? `${e.name}${i}`} className="weekday__ev">
                  <i className={`weekday__dot weekday__dot--${e.kind}`} aria-hidden="true" />
                  <span className="weekday__time">
                    {isAllDay(e) ? "All day" : `${formatHour(e.start, use24)} – ${formatHour(e.end, use24)}`}
                  </span>
                  <span className="weekday__name">{e.name}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="weekday__col" aria-label="Tasks">
          <h4 className="weekday__h">Tasks</h4>
          {day.tasks === null ? (
            <p className="weekday__empty">Tasks aren&apos;t connected.</p>
          ) : tasks.length === 0 ? (
            <p className="weekday__empty">No tasks due.</p>
          ) : (
            <ul className="weekday__list">
              {tasks.map((t, i) => (
                <li key={t.id ?? `${t.name}${i}`} className={`week__task week__task--p${t.priority}`}>
                  <i aria-hidden="true" />
                  <span className="week__task-name">{t.name}</span>
                  {t.dueHour !== null ? <span className="week__task-time">{formatHour(t.dueHour, use24)}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

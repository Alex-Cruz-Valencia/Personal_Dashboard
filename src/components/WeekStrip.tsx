import type { WeekDay } from "@/lib/types";

/** A full bar is this many hours of booked + task time. */
const BAR_HOURS = 8;

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
 * tasks fall due, with heavy days flagged in words. Informational only.
 */
export function WeekStrip({ days }: { days: WeekDay[] }) {
  return (
    <section className="card week" aria-label="This week">
      <div className="card__head">
        <h2 className="card__title">This week</h2>
        <div className="week__key">
          <span className="week__key-item week__key-item--booked">booked</span>
          <span className="week__key-item week__key-item--tasks">tasks due</span>
        </div>
      </div>
      <ol className="week__days">
        {days.map((d) => {
          const bookedPct = Math.min(100, ((d.bookedHours ?? 0) / BAR_HOURS) * 100);
          const taskPct = Math.min(100 - bookedPct, (((d.tasksDue ?? 0) * 0.5) / BAR_HOURS) * 100);
          return (
            <li
              key={d.iso}
              className={`week__day${d.isToday ? " week__day--today" : ""}${d.heavy ? " week__day--heavy" : ""}`}
              aria-label={describe(d)}
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
            </li>
          );
        })}
      </ol>
    </section>
  );
}

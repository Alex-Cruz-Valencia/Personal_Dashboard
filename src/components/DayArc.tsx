import {
  arcRangeLabel,
  buildArcEvents,
  buildArcTasks,
  buildHourLines,
  buildScaleLabels,
  arcPct,
  formatHour,
} from "@/lib/format";
import type { DashboardSettings } from "@/lib/settings";
import { use24Hour } from "@/lib/settings";
import type { AgendaEvent, ArcWindow, Task, TodayInfo } from "@/lib/types";

interface DayArcProps {
  agenda: AgendaEvent[];
  tasks: Task[];
  arc: ArcWindow;
  today: TodayInfo;
  settings: DashboardSettings;
}

export function DayArc({ agenda, tasks, arc, today, settings }: DayArcProps) {
  const use24 = use24Hour(settings);
  const hourLines = buildHourLines(arc);
  const arcEvents = buildArcEvents(agenda, arc, use24);
  const arcTasks = buildArcTasks(tasks, arc);
  const scaleLabels = buildScaleLabels(arc, use24);
  const nowLeft = arcPct(today.nowHour, arc).toFixed(2);
  const nowLabel = formatHour(today.nowHour, use24);

  return (
    <section className="card dayarc">
      <div className="dayarc__head">
        <h2 className="dayarc__title">
          The day arc
          <span className="dayarc__sub">{arcRangeLabel(arc, use24)}</span>
        </h2>
        <div className="dayarc__legend">
          <span>
            <i className="dayarc__swatch" style={{ background: "var(--cal-meeting)" }} />
            meeting
          </span>
          <span>
            <i className="dayarc__swatch" style={{ background: "var(--cal-focus)" }} />
            focus block
          </span>
          <span>
            <i className="dayarc__swatch" style={{ background: "var(--cal-personal)" }} />
            personal
          </span>
          <span>
            <i className="dayarc__swatch" style={{ background: "var(--ink-faint)" }} />
            task due
          </span>
        </div>
      </div>

      <div className="arc">
        <div className="arc__band">
          {hourLines.map((h, i) => (
            <div key={`h${i}`} className="arc__hour" style={{ left: `${h.left}%` }} />
          ))}
          {arcEvents.map((e, i) => (
            <div
              key={`e${i}`}
              className={e.cls}
              style={{ left: `${e.left}%`, width: `${e.width}%` }}
            >
              <div className="arc__event-label">{e.label}</div>
              <div className="arc__event-time">{e.timeLabel}</div>
            </div>
          ))}
        </div>

        <div className="arc__now" style={{ left: `${nowLeft}%` }}>
          <div className="arc__now-label">NOW {nowLabel}</div>
        </div>

        <div className="arc__ticks">
          {arcTasks.map((t, i) => (
            <div key={`t${i}`} className="arc__task-tick" style={{ left: `${t.left}%` }} />
          ))}
        </div>

        <div className="arc__scale">
          {scaleLabels.map((s, i) => (
            <div key={`s${i}`} className="arc__scale-label" style={{ left: `${s.left}%` }}>
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

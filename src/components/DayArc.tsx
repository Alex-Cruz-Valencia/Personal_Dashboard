"use client";

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
import { useEventDetail } from "./EventDetail";

interface DayArcProps {
  agenda: AgendaEvent[];
  tasks: Task[];
  arc: ArcWindow;
  today: TodayInfo;
  settings: DashboardSettings;
}

export function DayArc({ agenda, tasks, arc, today, settings }: DayArcProps) {
  const use24 = use24Hour(settings);
  const { open, isSelected } = useEventDetail();
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
          {arcEvents.map((e, i) => {
            const event = agenda[i];
            const selected = isSelected(event);
            return (
              <div
                key={`e${i}`}
                className={`${e.cls}${selected ? " arc__event--selected" : ""}`}
                style={{ left: `${e.left}%`, width: `${e.width}%` }}
                role="button"
                tabIndex={0}
                aria-label={`${event.name}, details`}
                onClick={(ev) => open(event, ev.currentTarget)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    open(event, ev.currentTarget);
                  }
                }}
              >
                <div className="arc__event-label">{e.label}</div>
                <div className="arc__event-time">{e.timeLabel}</div>
              </div>
            );
          })}
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

"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  arcRangeLabel,
  buildArcEvents,
  buildArcTasks,
  buildHourLines,
  buildScaleLabels,
  arcPct,
  expandedHourPx,
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
  const [expanded, setExpanded] = useExpanded();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const hourPx = expanded ? expandedHourPx(agenda) : undefined;
  const arcWidth = hourPx ? (arc.to - arc.from) * hourPx : undefined;
  const hourLines = buildHourLines(arc);
  const arcEvents = buildArcEvents(agenda, arc, use24, hourPx);
  const arcTasks = buildArcTasks(tasks, arc);
  const scaleLabels = buildScaleLabels(arc, use24, expanded ? 1 : 2);
  const nowPct = arcPct(today.nowHour, arc);
  const nowLeft = nowPct.toFixed(2);
  const nowLabel = formatHour(today.nowHour, use24);

  // Opening the expanded view lands on "now" (a third in from the left, so
  // what's next is in view), not on the start of the day.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!expanded || !el || !arcWidth) return;
    el.scrollLeft = Math.max(0, (nowPct / 100) * arcWidth - el.clientWidth / 3);
    // Only on toggling open — not on every 60s refresh while reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  return (
    <section className={`card dayarc${expanded ? " dayarc--expanded" : ""}`}>
      <div className="dayarc__head">
        <h2 className="dayarc__title">
          The day arc
          <span className="dayarc__sub">{arcRangeLabel(arc, use24)}</span>
        </h2>
        <div className="dayarc__tools">
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
          <button
            type="button"
            className="dayarc__expand"
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Fit the whole day in view" : "Zoom in so every event has room"}
          >
            {expanded ? "Fit day" : "Expand"}
          </button>
        </div>
      </div>

      <div className="arc__scroller" ref={scrollerRef}>
        <div className="arc" style={arcWidth ? { width: arcWidth } : undefined}>
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
                  title={e.title}
                  style={
                    {
                      left: `${e.left}%`,
                      width: `${e.width}%`,
                      ...(e.lanes > 1 ? { "--lane": e.lane, "--lanes": e.lanes } : {}),
                    } as CSSProperties
                  }
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
                  {e.side ? (
                    // Only shown when the block is too narrow for the label
                    // above (container query in globals.css).
                    <div
                      className={`arc__sidelabel arc__sidelabel--${e.side.dir}`}
                      style={{ maxWidth: `${e.side.maxWidth}%` }}
                      aria-hidden="true"
                    >
                      <span className="arc__sidelabel-name">{e.label}</span>
                      <span className="arc__sidelabel-time">{e.timeLabel}</span>
                    </div>
                  ) : null}
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
      </div>
    </section>
  );
}

const EXPANDED_KEY = "dayarc:expanded";

/** Per-viewer convenience, so it's browser storage, not the prefs cookie. */
function useExpanded(): [boolean, (v: boolean) => void] {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after SSR
      if (localStorage.getItem(EXPANDED_KEY) === "1") setExpanded(true);
    } catch {}
  }, []);
  const set = (v: boolean) => {
    setExpanded(v);
    try {
      localStorage.setItem(EXPANDED_KEY, v ? "1" : "0");
    } catch {}
  };
  return [expanded, set];
}

"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { upNext } from "@/lib/attention";
import { dateLineFor, formatHour, layoutOverlaps } from "@/lib/format";
import { minutesLabel } from "@/lib/plan";
import type { DashboardSettings } from "@/lib/settings";
import { use24Hour } from "@/lib/settings";
import type { AgendaEvent, ArcWindow, TodayInfo } from "@/lib/types";
import { useNowSeconds } from "@/lib/use-now";
import { useEventDetail } from "./EventDetail";
import { formatClock, useFocus } from "./Focus";

/** Pixels per hour. A 30-minute event is 28px: room for a one-line title. */
const HOUR_PX = 56;
/** Events shorter than this show only their title. */
const TWO_LINE_PX = 40;
const THREE_LINE_PX = 60;

interface DayCalendarProps {
  agenda: AgendaEvent[];
  arc: ArcWindow;
  today: TodayInfo;
  settings: DashboardSettings;
  /** Demo mode: "now" stays at the sample time. */
  frozen?: boolean;
  /** The task the Focus button starts on. */
  focusTask?: string;
}

/**
 * Today as a vertical day view, the way Google Calendar draws it: hours down
 * the left, events as blocks sized by duration, overlapping events side by
 * side, a line at the current time. Click an event for its details.
 */
export function DayCalendar({ agenda, arc, today, settings, frozen = false, focusTask }: DayCalendarProps) {
  const use24 = use24Hour(settings);
  const { open, isSelected } = useEventDetail();
  const focus = useFocus();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const landed = useRef(false);

  // The now-line and event states move on their own between the 60s server refreshes.
  const nowHour = useNowSeconds(today, frozen, 15) / 3600;
  const hours = arc.to - arc.from;
  const height = hours * HOUR_PX;
  const y = (h: number) => (Math.min(Math.max(h, arc.from), arc.to) - arc.from) * HOUR_PX;
  const lanes = layoutOverlaps(agenda);
  const next = upNext(agenda, nowHour);
  const nowVisible = nowHour >= arc.from && nowHour <= arc.to;

  const hourMarks: number[] = [];
  for (let h = Math.ceil(arc.from); h <= Math.floor(arc.to); h++) hourMarks.push(h);

  // Land on the present, a third of the way down, so what's next is in view.
  // Once per page load, not on every 60s refresh while someone is scrolled elsewhere.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || landed.current) return;
    landed.current = true;
    const anchor = nowVisible ? nowHour : (agenda[0]?.start ?? arc.from);
    el.scrollTop = Math.max(0, y(anchor) - el.clientHeight / 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="card vcal" aria-label="Today's calendar">
      <div className="vcal__head">
        <h2 className="card__title">
          Today
          <span className="vcal__date">{dateLineFor(today.iso)}</span>
        </h2>
        {focus.session ? (
          <div className="vcal__status vcal__focus-status" aria-live="polite">
            <span className="vcal__tag">Focus</span>
            <span className="vcal__name">{focus.session.name}</span>
            <span className="vcal__when">
              {focus.done ? "Complete" : formatClock(focus.remainingMs)}
              {!focus.done && focus.session.endsAt == null ? " paused" : ""}
            </span>
            {!focus.done ? (
              <button
                type="button"
                className="vcal__btn"
                onClick={focus.session.endsAt == null ? focus.resume : focus.pause}
              >
                {focus.session.endsAt == null ? "Resume" : "Pause"}
              </button>
            ) : null}
            <button type="button" className="vcal__btn" onClick={focus.stop}>
              {focus.done ? "Dismiss" : "Stop"}
            </button>
          </div>
        ) : (
          <>
            {next ? (
              <div className="vcal__status" aria-live="polite">
                <span className="vcal__tag">{next.mode === "now" ? "Now" : "Next"}</span>
                <span className="vcal__name">{next.name}</span>
                <span className="vcal__when">
                  {next.mode === "now" ? `${minutesLabel(next.minutes)} left` : `in ${minutesLabel(next.minutes)}`}
                </span>
              </div>
            ) : null}
            <button
              type="button"
              className="vcal__btn"
              onClick={() => focus.start(focusTask ?? "Focus", 25)}
              title={focusTask ? `Start 25 minutes on: ${focusTask}` : "Start a 25 minute focus session"}
            >
              Focus 25
            </button>
          </>
        )}
      </div>

      <div className="vcal__scroller" ref={scrollerRef}>
        <div className="vcal__body" style={{ height }}>
          <div className="vcal__gutter" aria-hidden="true">
            {hourMarks.map((h) => (
              <span key={h} className="vcal__hour-label" style={{ top: y(h) }}>
                {h === Math.ceil(arc.from) ? "" : formatHour(h, use24)}
              </span>
            ))}
          </div>

          <div className="vcal__col">
            {hourMarks.map((h) => (
              <div key={h} className="vcal__line" style={{ top: y(h) }} />
            ))}

            {focus.session ? (
              <div
                className="vcal__focus"
                style={{
                  top: y(focus.session.startHour),
                  height: Math.max(20, y(focus.session.startHour + focus.session.durationMs / 3_600_000) - y(focus.session.startHour)),
                }}
                aria-hidden="true"
              >
                <i
                  className="vcal__focus-done"
                  style={{ height: `${Math.min(100, Math.max(0, (1 - focus.remainingMs / focus.session.durationMs) * 100))}%` }}
                />
                <span className="vcal__focus-label">Focus</span>
              </div>
            ) : null}

            {agenda.map((e, i) => {
              const top = y(e.start);
              const h = Math.max(20, y(e.end) - top - 2);
              const { lane, lanes: n } = lanes[i];
              const state =
                e.end <= nowHour ? "past" : e.start <= nowHour ? "now" : e.start - nowHour <= 0.25 ? "soon" : "later";
              return (
                <div
                  key={e.id ?? `${e.name}${i}`}
                  className={`vcal__event vcal__event--${e.kind} vcal__event--${state}${isSelected(e) ? " vcal__event--selected" : ""}`}
                  style={
                    {
                      top,
                      height: h,
                      left: `calc(${(lane / n) * 100}% + 2px)`,
                      width: `calc(${100 / n}% - 4px)`,
                    } as CSSProperties
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={`${e.name}, ${formatHour(e.start, use24)} to ${formatHour(e.end, use24)}. Details`}
                  onClick={(ev) => open(e, ev.currentTarget)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      open(e, ev.currentTarget);
                    }
                  }}
                >
                  <div className="vcal__event-title">{e.name}</div>
                  {h >= TWO_LINE_PX ? (
                    <div className="vcal__event-time">
                      {formatHour(e.start, use24)} – {formatHour(e.end, use24)}
                    </div>
                  ) : null}
                  {h >= THREE_LINE_PX && (e.location || e.where) ? (
                    <div className="vcal__event-where">{e.location || e.where}</div>
                  ) : null}
                  {state === "now" ? (
                    <i className="vcal__event-prog" style={{ width: `${(((nowHour - e.start) / (e.end - e.start)) * 100).toFixed(1)}%` }} />
                  ) : null}
                </div>
              );
            })}

            {nowVisible ? (
              <div className="vcal__now" style={{ top: y(nowHour) }} aria-label={`Now, ${formatHour(nowHour, use24)}`}>
                <i />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

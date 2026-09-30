"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
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
  const fitWidth = useContentWidth(scrollerRef, expanded);
  const pan = useDragPan(scrollerRef, expanded);
  const hours = arc.to - arc.from;
  // Zoom only as far as the day needs: if every event already gets its room
  // at the card's own width, the arc just fills the card and doesn't scroll.
  const hourPx =
    expanded && fitWidth > 0
      ? Math.max(expandedHourPx(agenda), fitWidth / hours)
      : undefined;
  const arcWidth = hourPx ? Math.round(hours * hourPx) : undefined;
  const hourLines = buildHourLines(arc);
  const arcEvents = buildArcEvents(agenda, arc, use24, hourPx);
  const arcTasks = buildArcTasks(tasks, arc);
  const scaleLabels = buildScaleLabels(arc, use24, expanded ? 1 : 2);
  const nowPct = arcPct(today.nowHour, arc);
  const nowLeft = nowPct.toFixed(2);
  const nowLabel = formatHour(today.nowHour, use24);

  // Opening the expanded view lands on "now" (a third in from the left, so
  // what's next is in view), not on the start of the day.
  // Once per opening — not on every 60s refresh or resize while reading.
  const landed = useRef(false);
  useLayoutEffect(() => {
    if (!expanded) {
      landed.current = false;
      return;
    }
    const el = scrollerRef.current;
    if (!el || !arcWidth) return;
    if (!landed.current) {
      landed.current = true;
      el.scrollLeft = Math.max(0, (nowPct / 100) * arcWidth - el.clientWidth / 3);
    }
    // The arc's width just changed under the scroller — re-check the fades.
    pan.sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, arcWidth, nowPct]);

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

      <div
        className={`arc__scroller${pan.more.left ? " arc__scroller--more-left" : ""}${pan.more.right ? " arc__scroller--more-right" : ""}${pan.dragging ? " arc__scroller--dragging" : ""}`}
        ref={scrollerRef}
        {...pan.handlers}
      >
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
                  className={`${e.cls}${e.textCls ?? ""}${selected ? " arc__event--selected" : ""}`}
                  title={e.title}
                  style={
                    {
                      left: `${e.left}%`,
                      width: `${e.width}%`,
                      ...(e.lanes > 1 ? { "--lane": e.lane, "--lanes": e.lanes } : {}),
                    ...e.textVars,
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
                  <div className="arc__event-time">
                    {expanded && !e.shortTime ? e.rangeLabel : e.timeLabel}
                  </div>
                  {expanded && e.where ? (
                    <div className="arc__event-where">{e.where}</div>
                  ) : null}
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

/**
 * Per-viewer convenience, so it's browser storage, not the prefs cookie.
 * Expanded is the default; only an explicit "Fit day" ("0") turns it off.
 * SSR renders the fitted arc (no width to measure there anyway).
 */
function useExpanded(): [boolean, (v: boolean) => void] {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(EXPANDED_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after SSR
    if (stored !== "0") setExpanded(true);
  }, []);
  const set = (v: boolean) => {
    setExpanded(v);
    try {
      localStorage.setItem(EXPANDED_KEY, v ? "1" : "0");
    } catch {}
  };
  return [expanded, set];
}

/** Content-box width of the scroller (the width the arc can fill unscrolled). */
function useContentWidth(
  ref: RefObject<HTMLDivElement | null>,
  active: boolean,
): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      setWidth(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, active]);
  return width;
}

/**
 * Mouse drag-to-pan for the scrolling arc (trackpads and touch already
 * scroll sideways natively; a mouse wheel doesn't), plus which edges have
 * more day beyond them, for the fade hints. A drag past a few px swallows
 * the click that ends it, so panning never opens an event by accident.
 */
function useDragPan(ref: RefObject<HTMLDivElement | null>, active: boolean) {
  const [more, setMore] = useState({ left: false, right: false });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const sync = () => {
    const el = ref.current;
    if (!el || !active) return setMore({ left: false, right: false });
    const max = el.scrollWidth - el.clientWidth;
    setMore({ left: el.scrollLeft > 2, right: el.scrollLeft < max - 2 });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handlers = {
    onScroll: sync,
    onPointerDown: (ev: ReactPointerEvent<HTMLDivElement>) => {
      if (!active || ev.pointerType !== "mouse" || ev.button !== 0) return;
      drag.current = { x: ev.clientX, left: ev.currentTarget.scrollLeft, moved: false };
    },
    onPointerMove: (ev: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.x;
      if (!d.moved && Math.abs(dx) < 5) return;
      if (!d.moved) {
        d.moved = true;
        setDragging(true);
        try {
          ev.currentTarget.setPointerCapture(ev.pointerId);
        } catch {}
      }
      ev.currentTarget.scrollLeft = d.left - dx;
    },
    onPointerUp: () => {
      if (drag.current?.moved) suppressClick.current = true;
      drag.current = null;
      setDragging(false);
    },
    onPointerCancel: () => {
      drag.current = null;
      setDragging(false);
    },
    onClickCapture: (ev: ReactMouseEvent) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        ev.stopPropagation();
        ev.preventDefault();
      }
    },
  };
  return { more, dragging, handlers, sync };
}

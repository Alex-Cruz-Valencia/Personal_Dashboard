"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { upNext } from "@/lib/attention";
import { dateLineFor, decimalHourToTimeInput, formatHour, layoutOverlaps } from "@/lib/format";
import { minutesLabel } from "@/lib/plan";
import type { DashboardSettings } from "@/lib/settings";
import { use24Hour } from "@/lib/settings";
import type { AgendaEvent, ArcWindow, TodayInfo, WeekDay } from "@/lib/types";
import { useNowSeconds } from "@/lib/use-now";
import { EndOfDay } from "./EndOfDay";
import { useEventDetail } from "./EventDetail";
import { formatClock, useFocus } from "./Focus";
import { Popover } from "./Popover";
import { DayDetail } from "./WeekStrip";

/** Pixels per hour. A 30-minute event is 28px: room for a one-line title. */
const HOUR_PX = 56;
/** Events shorter than this show only their title. */
const TWO_LINE_PX = 40;
const THREE_LINE_PX = 60;
/** Where "now" sits in the view when the calendar centres on it (fraction of the height). */
const NOW_AT = 0.4;
/** Untouched this long (ms) and off-centre: drift back to now by itself. */
const IDLE_RETURN_MS = 60_000;
/** With past events tucked away, the calendar starts this many hours before now (to the hour above). */
const PAST_KEEP_H = 1;
/** Dragging and drawing snap to this many hours (15 minutes). */
const SNAP = 0.25;
/** A pointer that moves less than this many px is a click, not a drag. */
const DRAG_PX = 4;
/** Within this many px of the scroller's edge a drag scrolls it. */
const EDGE_PX = 30;

interface Span {
  start: number;
  end: number;
}

interface DayCalendarProps {
  agenda: AgendaEvent[];
  arc: ArcWindow;
  today: TodayInfo;
  settings: DashboardSettings;
  /** Demo mode: "now" stays at the sample time. */
  frozen?: boolean;
  /** The task the Focus button starts on. */
  focusTask?: string;
  /** Google is connected: events can be dragged, resized and drawn. */
  editable?: boolean;
  /** Tomorrow's agenda and tasks, for "Plan tomorrow" (null when neither source is readable). */
  tomorrow?: WeekDay | null;
}

/**
 * Today as a vertical day view, the way Google Calendar draws it: hours down
 * the left, events as blocks sized by duration, overlapping events side by
 * side, a line at the current time. Click an event for its details; when
 * Google is connected, drag one to move it, drag its bottom edge to resize it,
 * or drag on an empty stretch to add a new one. Nothing is saved until you let go.
 */
export function DayCalendar({ agenda: rawAgenda, arc, today, settings, frozen = false, focusTask, editable = false, tomorrow = null }: DayCalendarProps) {
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
  const router = useRouter();

  // A moved event shows at its new time at once; the override only applies to the
  // agenda it was made against, so the next server render replaces it.
  const [moved, setMoved] = useState<Record<string, Span & { base: AgendaEvent[] }>>({});
  const agenda = rawAgenda.map((e) => {
    const m = e.id ? moved[e.id] : undefined;
    return m && m.base === rawAgenda ? { ...e, start: m.start, end: m.end } : e;
  });
  const lanes = layoutOverlaps(agenda);
  const next = upNext(agenda, nowHour);
  const nowVisible = nowHour >= arc.from && nowHour <= arc.to;

  const hourMarks: number[] = [];
  for (let h = Math.ceil(arc.from); h <= Math.floor(arc.to); h++) hourMarks.push(h);

  const nowY = y(nowHour);
  const [away, setAway] = useState<"up" | "down" | null>(null);
  const lastTouch = useRef(0);

  // Past events: by default the calendar starts about an hour before now and the rest of the
  // morning sits above the top edge, out of sight. Scrolling up (or the pill) brings it back.
  const [showPast, setShowPast] = useState(false);
  const [snap, setSnap] = useState(false);
  // The card is only as tall as the day left needs; while the morning is open it keeps the height it had.
  const [lockH, setLockH] = useState<number | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const collapsed = settings.pastEvents === "hide" && !showPast;
  const viewFrom = collapsed ? Math.min(Math.max(Math.floor(nowHour - PAST_KEEP_H), arc.from), arc.to) : arc.from;
  const hiddenPx = (viewFrom - arc.from) * HOUR_PX;
  const hiddenCount = collapsed ? agenda.filter((e) => e.end <= viewFrom).length : 0;
  const shift = useRef(0);
  /** Change the layout without the slide, so the view doesn't visibly jump. */
  const instant = (change: () => void) => {
    setSnap(true);
    change();
    setTimeout(() => setSnap(false), 80);
  };
  const reveal = () => {
    shift.current = hiddenPx;
    setLockH(cardRef.current?.offsetHeight ?? null);
    instant(() => setShowPast(true));
  };
  // Keep what was on screen where it was when the tucked-away hours come back above it.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (showPast && el && shift.current) el.scrollTop += shift.current;
    shift.current = 0;
  }, [showPast]);

  /** Is the now line off screen (and which way), or well outside the comfortable middle? */
  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !nowVisible) return { dir: null as "up" | "down" | null, off: false };
    const rel = (nowY - hiddenPx - el.scrollTop) / el.clientHeight;
    return { dir: rel < 0 ? ("up" as const) : rel > 1 ? ("down" as const) : null, off: rel < 0.12 || rel > 0.75 };
  }, [nowY, nowVisible, hiddenPx]);

  const goNow = useCallback(
    (smooth: boolean) => {
      const el = scrollerRef.current;
      if (!el) return;
      if (settings.pastEvents === "hide") {
        // The top of the calendar is already about an hour before now.
        if (showPast) instant(() => { setShowPast(false); setLockH(null); });
        el.scrollTo({ top: 0, behavior: smooth && !showPast ? "smooth" : "auto" });
        return;
      }
      const anchor = nowVisible ? nowY : y(agenda[0]?.start ?? arc.from);
      el.scrollTo({ top: Math.max(0, anchor - el.clientHeight * NOW_AT), behavior: smooth ? "smooth" : "auto" });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nowY, nowVisible, agenda, arc.from, settings.pastEvents, showPast],
  );

  const maxHour = Math.min(arc.to, 23.75);
  const clampSpan = (start: number, end: number): Span => {
    const dur = end - start;
    const s0 = Math.min(Math.max(start, arc.from), maxHour - Math.min(dur, maxHour - arc.from));
    return { start: s0, end: Math.min(maxHour, s0 + dur) };
  };
  const hourAt = (clientY: number) => {
    const el = scrollerRef.current;
    if (!el) return arc.from;
    return arc.from + (clientY - el.getBoundingClientRect().top + el.scrollTop + hiddenPx) / HOUR_PX;
  };
  const edgeScroll = (clientY: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (clientY < r.top + EDGE_PX) el.scrollTop -= 12;
    else if (clientY > r.bottom - EDGE_PX) el.scrollTop += 12;
  };

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tell = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 7000);
  };

  /** Drag in progress: which event, and where it would land. */
  const [drag, setDrag] = useState<(Span & { id: string }) | null>(null);
  const dragRef = useRef<{ id: string; mode: "move" | "resize"; h0: number; span: Span; active: boolean; latest: Span | null } | null>(null);
  const suppressClick = useRef(false);

  const saveMove = async (id: string, span: Span) => {
    setMoved((m) => ({ ...m, [id]: { ...span, base: rawAgenda } }));
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: today.iso,
          startTime: decimalHourToTimeInput(span.start),
          endTime: decimalHourToTimeInput(span.end),
        }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Couldn't move that event.");
      router.refresh();
    } catch (e) {
      setMoved((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== id)));
      tell((e as Error).message);
    }
  };

  /** A new event being drawn: `locked` once the pointer is up and it's waiting for a name. */
  const [draft, setDraft] = useState<(Span & { locked: boolean }) | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftBusy, setDraftBusy] = useState(false);
  const drawRef = useRef<{ h0: number; active: boolean } | null>(null);

  const createDraft = async () => {
    const name = draftName.trim();
    if (!draft || !name || draftBusy) return;
    setDraftBusy(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          date: today.iso,
          startTime: decimalHourToTimeInput(draft.start),
          endTime: decimalHourToTimeInput(draft.end),
        }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Couldn't add that event.");
      setDraft(null);
      setDraftName("");
      router.refresh();
    } catch (e) {
      tell((e as Error).message);
    }
    setDraftBusy(false);
  };

  const [planAnchor, setPlanAnchor] = useState<DOMRect | null>(null);

  // Land on the present before first paint.
  useLayoutEffect(() => {
    if (landed.current) return;
    landed.current = true;
    goNow(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A second screen gets scrolled, then left alone: drift back to now after a quiet minute,
  // and snap there when the tab comes back into view.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const touch = () => {
      lastTouch.current = Date.now();
    };
    const evs = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    evs.forEach((n) => el.addEventListener(n, touch, { passive: true }));
    const tick = () => {
      const m = measure();
      setAway(m.dir);
      if (m.off && Date.now() - lastTouch.current > IDLE_RETURN_MS) goNow(true);
    };
    const id = setInterval(tick, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastTouch.current > IDLE_RETURN_MS) goNow(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      evs.forEach((n) => el.removeEventListener(n, touch));
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [measure, goNow]);

  return (
    <section ref={cardRef} className={`card vcal${collapsed ? "" : " vcal--full"}`} style={lockH ? { height: lockH } : undefined} aria-label="Today's calendar">
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
        <button
          type="button"
          className="vcal__btn vcal__now-btn"
          onClick={() => goNow(true)}
          title="Scroll the calendar to the current time"
        >
          {away === "up" ? "↑ " : away === "down" ? "↓ " : ""}Now
        </button>
        {notice ? (
          <p className="vcal__notice" role="alert">
            {notice}
          </p>
        ) : null}
      </div>

      <div className="vcal__wrap">
      <div
        className="vcal__scroller"
        ref={scrollerRef}
        onScroll={() => setAway(measure().dir)}
        onWheel={(ev) => {
          if (collapsed && ev.currentTarget.scrollTop <= 0 && ev.deltaY < 0) reveal();
        }}
      >
        {collapsed && hiddenCount > 0 ? (
          <div className="vcal__earlier">
            <button type="button" onClick={reveal}>
              ↑ Earlier today · {hiddenCount} {hiddenCount === 1 ? "event" : "events"}
            </button>
          </div>
        ) : null}
        <div className={`vcal__body${snap ? " vcal__body--snap" : ""}`} style={{ height, marginTop: -hiddenPx }}>
          <div className="vcal__gutter" aria-hidden="true">
            {hourMarks.map((h) => (
              <span key={h} className="vcal__hour-label" style={{ top: y(h) }}>
                {h <= Math.ceil(viewFrom) ? "" : formatHour(h, use24)}
              </span>
            ))}
          </div>

          <div
            className={`vcal__col${editable ? " vcal__col--editable" : ""}`}
            onPointerDown={(ev) => {
              if (!editable || ev.button !== 0 || ev.pointerType === "touch") return;
              if ((ev.target as HTMLElement).closest(".vcal__event, .vcal__draft")) return;
              const h0 = Math.floor(hourAt(ev.clientY) / SNAP) * SNAP;
              drawRef.current = { h0, active: false };
              ev.currentTarget.setPointerCapture(ev.pointerId);
              setDraftName("");
              setDraft({ ...clampSpan(h0, h0 + 0.5), locked: false });
            }}
            onPointerMove={(ev) => {
              const d = drawRef.current;
              if (!d) return;
              d.active = true;
              edgeScroll(ev.clientY);
              const h = hourAt(ev.clientY);
              const lo = Math.floor(Math.min(d.h0, h) / SNAP) * SNAP;
              const hi = Math.max(lo + SNAP, Math.ceil(Math.max(d.h0 + 0.01, h) / SNAP) * SNAP);
              setDraft({ ...clampSpan(lo, hi), locked: false });
            }}
            onPointerUp={(ev) => {
              const d = drawRef.current;
              drawRef.current = null;
              if (!d) return;
              ev.currentTarget.releasePointerCapture(ev.pointerId);
              // A bare click keeps the 30-minute default; a drag keeps what was drawn.
              setDraft((cur) => (cur ? { ...cur, locked: true } : cur));
            }}
            onPointerCancel={() => {
              drawRef.current = null;
              setDraft(null);
            }}
          >
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
              const dragging = drag && drag.id === e.id ? drag : null;
              const start = dragging ? dragging.start : e.start;
              const end = dragging ? dragging.end : e.end;
              const canEdit = editable && Boolean(e.id);
              const top = y(start);
              const h = Math.max(20, y(end) - top - 2);
              const { lane, lanes: n } = lanes[i];
              const state =
                e.end <= nowHour ? "past" : e.start <= nowHour ? "now" : e.start - nowHour <= 0.25 ? "soon" : "later";
              return (
                <div
                  key={e.id ?? `${e.name}${i}`}
                  className={`vcal__event vcal__event--${e.kind} vcal__event--${state}${isSelected(e) ? " vcal__event--selected" : ""}${canEdit ? " vcal__event--editable" : ""}${dragging ? " vcal__event--dragging" : ""}`}
                  style={
                    {
                      top,
                      height: h,
                      left: `calc(${(lane / n) * 100}% + 2px)`,
                      width: `calc(${100 / n}% - 4px)`,
                      ...(start < viewFrom && end > viewFrom ? { paddingTop: 3 + Math.min((viewFrom - start) * HOUR_PX, Math.max(0, h - 26)) } : null),
                    } as CSSProperties
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={`${e.name}, ${formatHour(e.start, use24)} to ${formatHour(e.end, use24)}. Details`}
                  onPointerDown={(ev) => {
                    if (!canEdit || ev.button !== 0 || ev.pointerType === "touch") return;
                    dragRef.current = {
                      id: e.id as string,
                      mode: (ev.target as HTMLElement).dataset.resize === "1" ? "resize" : "move",
                      h0: hourAt(ev.clientY),
                      span: { start: e.start, end: e.end },
                      active: false,
                      latest: null,
                    };
                    ev.currentTarget.setPointerCapture(ev.pointerId);
                  }}
                  onPointerMove={(ev) => {
                    const d = dragRef.current;
                    if (!d || d.id !== e.id) return;
                    const dh = hourAt(ev.clientY) - d.h0;
                    if (!d.active) {
                      if (Math.abs(dh) * HOUR_PX < DRAG_PX) return;
                      d.active = true;
                    }
                    edgeScroll(ev.clientY);
                    const delta = Math.round(dh / SNAP) * SNAP;
                    const span =
                      d.mode === "move"
                        ? clampSpan(d.span.start + delta, d.span.end + delta)
                        : { start: d.span.start, end: Math.min(maxHour, Math.max(d.span.start + SNAP, d.span.end + delta)) };
                    d.latest = span;
                    setDrag({ id: d.id, ...span });
                  }}
                  onPointerUp={(ev) => {
                    const d = dragRef.current;
                    dragRef.current = null;
                    if (!d) return;
                    ev.currentTarget.releasePointerCapture(ev.pointerId);
                    if (!d.active) return;
                    suppressClick.current = true;
                    setTimeout(() => (suppressClick.current = false), 0);
                    const final = d.latest;
                    setDrag(null);
                    if (final && (final.start !== d.span.start || final.end !== d.span.end)) saveMove(d.id, final);
                  }}
                  onPointerCancel={() => {
                    dragRef.current = null;
                    setDrag(null);
                  }}
                  onClick={(ev) => {
                    if (!suppressClick.current) open(e, ev.currentTarget);
                  }}
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
                      {formatHour(start, use24)} – {formatHour(end, use24)}
                    </div>
                  ) : null}
                  {dragging && h < TWO_LINE_PX ? (
                    <div className="vcal__event-chip">
                      {formatHour(start, use24)} – {formatHour(end, use24)}
                    </div>
                  ) : null}
                  {canEdit && h >= 24 ? <i className="vcal__resize" data-resize="1" aria-hidden="true" /> : null}
                  {h >= THREE_LINE_PX && (e.location || e.where) ? (
                    <div className="vcal__event-where">{e.location || e.where}</div>
                  ) : null}
                  {state === "now" ? (
                    <i className="vcal__event-elapsed" style={{ height: `${Math.min(100, ((nowHour - e.start) / (e.end - e.start)) * 100).toFixed(1)}%` }} />
                  ) : null}
                </div>
              );
            })}

            {draft ? (
              <div
                className="vcal__event vcal__draft"
                style={{ top: y(draft.start), height: Math.max(20, y(draft.end) - y(draft.start) - 2), left: 2, right: 2 }}
              >
                {draft.locked ? (
                  <input
                    autoFocus
                    className="vcal__draft-input"
                    value={draftName}
                    disabled={draftBusy}
                    placeholder="New event"
                    aria-label="New event name"
                    onChange={(ev) => setDraftName(ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") createDraft();
                      if (ev.key === "Escape") setDraft(null);
                    }}
                    onBlur={() => !draftBusy && setDraft(null)}
                  />
                ) : null}
                <div className="vcal__event-time">
                  {formatHour(draft.start, use24)} – {formatHour(draft.end, use24)}
                </div>
              </div>
            ) : null}

            {nowVisible ? (
              <div className="vcal__now" style={{ top: y(nowHour) }} aria-label={`Now, ${formatHour(nowHour, use24)}`}>
                <i />
              </div>
            ) : null}
          </div>
        </div>
        <EndOfDay tomorrow={tomorrow} onPlan={(b) => setPlanAnchor(b.getBoundingClientRect())} />
      </div>
      </div>
      {planAnchor && tomorrow ? (
        <Popover anchor={planAnchor} theme={settings.theme} onClose={() => setPlanAnchor(null)} ariaLabel="Tomorrow" className="taskedit plantomorrow">
          <DayDetail day={tomorrow} use24={use24} onClose={() => setPlanAnchor(null)} />
        </Popover>
      ) : null}
    </section>
  );
}

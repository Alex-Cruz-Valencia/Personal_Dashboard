"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { formatHour } from "@/lib/format";
import type { Theme } from "@/lib/settings";
import type { AgendaEvent } from "@/lib/types";

interface OpenState {
  event: AgendaEvent;
  anchor: DOMRect;
}

interface EventDetailApi {
  open: (event: AgendaEvent, anchorEl: HTMLElement) => void;
  close: () => void;
  isSelected: (event: AgendaEvent) => boolean;
}

const keyOf = (e: AgendaEvent) => e.id ?? `${e.name}@${e.start}`;

const Ctx = createContext<EventDetailApi | null>(null);

export function useEventDetail(): EventDetailApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useEventDetail must be used within EventDetailProvider");
  return api;
}

export function EventDetailProvider({
  use24,
  theme,
  children,
}: {
  use24: boolean;
  /** The popover is portalled outside `.morning`, so it carries its own theme. */
  theme: Theme;
  children: ReactNode;
}) {
  const [state, setState] = useState<OpenState | null>(null);

  const open = useCallback((event: AgendaEvent, anchorEl: HTMLElement) => {
    setState({ event, anchor: anchorEl.getBoundingClientRect() });
  }, []);
  const close = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = () => close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [state, close]);

  const api: EventDetailApi = {
    open,
    close,
    isSelected: (event) => Boolean(state) && keyOf(state!.event) === keyOf(event),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {state ? (
        <EventDetailCard
          event={state.event}
          anchor={state.anchor}
          use24={use24}
          theme={theme}
          onClose={close}
        />
      ) : null}
    </Ctx.Provider>
  );
}

function EventDetailCard({
  event,
  anchor,
  use24,
  theme,
  onClose,
}: {
  event: AgendaEvent;
  anchor: DOMRect;
  use24: boolean;
  theme: Theme;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number }>({
    top: -9999,
    left: -9999,
    maxHeight: 400,
  });

  // Measure the rendered card, then position it against the anchor. This is
  // the canonical use of useLayoutEffect (paint-blocking, needs real DOM size).
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Hidden/detached pane reports 0×0 — don't compute against garbage.
    if (vw < 120 || vh < 120) {
      setPos({ top: 24, left: 12, maxHeight: 600 });
      return;
    }

    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const gap = 8;
    const margin = 12;

    const roomBelow = vh - anchor.bottom - gap - margin;
    const roomAbove = anchor.top - gap - margin;
    const below = roomBelow >= Math.min(height, 220) || roomBelow >= roomAbove;

    const maxHeight = Math.max(160, below ? roomBelow : roomAbove);
    const top = below
      ? anchor.bottom + gap
      : Math.max(margin, anchor.top - gap - Math.min(height, maxHeight));

    let left = anchor.left + anchor.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, vw - width - margin));

    setPos({ top, left, maxHeight });
  }, [anchor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    // Defer so the click that opened the card doesn't immediately close it.
    const id = window.setTimeout(
      () => document.addEventListener("pointerdown", onDown),
      0,
    );
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  const startEnd = `${formatHour(event.start, use24)} – ${formatHour(event.end, use24)}`;
  const mins = Math.round((event.end - event.start) * 60);
  const duration =
    mins >= 60
      ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`
      : `${mins} min`;

  return createPortal(
    <div
      ref={ref}
      className={`event-detail event-detail--${event.kind}`}
      data-theme={theme}
      role="dialog"
      aria-label={event.name}
      style={{
        top: pos.top,
        left: pos.left,
        maxHeight: pos.maxHeight,
      }}
    >
      <div className="event-detail__head">
        <span className={`event-detail__kind event-detail__kind--${event.kind}`}>
          {event.kind === "focus" ? "focus block" : event.kind}
        </span>
        <button
          type="button"
          className="event-detail__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <h3 className="event-detail__name">{event.name}</h3>
      <div className="event-detail__time">
        {startEnd} <span>· {duration}</span>
      </div>

      <div className="event-detail__rows">
        {event.location ? (
          <div className="event-detail__row">
            <span className="event-detail__row-key">Location</span>
            <span className="event-detail__row-val">{event.location}</span>
          </div>
        ) : null}
        {event.attendeeCount ? (
          <div className="event-detail__row">
            <span className="event-detail__row-key">People</span>
            <span className="event-detail__row-val">
              {event.attendeeCount} invited
            </span>
          </div>
        ) : null}
      </div>

      {event.meetingLink ? (
        <a
          className="event-detail__join"
          href={event.meetingLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Join call
        </a>
      ) : null}

      {event.description ? (
        <p className="event-detail__desc">{event.description}</p>
      ) : null}

      {event.htmlLink ? (
        <a
          className="event-detail__open"
          href={event.htmlLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in calendar →
        </a>
      ) : null}
    </div>,
    document.body,
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { formatHour } from "@/lib/format";
import type { Theme } from "@/lib/settings";
import type { AgendaEvent } from "@/lib/types";
import { Popover } from "./Popover";

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
  theme: Theme;
  children: ReactNode;
}) {
  const [state, setState] = useState<OpenState | null>(null);

  const open = useCallback((event: AgendaEvent, anchorEl: HTMLElement) => {
    setState({ event, anchor: anchorEl.getBoundingClientRect() });
  }, []);
  const close = useCallback(() => setState(null), []);

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
  const startEnd = `${formatHour(event.start, use24)} – ${formatHour(event.end, use24)}`;
  const mins = Math.round((event.end - event.start) * 60);
  const duration =
    mins >= 60
      ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ""}`
      : `${mins} min`;

  return (
    <Popover
      anchor={anchor}
      theme={theme}
      onClose={onClose}
      closeOnScroll
      ariaLabel={event.name}
      className={`event-detail event-detail--${event.kind}`}
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
    </Popover>
  );
}

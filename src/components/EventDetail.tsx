"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { decimalHourToTimeInput, formatHour } from "@/lib/format";
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

/** "HH:MM" → decimal hour, the inverse of `decimalHourToTimeInput`. */
function timeInputToDecimal(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
}

const Ctx = createContext<EventDetailApi | null>(null);

export function useEventDetail(): EventDetailApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useEventDetail must be used within EventDetailProvider");
  return api;
}

export function EventDetailProvider({
  use24,
  theme,
  todayIso,
  children,
}: {
  use24: boolean;
  theme: Theme;
  /** Prefills the date field — the dashboard only ever shows one day. */
  todayIso: string;
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
      {state?.event.id ? (
        <EventDetailCard
          key={state.event.id}
          event={state.event}
          anchor={state.anchor}
          use24={use24}
          theme={theme}
          todayIso={todayIso}
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
  todayIso,
  onClose,
}: {
  event: AgendaEvent;
  anchor: DOMRect;
  use24: boolean;
  theme: Theme;
  todayIso: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const id = event.id as string;

  const [name, setName] = useState(event.name);
  const [location, setLocation] = useState(event.location ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [date, setDate] = useState(todayIso);
  const [startTime, setStartTime] = useState(decimalHourToTimeInput(event.start));
  const [endTime, setEndTime] = useState(decimalHourToTimeInput(event.end));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const send = useCallback(
    async (body: Record<string, unknown>, method: "PATCH" | "DELETE" = "PATCH") => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/events/${id}`, {
          method,
          headers: method === "DELETE" ? undefined : { "content-type": "application/json" },
          body: method === "DELETE" ? undefined : JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [id, router],
  );

  const reschedule = (nextDate: string, nextStart: string, nextEnd: string) => {
    if (nextEnd <= nextStart) {
      setError("End time must be after start time.");
      return;
    }
    send({ date: nextDate, startTime: nextStart, endTime: nextEnd });
  };

  return (
    <Popover
      anchor={anchor}
      theme={theme}
      onClose={onClose}
      ariaLabel={`Edit event: ${event.name}`}
      className="eventedit"
    >
      <div className="eventedit__head">
        <span className={`eventedit__kind eventedit__kind--${event.kind}`}>
          {event.kind === "focus" ? "focus block" : event.kind}
          {saving ? " · saving…" : ""}
        </span>
        <button type="button" className="eventedit__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <input
        className="eventedit__name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== event.name && send({ name: name.trim() })}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />

      <div className="eventedit__time">
        {formatHour(timeInputToDecimal(startTime), use24)} –{" "}
        {formatHour(timeInputToDecimal(endTime), use24)}
      </div>

      <div className="eventedit__field">
        <span className="eventedit__label">Date</span>
        <input
          type="date"
          className="eventedit__text"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            reschedule(e.target.value, startTime, endTime);
          }}
        />
      </div>
      <div className="eventedit__row2">
        <label className="eventedit__field">
          <span className="eventedit__label">Start</span>
          <input
            type="time"
            className="eventedit__text"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              reschedule(date, e.target.value, endTime);
            }}
          />
        </label>
        <label className="eventedit__field">
          <span className="eventedit__label">End</span>
          <input
            type="time"
            className="eventedit__text"
            value={endTime}
            onChange={(e) => {
              setEndTime(e.target.value);
              reschedule(date, startTime, e.target.value);
            }}
          />
        </label>
      </div>

      <div className="eventedit__field">
        <span className="eventedit__label">Location</span>
        <input
          type="text"
          className="eventedit__text"
          value={location}
          placeholder="Add a location…"
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => location !== (event.location ?? "") && send({ location })}
        />
      </div>

      {event.attendeeCount ? (
        <div className="eventedit__row">
          <span className="eventedit__row-key">People</span>
          <span className="eventedit__row-val">{event.attendeeCount} invited</span>
        </div>
      ) : null}

      {event.meetingLink ? (
        <a
          className="eventedit__join"
          href={event.meetingLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Join call
        </a>
      ) : null}

      <div className="eventedit__field">
        <span className="eventedit__label">Description</span>
        <textarea
          className="eventedit__textarea"
          value={description}
          rows={2}
          placeholder="Add detail…"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            description !== (event.description ?? "") && send({ description })
          }
        />
      </div>

      {error ? <p className="eventedit__error">{error}</p> : null}

      <div className="eventedit__actions">
        {event.htmlLink ? (
          <a
            className="eventedit__open"
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Calendar →
          </a>
        ) : (
          <span />
        )}
        {confirmDelete ? (
          <span className="eventedit__confirm">
            <button
              type="button"
              className="eventedit__delete is-armed"
              onClick={() => {
                send({}, "DELETE");
                onClose();
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="eventedit__cancel"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="eventedit__delete"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        )}
      </div>
    </Popover>
  );
}

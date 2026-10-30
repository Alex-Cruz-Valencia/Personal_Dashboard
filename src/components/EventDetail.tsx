"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { decimalHourToTimeInput, formatHour } from "@/lib/format";
import type { Theme } from "@/lib/settings";
import type { AgendaEvent, EventDetails, RsvpStatus } from "@/lib/types";
import { EventRead } from "./EventRead";
import { flushFocus, Popover } from "./Popover";

interface OpenState {
  event: AgendaEvent;
  anchor: DOMRect;
  dateIso?: string;
}

interface EventDetailApi {
  /** `dateIso`: the day the event is on, when it isn't today (the week view). */
  open: (event: AgendaEvent, anchorEl: HTMLElement, dateIso?: string) => void;
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

  const open = useCallback((event: AgendaEvent, anchorEl: HTMLElement, dateIso?: string) => {
    setState({ event, anchor: anchorEl.getBoundingClientRect(), dateIso });
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
          todayIso={state.dateIso ?? todayIso}
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
  // Opens as Google's read view; the pencil switches to the form below.
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState<EventDetails | null>(null);
  const [detailsFailed, setDetailsFailed] = useState(false);
  const [rsvp, setRsvp] = useState<RsvpStatus | null>(null);

  // Guests, repeat rule, reminders: loaded when the card opens, not on every page refresh.
  useEffect(() => {
    let alive = true;
    fetch(`/api/events/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<EventDetails>) : Promise.reject(new Error("details"))))
      .then((d) => {
        if (!alive) return;
        setDetails(d);
        setRsvp(d.rsvp);
      })
      .catch(() => alive && setDetailsFailed(true));
    return () => {
      alive = false;
    };
  }, [id]);

  const send = useCallback(
    async (body: Record<string, unknown>, method: "PATCH" | "DELETE" = "PATCH"): Promise<boolean> => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(id)}`, {
          method,
          headers: method === "DELETE" ? undefined : { "content-type": "application/json" },
          body: method === "DELETE" ? undefined : JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
        router.refresh();
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [id, router],
  );

  // Date and time inputs change on every keystroke ("1" then "10" for 10:00), so a
  // reschedule waits until the fields settle: one PATCH, not several racing ones
  // that could land out of order. A pending one is still sent if the card closes.
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const run = pending.current;
    pending.current = null;
    run?.();
  }, []);
  useEffect(() => flush, [flush]);

  const reschedule = (nextDate: string, nextStart: string, nextEnd: string) => {
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    if (!nextDate || !nextStart || !nextEnd) return; // a half-typed field
    if (nextEnd <= nextStart) {
      setError("End time must be after start time.");
      return;
    }
    setError(null);
    pending.current = () => send({ date: nextDate, startTime: nextStart, endTime: nextEnd });
    timer.current = setTimeout(flush, 700);
  };
  // An event that runs past either end of today is drawn clipped (00:00 or 24:00);
  // saving those clipped times would cut the real event short.
  const clipped = event.start <= 0 || event.end >= 24;

  const dayLabel = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const when = `${dayLabel} · ${formatHour(timeInputToDecimal(startTime), use24)} – ${formatHour(timeInputToDecimal(endTime), use24)}`;

  if (!editing) {
    return (
      <Popover
        anchor={anchor}
        theme={theme}
        onClose={onClose}
        ariaLabel={`Event: ${name}`}
        className="gevent"
        align="side"
        layoutKey={details ? "loaded" : "loading"}
      >
        <EventRead
          event={event}
          name={name}
          location={location}
          // The full text once it's loaded, unless it was just edited here.
          description={description === (event.description ?? "") ? (details?.description ?? description) : description}
          when={when}
          details={details}
          failed={detailsFailed}
          rsvp={rsvp}
          busy={saving}
          error={error}
          onEdit={() => {
            // The form edits the whole description, not the shortened one the agenda carries.
            if (details?.description && description === (event.description ?? "")) setDescription(details.description);
            setEditing(true);
          }}
          onDelete={async () => {
            if (await send({}, "DELETE")) onClose();
          }}
          onRsvp={async (status) => {
            const before = rsvp;
            setRsvp(status);
            if (!(await send({ rsvp: status }))) setRsvp(before);
          }}
          onClose={onClose}
        />
      </Popover>
    );
  }

  return (
    <Popover
      anchor={anchor}
      theme={theme}
      onClose={onClose}
      ariaLabel={`Edit event: ${event.name}`}
      className="eventedit"
      align="side"
      layoutKey="editing"
    >
      <div className="eventedit__head">
        <button
          type="button"
          className="eventedit__back"
          onClick={() => {
            flushFocus();
            setEditing(false);
          }}
        >
          ‹ Back
        </button>
        {saving ? <span className="eventedit__kind">saving…</span> : null}
        <button type="button" className="eventedit__close" onClick={() => { flushFocus(); onClose(); }} aria-label="Close">
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

      {clipped ? (
        <p className="eventedit__hint">This runs past today, so change its times in Google Calendar.</p>
      ) : null}
      <div className="eventedit__field">
        <span className="eventedit__label">Date</span>
        <input
          type="date"
          className="eventedit__text"
          disabled={clipped}
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
            disabled={clipped}
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
            disabled={clipped}
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

      <div className="eventedit__field">
        <span className="eventedit__label">Description</span>
        <textarea
          className="eventedit__textarea"
          value={description}
          rows={2}
          placeholder="Add detail…"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            description !== (details?.description ?? event.description ?? "") && send({ description })
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
              disabled={saving}
              onClick={async () => {
                // Close only once it's gone, so a refusal (e.g. a read-only
                // calendar) is shown instead of the card just vanishing.
                if (timer.current) clearTimeout(timer.current);
                pending.current = null; // no reschedule of an event being deleted
                if (await send({}, "DELETE")) onClose();
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

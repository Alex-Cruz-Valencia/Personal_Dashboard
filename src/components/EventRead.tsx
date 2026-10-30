"use client";

import { useState, type ReactNode } from "react";
import { flushFocus } from "./Popover";
import type { AgendaEvent, EventDetails, EventGuest, RsvpStatus } from "@/lib/types";

/**
 * The event card's read view, laid out like Google Calendar's: actions along the top, then the
 * title, when and how often, the call, where, who (with their answers), notes, reminders and the
 * calendar, and "Going?" pinned to the bottom. The pencil opens the edit form. Google's "Take
 * meeting notes" and "Set your working location" are left out: they only work inside Google.
 */

const LINK = /(https?:\/\/[^\s<>"')]+)/g;

/** Plain text with its web links clickable. Built as elements, so nothing in it runs as HTML. */
function Linked({ text }: { text: string }) {
  return text.split(LINK).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

function guestCounts(guests: EventGuest[]): string {
  const n = (s: RsvpStatus) => guests.filter((g) => g.status === s).length;
  const parts = [
    n("accepted") ? `${n("accepted")} yes` : "",
    n("declined") ? `${n("declined")} no` : "",
    n("tentative") ? `${n("tentative")} maybe` : "",
    n("needsAction") ? `${n("needsAction")} awaiting` : "",
  ];
  return parts.filter(Boolean).join(", ");
}

function Guest({ g }: { g: EventGuest }) {
  return (
    <li className="gevent__guest">
      <span className="gevent__avatar" aria-hidden="true">
        {g.name[0]?.toUpperCase()}
        {g.status === "accepted" ? <i className="gevent__badge gevent__badge--yes">✓</i> : null}
        {g.status === "declined" ? <i className="gevent__badge gevent__badge--no">✕</i> : null}
        {g.status === "tentative" ? <i className="gevent__badge gevent__badge--maybe">?</i> : null}
      </span>
      <span className="gevent__guest-text">
        <span className="gevent__guest-name">{g.name}{g.self ? " (you)" : ""}</span>
        {g.organizer ? <span className="gevent__sub">Organizer</span> : null}
      </span>
    </li>
  );
}

export function EventRead({
  event,
  name,
  location,
  description,
  when,
  details,
  failed,
  rsvp,
  busy,
  error,
  onEdit,
  onDelete,
  onRsvp,
  onClose,
}: {
  event: AgendaEvent;
  name: string;
  location: string;
  description: string;
  /** "Monday, October 26 · 10:10am – 11:15am". */
  when: string;
  details: EventDetails | null;
  /** The extra details couldn't be loaded; the card still shows what it has. */
  failed: boolean;
  rsvp: RsvpStatus | null;
  busy: boolean;
  error: string | null;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onRsvp: (status: "accepted" | "declined" | "tentative") => void;
  onClose: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const guests = details?.guests ?? [];
  const emails = guests.flatMap((g) => (g.email && !g.self ? [g.email] : []));
  const canEdit = details?.canEdit ?? false;

  const copyGuests = async () => {
    try {
      await navigator.clipboard.writeText(guests.flatMap((g) => (g.email ? [g.email] : [])).join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the clipboard was refused: nothing to show for it */
    }
  };

  return (
    <>
      <div className="gevent__bar">
        {canEdit ? (
          <IconBtn label="Edit event" onClick={onEdit}><Pencil /></IconBtn>
        ) : null}
        {canEdit ? (
          <IconBtn label="Delete event" onClick={() => setConfirming(true)}><Trash /></IconBtn>
        ) : null}
        {emails.length ? (
          // Opens a Gmail compose window for you to write and send yourself; nothing is sent from here.
          <a
            className="gevent__icon"
            title="Email guests"
            aria-label="Email guests"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emails.join(","))}&su=${encodeURIComponent(name)}`}
          >
            <Mail />
          </a>
        ) : null}
        {event.htmlLink ? (
          <span className="gevent__more">
            <IconBtn label="More options" onClick={() => setMenu(!menu)}><Dots /></IconBtn>
            {menu ? (
              <a className="gevent__menu" href={event.htmlLink} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(false)}>
                Open in Google Calendar
              </a>
            ) : null}
          </span>
        ) : null}
        <IconBtn
          label="Close"
          onClick={() => {
            flushFocus();
            onClose();
          }}
        >
          <Close />
        </IconBtn>
      </div>

      <div className="gevent__title-row">
        <span className="gevent__swatch" data-color={event.color} aria-hidden="true" />
        <div className="gevent__title-text">
          <h3 className="gevent__title">{name}</h3>
          <p className="gevent__when">{when}</p>
          {details?.recurrence ? <p className="gevent__when">{details.recurrence}</p> : null}
        </div>
      </div>

      {confirming ? (
        <div className="gevent__confirm">
          <span>Delete this event?{details?.recurrence ? " Only this one; the rest of the series stays." : ""}</span>
          <span className="gevent__confirm-actions">
            <button type="button" className="gevent__btn" onClick={() => setConfirming(false)}>Cancel</button>
            <button type="button" className="gevent__btn gevent__btn--danger" disabled={busy} onClick={() => void onDelete()}>Delete</button>
          </span>
        </div>
      ) : null}

      {event.meetingLink ? (
        <Row icon={<Video />}>
          <a className="gevent__join" href={event.meetingLink} target="_blank" rel="noopener noreferrer">
            Join call
          </a>
        </Row>
      ) : null}

      {location ? <Row icon={<Pin />}><Linked text={location} /></Row> : null}

      {guests.length ? (
        <Row
          icon={<People />}
          action={
            <button type="button" className="gevent__icon" title={copied ? "Copied" : "Copy guest emails"} aria-label="Copy guest emails" onClick={() => void copyGuests()}>
              {copied ? "✓" : <Copy />}
            </button>
          }
        >
          <div>{guests.length} {guests.length === 1 ? "guest" : "guests"}</div>
          <div className="gevent__sub">{guestCounts(guests)}</div>
          <ul className="gevent__guests">
            {guests.map((g) => (
              <Guest key={g.email ?? g.name} g={g} />
            ))}
          </ul>
        </Row>
      ) : null}

      {description ? (
        <Row icon={<Notes />}>
          <div className="gevent__notes"><Linked text={description} /></div>
        </Row>
      ) : null}

      {details?.reminders.length ? (
        <Row icon={<Bell />}>
          {details.reminders.map((r) => (
            <div key={r}>{r}</div>
          ))}
        </Row>
      ) : null}

      {details ? <Row icon={<CalendarIcon />}>{details.calendar}</Row> : null}
      {!details && !failed ? <p className="gevent__loading">Loading details…</p> : null}
      {failed ? <p className="gevent__loading">Couldn&apos;t load the guests and repeat details.</p> : null}
      {error ? <p className="gevent__error" role="alert">{error}</p> : null}

      {rsvp ? (
        <div className="gevent__going">
          <span>Going?</span>
          <span className="gevent__answers" role="group" aria-label="Going?">
            {([["accepted", "Yes"], ["declined", "No"], ["tentative", "Maybe"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`gevent__answer${rsvp === value ? " is-on" : ""}`}
                aria-pressed={rsvp === value}
                disabled={busy}
                onClick={() => onRsvp(value)}
              >
                {label}
              </button>
            ))}
          </span>
        </div>
      ) : null}
    </>
  );
}

function Row({ icon, action, children }: { icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="gevent__row">
      <span className="gevent__row-icon">{icon}</span>
      <div className="gevent__row-body">{children}</div>
      {action}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="gevent__icon" title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

const S = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const Pencil = () => <svg {...S}><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></svg>;
const Trash = () => <svg {...S}><path d="M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5l1 13h9l1-13M10.5 10v6M13.5 10v6" /></svg>;
const Mail = () => <svg {...S}><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M4 7l8 6 8-6" /></svg>;
const Dots = () => <svg {...S}><circle cx="12" cy="5.5" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="18.5" r="1.2" fill="currentColor" /></svg>;
const Close = () => <svg {...S}><path d="M6 6l12 12M18 6L6 18" /></svg>;
const Video = () => <svg {...S}><rect x="3.5" y="6.5" width="12" height="11" rx="2" /><path d="M15.5 10.5l5-3v9l-5-3" /></svg>;
const Pin = () => <svg {...S}><path d="M12 21s7-6.4 7-11.5a7 7 0 0 0-14 0C5 14.6 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
const People = () => <svg {...S}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5z" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17 14.4c1.9.6 3.1 2.2 3.5 4.6" /></svg>;
const Notes = () => <svg {...S}><path d="M4 7h16M4 12h16M4 17h10" /></svg>;
const Bell = () => <svg {...S}><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 1.5h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>;
const CalendarIcon = () => <svg {...S}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>;
const Copy = () => <svg {...S}><rect x="8.5" y="8.5" width="11" height="12" rx="2" /><path d="M15.5 8.5V6a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" /></svg>;

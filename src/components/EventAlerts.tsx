"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ALERT_MINUTES, alertBody, alertKey, dueAlerts, safeLink } from "@/lib/event-alerts";
import { decimalHourInZone, isoDateInZone } from "@/lib/time";
import type { AgendaEvent, TodayInfo } from "@/lib/types";

const ON_KEY = "dashboard_alerts";
const SENT_KEY = "dashboard_alerted";
const CHECK_MS = 20_000;
/** A hidden tab stops refreshing, so a new or moved event would otherwise be missed. */
const HIDDEN_REFRESH_MS = 5 * 60_000;

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

function readOn(): boolean {
  try {
    return window.localStorage.getItem(ON_KEY) === "on";
  } catch {
    return false;
  }
}

function writeOn(on: boolean) {
  try {
    window.localStorage.setItem(ON_KEY, on ? "on" : "off");
  } catch {
    /* private mode: it stays off */
  }
  listeners.forEach((l) => l());
}

/** This browser's sent list, kept to today so it can't grow. */
function readSent(iso: string): Set<string> {
  try {
    const all = JSON.parse(window.localStorage.getItem(SENT_KEY) ?? "[]") as string[];
    return new Set(all.filter((k) => k.startsWith(`${iso}|`)));
  } catch {
    return new Set();
  }
}

function writeSent(sent: Set<string>) {
  try {
    window.localStorage.setItem(SENT_KEY, JSON.stringify([...sent]));
  } catch {
    /* private mode: the tag on each notification still stops most repeats */
  }
}

function show(title: string, body: string, tag: string, link?: string) {
  const n = new Notification(title, { body, tag });
  n.onclick = () => {
    window.focus();
    if (link) window.open(link, "_blank", "noopener,noreferrer");
    n.close();
  };
}

/** Renders nothing. While this tab is open and alerts are on, notifies before each event. */
export function EventAlerts({ agenda, today, use24 }: { agenda: AgendaEvent[]; today: TodayInfo; use24: boolean }) {
  const router = useRouter();
  const on = useSyncExternalStore(subscribe, readOn, () => false);

  useEffect(() => {
    if (!on || typeof Notification === "undefined") return;
    let refreshed = Date.now();
    const check = () => {
      if (document.visibilityState === "hidden" && Date.now() - refreshed > HIDDEN_REFRESH_MS) {
        refreshed = Date.now();
        router.refresh();
      }
      if (Notification.permission !== "granted") return;
      // The real clock, not the page's: a preview hour or a stale render must never set one off.
      const now = new Date();
      const iso = isoDateInZone(now, today.timezone);
      if (iso !== today.iso) return;
      const nowHour = decimalHourInZone(now, today.timezone);
      const sent = readSent(iso);
      for (const e of dueAlerts(agenda, nowHour, iso, sent)) {
        const key = alertKey(iso, e);
        sent.add(key);
        show(e.name, alertBody(e, nowHour, use24), key, safeLink(e.meetingLink));
      }
      writeSent(sent);
    };
    check();
    const id = setInterval(check, CHECK_MS);
    return () => clearInterval(id);
  }, [on, agenda, today.iso, today.timezone, use24, router]);

  return null;
}

/** ⚙ Event alerts. The permission prompt needs a click, which is why this isn't a plain setting. */
export function EventAlertsField() {
  const on = useSyncExternalStore(subscribe, readOn, () => false);
  const [note, setNote] = useState<string | null>(null);
  const supported = typeof Notification !== "undefined";

  const turnOn = async () => {
    setNote(null);
    const answer = await Notification.requestPermission();
    if (answer === "granted") writeOn(true);
    else setNote("Your browser is blocking notifications for this site. Allow them in its site settings.");
  };

  return (
    <div className="settings__field">
      <div className="settings__label">Event alerts</div>
      {supported ? (
        <div className="settings__seg" role="group" aria-label="Event alerts">
          <button type="button" className={`settings__seg-btn${on ? "" : " is-on"}`} onClick={() => writeOn(false)}>
            Off
          </button>
          <button type="button" className={`settings__seg-btn${on ? " is-on" : ""}`} onClick={turnOn}>
            {ALERT_MINUTES} min before
          </button>
          {on ? (
            <button type="button" className="settings__seg-btn" onClick={() => show("Test alert", "Alerts are working.", "dashboard-test")}>
              Test
            </button>
          ) : null}
        </div>
      ) : (
        <p className="settings__hint">This browser can&apos;t show notifications.</p>
      )}
      {note ? <p className="settings__hint">{note}</p> : <p className="settings__hint">Only while this tab is open.</p>}
    </div>
  );
}

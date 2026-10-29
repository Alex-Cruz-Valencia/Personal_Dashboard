"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Local only: a focus session is remembered in this browser and writes nothing anywhere. */
const KEY = "dashboard_focus";
/** A session that ended this long ago is from another day; don't bring it back. */
const STALE_MS = 6 * 60 * 60 * 1000;

interface Session {
  name: string;
  durationMs: number;
  /** Decimal hour on the arc when it started, so the block can be drawn. */
  startHour: number;
  /** Epoch ms when it ends; null while paused. */
  endsAt: number | null;
  /** Time left, frozen while paused. */
  remainingMs: number;
}

export interface FocusApi {
  session: Session | null;
  remainingMs: number;
  done: boolean;
  start: (name: string, minutes: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const Ctx = createContext<FocusApi | null>(null);

export function useFocus(): FocusApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useFocus must be used within FocusProvider");
  return api;
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function load(): Session | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (typeof s.name !== "string" || typeof s.durationMs !== "number") return null;
    // Otherwise yesterday's finished session sits in the tab title and on today's calendar.
    if (s.endsAt != null && Date.now() - s.endsAt > STALE_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function save(s: Session | null) {
  try {
    if (s) window.localStorage.setItem(KEY, JSON.stringify(s));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode: the timer still works for this page view */
  }
}

export function FocusProvider({ nowHour, children }: { nowHour: number; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const nowHourRef = useRef(nowHour);
  useEffect(() => {
    nowHourRef.current = nowHour;
  }, [nowHour]);

  // Restore after hydration (localStorage doesn't exist on the server).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(load());
  }, []);

  const running = session?.endsAt != null;
  const remainingMs = session ? (session.endsAt != null ? session.endsAt - now : session.remainingMs) : 0;
  const done = session != null && session.endsAt != null && remainingMs <= 0;

  // Tick once a second, only while a session is actually counting down.
  useEffect(() => {
    if (!running || done) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running, done]);

  // The countdown in the tab title, so it shows from another window.
  useEffect(() => {
    if (!session) return;
    const original = document.title;
    document.title = done ? `Focus complete · ${session.name}` : `${formatClock(remainingMs)} · ${session.name}`;
    return () => {
      document.title = original;
    };
  }, [session, remainingMs, done]);

  const update = useCallback((next: Session | null) => {
    setSession(next);
    save(next);
  }, []);

  const api = useMemo<FocusApi>(
    () => ({
      session,
      remainingMs,
      done,
      start: (name, minutes) => {
        const durationMs = minutes * 60_000;
        setNow(Date.now());
        update({ name, durationMs, startHour: nowHourRef.current, endsAt: Date.now() + durationMs, remainingMs: durationMs });
      },
      pause: () => {
        if (session && session.endsAt != null) update({ ...session, endsAt: null, remainingMs: Math.max(0, session.endsAt - Date.now()) });
      },
      resume: () => {
        setNow(Date.now());
        if (session && session.endsAt == null) update({ ...session, endsAt: Date.now() + session.remainingMs });
      },
      stop: () => update(null),
    }),
    [session, remainingMs, done, update],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

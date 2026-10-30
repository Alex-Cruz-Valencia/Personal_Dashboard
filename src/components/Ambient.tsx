"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { dateLineFor } from "@/lib/format";
import type { Theme } from "@/lib/settings";
import type { TodayInfo, Weather } from "@/lib/types";
import { useNowSeconds } from "@/lib/use-now";
import { WeatherScene } from "./WeatherScene";

/**
 * Ambient: a screen to leave up, not to use. Just the time over the day's sky (stars and
 * meteors at night, sun and slow beams by day), full screen, with the cursor hidden when idle
 * and the display kept awake. Any key, click or tap goes back to the dashboard.
 */
export function AmbientButton(props: { today: TodayInfo; weather: Weather; use24: boolean; theme: Theme; frozen: boolean }) {
  const [on, setOn] = useState(false);
  return (
    <>
      <button type="button" className="ambient-btn" onClick={() => setOn(true)} title="Ambient: just the time and the sky, full screen">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </svg>
        Ambient
      </button>
      {on ? <AmbientScreen {...props} onExit={() => setOn(false)} /> : null}
    </>
  );
}

function AmbientScreen({
  today,
  weather,
  use24,
  theme,
  frozen,
  onExit,
}: {
  today: TodayInfo;
  weather: Weather;
  use24: boolean;
  theme: Theme;
  frozen: boolean;
  onExit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idle, setIdle] = useState(false);
  const secs = useNowSeconds(today, frozen);
  const hh = Math.floor(secs / 3600) % 24;
  const mm = Math.floor((secs % 3600) / 60);
  const hour = secs / 3600;
  const isDay = hour >= weather.sunrise && hour < weather.sunset;

  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    onExit();
  }, [onExit]);

  useEffect(() => {
    // Full screen and an awake display where the browser allows; it works without either.
    void ref.current?.requestFullscreen?.().catch(() => {});
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    void nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});

    // Leaving full screen (Esc) leaves ambient too. The first change is entering it.
    const onFs = () => {
      if (!document.fullscreenElement) onExit();
    };
    const onKey = () => exit();
    // The cursor fades after a few still seconds.
    let t: ReturnType<typeof setTimeout>;
    const onMove = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2500);
    };
    onMove();
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onMove);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onMove);
      clearTimeout(t);
      void lock?.release().catch(() => {});
    };
  }, [exit, onExit]);

  const h = use24 ? String(hh).padStart(2, "0") : String(hh % 12 === 0 ? 12 : hh % 12);
  return createPortal(
    <div
      ref={ref}
      className={`ambient ${isDay ? "ambient--day" : "ambient--night"}${idle ? " ambient--idle" : ""}`}
      data-theme={theme === "system" ? undefined : theme}
      role="dialog"
      aria-label="Ambient screen. Press any key to go back."
      onClick={exit}
    >
      <WeatherScene variant="page" sky={weather.sky} isDay={isDay} fenced={false} />
      <span className="ambient__orb" aria-hidden="true" />
      <div className="ambient__center">
        <div className="ambient__time">
          {h}
          <span className="ambient__colon">:</span>
          {String(mm).padStart(2, "0")}
          {use24 ? null : <span className="ambient__ampm">{hh >= 12 ? "pm" : "am"}</span>}
        </div>
        <div className="ambient__date">{dateLineFor(today.iso)}</div>
      </div>
      <p className="ambient__hint">Press any key or click to go back</p>
    </div>,
    document.body,
  );
}

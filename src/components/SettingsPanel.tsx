"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatHour } from "@/lib/format";
import {
  PREFS_COOKIE,
  use24Hour,
  type DashboardSettings,
  type Density,
  type Theme,
  type TimeFormat,
} from "@/lib/settings";
import { Popover } from "./Popover";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * The Appearance / Behavior knobs, as an in-app panel. Each change writes the
 * `dashboard_prefs` cookie and re-renders the server tree so the choice sticks
 * across visits (URL query params still win when present — see `settings.ts`).
 */
export function SettingsPanel({ settings }: { settings: DashboardSettings }) {
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  // Called unconditionally, at the top — its name makes ESLint's
  // rules-of-hooks treat it as a hook even though it's a plain function, so
  // it can't be called from inside the conditionally-rendered popover below.
  const use24 = use24Hour(settings);

  const toggle = () => {
    setAnchor((a) => (a ? null : (btnRef.current?.getBoundingClientRect() ?? null)));
  };

  const update = (patch: Partial<DashboardSettings>) => {
    const next = { ...settings, ...patch };
    document.cookie =
      `${PREFS_COOKIE}=${encodeURIComponent(JSON.stringify(next))}` +
      `;path=/;max-age=${ONE_YEAR};samesite=lax`;
    router.refresh();
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="settings__trigger"
        aria-label="Display settings"
        aria-expanded={anchor != null}
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm7.4-2.9 2 1.5-2 3.5-2.3-.9a7.6 7.6 0 0 1-1.4.8l-.4 2.4h-4l-.4-2.4a7.6 7.6 0 0 1-1.4-.8l-2.3.9-2-3.5 2-1.5a7.7 7.7 0 0 1 0-1.6l-2-1.5 2-3.5 2.3.9a7.6 7.6 0 0 1 1.4-.8l.4-2.4h4l.4 2.4c.5.2 1 .5 1.4.8l2.3-.9 2 3.5-2 1.5a7.7 7.7 0 0 1 0 1.6Z"
          />
        </svg>
      </button>

      {anchor ? (
        <Popover
          anchor={anchor}
          theme={settings.theme}
          onClose={() => setAnchor(null)}
          className="settings"
          ariaLabel="Display settings"
        >
          <Segmented<Theme>
            label="Appearance"
            value={settings.theme}
            options={[
              ["light", "Light"],
              ["dark", "Dark"],
              ["system", "System"],
            ]}
            onPick={(theme) => update({ theme })}
          />
          <Segmented<Density>
            label="Density"
            value={settings.density}
            options={[
              ["comfortable", "Comfortable"],
              ["focused", "Focused"],
            ]}
            onPick={(density) => update({ density })}
          />
          <Segmented<TimeFormat>
            label="Time"
            value={settings.timeFormat}
            options={[
              ["12-hour", "12-hour"],
              ["24-hour", "24-hour"],
            ]}
            onPick={(timeFormat) => update({ timeFormat })}
          />

          <div className="settings__row2">
            <HourField
              label="Day starts"
              value={settings.dayStart}
              use24={use24}
              onCommit={(dayStart) => update({ dayStart })}
            />
            <HourField
              label="Day ends"
              value={settings.dayEnd}
              use24={use24}
              onCommit={(dayEnd) => update({ dayEnd })}
            />
          </div>
          <HourField
            label="Weather starts"
            value={settings.weatherStart}
            use24={use24}
            onCommit={(weatherStart) => update({ weatherStart })}
          />
        </Popover>
      ) : null}
    </>
  );
}

/**
 * An hour-of-day field (0–24, 24 = midnight/end-of-day) with the resulting
 * clock time shown alongside so a bare integer isn't the only feedback.
 * Commits on blur / Enter, not per keystroke.
 */
function HourField({
  label,
  value,
  use24,
  onCommit,
}: {
  label: string;
  value: number;
  use24: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  // Resync if `value` changes from outside this field (e.g. another field's
  // edit clamped this one — see weatherStart in settings.ts). Adjusting
  // state during render, not an effect, per React's own pattern for this.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(String(value));
  }

  const commit = () => {
    const n = Number(draft);
    if (Number.isFinite(n) && n >= 0 && n <= 24 && n !== value) {
      onCommit(n);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <div className="settings__field">
      <div className="settings__label">{label}</div>
      <div className="settings__hour">
        <input
          type="number"
          min={0}
          max={24}
          step={1}
          className="settings__number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <span className="settings__hour-hint">{formatHour(value, use24)}</span>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onPick: (value: T) => void;
}) {
  return (
    <div className="settings__field">
      <div className="settings__label">{label}</div>
      <div className="settings__seg" role="group" aria-label={label}>
        {options.map(([val, text]) => (
          <button
            key={val}
            type="button"
            className={`settings__seg-btn${val === value ? " is-on" : ""}`}
            aria-pressed={val === value}
            onClick={() => val !== value && onPick(val)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

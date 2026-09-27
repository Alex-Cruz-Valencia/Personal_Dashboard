"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PREFS_COOKIE,
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
        </Popover>
      ) : null}
    </>
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

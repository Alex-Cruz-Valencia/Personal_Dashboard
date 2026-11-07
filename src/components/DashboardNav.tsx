"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import "./DashboardNav.css";

/** Carry presentation overrides between pages without carrying day-preview or auth parameters. */
export function DashboardNav({ active }: { active: "day" | "health" }) {
  const current = useSearchParams();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const params = new URLSearchParams();
  for (const key of ["theme", "palette", "look", "cal", "surface", "motion", "background", "skytheme", "skypart", "skyweather", "lightsky", "timeFormat", "time", "density", "dayStart", "dayEnd", "weatherStart", "windDown", "noteStyle", "past", "top", "lat", "lon", "tz"]) {
    const value = current.get(key);
    if (value !== null) params.set(key, value);
  }
  const query = params.size ? `?${params}` : "";
  const links = [
    { id: "day", label: "My day", href: `/${query}` },
    { id: "health", label: "Health", href: `/health${query}` },
  ] as const;
  return (
    <nav className="dashboard-nav" aria-label="Dashboard pages">
      {links.map(({ id, label, href }) => <Link
        key={id}
        href={href}
        aria-label={label}
        aria-current={active === id ? "page" : undefined}
        data-label-hidden={dismissed === id ? true : undefined}
        onMouseEnter={() => setDismissed(null)}
        onMouseLeave={() => setDismissed(null)}
        onFocus={() => setDismissed(null)}
        onBlur={() => setDismissed(null)}
        onKeyDown={(event) => { if (event.key === "Escape") setDismissed(id); }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {id === "day" ? <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></> : <><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" /><path d="M5 12h4l2-4 2 8 2-4h4" /></>}
        </svg>
        <span className="dashboard-nav__label" aria-hidden="true">{label}</span>
      </Link>)}
    </nav>
  );
}

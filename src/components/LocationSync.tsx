"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SENT_KEY = "gdash_loc_sent";

/**
 * Renders nothing. On mount it asks the browser for the current position and,
 * when it has moved (or the timezone changed), tells the server so weather and
 * clock follow the device. One "Allow" per device, then it's silent.
 */
export function LocationSync() {
  const router = useRouter();

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;

    let cancelled = false;
    const tz = (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      } catch {
        return "";
      }
    })();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        const key = `${lat},${lon},${tz}`;

        try {
          if (localStorage.getItem(SENT_KEY) === key) return;
        } catch {
          /* private mode — just proceed */
        }

        fetch("/api/location", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ latitude: lat, longitude: lon, timezone: tz }),
        })
          .then((res) => {
            if (!res.ok || cancelled) return;
            try {
              localStorage.setItem(SENT_KEY, key);
            } catch {
              /* ignore */
            }
            router.refresh();
          })
          .catch(() => {
            /* offline / blocked — keep the existing fallback location */
          });
      },
      () => {
        /* permission denied or unavailable — nothing to do */
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30 * 60 * 1000 },
    );

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}

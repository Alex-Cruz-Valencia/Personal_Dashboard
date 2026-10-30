/**
 * A Google Calendar repeat rule in words, the way Google's own event card puts it:
 * "Weekly on Monday, Wednesday, Friday, until Nov 18, 2026" or "Weekly on Monday, 9 times".
 * Pure and server/client-safe. Anything unusual falls back to a plain "Repeats".
 */

const DAYS: Record<string, string> = {
  SU: "Sunday", MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday",
};
const FREQ: Record<string, [one: string, unit: string]> = {
  DAILY: ["Daily", "days"],
  WEEKLY: ["Weekly", "weeks"],
  MONTHLY: ["Monthly", "months"],
  YEARLY: ["Annually", "years"],
};

/** "20261118T035959Z" or "20261118" → "Nov 18, 2026". */
function untilLabel(until: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(until);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

export function describeRecurrence(rule: string | undefined): string | null {
  if (!rule) return null;
  const parts = Object.fromEntries(
    rule.replace(/^RRULE:/i, "").split(";").map((p) => p.split("=") as [string, string]),
  );
  const freq = FREQ[parts.FREQ];
  if (!freq) return "Repeats";
  const every = Number(parts.INTERVAL ?? 1);
  let out = every > 1 ? `Every ${every} ${freq[1]}` : freq[0];
  if (parts.FREQ === "WEEKLY" && parts.BYDAY) {
    const days = parts.BYDAY.split(",").map((d: string) => DAYS[d]).filter(Boolean);
    if (days.length === 7) out = every > 1 ? out : "Daily";
    else if (days.length) out += ` on ${days.join(", ")}`;
  }
  const until = parts.UNTIL ? untilLabel(parts.UNTIL) : null;
  if (until) out += `, until ${until}`;
  else if (parts.COUNT) out += `, ${parts.COUNT} times`;
  return out;
}

/** Reminder minutes → "10 minutes before", "1 hour before", "1 day before". */
export function reminderLabel(minutes: number): string {
  if (minutes === 0) return "At time of event";
  const unit = (n: number, name: string) => `${n} ${name}${n === 1 ? "" : "s"} before`;
  if (minutes % 10080 === 0) return unit(minutes / 10080, "week");
  if (minutes % 1440 === 0) return unit(minutes / 1440, "day");
  if (minutes % 60 === 0) return unit(minutes / 60, "hour");
  return unit(minutes, "minute");
}

/**
 * "What did I miss?" — the attention strip's logic. Pure, so it runs the same
 * on server and client. Reads only data the dashboard already has.
 *
 * Times are decimal hours in the viewer's local day, like everywhere else.
 */

import { minutesLabel } from "./plan";
import type { AgendaEvent, Reply, Task } from "./types";

/** Back-to-back events closer than this are flagged as a tight turnaround. */
export const TIGHT_GAP_MINUTES = 10;
/** Events this long are treated as all-day banners, not conflicts. */
const ALL_DAY_HOURS = 12;

export type AttentionKind = "conflict" | "tight" | "overdue" | "reply";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  /** Short label for the kind chip. */
  label: string;
  title: string;
  detail: string;
  /** Where clicking it scrolls to. */
  target: "arc" | "tasks" | "replies";
}

/** "18h" → 0.75, "3d" → 3, anything unparseable → 0. */
function ageDays(age: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*([a-z]+)/i.exec(age.trim());
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("m") && unit !== "mo") return n / 1440;
  if (unit.startsWith("h")) return n / 24;
  if (unit.startsWith("d")) return n;
  if (unit.startsWith("w")) return n * 7;
  return n * 30;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function buildAttention(input: {
  agenda: AgendaEvent[];
  tasks: Task[];
  replies: Reply[];
  nowHour: number;
}): AttentionItem[] {
  const { agenda, tasks, replies, nowHour } = input;
  const items: AttentionItem[] = [];

  // Only what's still ahead (or underway) matters for conflicts and gaps.
  const upcoming = agenda
    .filter((e) => e.end > nowHour && e.end - e.start < ALL_DAY_HOURS)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  // Conflicts: each event against every later one that starts before it ends.
  const seen = new Set<string>();
  for (let i = 0; i < upcoming.length; i++) {
    for (let j = i + 1; j < upcoming.length; j++) {
      const a = upcoming[i];
      const b = upcoming[j];
      if (b.start >= a.end) break;
      const key = `${a.name}|${b.name}|${a.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const overlap = Math.round((Math.min(a.end, b.end) - b.start) * 60);
      items.push({
        id: `conflict-${i}-${j}`,
        kind: "conflict",
        label: "Conflict",
        title: `${a.name} overlaps ${b.name}`,
        detail: `${minutesLabel(Math.max(1, overlap))} of overlap`,
        target: "arc",
      });
    }
  }

  // Tight gaps: consecutive, non-overlapping events with almost no breathing room.
  for (let i = 0; i < upcoming.length - 1; i++) {
    const a = upcoming[i];
    const b = upcoming[i + 1];
    const gap = Math.round((b.start - a.end) * 60);
    if (gap < 0 || gap >= TIGHT_GAP_MINUTES || b.start <= nowHour) continue;
    items.push({
      id: `tight-${i}`,
      kind: "tight",
      label: "Tight",
      title: `${a.name} then ${b.name}`,
      detail: gap === 0 ? "Back to back" : `${plural(gap, "min")} between`,
      target: "arc",
    });
  }

  // Overdue tasks, rolled into one line so a long backlog doesn't flood the strip.
  const overdue = tasks
    .filter((t) => (t.overdueDays ?? 0) > 0)
    .sort((a, b) => (b.overdueDays ?? 0) - (a.overdueDays ?? 0));
  if (overdue.length) {
    const oldest = overdue[0];
    items.push({
      id: "overdue",
      kind: "overdue",
      label: "Overdue",
      title: plural(overdue.length, "task") + " past due",
      detail: `Oldest: ${oldest.name} (${plural(oldest.overdueDays ?? 0, "day")})`,
      target: "tasks",
    });
  }

  // Replies: anyone blocked first, then the rest by how long they've waited.
  const blocking = replies.filter((r) => r.urgency === 1);
  const rest = replies.filter((r) => r.urgency !== 1);
  const oldestOf = (rs: Reply[]) =>
    rs.reduce((m, r) => (ageDays(r.age) > ageDays(m.age) ? r : m), rs[0]);
  if (blocking.length) {
    const o = oldestOf(blocking);
    items.push({
      id: "reply-blocking",
      kind: "reply",
      label: "Blocking",
      title: `${plural(blocking.length, "reply", "replies")} holding someone up`,
      detail: `${o.from}, ${o.age}`,
      target: "replies",
    });
  }
  if (rest.length) {
    const o = oldestOf(rest);
    items.push({
      id: "reply-waiting",
      kind: "reply",
      label: "Waiting",
      title: `${rest.length} ${rest.length === 1 ? "reply" : "replies"} waiting`,
      detail: `Longest: ${o.from}, ${o.age}`,
      target: "replies",
    });
  }

  return items;
}

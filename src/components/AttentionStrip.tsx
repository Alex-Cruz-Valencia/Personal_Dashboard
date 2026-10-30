"use client";

import { useState } from "react";
import { buildAttention, type AttentionItem } from "@/lib/attention";
import { dismissConflict, useDismissedConflicts } from "@/lib/conflict-state";
import { formatHour } from "@/lib/format";
import { useHiddenReplyIds } from "@/lib/reply-state";
import type { Theme } from "@/lib/settings";
import type { AgendaEvent, Reply, Task } from "@/lib/types";
import { useEventDetail } from "./EventDetail";
import { Popover } from "./Popover";
import { ReplyQueue } from "./ReplyQueue";

const TARGETS: Record<AttentionItem["target"], string> = {
  arc: ".dayarc, .vcal",
  tasks: ".column--tasks",
  replies: ".column--replies",
};

function jump(target: AttentionItem["target"]) {
  const el = document.querySelector(TARGETS[target]);
  if (!el) return;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
}

/**
 * "What did I miss?" — the first thing under the header. Only things that
 * need you; when there are none it says so in one quiet line. Reply items open
 * the emails themselves, with actions; the rest jump to their card.
 */
export function AttentionStrip({
  agenda,
  tasks,
  replies,
  nowHour,
  theme,
  aiDraft,
  canTask,
  todayIso,
  use24,
}: {
  use24: boolean;
  aiDraft: boolean;
  canTask: boolean;
  todayIso: string;
  agenda: AgendaEvent[];
  tasks: Task[];
  replies: Reply[];
  nowHour: number;
  theme: Theme;
}) {
  const hidden = useHiddenReplyIds();
  const okConflicts = useDismissedConflicts();
  const [open, setOpen] = useState<{ item: AttentionItem; anchor: DOMRect } | null>(null);
  const [resolving, setResolving] = useState<{ item: AttentionItem; el: HTMLElement } | null>(null);

  const live = replies.filter((r) => !r.id || !hidden.has(r.id));
  const items = buildAttention({ agenda, tasks, replies: live, nowHour, todayIso }).filter(
    (it) => !it.okKey || !okConflicts.has(it.okKey),
  );

  // The popover's list follows the live data, so an email dealt with leaves it.
  const queue = open?.item.replyIds
    ? live.filter((r) => r.id && open.item.replyIds?.includes(r.id))
    : [];

  if (items.length === 0) {
    return (
      <section className="attn attn--clear" aria-label="Needs attention">
        <span className="attn__clear">Nothing missed. Overdue tasks, conflicts and replies are all clear.</span>
      </section>
    );
  }
  return (
    <section className="attn" aria-label="Needs attention">
      <h2 className="attn__title">Needs attention</h2>
      <ul className="attn__list">
        {items.slice(0, 5).map((it) => (
          <li key={it.id}>
            <button
              type="button"
              className={`attn__item attn__item--${it.kind}`}
              aria-haspopup={it.replyIds?.length ? "dialog" : undefined}
              aria-expanded={it.events ? resolving?.item.id === it.id : undefined}
              onClick={(e) => {
                if (it.replyIds?.length) setOpen({ item: it, anchor: e.currentTarget.getBoundingClientRect() });
                else if (it.events && it.okKey) setResolving({ item: it, el: e.currentTarget });
                else jump(it.target);
              }}
            >
              <span className="attn__label">{it.label}</span>
              <span className="attn__text">{it.title}</span>
              <span className="attn__detail">{it.detail}</span>
            </button>
          </li>
        ))}
      </ul>
      {open && queue.length > 0 ? (
        <ReplyQueue
          title={open.item.title}
          replies={queue}
          anchor={open.anchor}
          theme={theme}
          aiDraft={aiDraft}
          canTask={canTask}
          todayIso={todayIso}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {resolving ? (
        <ConflictCard item={resolving.item} anchorEl={resolving.el} theme={theme} use24={use24} onClose={() => setResolving(null)} />
      ) : null}
    </section>
  );
}

/**
 * Resolving a conflict or a tight turnaround: say it's fine (the warning goes until either
 * event moves), open either event to move or delete it, or look at it on the calendar.
 */
function ConflictCard({
  item,
  anchorEl,
  theme,
  use24,
  onClose,
}: {
  item: AttentionItem;
  anchorEl: HTMLElement;
  theme: Theme;
  use24: boolean;
  onClose: () => void;
}) {
  const { open } = useEventDetail();
  const [anchor] = useState(() => anchorEl.getBoundingClientRect());
  const events = item.events ?? [];
  return (
    <Popover anchor={anchor} theme={theme} onClose={onClose} ariaLabel={`Resolve: ${item.title}`} className="resolve">
      <p className="resolve__title">{item.kind === "conflict" ? "These overlap" : "Tight turnaround"}</p>
      <p className="resolve__detail">{item.detail}</p>
      {events.length === 2 ? <OverlapSnippet a={events[0]} b={events[1]} use24={use24} /> : null}
      <ul className="resolve__events">
        {events.map((e) => (
          <li key={e.id ?? e.name}>
            <button
              type="button"
              className="resolve__event"
              data-color={e.color}
              disabled={!e.id}
              title={e.id ? "Move, shorten or delete it" : undefined}
              onClick={() => {
                onClose();
                open(e, anchorEl);
              }}
            >
              <span className="resolve__name">{e.name}</span>
              <span className="resolve__when">
                {formatHour(e.start, use24)} – {formatHour(e.end, use24)}
              </span>
              {e.id ? <span className="resolve__edit">Edit</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <div className="resolve__actions">
        <button
          type="button"
          className="resolve__btn"
          onClick={() => {
            onClose();
            jump(item.target);
          }}
        >
          Show on calendar
        </button>
        <button
          type="button"
          className="resolve__btn resolve__btn--ok"
          onClick={() => {
            if (item.okKey) dismissConflict(item.okKey);
            onClose();
          }}
        >
          It&apos;s fine
        </button>
      </div>
    </Popover>
  );
}

/** The snippet's height stays about this tall however long the events run. */
const SNIPPET_PX = 104;

/**
 * The two events as the day calendar draws them: side by side on a small time scale, sized by
 * duration, with the stretch they share banded across both. Shows at a glance whether it's five
 * minutes or the whole meeting.
 */
function OverlapSnippet({ a, b, use24 }: { a: AgendaEvent; b: AgendaEvent; use24: boolean }) {
  // Half-hour padding around both, snapped to half hours so the ticks land on clock times.
  const from = Math.max(0, Math.floor(Math.min(a.start, b.start) * 2) / 2 - 0.5);
  const to = Math.min(24, Math.ceil(Math.max(a.end, b.end) * 2) / 2 + 0.5);
  const px = SNIPPET_PX / (to - from);
  const y = (h: number) => (h - from) * px;
  const ticks: number[] = [];
  // Every half hour on a short span, every hour or two on a long one.
  const step = to - from <= 3 ? 0.5 : to - from <= 7 ? 1 : 2;
  for (let h = Math.ceil(from / step) * step; h <= to; h += step) ticks.push(h);
  const shared = { start: Math.max(a.start, b.start), end: Math.min(a.end, b.end) };
  return (
    <div className="resolve__snip" style={{ height: SNIPPET_PX }} aria-hidden="true">
      {ticks.map((h) => (
        <div key={h} className="resolve__tick" style={{ top: y(h) }}>
          <span>{formatHour(h, use24)}</span>
        </div>
      ))}
      {[a, b].map((e, i) => (
        <div
          key={e.id ?? e.name}
          className="resolve__block"
          data-color={e.color}
          style={{ top: y(e.start), height: Math.max(14, (e.end - e.start) * px - 1), left: i === 0 ? 3 : "calc(50% + 2px)", width: "calc(50% - 5px)" }}
        >
          {e.name}
        </div>
      ))}
      {shared.end > shared.start ? <div className="resolve__band" style={{ top: y(shared.start), height: (shared.end - shared.start) * px }} /> : null}
    </div>
  );
}

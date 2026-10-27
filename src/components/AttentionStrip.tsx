"use client";

import { useState } from "react";
import { buildAttention, type AttentionItem } from "@/lib/attention";
import { useHiddenReplyIds } from "@/lib/reply-state";
import type { Theme } from "@/lib/settings";
import type { AgendaEvent, Reply, Task } from "@/lib/types";
import { ReplyQueue } from "./ReplyQueue";

const TARGETS: Record<AttentionItem["target"], string> = {
  arc: ".dayarc",
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
}: {
  agenda: AgendaEvent[];
  tasks: Task[];
  replies: Reply[];
  nowHour: number;
  theme: Theme;
}) {
  const hidden = useHiddenReplyIds();
  const [open, setOpen] = useState<{ item: AttentionItem; anchor: DOMRect } | null>(null);

  const live = replies.filter((r) => !r.id || !hidden.has(r.id));
  const items = buildAttention({ agenda, tasks, replies: live, nowHour });

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
              onClick={(e) => {
                if (it.replyIds?.length) setOpen({ item: it, anchor: e.currentTarget.getBoundingClientRect() });
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
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}

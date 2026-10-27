"use client";

import type { AttentionItem } from "@/lib/attention";

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
 * need you; when there are none it says so in one quiet line.
 */
export function AttentionStrip({ items }: { items: AttentionItem[] }) {
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
            <button type="button" className={`attn__item attn__item--${it.kind}`} onClick={() => jump(it.target)}>
              <span className="attn__label">{it.label}</span>
              <span className="attn__text">{it.title}</span>
              <span className="attn__detail">{it.detail}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

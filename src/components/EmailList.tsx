"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildReplies, replyCountLabel } from "@/lib/format";
import type { Theme } from "@/lib/settings";
import type { Reply, SliceSource } from "@/lib/types";
import { Popover } from "./Popover";
import { StaleTag } from "./StaleTag";

interface EmailListProps {
  replies: Reply[];
  source: SliceSource;
  theme: Theme;
}

interface LabelInfo {
  name: string;
  textColor?: string;
  backgroundColor?: string;
}

// Loaded once per session and reused across every "Move…" click, so the
// popover never shows a loading state — it's fetched the moment the card
// mounts, well before anyone could have clicked anything.
let labelCache: LabelInfo[] | null = null;

export function EmailList({ replies, source, theme }: EmailListProps) {
  const router = useRouter();

  const [labels, setLabels] = useState<LabelInfo[] | null>(labelCache);
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [confirmTrashId, setConfirmTrashId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveState, setMoveState] = useState<{ id: string; anchor: DOMRect } | null>(null);

  useEffect(() => {
    if (labelCache || source === "off") return;
    let alive = true;
    fetch("/api/replies/meta")
      .then((r) => (r.ok ? r.json() : { labels: [] }))
      .then((m: { labels: LabelInfo[] }) => {
        labelCache = m.labels;
        if (alive) setLabels(m.labels);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [source]);

  // Cleared items disappear the instant an action succeeds — not when the
  // slower page-wide refresh eventually lands. The refresh still runs, to
  // reconcile the count and pick up anything that changed server-side.
  const visible = replies.filter((r) => !r.id || !cleared.has(r.id));
  const rows = buildReplies(visible);

  const clear = (id: string, run: () => Promise<Response>) => {
    setError(null);
    setConfirmTrashId(null);
    setMoveState(null);
    setBusy((s) => new Set(s).add(id));
    setCleared((s) => new Set(s).add(id));
    run()
      .then((res) => {
        if (!res.ok) throw new Error();
        router.refresh();
      })
      .catch(() => {
        setCleared((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        setError("Couldn't do that — try again.");
      })
      .finally(() => {
        setBusy((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      });
  };

  const trash = (id: string) =>
    clear(id, () => fetch(`/api/replies/${id}/trash`, { method: "POST" }));

  const move = (id: string, label: string) =>
    clear(id, () =>
      fetch(`/api/replies/${id}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      }),
    );

  return (
    <section className="card column--replies">
      <div className="card__head">
        <h2 className="card__title">Needs a reply</h2>
        <div className="card__count">{replyCountLabel(visible)}</div>
        <StaleTag source={source} />
      </div>
      <div className="card__body">
        {rows.length === 0 ? (
          <p className="card__empty card__empty--first">
            {source === "off"
              ? "Connect Gmail to see threads that still need a reply."
              : "Inbox is clear — nothing waiting on you."}
          </p>
        ) : (
          <ul className="replies">
            {rows.map((r, i) => {
              const id = r.id ?? "";
              const isBusy = id ? busy.has(id) : false;
              const canAct = Boolean(id) && !isBusy;
              return (
                <li key={id || `reply${i}`} className={`reply${r.unread ? " reply--unread" : ""}`}>
                  <div className="reply__avatar">{r.initials}</div>
                  <div className="reply__body">
                    <div className="reply__top">
                      <div className="reply__from">{r.from}</div>
                      <div className="reply__age">{r.age}</div>
                    </div>
                    <div className="reply__subject">{r.subject}</div>
                    <div className="reply__foot">
                      <span className={r.noteCls}>{r.note}</span>
                      {id ? (
                        <div className="reply__actions">
                          {confirmTrashId === id ? (
                            <span className="reply__confirm">
                              <button
                                type="button"
                                className="reply__action reply__action--trash-armed"
                                disabled={!canAct}
                                onClick={() => trash(id)}
                              >
                                Trash it
                              </button>
                              <button
                                type="button"
                                className="reply__action"
                                onClick={() => setConfirmTrashId(null)}
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="reply__action"
                                disabled={!canAct}
                                onClick={(e) =>
                                  setMoveState({
                                    id,
                                    anchor: e.currentTarget.getBoundingClientRect(),
                                  })
                                }
                              >
                                Move…
                              </button>
                              <button
                                type="button"
                                className="reply__action reply__action--trash"
                                disabled={!canAct}
                                onClick={() => setConfirmTrashId(id)}
                              >
                                Trash
                              </button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {error ? <p className="tasks__error">{error}</p> : null}
      </div>

      {moveState ? (
        <MovePopover
          anchor={moveState.anchor}
          theme={theme}
          labels={labels}
          onClose={() => setMoveState(null)}
          onPick={(label) => move(moveState.id, label)}
        />
      ) : null}
    </section>
  );
}

function MovePopover({
  anchor,
  theme,
  labels,
  onClose,
  onPick,
}: {
  anchor: DOMRect;
  theme: Theme;
  labels: LabelInfo[] | null;
  onClose: () => void;
  onPick: (label: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (value: string) => {
    const label = value.trim();
    if (!label) return;
    onPick(label);
  };

  return (
    <Popover
      anchor={anchor}
      theme={theme}
      onClose={onClose}
      ariaLabel="Move to a label"
      className="replymove"
    >
      <div className="replymove__label">Move to a label</div>
      {labels === null ? (
        <p className="replymove__hint">Loading your labels…</p>
      ) : labels.length > 0 ? (
        <div className="replymove__chips">
          {labels.map((l) => (
            <button
              key={l.name}
              type="button"
              className="replymove__chip"
              style={
                l.backgroundColor
                  ? { background: l.backgroundColor, color: l.textColor, borderColor: "transparent" }
                  : undefined
              }
              onClick={() => submit(l.name)}
            >
              {l.name}
            </button>
          ))}
        </div>
      ) : null}
      <input
        ref={inputRef}
        className="replymove__input"
        value={draft}
        placeholder="New label — press Enter"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit(draft);
          }
        }}
      />
    </Popover>
  );
}

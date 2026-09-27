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

export function EmailList({ replies, source, theme }: EmailListProps) {
  const router = useRouter();
  const rows = buildReplies(replies);

  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [confirmTrashId, setConfirmTrashId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveState, setMoveState] = useState<{ id: string; anchor: DOMRect } | null>(null);

  const visibleIds = new Set(replies.map((r) => r.id));
  const cleared_ = new Set([...cleared].filter((id) => visibleIds.has(id)));

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
        <div className="card__count">{replyCountLabel(replies)}</div>
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
              const isCleared = id ? cleared_.has(id) : false;
              const isBusy = id ? busy.has(id) : false;
              const canAct = Boolean(id) && !isBusy && !isCleared;
              return (
                <li
                  key={id || `reply${i}`}
                  className={`reply${r.unread ? " reply--unread" : ""}${
                    isCleared ? " reply--cleared" : ""
                  }`}
                >
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
  onClose,
  onPick,
}: {
  anchor: DOMRect;
  theme: Theme;
  onClose: () => void;
  onPick: (label: string) => void;
}) {
  const [labels, setLabels] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/replies/meta")
      .then((r) => (r.ok ? r.json() : { labels: [] }))
      .then((m: { labels: string[] }) => {
        if (alive) setLabels(m.labels);
      })
      .catch(() => alive && setLabels([]));
    return () => {
      alive = false;
    };
  }, []);

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
              key={l}
              type="button"
              className="replymove__chip"
              onClick={() => submit(l)}
            >
              {l}
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { gmailLink, loadLabels, moveReply, trashReply, type LabelInfo } from "@/lib/reply-actions";
import { SNOOZE_HOURS, snoozeReply } from "@/lib/reply-state";
import type { Theme } from "@/lib/settings";
import type { Reply } from "@/lib/types";
import { Popover } from "./Popover";

/**
 * The emails behind an attention item, with an action on each: reply (opens
 * Gmail), wait (hide for a day, this browser only), move, trash.
 */
export function ReplyQueue({
  title,
  replies,
  anchor,
  theme,
  onClose,
}: {
  title: string;
  replies: Reply[];
  anchor: DOMRect;
  theme: Theme;
  onClose: () => void;
}) {
  const router = useRouter();
  const [labels, setLabels] = useState<LabelInfo[] | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [trashing, setTrashing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let alive = true;
    loadLabels().then((l) => alive && setLabels(l));
    return () => {
      alive = false;
    };
  }, []);

  // Everything dealt with: close rather than show an empty card.
  useEffect(() => {
    if (replies.length === 0) onClose();
  }, [replies.length, onClose]);

  const done = async (id: string, run: (id: string) => Promise<boolean>) => {
    setError(null);
    setMoving(null);
    setTrashing(null);
    const ok = await run(id);
    if (ok) router.refresh();
    else setError("Couldn't do that. Try again.");
  };

  return (
    <Popover anchor={anchor} theme={theme} onClose={onClose} ariaLabel={title} className="rq">
      <div className="rq__title">{title}</div>
      <ul className="rq__list">
        {replies.map((r) => {
          const id = r.id as string;
          return (
            <li key={id} className="rq__row">
              <div className="rq__top">
                <span className="rq__from">{r.from}</span>
                <span className="rq__age">{r.age}</span>
              </div>
              <div className="rq__subject">{r.subject}</div>
              <div className={`reply__note reply__note--u${r.urgency}`}>{r.note}</div>
              <div className="rq__actions">
                <a className="rq__btn rq__btn--primary" href={gmailLink(id)} target="_blank" rel="noreferrer">
                  Reply in Gmail
                </a>
                <button type="button" className="rq__btn" onClick={() => snoozeReply(id)} title={`Hide for ${SNOOZE_HOURS} hours`}>
                  Wait a day
                </button>
                <button type="button" className="rq__btn" onClick={() => setMoving(moving === id ? null : id)} aria-expanded={moving === id}>
                  Move…
                </button>
                {trashing === id ? (
                  <>
                    <button type="button" className="rq__btn rq__btn--danger" onClick={() => done(id, trashReply)}>
                      Trash it
                    </button>
                    <button type="button" className="rq__btn" onClick={() => setTrashing(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className="rq__btn" onClick={() => { setTrashing(id); setMoving(null); }}>
                    Trash
                  </button>
                )}
              </div>
              {moving === id ? (
                <div className="rq__move">
                  {labels === null ? <span className="rq__hint">Loading labels…</span> : null}
                  {labels?.map((l) => (
                    <button key={l.name} type="button" className="rq__chip" onClick={() => done(id, (i) => moveReply(i, l.name))}>
                      {l.name}
                    </button>
                  ))}
                  <input
                    className="rq__input"
                    value={draft}
                    placeholder="New label, press Enter"
                    aria-label="New label name"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && draft.trim()) {
                        e.preventDefault();
                        const name = draft.trim();
                        setDraft("");
                        done(id, (i) => moveReply(i, name));
                      }
                    }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? <p className="rq__error">{error}</p> : null}
    </Popover>
  );
}

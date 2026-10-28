"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { gmailLink, loadLabels, moveReply, trashReply, type LabelInfo } from "@/lib/reply-actions";
import { SNOOZE_HOURS, snoozeReply } from "@/lib/reply-state";
import type { Priority } from "@/lib/types";
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
  aiDraft,
  canTask,
  todayIso,
}: {
  aiDraft: boolean;
  /** Todoist is connected: "Make task" is offered. */
  canTask: boolean;
  todayIso: string;
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
  const [drafting, setDrafting] = useState<string | null>(null);
  const [tasking, setTasking] = useState<string | null>(null);

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
                {aiDraft ? (
                  <button
                    type="button"
                    className="rq__btn"
                    aria-expanded={drafting === id}
                    onClick={() => { setDrafting(drafting === id ? null : id); setTasking(null); setMoving(null); }}
                  >
                    Draft reply
                  </button>
                ) : null}
                {canTask ? (
                  <button
                    type="button"
                    className="rq__btn"
                    aria-expanded={tasking === id}
                    onClick={() => { setTasking(tasking === id ? null : id); setDrafting(null); setMoving(null); }}
                  >
                    Make task
                  </button>
                ) : null}
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
              {drafting === id ? <DraftPanel id={id} /> : null}
              {tasking === id ? (
                <TaskPanel
                  reply={r}
                  id={id}
                  ai={aiDraft}
                  todayIso={todayIso}
                  onAdded={() => {
                    router.refresh();
                  }}
                />
              ) : null}
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

/** "Draft reply": optional one-line steer, then an editable draft to save to Gmail. Never sends. */
function DraftPanel({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "drafting" | "ready" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    setPhase("drafting");
    try {
      const res = await fetch(`/api/replies/${id}/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !body.text) throw new Error(body.error || "Couldn't draft that.");
      setText(body.text);
      setPhase("ready");
    } catch (e) {
      setError((e as Error).message);
      setPhase(text ? "ready" : "idle");
    }
  };

  const save = async () => {
    setError(null);
    setPhase("saving");
    try {
      const res = await fetch(`/api/replies/${id}/draft/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "Couldn't save the draft.");
      setUrl(body.url);
      setPhase("saved");
    } catch (e) {
      setError((e as Error).message);
      setPhase("ready");
    }
  };

  return (
    <div className="rq__draft">
      {phase === "idle" || phase === "drafting" ? (
        <>
          <input
            className="rq__input"
            value={note}
            maxLength={300}
            placeholder="What should it say? (optional)"
            aria-label="What the reply should say"
            disabled={phase === "drafting"}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                generate();
              }
            }}
          />
          <button type="button" className="rq__btn rq__btn--primary" disabled={phase === "drafting"} onClick={generate}>
            {phase === "drafting" ? "Drafting…" : "Write draft"}
          </button>
        </>
      ) : (
        <>
          <textarea
            className="rq__text"
            value={text}
            rows={7}
            maxLength={8000}
            aria-label="Draft reply"
            onChange={(e) => setText(e.target.value)}
            disabled={phase === "saving"}
          />
          <p className="rq__hint">AI draft. Read it before you send; nothing is sent from here.</p>
          <div className="rq__actions">
            {phase === "saved" && url ? (
              <a className="rq__btn rq__btn--primary" href={url} target="_blank" rel="noreferrer">
                Saved. Open in Gmail drafts
              </a>
            ) : (
              <button type="button" className="rq__btn rq__btn--primary" disabled={phase === "saving" || !text.trim()} onClick={save}>
                {phase === "saving" ? "Saving…" : "Save to Gmail drafts"}
              </button>
            )}
            <button type="button" className="rq__btn" disabled={phase === "saving"} onClick={generate}>
              Redo
            </button>
          </div>
        </>
      )}
      {error ? <p className="rq__error">{error}</p> : null}
    </div>
  );
}

const DONE_HOURS = 24 * 30;

/** The task's starting title when nothing smarter is available. */
export function defaultTaskTitle(r: Reply): string {
  const who = r.from.split(/[\s<]/)[0] || r.from;
  const subject = r.subject.replace(/^((re|fwd?):\s*)+/i, "").trim();
  return `Reply to ${who}: ${subject}`.slice(0, 140);
}

/**
 * "Make task": a few editable fields (title, priority, due date), optionally
 * filled in by the AI from the email, then one click to add it to Todoist.
 * Nothing is written until that click.
 */
function TaskPanel({
  reply,
  id,
  ai,
  todayIso,
  onAdded,
}: {
  reply: Reply;
  id: string;
  ai: boolean;
  todayIso: string;
  onAdded: () => void;
}) {
  const [content, setContent] = useState(() => defaultTaskTitle(reply));
  const [priority, setPriority] = useState<Priority>(2);
  const [dueDate, setDueDate] = useState("");
  const [hide, setHide] = useState(true);
  const [phase, setPhase] = useState<"edit" | "reading" | "saving" | "saved">("edit");
  const [error, setError] = useState<string | null>(null);

  const fill = async () => {
    setError(null);
    setPhase("reading");
    try {
      const res = await fetch(`/api/replies/${id}/task`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ today: todayIso }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        suggestion?: { content: string; priority: Priority; dueDate: string | null };
        error?: string;
      };
      if (!res.ok || !body.suggestion) throw new Error(body.error || "Couldn't read a task from that.");
      setContent(body.suggestion.content);
      setPriority(body.suggestion.priority);
      setDueDate(body.suggestion.dueDate ?? "");
    } catch (e) {
      setError((e as Error).message);
    }
    setPhase("edit");
  };

  const add = async () => {
    setError(null);
    setPhase("saving");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content,
          priority,
          ...(dueDate ? { dueDate } : {}),
          description: `From ${reply.from}: ${reply.subject}\n${gmailLink(id)}`,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Couldn't add the task.");
      }
      setPhase("saved");
      // Off the pending list (this browser only; the email itself is untouched in Gmail).
      if (hide) snoozeReply(id, DONE_HOURS);
      onAdded();
    } catch (e) {
      setError((e as Error).message);
      setPhase("edit");
    }
  };

  if (phase === "saved") return <p className="rq__hint rq__saved">Added to Todoist.</p>;
  const busy = phase !== "edit";
  return (
    <div className="rq__draft rq__task">
      {ai ? (
        <button type="button" className="rq__btn" disabled={busy} onClick={fill}>
          {phase === "reading" ? "Reading…" : "Fill in from the email"}
        </button>
      ) : null}
      <input
        className="rq__input"
        value={content}
        maxLength={140}
        aria-label="Task"
        disabled={busy}
        onChange={(e) => setContent(e.target.value)}
      />
      <div className="rq__fields">
        <label className="rq__field">
          Priority
          <select className="rq__input" value={priority} disabled={busy} onChange={(e) => setPriority(Number(e.target.value) as Priority)}>
            <option value={1}>Urgent</option>
            <option value={2}>Normal</option>
            <option value={3}>Someday</option>
          </select>
        </label>
        <label className="rq__field">
          Due
          <input className="rq__input" type="date" value={dueDate} min={todayIso} disabled={busy} onChange={(e) => setDueDate(e.target.value)} />
        </label>
      </div>
      <label className="rq__check">
        <input type="checkbox" checked={hide} disabled={busy} onChange={(e) => setHide(e.target.checked)} />
        Take this email off my list
      </label>
      {ai ? <p className="rq__hint">AI fills in the fields; check them before adding.</p> : null}
      <div className="rq__actions">
        <button type="button" className="rq__btn rq__btn--primary" disabled={busy || !content.trim()} onClick={add}>
          {phase === "saving" ? "Adding…" : "Add to Todoist"}
        </button>
      </div>
      {error ? <p className="rq__error">{error}</p> : null}
    </div>
  );
}

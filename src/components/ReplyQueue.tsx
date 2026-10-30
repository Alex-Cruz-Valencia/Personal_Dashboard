"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  gmailLink,
  loadLabels,
  loadTriage,
  moveReply,
  trashReply,
  type LabelInfo,
  type TriageSuggestion,
} from "@/lib/reply-actions";
import { SNOOZE_HOURS, snoozeReply } from "@/lib/reply-state";
import type { Priority } from "@/lib/types";
import type { Theme } from "@/lib/settings";
import type { Reply } from "@/lib/types";
import { NewTaskForm, type TaskDraft } from "./NewTaskForm";
import { Popover } from "./Popover";

/**
 * The emails behind an attention item, with an action on each: reply (opens
 * Gmail), wait (hide for a day, this browser only), move, trash. With AI on,
 * each email also shows one suggested action; it runs only when clicked.
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
  const [triage, setTriage] = useState<Map<string, TriageSuggestion | null> | null>(null);
  const [triageError, setTriageError] = useState(false);
  const idKey = replies.map((r) => r.id).join(",");

  useEffect(() => {
    let alive = true;
    loadLabels().then((l) => alive && setLabels(l));
    return () => {
      alive = false;
    };
  }, []);

  // Suggestions are read-only, so they load on open (cached per page load).
  useEffect(() => {
    if (!aiDraft || !idKey) return;
    let alive = true;
    loadTriage(idKey.split(","))
      .then((m) => alive && setTriage(m))
      .catch(() => alive && setTriageError(true));
    return () => {
      alive = false;
    };
  }, [aiDraft, idKey]);

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

  const apply = (id: string, s: TriageSuggestion) => {
    setMoving(null);
    setTrashing(null);
    if (s.action === "trash") done(id, trashReply);
    else if (s.action === "file" && s.label) done(id, (i) => moveReply(i, s.label as string));
    else if (s.action === "task") { setTasking(id); setDrafting(null); }
    else if (s.action === "reply") { setDrafting(id); setTasking(null); }
    else snoozeReply(id);
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
              {aiDraft ? (
                <Suggestion
                  s={triage?.get(id) ?? null}
                  loading={triage === null && !triageError}
                  canTask={canTask}
                  onApply={(s) => apply(id, s)}
                />
              ) : null}
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
              {drafting === id ? (
                <DraftPanel
                  id={id}
                  fileAfter={triage?.get(id)?.action === "reply" ? triage.get(id)?.label : undefined}
                  onFile={(label) => done(id, (i) => moveReply(i, label))}
                />
              ) : null}
              {tasking === id ? (
                <TaskPanel
                  reply={r}
                  id={id}
                  ai={aiDraft}
                  autoFill={triage?.get(id)?.action === "task"}
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
      {triageError ? <p className="rq__hint rq__ai-note">Couldn&apos;t get AI suggestions right now.</p> : null}
    </Popover>
  );
}

const ACTION_NAME: Record<TriageSuggestion["action"], string> = {
  trash: "Trash",
  task: "Make a task",
  reply: "Reply",
  file: "File",
  leave: "Leave it",
};

const applyLabel = (s: TriageSuggestion) =>
  s.action === "file" ? `File to ${s.label}` : s.action === "reply" ? "Draft reply" : s.action === "leave" ? `Hide for ${SNOOZE_HOURS}h` : ACTION_NAME[s.action];

/** One line: what the AI would do with this email and why, plus the one click that does it. */
function Suggestion({
  s,
  loading,
  canTask,
  onApply,
}: {
  s: TriageSuggestion | null;
  loading: boolean;
  canTask: boolean;
  onApply: (s: TriageSuggestion) => void;
}) {
  if (loading) return <div className="rq__ai rq__ai--loading">Thinking about this one…</div>;
  if (!s) return null;
  const name = s.action === "file" ? `File to ${s.label}` : ACTION_NAME[s.action];
  const runnable = s.action !== "task" || canTask;
  return (
    <div className={`rq__ai rq__ai--${s.action}`}>
      <span className="rq__ai-text">
        <span className="rq__ai-kicker">Suggested:</span> <strong>{name}</strong>
        {s.action === "reply" && s.label ? <span className="rq__ai-then">, then file to {s.label}</span> : null}
        {s.reason ? <span className="rq__ai-why"> · {s.reason}</span> : null}
      </span>
      {runnable ? (
        <button
          type="button"
          className={`rq__btn rq__btn--sm${s.action === "trash" ? " rq__btn--danger" : ""}`}
          onClick={() => onApply(s)}
        >
          {applyLabel(s)}
        </button>
      ) : null}
    </div>
  );
}

/** "Draft reply": optional one-line steer, then an editable draft to save to Gmail. Never sends. */
function DraftPanel({
  id,
  fileAfter,
  onFile,
}: {
  id: string;
  /** The label triage suggested filing under once the reply is drafted. */
  fileAfter?: string;
  onFile: (label: string) => void;
}) {
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
              <>
                <a className="rq__btn rq__btn--primary" href={url} target="_blank" rel="noreferrer">
                  Saved. Open in Gmail drafts
                </a>
                {fileAfter ? (
                  <button type="button" className="rq__btn" onClick={() => onFile(fileAfter)}>
                    File to {fileAfter}
                  </button>
                ) : null}
              </>
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
  autoFill,
  todayIso,
  onAdded,
}: {
  reply: Reply;
  id: string;
  ai: boolean;
  /** Triage suggested a task: fill the fields from the email right away. */
  autoFill?: boolean;
  todayIso: string;
  onAdded: () => void;
}) {
  const [hide, setHide] = useState(true);
  const [saved, setSaved] = useState(false);

  const fill = async (): Promise<Partial<TaskDraft>> => {
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
    return { content: body.suggestion.content, priority: body.suggestion.priority, due: body.suggestion.dueDate ?? "" };
  };

  if (saved) return <p className="rq__hint rq__saved">Added to Todoist.</p>;
  return (
    <div className="rq__draft rq__task">
      <NewTaskForm
        initial={{
          content: defaultTaskTitle(reply),
          description: `From ${reply.from}: ${reply.subject}\n${gmailLink(id)}`,
        }}
        submitLabel="Add to Todoist"
        onFill={ai ? fill : undefined}
        autoFill={ai && autoFill}
        extra={
          <>
            <label className="rq__check">
              <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
              Take this email off my list
            </label>
            {ai ? <p className="rq__hint">AI fills in the fields; check them before adding.</p> : null}
          </>
        }
        onAdded={() => {
          setSaved(true);
          // Off the pending list (this browser only; the email itself is untouched in Gmail).
          if (hide) snoozeReply(id, DONE_HOURS);
          onAdded();
        }}
      />
    </div>
  );
}

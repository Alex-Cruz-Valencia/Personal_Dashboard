"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PRIORITY_LABEL } from "@/lib/format";
import { loadTaskMeta, type TaskMeta } from "@/lib/task-meta";
import type { Priority } from "@/lib/types";

/** Same fields as the task editor, so a new task is built the way an existing one is edited. */
export interface TaskDraft {
  content: string;
  priority: Priority;
  /** Natural language ("tomorrow 9am") or an ISO date; empty = no date. */
  due: string;
  projectId: string;
  labels: string[];
  deadline: string;
  durationMinutes: string;
  description: string;
}

export const EMPTY_DRAFT: TaskDraft = {
  content: "",
  priority: 2,
  due: "",
  projectId: "",
  labels: [],
  deadline: "",
  durationMinutes: "",
  description: "",
};

const DUE_CHIPS: { label: string; value: string }[] = [
  { label: "Today", value: "today" },
  { label: "Tomorrow", value: "tomorrow" },
  { label: "This weekend", value: "saturday" },
  { label: "Next week", value: "next monday" },
  { label: "No date", value: "" },
];

const HAS_TIME = /\d\s?(am|pm)\b|\d:\d\d|\bat\s+\d|\b(noon|midnight)\b|T\d\d:/i;

interface Props {
  initial?: Partial<TaskDraft>;
  submitLabel?: string;
  /** AI helper: returns fields to overwrite (content, priority, due). */
  onFill?: () => Promise<Partial<TaskDraft>>;
  /** Run `onFill` once on open (read-only; adding still takes the click). */
  autoFill?: boolean;
  /** Extra controls above the buttons (parent owns their state). */
  extra?: ReactNode;
  onCancel?: () => void;
  onAdded: () => void;
}

/** Fill in a task the way Todoist does, then add it. Nothing is written until Add. */
export function NewTaskForm({ initial, submitLabel = "Add task", onFill, autoFill, extra, onCancel, onAdded }: Props) {
  const [d, setD] = useState<TaskDraft>({ ...EMPTY_DRAFT, ...initial });
  const [meta, setMeta] = useState<TaskMeta | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [phase, setPhase] = useState<"edit" | "reading" | "saving">(autoFill && onFill ? "reading" : "edit");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadTaskMeta().then((m) => alive && setMeta(m));
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof TaskDraft>(k: K, v: TaskDraft[K]) => setD((s) => ({ ...s, [k]: v }));
  const busy = phase !== "edit";

  const addLabel = (raw: string) => {
    const l = raw.trim().replace(/^@/, "");
    setLabelDraft("");
    if (l && !d.labels.includes(l)) set("labels", [...d.labels, l]);
  };

  const fill = async () => {
    if (!onFill) return;
    setError(null);
    setPhase("reading");
    try {
      const fields = await onFill();
      setD((s) => ({ ...s, ...fields }));
    } catch (e) {
      setError((e as Error).message);
    }
    setPhase("edit");
  };

  // Mount-only on purpose: a later re-render must not overwrite what the person typed.
  useEffect(() => {
    if (!autoFill || !onFill) return;
    let alive = true;
    onFill()
      .then((fields) => alive && setD((s) => ({ ...s, ...fields })))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setPhase("edit"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    const content = d.content.trim();
    if (!content || busy) return;
    setError(null);
    setPhase("saving");
    try {
      const minutes = Number(d.durationMinutes);
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content,
          priority: d.priority,
          ...(d.due.trim() ? { due: d.due.trim() } : {}),
          ...(d.projectId ? { projectId: d.projectId } : {}),
          ...(d.labels.length ? { labels: d.labels } : {}),
          ...(d.deadline ? { deadline: d.deadline } : {}),
          ...(minutes > 0 ? { durationMinutes: Math.round(minutes) } : {}),
          ...(d.description.trim() ? { description: d.description.trim() } : {}),
        }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Couldn't add the task.");
      onAdded();
    } catch (e) {
      setError((e as Error).message);
      setPhase("edit");
    }
  };

  return (
    <div className="newtask">
      {onFill ? (
        <button type="button" className="rq__btn" disabled={busy} onClick={fill}>
          {phase === "reading" ? "Reading…" : "Fill in from the email"}
        </button>
      ) : null}

      <input
        autoFocus
        className="taskedit__name"
        value={d.content}
        maxLength={140}
        placeholder="Task name"
        aria-label="Task name"
        disabled={busy}
        onChange={(e) => set("content", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />

      <div className="taskedit__field">
        <span className="taskedit__label">Priority</span>
        <div className="taskedit__seg">
          {([1, 2, 3] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              className={`taskedit__seg-btn taskedit__seg-btn--p${p}${d.priority === p ? " is-on" : ""}`}
              onClick={() => set("priority", p)}
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="taskedit__field">
        <span className="taskedit__label">
          Due <span className="taskedit__cur">{d.due || "—"}</span>
        </span>
        <div className="taskedit__chips">
          {DUE_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              disabled={busy}
              className={`taskedit__chip${d.due === c.value ? " is-on" : ""}`}
              onClick={() => set("due", c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          className="taskedit__text"
          value={d.due}
          disabled={busy}
          placeholder="or type a date — “fri 3pm”, “in 2 weeks”"
          onChange={(e) => set("due", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </div>

      <div className="taskedit__field">
        <span className="taskedit__label">Project</span>
        <select className="taskedit__select" value={d.projectId} disabled={busy} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">Inbox (default)</option>
          {(meta?.projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="taskedit__field">
        <span className="taskedit__label">Labels</span>
        <div className="taskedit__labels">
          {d.labels.map((l) => (
            <button key={l} type="button" className="taskedit__label-chip" title="Remove" onClick={() => set("labels", d.labels.filter((x) => x !== l))}>
              {l} ×
            </button>
          ))}
          <input
            className="taskedit__label-input"
            list="newtask-labels"
            value={labelDraft}
            disabled={busy}
            placeholder="add…"
            onChange={(e) => setLabelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLabel(e.currentTarget.value);
              }
            }}
            onBlur={(e) => addLabel(e.currentTarget.value)}
          />
          <datalist id="newtask-labels">
            {(meta?.labels ?? []).map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="taskedit__row2">
        <label className="taskedit__field">
          <span className="taskedit__label">Deadline</span>
          <input type="date" className="taskedit__text" value={d.deadline} disabled={busy} onChange={(e) => set("deadline", e.target.value)} />
        </label>
        <label className="taskedit__field">
          <span className="taskedit__label">Duration</span>
          <input
            type="number"
            min={0}
            step={5}
            className="taskedit__text"
            value={d.durationMinutes}
            disabled={busy}
            placeholder="min"
            onChange={(e) => set("durationMinutes", e.target.value)}
          />
        </label>
      </div>
      {d.durationMinutes && !HAS_TIME.test(d.due) ? (
        <p className="taskedit__hint">Todoist only keeps a duration on tasks with a due time (e.g. “tomorrow 9am”).</p>
      ) : null}

      <div className="taskedit__field">
        <span className="taskedit__label">Notes</span>
        <textarea
          className="taskedit__textarea"
          value={d.description}
          rows={2}
          disabled={busy}
          maxLength={2000}
          placeholder="Add detail…"
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      {extra}
      {error ? <p className="taskedit__error">{error}</p> : null}

      <div className="newtask__actions">
        {onCancel ? (
          <button type="button" className="taskedit__cancel" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="button" className="taskedit__done" disabled={busy || !d.content.trim()} onClick={submit}>
          {phase === "saving" ? "Adding…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

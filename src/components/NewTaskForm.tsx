"use client";

import { useEffect, useState, type ReactNode } from "react";
import { loadTaskMeta, type TaskMeta } from "@/lib/task-meta";
import { TaskFieldsMenu, type TaskFields } from "./TaskMenu";

/** The Todoist menu's fields plus the rest of the task, so a new task is built the way one is edited. */
export interface TaskDraft extends TaskFields {
  content: string;
  labels: string[];
  durationMinutes: string;
  description: string;
}

export const EMPTY_DRAFT: TaskDraft = {
  content: "",
  priority: 4,
  due: "",
  projectId: "",
  sectionId: "",
  labels: [],
  deadline: "",
  durationMinutes: "",
  description: "",
};

const HAS_TIME = /\d\s?(am|pm)\b|\d:\d\d|\bat\s+\d|\b(noon|midnight)\b|T\d\d:/i;

interface Props {
  initial?: Partial<TaskDraft>;
  /** The dashboard's day, for the menu's date shortcuts. */
  todayIso: string;
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
export function NewTaskForm({ initial, todayIso, submitLabel = "Add task", onFill, autoFill, extra, onCancel, onAdded }: Props) {
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
          todoistPriority: d.priority,
          ...(d.due.trim() ? { due: d.due.trim() } : {}),
          ...(d.sectionId ? { sectionId: d.sectionId } : d.projectId ? { projectId: d.projectId } : {}),
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

      <TaskFieldsMenu value={d} onChange={(patch) => setD((s) => ({ ...s, ...patch }))} todayIso={todayIso} disabled={busy} />

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

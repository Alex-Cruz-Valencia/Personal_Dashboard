"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { PRIORITY_LABEL } from "@/lib/format";
import type { Theme } from "@/lib/settings";
import type { Priority, Project, Task } from "@/lib/types";
import { Popover } from "./Popover";

interface Meta {
  projects: Project[];
  labels: string[];
}

interface TaskDetailApi {
  open: (task: Task, anchorEl: HTMLElement) => void;
  close: () => void;
  isSelected: (task: Task) => boolean;
}

const Ctx = createContext<TaskDetailApi | null>(null);

export function useTaskDetail(): TaskDetailApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useTaskDetail must be used within TaskDetailProvider");
  return api;
}

// Fetched once per session.
let metaCache: Meta | null = null;

export function TaskDetailProvider({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}) {
  const [state, setState] = useState<{ task: Task; anchor: DOMRect } | null>(null);
  const [meta, setMeta] = useState<Meta | null>(metaCache);

  useEffect(() => {
    if (metaCache || !state) return;
    let alive = true;
    fetch("/api/tasks/meta")
      .then((r) => (r.ok ? r.json() : { projects: [], labels: [] }))
      .then((m: Meta) => {
        metaCache = m;
        if (alive) setMeta(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [state]);

  const open = useCallback((task: Task, anchorEl: HTMLElement) => {
    setState({ task, anchor: anchorEl.getBoundingClientRect() });
  }, []);
  const close = useCallback(() => setState(null), []);

  const api: TaskDetailApi = {
    open,
    close,
    isSelected: (task) =>
      Boolean(state) && Boolean(task.id) && state!.task.id === task.id,
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {state?.task.id ? (
        <TaskDetailCard
          key={state.task.id}
          task={state.task}
          anchor={state.anchor}
          theme={theme}
          meta={meta ?? { projects: [], labels: [] }}
          onClose={close}
        />
      ) : null}
    </Ctx.Provider>
  );
}

const DUE_CHIPS: { label: string; value: string }[] = [
  { label: "Today", value: "today" },
  { label: "Tomorrow", value: "tomorrow" },
  { label: "This weekend", value: "saturday" },
  { label: "Next week", value: "next monday" },
  { label: "No date", value: "" },
];

function TaskDetailCard({
  task,
  anchor,
  theme,
  meta,
  onClose,
}: {
  task: Task;
  anchor: DOMRect;
  theme: Theme;
  meta: Meta;
  onClose: () => void;
}) {
  const router = useRouter();
  const id = task.id as string;

  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [labelDraft, setLabelDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Local optimistic copy so the UI reflects edits before the refresh lands.
  const [local, setLocal] = useState({
    priority: task.priority,
    due: task.due,
    projectId: task.projectId,
    labels: task.labels ?? [],
    deadline: task.deadline ?? "",
    durationMinutes: task.durationMinutes,
  });

  const send = useCallback(
    async (body: Record<string, unknown>, method: "PATCH" | "DELETE" | "POST" = "PATCH", path = `/api/tasks/${id}`) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(path, {
          method,
          headers: method === "DELETE" ? undefined : { "content-type": "application/json" },
          body: method === "DELETE" ? undefined : JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Request failed");
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [id, router],
  );

  const setPriority = (p: Priority) => {
    setLocal((s) => ({ ...s, priority: p }));
    send({ priority: p });
  };
  const setDue = (value: string) => {
    setLocal((s) => ({ ...s, due: value || "—" }));
    send({ due: value || null });
  };
  const setProject = (projectId: string) => {
    setLocal((s) => ({ ...s, projectId }));
    send({ projectId });
  };
  const setLabels = (labels: string[]) => {
    setLocal((s) => ({ ...s, labels }));
    send({ labels });
  };
  const addLabel = (raw: string) => {
    const l = raw.trim().replace(/^@/, "");
    if (!l || local.labels.includes(l)) return setLabelDraft("");
    setLabelDraft("");
    setLabels([...local.labels, l]);
  };

  return (
    <Popover
      anchor={anchor}
      theme={theme}
      onClose={onClose}
      ariaLabel={`Edit task: ${task.name}`}
      className="taskedit"
    >
      <div className="taskedit__head">
        <span className="taskedit__eyebrow">
          Task{saving ? " · saving…" : ""}
        </span>
        <button type="button" className="taskedit__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <input
        className="taskedit__name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== task.name && send({ content: name.trim() })}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />

      <div className="taskedit__field">
        <span className="taskedit__label">Priority</span>
        <div className="taskedit__seg">
          {([1, 2, 3] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              className={`taskedit__seg-btn taskedit__seg-btn--p${p}${
                local.priority === p ? " is-on" : ""
              }`}
              onClick={() => setPriority(p)}
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="taskedit__field">
        <span className="taskedit__label">
          Due <span className="taskedit__cur">{local.due}</span>
          {task.isRecurring ? (
            <span className="taskedit__recur">🔁 {task.recurrence}</span>
          ) : null}
        </span>
        <div className="taskedit__chips">
          {DUE_CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              className="taskedit__chip"
              onClick={() => setDue(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          className="taskedit__text"
          placeholder="or type a date — “fri 3pm”, “in 2 weeks”"
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) {
              setDue(e.currentTarget.value.trim());
              e.currentTarget.value = "";
            }
          }}
        />
        {task.isRecurring ? (
          <p className="taskedit__hint">Setting a specific date removes the repeat.</p>
        ) : null}
      </div>

      <div className="taskedit__field">
        <span className="taskedit__label">Project</span>
        <select
          className="taskedit__select"
          value={local.projectId ?? ""}
          onChange={(e) => setProject(e.target.value)}
        >
          {!meta.projects.some((p) => p.id === local.projectId) && local.projectId ? (
            <option value={local.projectId}>{task.meta}</option>
          ) : null}
          {meta.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="taskedit__field">
        <span className="taskedit__label">Labels</span>
        <div className="taskedit__labels">
          {local.labels.map((l) => (
            <button
              key={l}
              type="button"
              className="taskedit__label-chip"
              onClick={() => setLabels(local.labels.filter((x) => x !== l))}
              title="Remove"
            >
              {l} ×
            </button>
          ))}
          <input
            className="taskedit__label-input"
            list="taskedit-labels"
            value={labelDraft}
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
          <datalist id="taskedit-labels">
            {meta.labels.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="taskedit__row2">
        <label className="taskedit__field">
          <span className="taskedit__label">Deadline</span>
          <input
            type="date"
            className="taskedit__text"
            value={local.deadline}
            onChange={(e) => {
              setLocal((s) => ({ ...s, deadline: e.target.value }));
              send({ deadline: e.target.value || null });
            }}
          />
        </label>
        <label className="taskedit__field">
          <span className="taskedit__label">Duration</span>
          <input
            type="number"
            min={0}
            step={5}
            className="taskedit__text"
            defaultValue={local.durationMinutes ?? ""}
            placeholder="min"
            onBlur={(e) => {
              const v = e.target.value.trim();
              const n = v ? Number(v) : null;
              if (n !== (task.durationMinutes ?? null)) {
                send({ durationMinutes: n });
              }
            }}
          />
        </label>
      </div>

      <div className="taskedit__field">
        <span className="taskedit__label">Notes</span>
        <textarea
          className="taskedit__textarea"
          value={description}
          rows={2}
          placeholder="Add detail…"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() =>
            description !== (task.description ?? "") && send({ description })
          }
        />
      </div>

      {error ? <p className="taskedit__error">{error}</p> : null}

      <div className="taskedit__actions">
        <button
          type="button"
          className="taskedit__done"
          onClick={() => {
            send({}, "POST", `/api/tasks/${id}/complete`);
            onClose();
          }}
        >
          ✓ Complete
        </button>
        {confirmDelete ? (
          <span className="taskedit__confirm">
            <button
              type="button"
              className="taskedit__delete is-armed"
              onClick={() => {
                send({}, "DELETE");
                onClose();
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="taskedit__cancel"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="taskedit__delete"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        )}
      </div>
    </Popover>
  );
}

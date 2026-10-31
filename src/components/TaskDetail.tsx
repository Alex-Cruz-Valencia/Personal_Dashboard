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
import type { Theme } from "@/lib/settings";
import type { Project, Section, Task } from "@/lib/types";
import { useFocus } from "./Focus";
import { flushFocus, Popover } from "./Popover";
import { TaskFieldsMenu, TaskMenu, type TaskFields } from "./TaskMenu";

interface Meta {
  projects: Project[];
  sections?: Section[];
  labels: string[];
}

interface TaskDetailApi {
  open: (task: Task, anchorEl: HTMLElement) => void;
  /** The right-click menu, at the pointer; `rowEl` is where Edit then anchors the editor. */
  openMenu: (task: Task, x: number, y: number, rowEl: HTMLElement) => void;
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
  todayIso,
  ai,
  children,
}: {
  theme: Theme;
  /** The AI model is set up (DashboardData.ai), so the menu offers Task Assist. */
  ai: boolean;
  /** The dashboard's day, for the menu's date shortcuts. */
  todayIso: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<{ task: Task; anchor: DOMRect } | null>(null);
  const [menu, setMenu] = useState<{ task: Task; at: DOMRect; rowEl: HTMLElement } | null>(null);
  const [meta, setMeta] = useState<Meta | null>(metaCache);

  useEffect(() => {
    if (metaCache || (!state && !menu)) return;
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
  }, [state, menu]);

  const open = useCallback((task: Task, anchorEl: HTMLElement) => {
    setMenu(null);
    setState({ task, anchor: anchorEl.getBoundingClientRect() });
  }, []);
  const openMenu = useCallback((task: Task, x: number, y: number, rowEl: HTMLElement) => {
    setState(null);
    setMenu({ task, at: new DOMRect(x, y, 0, 0), rowEl });
  }, []);
  const close = useCallback(() => setState(null), []);
  const closeMenu = useCallback(() => setMenu(null), []);

  const api: TaskDetailApi = {
    open,
    openMenu,
    close,
    isSelected: (task) =>
      Boolean(task.id) &&
      ((Boolean(state) && state!.task.id === task.id) || (Boolean(menu) && menu!.task.id === task.id)),
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
          todayIso={todayIso}
          meta={meta ?? { projects: [], labels: [] }}
          onClose={close}
        />
      ) : null}
      {menu?.task.id ? (
        <TaskMenu
          key={`menu-${menu.task.id}-${menu.at.x}-${menu.at.y}`}
          task={menu.task}
          at={menu.at}
          theme={theme}
          todayIso={todayIso}
          meta={meta ?? { projects: [], labels: [] }}
          ai={ai}
          onEdit={() => open(menu.task, menu.rowEl)}
          onClose={closeMenu}
        />
      ) : null}
    </Ctx.Provider>
  );
}

function TaskDetailCard({
  task,
  anchor,
  theme,
  todayIso,
  meta,
  onClose,
}: {
  task: Task;
  anchor: DOMRect;
  theme: Theme;
  todayIso: string;
  meta: Meta;
  onClose: () => void;
}) {
  const router = useRouter();
  const focus = useFocus();
  const id = task.id as string;

  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [labelDraft, setLabelDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Local optimistic copy so the UI reflects edits before the refresh lands.
  const [local, setLocal] = useState({
    priority: task.todoistPriority ?? 4,
    due: task.dueDate ?? "",
    projectId: task.projectId ?? "",
    sectionId: task.sectionId ?? "",
    labels: task.labels ?? [],
    deadline: task.deadline ?? "",
    durationMinutes: task.durationMinutes,
  });

  const send = useCallback(
    async (body: Record<string, unknown>, method: "PATCH" | "DELETE" | "POST" = "PATCH", path = `/api/tasks/${id}`): Promise<boolean> => {
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
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [id, router],
  );

  const setFields = (patch: Partial<TaskFields>) => {
    setLocal((s) => ({ ...s, ...patch }));
    // A picked day keeps the task's time and repeat; typed words replace the whole due.
    if (patch.due !== undefined) send(!patch.due ? { date: null } : /^\d{4}-\d{2}-\d{2}$/.test(patch.due) ? { date: patch.due } : { due: patch.due });
    if (patch.priority !== undefined) send({ todoistPriority: patch.priority });
    if (patch.deadline !== undefined) send({ deadline: patch.deadline || null });
    if (patch.sectionId) send({ sectionId: patch.sectionId });
    else if (patch.projectId) send({ projectId: patch.projectId });
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
        <button type="button" className="taskedit__close" onClick={() => { flushFocus(); onClose(); }} aria-label="Close">
          ×
        </button>
      </div>
      {focus.session ? null : (
        <button
          type="button"
          className="taskedit__focus"
          onClick={() => {
            const m = task.durationMinutes && task.durationMinutes > 0 ? Math.min(120, Math.max(5, task.durationMinutes)) : 25;
            focus.start(task.name, m);
            onClose();
          }}
        >
          Focus on this ({task.durationMinutes && task.durationMinutes > 0 ? Math.min(120, Math.max(5, task.durationMinutes)) : 25} min)
        </button>
      )}

      <input
        className="taskedit__name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== task.name && send({ content: name.trim() })}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />

      <TaskFieldsMenu
        value={local}
        onChange={setFields}
        todayIso={todayIso}
        recurring={task.isRecurring ? task.recurrence : undefined}
      />

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
              // Blank or 0 clears it; Todoist takes whole minutes up to a day.
              const v = Number(e.target.value.trim());
              const n = Number.isFinite(v) && v > 0 ? Math.min(1440, Math.round(v)) : null;
              if (n !== (local.durationMinutes ?? null)) {
                setLocal((s) => ({ ...s, durationMinutes: n }));
                send({ durationMinutes: n });
              }
            }}
          />
        </label>

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
          disabled={saving}
          onClick={async () => {
            if (await send({}, "POST", `/api/tasks/${id}/complete`)) onClose();
          }}
        >
          ✓ Complete
        </button>
        {confirmDelete ? (
          <span className="taskedit__confirm">
            <button
              type="button"
              className="taskedit__delete is-armed"
              disabled={saving}
              onClick={async () => {
                if (await send({}, "DELETE")) onClose();
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

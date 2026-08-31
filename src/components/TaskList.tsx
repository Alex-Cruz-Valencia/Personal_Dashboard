"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { buildTasks, taskCountLabel } from "@/lib/format";
import type { DashboardSettings } from "@/lib/settings";
import type { Task } from "@/lib/types";

interface TaskListProps {
  tasks: Task[];
  settings: DashboardSettings;
}

export function TaskList({ tasks, settings }: TaskListProps) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  const rows = buildTasks(tasks, settings.density);
  // Optimistic "done" ids still present in the latest server render. Stale ids
  // (task already gone) are simply ignored — `done` only grows on click.
  const taskIds = new Set(tasks.map((t) => t.id));
  const doneVisible = new Set([...done].filter((id) => taskIds.has(id)));

  const mark = (id: string) => {
    setError(null);
    setBusy((s) => new Set(s).add(id));
    setDone((s) => new Set(s).add(id));
    fetch(`/api/tasks/${id}/complete`, { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error();
        router.refresh();
      })
      .catch(() => {
        setDone((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        setError("Couldn't complete that task — try again.");
      })
      .finally(() => {
        setBusy((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      });
  };

  const saveEdit = (id: string, value: string) => {
    setEditingId(null);
    const original = tasks.find((t) => t.id === id)?.name ?? "";
    const content = value.trim();
    if (!content || content === original) return;
    setError(null);
    setBusy((s) => new Set(s).add(id));
    fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        router.refresh();
      })
      .catch(() => setError("Couldn't save that edit — try again."))
      .finally(() => {
        setBusy((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      });
  };

  const onEditKey = (e: ReactKeyboardEvent<HTMLInputElement>, id: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit(id, e.currentTarget.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditingId(null);
    }
  };

  return (
    <section className="card column--tasks">
      <div className="card__head">
        <h2 className="card__title">Today&rsquo;s tasks</h2>
        <div className="card__count">{taskCountLabel(rows)}</div>
      </div>
      <div className="card__body">
        <ul className="tasks">
          {rows.map((t, i) => {
            const id = t.id ?? "";
            const isDone = id ? doneVisible.has(id) : false;
            const isBusy = id ? busy.has(id) : false;
            const canAct = Boolean(id) && !isBusy;
            return (
              <li
                key={id || `task${i}`}
                className={`${t.cls}${isDone ? " task--done" : ""}`}
              >
                <i
                  className="task__check"
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={`Mark "${t.name}" done`}
                  tabIndex={canAct ? 0 : -1}
                  onClick={() => canAct && !isDone && mark(id)}
                  onKeyDown={(e) => {
                    if (canAct && !isDone && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      mark(id);
                    }
                  }}
                />
                <div className="task__body">
                  {editingId === id ? (
                    <input
                      ref={editRef}
                      className="task__name-input"
                      defaultValue={t.name}
                      onKeyDown={(e) => onEditKey(e, id)}
                      onBlur={(e) => saveEdit(id, e.currentTarget.value)}
                    />
                  ) : (
                    <div
                      className="task__name"
                      onClick={() => id && !isDone && setEditingId(id)}
                      title={id ? "Click to edit" : undefined}
                    >
                      {t.name}
                    </div>
                  )}
                  <div className="task__meta">
                    <span className={t.tagCls}>{t.priorityLabel}</span>
                    <span className="task__tag">{t.meta}</span>
                  </div>
                </div>
                <div className="task__due">{t.due}</div>
              </li>
            );
          })}
        </ul>
        {error ? <p className="tasks__error">{error}</p> : null}
      </div>
    </section>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buildTasks, taskCountLabel } from "@/lib/format";
import { use24Hour, type ShownSettings, type Theme } from "@/lib/settings";
import type { SliceSource, Task } from "@/lib/types";
import { NewTaskForm } from "./NewTaskForm";
import { Popover } from "./Popover";
import { StaleTag } from "./StaleTag";
import { useTaskDetail } from "./TaskDetail";

interface TaskListProps {
  tasks: Task[];
  settings: ShownSettings;
  source: SliceSource;
}

export function TaskList({ tasks, settings, source }: TaskListProps) {
  const router = useRouter();
  const { openMenu, isSelected } = useTaskDetail();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Sample tasks keep their reference labels ("EOD"); live ones follow ⚙ Time.
  const use24 = use24Hour(settings); // a plain function, but named like a hook: call it unconditionally
  const rows = buildTasks(tasks, settings.density, source === "live" ? use24 : undefined);
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

  return (
    <section className="card column--tasks">
      <div className="card__head">
        <h2 className="card__title">Today&rsquo;s tasks</h2>
        <div className="card__count">{taskCountLabel(rows)}</div>
        <StaleTag source={source} />
      </div>
      <div className="card__body">
        {rows.length === 0 ? (
          <p className="card__empty card__empty--first">
            {tasks.length > 0
              ? `${tasks.length} lower-priority ${
                  tasks.length === 1 ? "task" : "tasks"
                } hidden by Focused view.`
              : source === "off"
                ? "Connect Todoist to see what’s due today."
                : "Nothing due today — enjoy the clear run."}
          </p>
        ) : null}
        <ul className="tasks">
          {rows.map((t, i) => {
            const id = t.id ?? "";
            const isDone = id ? doneVisible.has(id) : false;
            const isBusy = id ? busy.has(id) : false;
            const canCheck = Boolean(id) && !isBusy && !isDone;
            const task = tasks.find((x) => x.id === id);
            return (
              <li
                key={id || `task${i}`}
                className={`${t.cls}${isDone ? " task--done" : ""}${
                  task && isSelected(task) ? " task--selected" : ""
                }`}
                onContextMenu={(e) => {
                  // Right-click anywhere on the row: Todoist's task menu, at the pointer.
                  const body = e.currentTarget.querySelector<HTMLElement>(".task__body");
                  if (!task || !body) return;
                  e.preventDefault();
                  openMenu(task, e.clientX, e.clientY, body);
                }}
              >
                <i
                  className="task__check"
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={`Mark "${t.name}" done`}
                  tabIndex={canCheck ? 0 : -1}
                  onClick={() => canCheck && mark(id)}
                  onKeyDown={(e) => {
                    if (canCheck && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      mark(id);
                    }
                  }}
                />
                <div
                  className="task__body"
                  role={task ? "button" : undefined}
                  tabIndex={task ? 0 : -1}
                  title={task ? "Task menu" : undefined}
                  aria-haspopup={task ? "menu" : undefined}
                  // A click opens the same Todoist menu as a right-click; its Edit opens the full editor.
                  onClick={(e) => task && openMenu(task, e.clientX, e.clientY, e.currentTarget)}
                  onKeyDown={(e) => {
                    if (task && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      const r = e.currentTarget.getBoundingClientRect();
                      openMenu(task, r.left + 12, r.bottom, e.currentTarget);
                    }
                  }}
                >
                  <div className="task__name">{t.name}</div>
                  <div className="task__meta">
                    {t.dueShown ? <span className="task__when">{t.dueShown}</span> : null}
                    {t.deadlineLabel ? (
                      <span className="task__deadline" title="Deadline">
                        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          <circle cx="8" cy="8" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                        {t.deadlineLabel}
                      </span>
                    ) : null}
                    <span className="task__place">
                      {t.place}
                      <span className="task__hash" style={t.projectColor ? { color: t.projectColor } : undefined} aria-hidden>#</span>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {error ? <p className="tasks__error">{error}</p> : null}
        <AddTask theme={settings.theme} onAdded={() => router.refresh()} />
      </div>
    </section>
  );
}

function AddTask({ theme, onAdded }: { theme: Theme; onAdded: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="tasks__add"
        onClick={() => btn.current && setAnchor(btn.current.getBoundingClientRect())}
      >
        + Add task
      </button>
      {anchor ? (
        <Popover anchor={anchor} theme={theme} onClose={() => setAnchor(null)} ariaLabel="New task" className="taskedit">
          <div className="taskedit__head">
            <span className="taskedit__eyebrow">New task</span>
            <button type="button" className="taskedit__close" onClick={() => setAnchor(null)} aria-label="Close">
              ×
            </button>
          </div>
          <NewTaskForm
            onCancel={() => setAnchor(null)}
            onAdded={() => {
              setAnchor(null);
              onAdded();
            }}
          />
        </Popover>
      ) : null}
    </>
  );
}

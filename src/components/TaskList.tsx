"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildTasks, taskCountLabel } from "@/lib/format";
import type { DashboardSettings } from "@/lib/settings";
import type { Task } from "@/lib/types";
import { useTaskDetail } from "./TaskDetail";

interface TaskListProps {
  tasks: Task[];
  settings: DashboardSettings;
}

export function TaskList({ tasks, settings }: TaskListProps) {
  const router = useRouter();
  const { open, isSelected } = useTaskDetail();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const rows = buildTasks(tasks, settings.density);
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
      </div>
      <div className="card__body">
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
                  title={task ? "Edit task" : undefined}
                  onClick={(e) => task && open(task, e.currentTarget)}
                  onKeyDown={(e) => {
                    if (task && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      open(task, e.currentTarget);
                    }
                  }}
                >
                  <div className="task__name">{t.name}</div>
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
        <AddTask onAdded={() => router.refresh()} />
      </div>
    </section>
  );
}

function AddTask({ onAdded }: { onAdded: () => void }) {
  const [openInput, setOpenInput] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const content = value.trim();
    if (!content) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed");
      setValue("");
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!openInput) {
    return (
      <button type="button" className="tasks__add" onClick={() => setOpenInput(true)}>
        + Add task
      </button>
    );
  }

  return (
    <div className="tasks__add-row">
      <input
        autoFocus
        className="tasks__add-input"
        value={value}
        placeholder="Task name — “Email Dana, tomorrow 9am p1”"
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") {
            setValue("");
            setOpenInput(false);
          }
        }}
        onBlur={() => !value.trim() && setOpenInput(false)}
      />
      {error ? <p className="tasks__error">{error}</p> : null}
    </div>
  );
}

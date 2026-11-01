"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatHour } from "@/lib/format";
import { loadTaskMeta, type TaskMeta } from "@/lib/task-meta";
import type { Theme } from "@/lib/settings";
import type { Project, Section, Task } from "@/lib/types";
import { Popover } from "./Popover";

/**
 * The right-click menu on a task, modelled on Todoist's own: Edit, Go to project, the date and
 * priority shortcuts, Deadline, Reminders, Move to…, Duplicate, Copy link, Delete. Every
 * write goes through /api/tasks*; "Go to project", "Reminders" and the link point at the
 * Todoist web app.
 */

const TODOIST = "https://app.todoist.com/app";

type View = "main" | "date" | "deadline" | "move" | "assist" | "delete";
export type TodoistP = 1 | 2 | 3 | 4;

interface Meta {
  projects: Project[];
  sections?: Section[];
}

/** `iso` plus `days`, as "YYYY-MM-DD" (calendar arithmetic, no time zone involved). */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function weekday(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}
function dayLabel(iso: string, todayIso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const far = Math.abs(Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) > 6 * 86_400_000;
  return d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", ...(far ? { month: "short", day: "numeric" } : {}) });
}

/** Todoist's date shortcuts, as days from today. */
function quickDates(todayIso: string) {
  const dow = weekday(todayIso);
  return [
    { key: "today", label: "Today", date: todayIso },
    { key: "tomorrow", label: "Tomorrow", date: addDays(todayIso, 1) },
    { key: "weekend", label: "This weekend", date: addDays(todayIso, (6 - dow + 7) % 7 || 7) },
    { key: "nextweek", label: "Next week", date: addDays(todayIso, (1 - dow + 7) % 7 || 7) },
  ] as const;
}

export function TaskMenu({
  task,
  at,
  theme,
  todayIso,
  meta,
  ai,
  onEdit,
  onClose,
}: {
  task: Task;
  /** Where the pointer was. */
  at: DOMRect;
  theme: Theme;
  todayIso: string;
  meta: Meta;
  /** The AI model is set up, so Task Assist is offered. */
  ai: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const id = task.id as string;
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>("main");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [priority, setPriority] = useState<TodoistP>(task.todoistPriority ?? 4);
  const [query, setQuery] = useState("");

  // Keys go to the menu as soon as it opens, and to the new view when it changes.
  useEffect(() => {
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("input, [data-mi]");
    (first ?? el)?.focus();
  }, [view]);

  const send = async (path: string, method: "PATCH" | "POST" | "DELETE", body?: unknown): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save that.");
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  /** Write, then close only once Todoist has it. */
  const act = async (path: string, method: "PATCH" | "POST" | "DELETE", body?: unknown) => {
    if (await send(path, method, body)) onClose();
  };
  const patch = (body: Record<string, unknown>) => act(`/api/tasks/${id}`, "PATCH", body);

  const setDate = (date: string | null) => patch({ date });
  const setP = (p: TodoistP) => {
    setPriority(p);
    void patch({ todoistPriority: p });
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${TODOIST}/task/${id}`);
      setCopied(true);
      setTimeout(onClose, 700);
    } catch {
      setError("Couldn't copy the link.");
    }
  };
  const openTodoist = (path: string) => {
    window.open(`${TODOIST}/${path}`, "_blank", "noopener");
    onClose();
  };

  const dates = quickDates(todayIso).filter((d) => d.date !== task.dueDate);

  /** Arrow keys walk the menu's items; the letters are Todoist's shortcuts. */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const inField = (e.target as HTMLElement).matches("input, textarea");
    if (e.key === "Escape" && view !== "main") {
      e.preventDefault();
      e.stopPropagation();
      setView("main");
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = [...(ref.current?.querySelectorAll<HTMLElement>("[data-mi]") ?? [])];
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[i < 0 ? 0 : next].focus();
      return;
    }
    if (inField || view !== "main" || busy) return;
    const k = e.key.toLowerCase();
    const mod = e.metaKey || e.ctrlKey;
    const run = (fn: () => void) => {
      e.preventDefault();
      fn();
    };
    if (k === "e") run(onEdit);
    else if (k === "g" && e.shiftKey && task.projectId) run(() => openTodoist(`project/${task.projectId}`));
    else if (k === "t" && !mod) run(() => setView("date"));
    else if (k === "y" && !mod) run(() => ref.current?.querySelector<HTMLElement>(".taskmenu__flag.is-on")?.focus());
    else if (["1", "2", "3", "4"].includes(k) && !mod) run(() => setP(Number(k) as TodoistP));
    else if (k === "d" && !mod) run(() => setView("deadline"));
    else if (k === "v" && !mod) run(() => setView("move"));
    else if (k === "c" && mod && e.shiftKey) run(() => void copyLink());
    else if ((k === "backspace" && mod) || k === "delete") run(() => setView("delete"));
  };

  return (
    <Popover anchor={at} align="point" theme={theme} onClose={onClose} ariaLabel={`Task menu: ${task.name}`} className="taskmenu">
      <div ref={ref} tabIndex={-1} className="taskmenu__inner" role="menu" onKeyDown={onKeyDown} aria-busy={busy}>
        {view === "main" ? (
          <>
            <Group>
              <Item icon={<IconEdit />} label="Edit" keys="⌘E" onClick={onEdit} />
              {task.projectId ? (
                <Item icon={<IconProject />} label="Go to project" keys="⇧G" onClick={() => openTodoist(`project/${task.projectId}`)} />
              ) : null}
            </Group>
            <Group>
              <Head label="Date" keys="T" />
              <div className="taskmenu__icons">
                {dates.map((d) => (
                  <IconBtn key={d.key} label={`${d.label} · ${dayLabel(d.date, todayIso)}`} className={`taskmenu__date--${d.key}`} onClick={() => setDate(d.date)}>
                    {d.key === "today" ? <IconToday day={Number(todayIso.slice(8))} /> : d.key === "tomorrow" ? <IconSun /> : d.key === "weekend" ? <IconCouch /> : <IconNextWeek />}
                  </IconBtn>
                ))}
                {task.dueDate ? (
                  <IconBtn label="No date" className="taskmenu__date--none" onClick={() => setDate(null)}>
                    <IconNoDate />
                  </IconBtn>
                ) : null}
                <IconBtn label="More dates…" className="taskmenu__date--more" onClick={() => setView("date")}>
                  <IconMore />
                </IconBtn>
              </div>
              <Head label="Priority" keys="Y" />
              <div className="taskmenu__icons">
                {([1, 2, 3, 4] as TodoistP[]).map((p) => (
                  <IconBtn key={p} label={`Priority ${p}`} className={`taskmenu__flag taskmenu__flag--p${p}${priority === p ? " is-on" : ""}`} onClick={() => setP(p)}>
                    <IconFlag filled={p !== 4} />
                  </IconBtn>
                ))}
              </div>
            </Group>
            <Group>
              <Item icon={<IconDeadline />} label="Deadline" keys="D" onClick={() => setView("deadline")} />
              <Item icon={<IconAlarm />} label="Reminders" keys="↗" title="Reminders are set in Todoist" onClick={() => openTodoist(`task/${id}`)} />
            </Group>
            <Group>
              <Item icon={<IconMove />} label="Move to…" keys="V" onClick={() => setView("move")} />
              <Item icon={<IconDuplicate />} label="Duplicate" onClick={() => act(`/api/tasks/${id}/duplicate`, "POST")} />
              <Item icon={<IconLink />} label={copied ? "Link copied" : "Copy link to task"} keys="⇧⌘C" onClick={() => void copyLink()} />
            </Group>
            {ai ? (
              <Group>
                <Item icon={<IconSparkle />} label="Task Assist" badge="Beta" keys="›" onClick={() => setView("assist")} />
              </Group>
            ) : null}
            <Group>
              <Item icon={<IconTrash />} label="Delete" keys="⌘⌫" danger onClick={() => setView("delete")} />
            </Group>
          </>
        ) : view === "date" ? (
          <DatePanel
            title="Date"
            todayIso={todayIso}
            current={task.dueDate}
            recurring={task.isRecurring ? task.recurrence : undefined}
            onBack={() => setView("main")}
            onPick={(date) => setDate(date)}
            onText={(text) => patch({ due: text })}
            clearLabel={task.dueDate ? "No date" : undefined}
            onClear={() => setDate(null)}
          />
        ) : view === "deadline" ? (
          <DatePanel
            title="Deadline"
            todayIso={todayIso}
            current={task.deadline ?? undefined}
            onBack={() => setView("main")}
            onPick={(date) => patch({ deadline: date })}
            clearLabel={task.deadline ? "Remove deadline" : undefined}
            onClear={() => patch({ deadline: null })}
          />
        ) : view === "move" ? (
          <MovePanel current={task} meta={meta} query={query} setQuery={setQuery} onBack={() => setView("main")} onMove={(to) => patch(to)} />
        ) : view === "assist" ? (
          <AssistPanel task={task} busy={busy} onBack={() => setView("main")} send={send} onDone={onClose} />
        ) : (
          <div className="taskmenu__confirm">
            <p className="taskmenu__confirm-title">Delete task?</p>
            <p className="taskmenu__confirm-body">
              <b>{task.name}</b> will be deleted from Todoist.
            </p>
            <div className="taskmenu__confirm-actions">
              <button type="button" data-mi className="taskmenu__btn" onClick={() => setView("main")}>
                Cancel
              </button>
              <button type="button" data-mi className="taskmenu__btn taskmenu__btn--danger" disabled={busy} onClick={() => act(`/api/tasks/${id}`, "DELETE")}>
                Delete
              </button>
            </div>
          </div>
        )}
        {error ? <p className="taskmenu__error" role="alert">{error}</p> : null}
      </div>
    </Popover>
  );
}

/** What the menu sets on a task. `due` is "" (no date), an ISO date, or words ("fri 3pm"). */
export interface TaskFields {
  due: string;
  priority: TodoistP;
  deadline: string;
  projectId: string;
  sectionId: string;
}

const ISO_DUE = /^(\d{4}-\d{2}-\d{2})(?: (\d{2}):(\d{2}))?$/;
/** A whole date, not a year still being typed (a date input reads "2" as the year 0002). */
const TYPED_DAY = /^[2-9]\d{3}-\d{2}-\d{2}$/;

/** A due value as the menu shows it: "Tomorrow", "Sat · 2:00pm", or the words as typed. */
export function dueLabel(due: string, todayIso: string): string {
  const m = ISO_DUE.exec(due);
  if (!m) return due;
  const day = quickDates(todayIso).find((d) => d.date === m[1] && (d.key === "today" || d.key === "tomorrow"))?.label ?? dayLabel(m[1], todayIso);
  return m[2] ? `${day} · ${formatHour(Number(m[2]) + Number(m[3]) / 60, false)}` : day;
}

/**
 * The same menu inside a form: every place that makes or edits a task uses it, so tasks are set
 * up one way everywhere. It writes nothing itself; each choice goes to `onChange`.
 */
export function TaskFieldsMenu({
  value,
  onChange,
  todayIso,
  recurring,
  needsProject,
  disabled,
}: {
  value: TaskFields;
  onChange: (patch: Partial<TaskFields>) => void;
  todayIso: string;
  /** The repeat, when the task has one. */
  recurring?: string;
  /** Inbox isn't an answer here (Clarify): it's left off the list and the row asks for a project. */
  needsProject?: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"main" | "date" | "deadline" | "move">("main");
  const [meta, setMeta] = useState<TaskMeta>({ projects: [], labels: [] });
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    loadTaskMeta().then((m) => alive && setMeta(m));
    return () => {
      alive = false;
    };
  }, []);

  const pick = (patch: Partial<TaskFields>) => {
    onChange(patch);
    setView("main");
  };
  const back = () => setView("main");
  const dueDay = ISO_DUE.exec(value.due)?.[1];
  const list = needsProject ? { ...meta, projects: meta.projects.filter((p) => !p.inbox) } : meta;
  const project = meta.projects.find((p) => p.id === value.projectId);
  const section = meta.sections?.find((s) => s.id === value.sectionId);
  const place = project ? (section ? `${project.name} / ${section.name}` : project.name) : needsProject ? "Choose a project" : "Inbox";

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && view !== "main") {
      e.preventDefault();
      e.stopPropagation();
      setView("main");
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = [...(ref.current?.querySelectorAll<HTMLElement>("[data-mi]") ?? [])];
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[i < 0 ? 0 : next].focus();
      return;
    }
    if ((e.target as HTMLElement).matches("input, textarea") || view !== "main" || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === "t") setView("date");
    else if (k === "d") setView("deadline");
    else if (k === "v") setView("move");
    else if (["1", "2", "3", "4"].includes(k)) onChange({ priority: Number(k) as TodoistP });
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div ref={ref} className="taskmenu taskmenu--inline" role="group" aria-label="Task details" aria-disabled={disabled} onKeyDown={onKeyDown}>
      <fieldset className="taskmenu__fields" disabled={disabled}>
        {view === "main" ? (
          <>
            <Group>
              <Head label="Date" keys={value.due ? dueLabel(value.due, todayIso) : "No date"} />
              <div className="taskmenu__icons">
                {quickDates(todayIso)
                  .filter((d) => d.date !== dueDay)
                  .map((d) => (
                    <IconBtn key={d.key} label={`${d.label} · ${dayLabel(d.date, todayIso)}`} className={`taskmenu__date--${d.key}`} onClick={() => onChange({ due: d.date })}>
                      {d.key === "today" ? <IconToday day={Number(todayIso.slice(8))} /> : d.key === "tomorrow" ? <IconSun /> : d.key === "weekend" ? <IconCouch /> : <IconNextWeek />}
                    </IconBtn>
                  ))}
                {value.due ? (
                  <IconBtn label="No date" className="taskmenu__date--none" onClick={() => onChange({ due: "" })}>
                    <IconNoDate />
                  </IconBtn>
                ) : null}
                <IconBtn label="More dates…" className="taskmenu__date--more" onClick={() => setView("date")}>
                  <IconMore />
                </IconBtn>
              </div>
              <Head label="Priority" keys={`P${value.priority}`} />
              <div className="taskmenu__icons">
                {([1, 2, 3, 4] as TodoistP[]).map((p) => (
                  <IconBtn key={p} label={`Priority ${p}`} className={`taskmenu__flag taskmenu__flag--p${p}${value.priority === p ? " is-on" : ""}`} onClick={() => onChange({ priority: p })}>
                    <IconFlag filled={p !== 4} />
                  </IconBtn>
                ))}
              </div>
            </Group>
            <Group>
              <Item icon={<IconDeadline />} label="Deadline" keys={value.deadline ? dayLabel(value.deadline, todayIso) : "D"} onClick={() => setView("deadline")} />
              <Item icon={<IconMove />} label="Move to…" keys={place} onClick={() => setView("move")} />
            </Group>
          </>
        ) : view === "date" ? (
          <DatePanel
            title="Date"
            todayIso={todayIso}
            current={dueDay}
            recurring={recurring}
            onBack={back}
            onPick={(due) => pick({ due })}
            onText={(due) => pick({ due })}
            clearLabel={value.due ? "No date" : undefined}
            onClear={() => pick({ due: "" })}
          />
        ) : view === "deadline" ? (
          <DatePanel
            title="Deadline"
            todayIso={todayIso}
            current={value.deadline || undefined}
            onBack={back}
            onPick={(deadline) => pick({ deadline })}
            clearLabel={value.deadline ? "Remove deadline" : undefined}
            onClear={() => pick({ deadline: "" })}
          />
        ) : (
          <MovePanel
            current={{ projectId: value.projectId, sectionId: value.sectionId || undefined }}
            meta={list}
            query={query}
            setQuery={setQuery}
            onBack={back}
            onMove={(to) => {
              setQuery("");
              if ("projectId" in to) pick({ projectId: to.projectId, sectionId: "" });
              else pick({ sectionId: to.sectionId, projectId: meta.sections?.find((s) => s.id === to.sectionId)?.projectId ?? value.projectId });
            }}
          />
        )}
      </fieldset>
    </div>
  );
}

/* ---------- panels ---------- */

function PanelHead({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="taskmenu__panel-head">
      <button type="button" className="taskmenu__back" onClick={onBack} aria-label="Back">
        ‹
      </button>
      <span>{title}</span>
    </div>
  );
}

function DatePanel({
  title,
  todayIso,
  current,
  recurring,
  onBack,
  onPick,
  onText,
  clearLabel,
  onClear,
}: {
  title: string;
  todayIso: string;
  current?: string;
  recurring?: string;
  onBack: () => void;
  onPick: (iso: string) => void;
  onText?: (text: string) => void;
  clearLabel?: string;
  onClear: () => void;
}) {
  const [text, setText] = useState("");
  // A typed date is valid after one keystroke, so it waits for Enter or "Set to…".
  // A day clicked in the browser's calendar has no keystroke before it and applies at once.
  const typing = useRef(false);
  const [typed, setTyped] = useState("");
  const ready = TYPED_DAY.test(typed) && typed !== current ? typed : "";
  return (
    <div className="taskmenu__panel">
      <PanelHead title={title} onBack={onBack} />
      {onText ? (
        <input
          className="taskmenu__input"
          placeholder="Type a date — “fri 3pm”, “every mon”"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) onText(text.trim());
          }}
        />
      ) : null}
      {recurring ? <p className="taskmenu__note">Repeats {recurring}. Picking a day moves this one and keeps the repeat.</p> : null}
      <div className="taskmenu__list">
        {quickDates(todayIso).map((d) => (
          <button key={d.key} type="button" data-mi className={`taskmenu__row${d.date === current ? " is-on" : ""}`} onClick={() => onPick(d.date)}>
            <span className={`taskmenu__ico taskmenu__date--${d.key}`}>
              {d.key === "today" ? <IconToday day={Number(todayIso.slice(8))} /> : d.key === "tomorrow" ? <IconSun /> : d.key === "weekend" ? <IconCouch /> : <IconNextWeek />}
            </span>
            <span className="taskmenu__label">{d.label}</span>
            <span className="taskmenu__keys">{dayLabel(d.date, todayIso)}</span>
          </button>
        ))}
        {clearLabel ? (
          <button type="button" data-mi className="taskmenu__row" onClick={onClear}>
            <span className="taskmenu__ico taskmenu__date--none">
              <IconNoDate />
            </span>
            <span className="taskmenu__label">{clearLabel}</span>
          </button>
        ) : null}
      </div>
      <div className="taskmenu__pick">
        <label className="taskmenu__pickfield">
          <span>Pick a day</span>
          <input
            type="date"
            data-mi
            className="taskmenu__input"
            defaultValue={current}
            onKeyDown={(e) => {
              if (/^\d$/.test(e.key) || e.key === "Backspace" || e.key === "Delete") typing.current = true;
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (ready) onPick(ready);
            }}
            onChange={(e) => {
              if (typing.current) setTyped(e.target.value);
              else if (e.target.value) onPick(e.target.value);
            }}
          />
        </label>
        {ready ? (
          <button type="button" data-mi className="taskmenu__row" onClick={() => onPick(ready)}>
            <span className="taskmenu__label">Set to {dayLabel(ready, todayIso)}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MovePanel({
  current,
  meta,
  query,
  setQuery,
  onBack,
  onMove,
}: {
  current: { projectId?: string; sectionId?: string };
  meta: Meta;
  query: string;
  setQuery: (q: string) => void;
  onBack: () => void;
  onMove: (to: { projectId: string } | { sectionId: string }) => void;
}) {
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const out: { key: string; label: string; color?: string; section: boolean; on: boolean; to: { projectId: string } | { sectionId: string } }[] = [];
    for (const p of meta.projects) {
      const secs = (meta.sections ?? []).filter((s) => s.projectId === p.id);
      const pHit = !q || p.name.toLowerCase().includes(q);
      const secHits = secs.filter((s) => !q || pHit || s.name.toLowerCase().includes(q));
      if (!pHit && !secHits.length) continue;
      out.push({ key: p.id, label: p.name, color: p.color, section: false, on: current.projectId === p.id && !current.sectionId, to: { projectId: p.id } });
      for (const s of secHits) out.push({ key: s.id, label: s.name, section: true, on: current.sectionId === s.id, to: { sectionId: s.id } });
    }
    return out;
  }, [meta, q, current.projectId, current.sectionId]);

  return (
    <div className="taskmenu__panel">
      <PanelHead title="Move to…" onBack={onBack} />
      <input className="taskmenu__input" placeholder="Type a project name" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="taskmenu__list taskmenu__list--scroll">
        {rows.length === 0 ? <p className="taskmenu__note">{meta.projects.length ? "No matches." : "Loading projects…"}</p> : null}
        {rows.map((r) => (
          <button key={r.key} type="button" data-mi className={`taskmenu__row${r.section ? " taskmenu__row--section" : ""}${r.on ? " is-on" : ""}`} onClick={() => onMove(r.to)}>
            <span className="taskmenu__ico">{r.section ? <IconSection /> : <span className="taskmenu__hash" style={{ color: r.color }}>#</span>}</span>
            <span className="taskmenu__label">{r.label}</span>
            {r.on ? <span className="taskmenu__keys">✓</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

type AssistMode = "actionable" | "breakdown" | "tips";
type AssistResult =
  | { mode: "actionable"; title: string }
  | { mode: "breakdown"; subtasks: string[] }
  | { mode: "tips"; tips: string[] };

const ASSIST_OPTIONS: { mode: AssistMode; label: string; hint: string }[] = [
  { mode: "actionable", label: "Make it actionable", hint: "A clearer title that starts with what to do" },
  { mode: "breakdown", label: "Break it down", hint: "Next steps, added as subtasks" },
  { mode: "tips", label: "Give me tips", hint: "Ideas for getting it done" },
];

/**
 * Task Assist: ask the AI model about this task, then apply what it suggests with a click.
 * Nothing is written to Todoist until "Use this title", "Add subtasks" or "Add to notes".
 */
function AssistPanel({
  task,
  busy,
  onBack,
  send,
  onDone,
}: {
  task: Task;
  busy: boolean;
  onBack: () => void;
  send: (path: string, method: "PATCH" | "POST" | "DELETE", body?: unknown) => Promise<boolean>;
  onDone: () => void;
}) {
  const id = task.id as string;
  const [mode, setMode] = useState<AssistMode | null>(null);
  const [result, setResult] = useState<AssistResult | null>(null);
  const [thinking, setThinking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);

  const ask = async (m: AssistMode) => {
    setMode(m);
    setResult(null);
    setProblem(null);
    setThinking(true);
    try {
      const res = await fetch(`/api/tasks/${id}/assist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: m }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Task Assist couldn't help with that.");
      setResult(body as AssistResult);
      if (body.mode === "breakdown") setPicked((body.subtasks as string[]).map(() => true));
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      setThinking(false);
    }
  };

  const addSubtasks = async (items: string[]) => {
    // One at a time, so they land in the order suggested.
    for (const content of items) {
      if (!(await send("/api/tasks", "POST", { content, parentId: id }))) return;
    }
    onDone();
  };

  const back = () => (mode ? (setMode(null), setResult(null), setProblem(null)) : onBack());

  return (
    <div className="taskmenu__panel taskmenu__assist">
      <PanelHead title={mode ? ASSIST_OPTIONS.find((o) => o.mode === mode)!.label : "Task Assist"} onBack={back} />
      {!mode ? (
        <div className="taskmenu__list">
          {ASSIST_OPTIONS.map((o) => (
            <button key={o.mode} type="button" data-mi className="taskmenu__row taskmenu__row--two" onClick={() => void ask(o.mode)}>
              <span className="taskmenu__ico taskmenu__sparkle">
                <IconSparkle />
              </span>
              <span className="taskmenu__label">
                {o.label}
                <small>{o.hint}</small>
              </span>
            </button>
          ))}
          <p className="taskmenu__note">Sends this task&apos;s title, notes and project name to your AI model. Nothing changes until you apply it.</p>
        </div>
      ) : thinking ? (
        <p className="taskmenu__thinking" aria-live="polite">
          <span className="taskmenu__sparkle">
            <IconSparkle />
          </span>{" "}
          Thinking…
        </p>
      ) : problem ? (
        <div className="taskmenu__result">
          <p className="taskmenu__note">{problem}</p>
          <div className="taskmenu__confirm-actions">
            <button type="button" data-mi className="taskmenu__btn" onClick={() => void ask(mode)}>
              Try again
            </button>
          </div>
        </div>
      ) : result?.mode === "actionable" ? (
        <div className="taskmenu__result">
          <p className="taskmenu__was">{task.name}</p>
          <p className="taskmenu__suggest">{result.title}</p>
          <div className="taskmenu__confirm-actions">
            <button type="button" data-mi className="taskmenu__btn" onClick={() => void ask("actionable")}>
              Try again
            </button>
            <button type="button" data-mi className="taskmenu__btn taskmenu__btn--primary" disabled={busy} onClick={async () => (await send(`/api/tasks/${id}`, "PATCH", { content: result.title })) && onDone()}>
              Use this title
            </button>
          </div>
        </div>
      ) : result?.mode === "breakdown" ? (
        <div className="taskmenu__result">
          <ul className="taskmenu__steps">
            {result.subtasks.map((st, i) => (
              <li key={st}>
                <label>
                  <input type="checkbox" data-mi checked={picked[i] ?? true} onChange={(e) => setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))} />
                  <span>{st}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="taskmenu__confirm-actions">
            <button type="button" data-mi className="taskmenu__btn" onClick={() => void ask("breakdown")}>
              Try again
            </button>
            <button
              type="button"
              data-mi
              className="taskmenu__btn taskmenu__btn--primary"
              disabled={busy || !picked.some(Boolean)}
              onClick={() => void addSubtasks(result.subtasks.filter((_, i) => picked[i] ?? true))}
            >
              Add {picked.filter(Boolean).length} subtask{picked.filter(Boolean).length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      ) : result?.mode === "tips" ? (
        <div className="taskmenu__result">
          <ul className="taskmenu__tips">
            {result.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="taskmenu__confirm-actions">
            <button type="button" data-mi className="taskmenu__btn" onClick={onDone}>
              Done
            </button>
            <button
              type="button"
              data-mi
              className="taskmenu__btn taskmenu__btn--primary"
              disabled={busy}
              onClick={async () => {
                const tips = result.tips.map((t) => `- ${t}`).join("\n");
                const description = [task.description?.trim(), `Tips:\n${tips}`].filter(Boolean).join("\n\n").slice(0, 2000);
                if (await send(`/api/tasks/${id}`, "PATCH", { description })) onDone();
              }}
            >
              Add to notes
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- pieces ---------- */

function Group({ children }: { children: ReactNode }) {
  return <div className="taskmenu__group">{children}</div>;
}

function Head({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="taskmenu__head">
      <span>{label}</span>
      <span className="taskmenu__keys">{keys}</span>
    </div>
  );
}

function Item({
  icon,
  label,
  keys,
  danger,
  title,
  badge,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  badge?: string;
  keys?: string;
  danger?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" role="menuitem" data-mi title={title} className={`taskmenu__row${danger ? " taskmenu__row--danger" : ""}`} onClick={onClick}>
      <span className="taskmenu__ico">{icon}</span>
      <span className="taskmenu__label">
        {label}
        {badge ? <span className="taskmenu__badge">{badge}</span> : null}
      </span>
      {keys ? <span className="taskmenu__keys">{keys}</span> : null}
    </button>
  );
}

function IconBtn({ label, className, onClick, children }: { label: string; className?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" data-mi className={`taskmenu__iconbtn ${className ?? ""}`} title={label} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

/* ---------- icons (24px grid, drawn in currentColor) ---------- */

const S = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const IconEdit = () => (
  <svg {...S}><path d="M4 20h16" /><path d="M14.5 5.5l3 3L8 18H5v-3z" /></svg>
);
const IconProject = () => (
  <svg {...S}><circle cx="5" cy="7" r="0.8" fill="currentColor" /><circle cx="5" cy="12" r="0.8" fill="currentColor" /><circle cx="5" cy="17" r="0.8" fill="currentColor" /><path d="M9 7h11M9 12h11M9 17h11" /></svg>
);
const IconToday = ({ day }: { day: number }) => (
  <svg {...S}><rect x="4" y="4.5" width="16" height="15" rx="2.5" /><path d="M4 9h16" /><text x="12" y="17.2" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor" stroke="none">{day}</text></svg>
);
const IconSun = () => (
  <svg {...S}><circle cx="12" cy="12" r="3.6" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></svg>
);
const IconCouch = () => (
  <svg {...S}><path d="M6 11V8.5A2.5 2.5 0 0 1 8.5 6h7A2.5 2.5 0 0 1 18 8.5V11" /><path d="M4 18v-5a2 2 0 0 1 4 0v1h8v-1a2 2 0 0 1 4 0v5z" /><path d="M6 18v1.5M18 18v1.5" /></svg>
);
const IconNextWeek = () => (
  <svg {...S}><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 4v16" /><path d="M11.5 12h5M14.5 9.5L17 12l-2.5 2.5" /></svg>
);
const IconNoDate = () => (
  <svg {...S}><circle cx="12" cy="12" r="8" /><path d="M16 8l-8 8" /></svg>
);
const IconMore = () => (
  <svg {...S}><circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" /></svg>
);
const IconFlag = ({ filled }: { filled: boolean }) => (
  <svg {...S}><path d="M6 21V4" /><path d="M6 4.5h11.5l-2.4 4 2.4 4H6" fill={filled ? "currentColor" : "none"} /></svg>
);
const IconDeadline = () => (
  <svg {...S}><circle cx="11" cy="13" r="7" /><circle cx="11" cy="13" r="2.6" /><path d="M13 11l5-5M16 4.5V6h1.5M19.5 7.5H18" /></svg>
);
const IconAlarm = () => (
  <svg {...S}><circle cx="12" cy="13" r="7" /><path d="M12 9.5V13l2.5 1.5M4.5 5.5L7 3.5M19.5 5.5L17 3.5M7 19.5L5.5 21M17 19.5l1.5 1.5" /></svg>
);
const IconMove = () => (
  <svg {...S}><circle cx="5" cy="6" r="0.8" fill="currentColor" /><circle cx="5" cy="12" r="0.8" fill="currentColor" /><circle cx="5" cy="18" r="0.8" fill="currentColor" /><path d="M9 6h11M9 12h7M9 18h7M17 15.5l2.5 2.5-2.5 2.5" /></svg>
);
const IconDuplicate = () => (
  <svg {...S}><rect x="4" y="8" width="12" height="12" rx="2" /><path d="M8 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" /><path d="M10 11v6M7 14h6" /></svg>
);
const IconLink = () => (
  <svg {...S}><path d="M10 14l4-4" /><path d="M8.5 11.5l-2 2a3 3 0 0 0 4.2 4.2l2-2" /><path d="M15.5 12.5l2-2a3 3 0 0 0-4.2-4.2l-2 2" /></svg>
);
const IconTrash = () => (
  <svg {...S}><path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10.5 10v6M13.5 10v6" /></svg>
);
const IconSparkle = () => (
  <svg {...S}><path d="M10 3.5l1.6 4.4L16 9.5l-4.4 1.6L10 15.5l-1.6-4.4L4 9.5l4.4-1.6z" fill="currentColor" stroke="none" /><path d="M17.5 13.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" stroke="none" /></svg>
);
const IconSection = () => (
  <svg {...S}><path d="M5 8h14M5 12h14M5 16h9" /></svg>
);

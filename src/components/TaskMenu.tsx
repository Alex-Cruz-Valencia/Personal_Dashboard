"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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

type View = "main" | "date" | "deadline" | "move" | "delete";
type TodoistP = 1 | 2 | 3 | 4;

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
  onEdit,
  onClose,
}: {
  task: Task;
  /** Where the pointer was. */
  at: DOMRect;
  theme: Theme;
  todayIso: string;
  meta: Meta;
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
          <MovePanel task={task} meta={meta} query={query} setQuery={setQuery} onBack={() => setView("main")} onMove={(to) => patch(to)} />
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
      <label className="taskmenu__pick">
        <span>Pick a day</span>
        <input type="date" data-mi className="taskmenu__input" defaultValue={current} onChange={(e) => e.target.value && onPick(e.target.value)} />
      </label>
    </div>
  );
}

function MovePanel({
  task,
  meta,
  query,
  setQuery,
  onBack,
  onMove,
}: {
  task: Task;
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
      out.push({ key: p.id, label: p.name, color: p.color, section: false, on: task.projectId === p.id && !task.sectionId, to: { projectId: p.id } });
      for (const s of secHits) out.push({ key: s.id, label: s.name, section: true, on: task.sectionId === s.id, to: { sectionId: s.id } });
    }
    return out;
  }, [meta, q, task.projectId, task.sectionId]);

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
  onClick,
}: {
  icon: ReactNode;
  label: string;
  keys?: string;
  danger?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" role="menuitem" data-mi title={title} className={`taskmenu__row${danger ? " taskmenu__row--danger" : ""}`} onClick={onClick}>
      <span className="taskmenu__ico">{icon}</span>
      <span className="taskmenu__label">{label}</span>
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
const IconSection = () => (
  <svg {...S}><path d="M5 8h14M5 12h14M5 16h9" /></svg>
);

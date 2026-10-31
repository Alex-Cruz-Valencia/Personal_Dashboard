"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gmailLink, loadLabels, type LabelInfo } from "@/lib/reply-actions";
import { loadTaskMeta } from "@/lib/task-meta";
import type { ClarifyItem, Project } from "@/lib/types";
import { DraftPanel } from "./ReplyQueue";
import { TaskFieldsMenu, type TaskFields } from "./TaskMenu";

/**
 * Clarify: go through rough Inbox tasks and to-do emails one at a time and decide what each one
 * really is. It takes over the task card, so the calendar stays beside it. An item stays in the queue until it has a real home (a project, the calendar, a
 * label) or is finished. With AI on, the form arrives filled in; nothing is written until a click.
 */

type Outcome = "task" | "event" | "reply" | "waiting" | "someday" | "file" | "done" | "trash";
type Filter = "all" | ClarifyItem["kind"];

interface Suggestion {
  id: string;
  outcome: Outcome;
  title: string;
  projectId: string | null;
  date: string | null;
  start: string | null;
  end: string | null;
  priority: 1 | 2 | 3 | 4;
  label: string | null;
  reason: string;
}

const BATCH = 6;
const LINK = /\[([^\]]+)\]\((https?:[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
/** Todoist titles and notes can be markdown links; this reads as their text. */
const plain = (s: string) => s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, "$1");
const linksIn = (s: string) => [...s.matchAll(LINK)].map((m) => m[2] ?? m[3]);

/** Text with its links clickable. Everything else stays plain text. */
function Linked({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(LINK)) {
    parts.push(text.slice(at, m.index));
    const url = m[2] ?? m[3];
    parts.push(
      <a key={m.index} href={url} target="_blank" rel="noreferrer">
        {m[1] ?? url}
      </a>,
    );
    at = m.index + m[0].length;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}

function age(ms: number): string {
  if (!ms) return "";
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  return days < 1 ? "today" : days === 1 ? "1 day old" : `${days} days old`;
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "That didn't go through. Try again.");
}

export function ClarifyPanel({ ai, onExit }: { ai: boolean; onExit: () => void }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ClarifyItem[] | null>(null);
  const [todayIso, setTodayIso] = useState("");
  const [partial, setPartial] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [cleared, setCleared] = useState(0);
  const [suggestions, setSuggestions] = useState<ReadonlyMap<string, Suggestion | null>>(new Map());
  const [aiFailed, setAiFailed] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [labels, setLabels] = useState<LabelInfo[]>([]);
  const asked = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    fetch("/api/clarify")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((b: { items: ClarifyItem[]; todayIso: string; todoLabel: string; partial: boolean }) => {
        if (!alive) return;
        setItems(b.items);
        setTodayIso(b.todayIso);
        setPartial(b.partial);
        // The to-do label itself is no place to file something out of it.
        loadLabels().then((l) => alive && setLabels(l.filter((x) => x.name.toLowerCase() !== b.todoLabel.toLowerCase())));
      })
      .catch(() => alive && setFailed(true));
    loadTaskMeta().then((m) => alive && setProjects(m.projects.filter((p) => !p.inbox)));
    return () => {
      alive = false;
    };
  }, []);

  // Bring the card fully into view, with the keys listening from the start.
  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.current?.closest(".card")?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    root.current?.focus({ preventScroll: true });
  }, []);

  const shown = (items ?? []).filter((i) => filter === "all" || i.kind === filter);
  const waiting = shown.filter((i) => !skipped.has(i.id));
  const current = waiting[0] ?? null;

  const skip = useCallback(() => {
    if (current) setSkipped((s) => new Set(s).add(current.id));
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The rest of the page is still in use, so only keys pressed in here count.
      const el = e.target as HTMLElement;
      if (!root.current?.contains(el) || el.matches("input, textarea, select") || e.metaKey || e.ctrlKey) return;
      if (e.key === "Escape") onExit();
      else if (e.key.toLowerCase() === "s") skip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit, skip]);

  // Suggestions come in batches ahead of where you are, so the form is ready on arrival.
  const nextId = current?.id;

  // Each item starts at its top, and the keys carry on after the last one's button is gone.
  useEffect(() => {
    body.current?.scrollTo(0, 0);
    if (document.activeElement === document.body) root.current?.focus({ preventScroll: true });
  }, [nextId]);

  useEffect(() => {
    if (!ai || aiFailed || !nextId || asked.current.has(nextId)) return;
    const batch = waiting.filter((i) => !asked.current.has(i.id)).slice(0, BATCH);
    batch.forEach((i) => asked.current.add(i.id));
    fetch("/api/clarify/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: batch.map(({ kind, id, messageId }) => ({ kind, id, messageId })) }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((b: { suggestions: Suggestion[] }) =>
        setSuggestions((m) => {
          const next = new Map(m);
          for (const i of batch) next.set(i.id, b.suggestions.find((s) => s.id === i.id) ?? null);
          return next;
        }),
      )
      .catch(() => setAiFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai, aiFailed, nextId]);

  const remove = (item: ClarifyItem) => {
    setItems((list) => list && list.filter((i) => i.id !== item.id));
    setCleared((n) => n + 1);
    // What it became shows up on the calendar and task list right away.
    router.refresh();
  };

  const total = (items ?? []).length;
  const count = (k: Filter) => (items ?? []).filter((i) => k === "all" || i.kind === k).length;
  const pct = total + cleared > 0 ? Math.round((cleared / (total + cleared)) * 100) : 0;

  return (
    <div ref={root} className="clarify" tabIndex={-1} role="region" aria-label="Clarify">
      <div className="card__head">
        <h2 className="card__title">Clarify</h2>
        {items ? <div className="card__count">{waiting.length} left</div> : null}
        <button type="button" className="tasks__add clarify__back" onClick={onExit}>
          Back to tasks
        </button>
      </div>
      <div className="clarify__bar">
        <div className="clarify__tabs" role="tablist">
          {(["all", "task", "email"] as Filter[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} className={`clarify__tab${filter === k ? " is-on" : ""}`} onClick={() => setFilter(k)}>
              {k === "all" ? "All" : k === "task" ? "Inbox" : "Email"} <span>{count(k)}</span>
            </button>
          ))}
        </div>
        <div className="clarify__progress" aria-hidden="true">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div ref={body} className="card__body">
      {failed ? <p className="clarify__note">Couldn&apos;t load your Inbox and emails. Close this and try again.</p> : null}
      {partial ? <p className="clarify__note">One source didn&apos;t answer, so this list is only part of it.</p> : null}
      {!items && !failed ? <p className="clarify__note">Gathering everything…</p> : null}

      {current ? (
        <ClarifyCard
          key={current.id}
          item={current}
          suggestion={suggestions.get(current.id) ?? null}
          thinking={ai && !aiFailed && !suggestions.has(current.id)}
          projects={projects}
          labels={labels}
          todayIso={todayIso}
          onCleared={() => remove(current)}
          onSkip={skip}
        />
      ) : items && !failed ? (
        <div className="clarify__end">
          {shown.length > 0 ? (
            <>
              <p className="clarify__end-big">You skipped {shown.length === 1 ? "one" : shown.length}.</p>
              <button type="button" className="rq__btn rq__btn--primary" onClick={() => setSkipped(new Set())}>
                Go through {shown.length === 1 ? "it" : "them"} again
              </button>
            </>
          ) : (
            <>
              <p className="clarify__end-big">All clear.</p>
              <p className="clarify__note">Nothing here needs clarifying.</p>
              <button type="button" className="rq__btn" onClick={onExit}>
                Back to tasks
              </button>
            </>
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}

function nextHour(): string {
  return `${String(Math.min(new Date().getHours() + 1, 22)).padStart(2, "0")}:00`;
}
const plusHour = (t: string) => `${String(Math.min(Number(t.slice(0, 2)) + 1, 23)).padStart(2, "0")}:${t.slice(3)}`;

function ClarifyCard({
  item,
  suggestion: s,
  thinking,
  projects,
  labels,
  todayIso,
  onCleared,
  onSkip,
}: {
  item: ClarifyItem;
  suggestion: Suggestion | null;
  thinking: boolean;
  projects: Project[];
  labels: LabelInfo[];
  todayIso: string;
  onCleared: () => void;
  onSkip: () => void;
}) {
  const isEmail = item.kind === "email";
  const [outcome, setOutcome] = useState<"task" | "event" | "reply" | "file">("task");
  const [title, setTitle] = useState(plain(item.title));
  const [fields, setFields] = useState<TaskFields>({ due: item.dueDate ?? "", priority: item.priority ?? 4, deadline: "", projectId: "", sectionId: "" });
  const [date, setDate] = useState(item.dueDate ?? "");
  const [start, setStart] = useState(nextHour);
  const [end, setEnd] = useState(() => plusHour(nextHour()));
  const [body, setBody] = useState<string | null>(isEmail ? null : (item.detail ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const touched = useRef(false);
  // A two-step finish (add the task, then clear the email) must not repeat its first step on a retry.
  const firstStepDone = useRef(false);

  useEffect(() => {
    if (!isEmail || !item.messageId) return;
    let alive = true;
    fetch(`/api/clarify/message/${item.messageId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((b: { body: string }) => alive && setBody(b.body))
      .catch(() => alive && setBody(item.detail ?? ""));
    return () => {
      alive = false;
    };
  }, [isEmail, item.messageId, item.detail]);

  // The suggestion fills the form once, unless you've already started on it.
  useEffect(() => {
    if (!s || touched.current) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (s.outcome === "task" || s.outcome === "event" || s.outcome === "reply" || s.outcome === "file") setOutcome(s.outcome);
    if (s.title) setTitle(s.title);
    if (s.date) setDate(s.date);
    if (s.outcome === "event" && s.start) {
      setStart(s.start);
      setEnd(s.end ?? plusHour(s.start));
    }
    setFields((f) => ({
      ...f,
      projectId: s.projectId ?? f.projectId,
      due: s.date ? (s.start && s.outcome !== "event" ? `${s.date} ${s.start}` : s.date) : f.due,
      priority: s.priority < 4 ? s.priority : f.priority,
    }));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [s]);

  const touch = () => {
    touched.current = true;
    setError(null);
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      onCleared();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  /** Finish the source item once what it became exists elsewhere. */
  const finishSource = () =>
    isEmail ? send(`/api/clarify/thread/${item.id}`, "POST", { action: "clear" }) : send(`/api/tasks/${item.id}/complete`, "POST");

  const once = async (step: () => Promise<void>) => {
    if (!firstStepDone.current) await step();
    firstStepDone.current = true;
  };

  const source = isEmail ? `From ${item.from}: ${item.title}\n${gmailLink(item.id)}` : "";

  const saveTask = () =>
    run(async () => {
      const { due, deadline, priority, projectId, sectionId } = fields;
      const place = sectionId ? { sectionId } : { projectId };
      if (isEmail) {
        await once(() =>
          send("/api/tasks", "POST", { content: title.trim(), ...place, todoistPriority: priority, ...(due ? { due } : {}), ...(deadline ? { deadline } : {}), description: source }),
        );
        await send(`/api/clarify/thread/${item.id}`, "POST", { action: "clear" });
        return;
      }
      // A link in the rough title would vanish with the rewrite, so it moves to the notes.
      const notes = item.detail ?? "";
      const lost = linksIn(item.title).filter((u) => !notes.includes(u) && !title.includes(u));
      await send(`/api/tasks/${item.id}`, "PATCH", {
        content: title.trim(),
        ...place,
        todoistPriority: priority,
        ...(deadline ? { deadline } : {}),
        ...(lost.length ? { description: [notes, ...lost].filter(Boolean).join("\n") } : {}),
        // An untouched date stays as it is, along with any time it already has.
        ...(due === (item.dueDate ?? "") ? {} : { due: due || null }),
      });
    });

  const saveEvent = () => {
    if (end <= start) return setError("End time must be after start time.");
    run(async () => {
      await once(() =>
        send("/api/events", "POST", {
          name: title.trim(),
          date,
          startTime: start,
          endTime: end,
          description: isEmail ? source : item.detail || undefined,
        }),
      );
      await finishSource();
    });
  };

  const home = (name: string) => projects.find((p) => p.name.toLowerCase() === name)?.id;
  const moveTo = (id: string) => run(() => send(`/api/tasks/${item.id}`, "PATCH", { projectId: id }));
  const file = (label: string) => run(() => send(`/api/clarify/thread/${item.id}`, "POST", { action: "file", label }));
  const waitingId = home("waiting on");
  const somedayId = home("someday");
  const hasWaitingLabel = labels.some((l) => l.name === "Waiting On");

  const applySuggestion = () => {
    if (!s) return;
    if (s.outcome === "waiting" && waitingId) moveTo(waitingId);
    else if (s.outcome === "someday" && somedayId) moveTo(somedayId);
    else if (s.outcome === "file" && s.label) file(s.label);
    else if (s.outcome === "done") run(finishSource);
    else if (s.outcome === "trash") setConfirming(true);
  };
  const quick = s && !["task", "event", "reply"].includes(s.outcome) ? s : null;
  const suggestName = (x: Suggestion) =>
    x.outcome === "file" ? `File to ${x.label}` : { task: "A task", event: "An event", reply: "A reply", waiting: "Waiting on someone", someday: "Someday", done: "Already done", trash: "Let it go", file: "File" }[x.outcome];

  const tabs: { key: typeof outcome; name: string }[] = [
    { key: "task", name: "Task" },
    { key: "event", name: "Event" },
    ...(isEmail ? ([{ key: "reply", name: "Reply" }, { key: "file", name: "File" }] as const) : []),
  ];

  return (
    <div className="clarify__grid">
      <article className="clarify__item">
        <div className="clarify__meta">
          <span className="clarify__kind">{isEmail ? "Email" : "Inbox task"}</span>
          <span>{age(item.addedAt)}</span>
          {isEmail ? (
            <a href={gmailLink(item.id)} target="_blank" rel="noreferrer">
              Open in Gmail
            </a>
          ) : (
            <a href={`https://app.todoist.com/app/task/${item.id}`} target="_blank" rel="noreferrer">
              Open in Todoist
            </a>
          )}
        </div>
        <h3 className="clarify__raw">
          <Linked text={item.title} />
        </h3>
        {item.from ? <p className="clarify__from">From {item.from}</p> : null}
        {body === null ? (
          <p className="clarify__note">Loading the email…</p>
        ) : body ? (
          <div className="clarify__body">
            <Linked text={body} />
          </div>
        ) : null}
      </article>

      <section className="clarify__decide" aria-label="What this becomes">
        {thinking ? <div className="rq__ai rq__ai--loading">Reading this one…</div> : null}
        {s ? (
          <div className={`rq__ai${s.outcome === "trash" ? " rq__ai--trash" : ""}`}>
            <span className="rq__ai-text">
              <span className="rq__ai-kicker">Looks like:</span> <strong>{suggestName(s)}</strong>
              {s.reason ? <span className="rq__ai-why"> · {s.reason}</span> : null}
            </span>
            {quick && (quick.outcome !== "waiting" || waitingId) && (quick.outcome !== "someday" || somedayId) ? (
              <button type="button" className="rq__btn rq__btn--sm" disabled={busy} onClick={applySuggestion}>
                Do that
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="clarify__seg" role="tablist" aria-label="Turn it into">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={outcome === t.key}
              className={`clarify__seg-btn${outcome === t.key ? " is-on" : ""}`}
              onClick={() => {
                touch();
                setOutcome(t.key);
              }}
            >
              {t.name}
            </button>
          ))}
        </div>

        {outcome === "task" || outcome === "event" ? (
          <input
            autoFocus
            className="taskedit__name"
            value={title}
            maxLength={140}
            aria-label={outcome === "task" ? "Next action" : "Event name"}
            placeholder={outcome === "task" ? "What's the next action?" : "Event name"}
            disabled={busy}
            onChange={(e) => {
              touch();
              setTitle(e.target.value);
            }}
          />
        ) : null}

        {outcome === "task" ? (
          <>
            <TaskFieldsMenu
              value={fields}
              needsProject
              todayIso={todayIso}
              disabled={busy}
              onChange={(patch) => {
                touch();
                setFields((f) => ({ ...f, ...patch }));
                if (patch.due) setDate(patch.due.slice(0, 10));
              }}
            />
            <button type="button" className="taskedit__done" disabled={busy || !title.trim() || !fields.projectId} onClick={saveTask}>
              {busy ? "Saving…" : isEmail ? "Add task, clear email" : "Save task"}
            </button>
          </>
        ) : null}

        {outcome === "event" ? (
          <>
            <label className="taskedit__field">
              <span className="taskedit__label">Date</span>
              <input type="date" className="taskedit__text" value={date} min={todayIso} disabled={busy} onChange={(e) => { touch(); setDate(e.target.value); }} />
            </label>
            <div className="taskedit__row2">
              <label className="taskedit__field">
                <span className="taskedit__label">Start</span>
                <input type="time" className="taskedit__text" value={start} disabled={busy} onChange={(e) => { touch(); setStart(e.target.value); setEnd(plusHour(e.target.value)); }} />
              </label>
              <label className="taskedit__field">
                <span className="taskedit__label">End</span>
                <input type="time" className="taskedit__text" value={end} disabled={busy} onChange={(e) => { touch(); setEnd(e.target.value); }} />
              </label>
            </div>
            <button type="button" className="taskedit__done" disabled={busy || !title.trim() || !date || !start || !end} onClick={saveEvent}>
              {busy ? "Saving…" : isEmail ? "Add to calendar, clear email" : "Add to calendar, finish task"}
            </button>
          </>
        ) : null}

        {outcome === "reply" && item.messageId ? (
          <DraftPanel id={item.messageId} fileAfter={hasWaitingLabel ? "Waiting On" : undefined} onFile={file} />
        ) : null}

        {outcome === "file" ? (
          <div className="rq__move">
            {labels.map((l) => (
              <button key={l.name} type="button" className="rq__chip" disabled={busy} onClick={() => file(l.name)}>
                {l.name}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <p className="taskedit__error">{error}</p> : null}

        <div className="clarify__others">
          {!isEmail && waitingId ? (
            <button type="button" className="rq__btn" disabled={busy} onClick={() => moveTo(waitingId)}>
              Waiting on
            </button>
          ) : null}
          {!isEmail && somedayId ? (
            <button type="button" className="rq__btn" disabled={busy} onClick={() => moveTo(somedayId)}>
              Someday
            </button>
          ) : null}
          <button type="button" className="rq__btn" disabled={busy} onClick={() => run(finishSource)} title={isEmail ? "Takes it off the to-do label" : "Completes the task"}>
            Done
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                className="rq__btn rq__btn--danger"
                disabled={busy}
                onClick={() => run(() => (isEmail ? send(`/api/clarify/thread/${item.id}`, "POST", { action: "trash" }) : send(`/api/tasks/${item.id}`, "DELETE")))}
              >
                {isEmail ? "Trash it" : "Delete it"}
              </button>
              <button type="button" className="rq__btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="rq__btn" disabled={busy} onClick={() => setConfirming(true)}>
              {isEmail ? "Trash" : "Delete"}
            </button>
          )}
          <button type="button" className="rq__btn clarify__skip" disabled={busy} onClick={onSkip} title="Press S">
            Skip
          </button>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { loadTaskMeta, type TaskMeta } from "@/lib/task-meta";
import type { Theme } from "@/lib/settings";
import { Popover } from "./Popover";
import { dueLabel, TaskFieldsMenu } from "./TaskMenu";

/**
 * Ramble: talk (or type) everything on your mind, get it back as separate tasks with dates,
 * priorities and projects, review them, then add the ones you want. Speech-to-text is the
 * browser's own (Web Speech API); the AI model only ever sees the text. Nothing is added to
 * Todoist until "Add".
 */

interface RambleTask {
  content: string;
  dueDate: string | null;
  time: string | null;
  priority: 1 | 2 | 3 | 4;
  projectId: string | null;
  projectName: string | null;
}

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function speechApi(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function RambleButton({ theme, todayIso, onAdded }: { theme: Theme; todayIso: string; onAdded: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  return (
    <>
      <button
        ref={btn}
        type="button"
        className="tasks__add tasks__ramble"
        title="Talk through what's on your mind; get it back as tasks"
        onClick={() => btn.current && setAnchor(btn.current.getBoundingClientRect())}
      >
        <MicIcon /> Ramble
      </button>
      {anchor ? (
        <Popover anchor={anchor} theme={theme} onClose={() => setAnchor(null)} ariaLabel="Ramble" className="taskedit ramble">
          <RamblePanel
            todayIso={todayIso}
            onClose={() => setAnchor(null)}
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

/** Words typed into the menu's date replace the heard date; a deadline and section are menu-only. */
type Row = RambleTask & { on: boolean; dueText?: string; deadline?: string; sectionId?: string };

const rowDue = (t: Row) => t.dueText ?? (t.dueDate ? (t.time ? `${t.dueDate} ${t.time}` : t.dueDate) : "");

function RamblePanel({ todayIso, onClose, onAdded }: { todayIso: string; onClose: () => void; onAdded: () => void }) {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Row[] | null>(null);
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const [meta, setMeta] = useState<TaskMeta>({ projects: [], labels: [] });
  const rec = useRef<Recognition | null>(null);
  // Read after mount: the server doesn't know whether this browser can listen.
  const [canListen, setCanListen] = useState(false);
  useEffect(() => {
    let alive = true;
    loadTaskMeta().then((m) => alive && setMeta(m));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    setCanListen(Boolean(speechApi())); // eslint-disable-line react-hooks/set-state-in-effect
    return () => rec.current?.stop();
  }, []);

  const listen = () => {
    const Api = speechApi();
    if (!Api) return;
    setError(null);
    const r = new Api();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let fin = "";
      let mid = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript;
        else mid += res[0].transcript;
      }
      if (fin) setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${fin.trim()}`);
      setInterim(mid);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("Microphone access is blocked. Allow it in the browser, or type instead.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError("Couldn't hear that. Try again, or type instead.");
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    rec.current = r;
    r.start();
    setListening(true);
  };
  const stop = () => rec.current?.stop();

  const makeTasks = async () => {
    stop();
    const said = `${text} ${interim}`.trim();
    if (!said) return;
    setThinking(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks/ramble", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: said }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't turn that into tasks.");
      setTasks((body.tasks as RambleTask[]).map((t) => ({ ...t, on: true })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setThinking(false);
    }
  };

  const add = async () => {
    if (!tasks) return;
    setAdding(true);
    setError(null);
    // One at a time, in the order said.
    for (const t of tasks.filter((x) => x.on && x.content.trim())) {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: t.content.trim(),
          todoistPriority: t.priority,
          ...(t.sectionId ? { sectionId: t.sectionId } : t.projectId ? { projectId: t.projectId } : {}),
          ...(rowDue(t) ? { due: rowDue(t) } : {}),
          ...(t.deadline ? { deadline: t.deadline } : {}),
        }),
      }).catch(() => null);
      if (!res?.ok) {
        setError(`Couldn't add "${t.content}". The ones above it were added.`);
        setAdding(false);
        return;
      }
      setTasks((list) => list && list.map((x) => (x === t ? { ...x, on: false, content: x.content } : x)));
    }
    setAdding(false);
    onAdded();
  };

  const picked = tasks?.filter((t) => t.on).length ?? 0;

  return (
    <>
      <div className="taskedit__head">
        <span className="taskedit__eyebrow">Ramble</span>
        <button type="button" className="taskedit__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {tasks ? (
        <>
          <p className="ramble__lead">Here&apos;s what I heard. Untick anything you don&apos;t want.</p>
          <ul className="ramble__list">
            {tasks.map((t, i) => (
              <li key={i} className={`ramble__task${t.on ? "" : " is-off"}`}>
                <input
                  type="checkbox"
                  checked={t.on}
                  aria-label={`Add "${t.content}"`}
                  onChange={(e) => setTasks((l) => l && l.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))}
                />
                <div className="ramble__body">
                  <input
                    className="ramble__name"
                    value={t.content}
                    onChange={(e) => setTasks((l) => l && l.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
                  />
                  <button type="button" className="ramble__meta" aria-expanded={menuAt === i} title="Change the date, priority or project" onClick={() => setMenuAt(menuAt === i ? null : i)}>
                    {rowDue(t) ? <span>{dueLabel(rowDue(t), todayIso)}</span> : <span className="ramble__none">No date</span>}
                    {t.priority < 4 ? <span className={`ramble__p ramble__p--${t.priority}`}>P{t.priority}</span> : null}
                    {t.projectId ? <span># {meta.projects.find((p) => p.id === t.projectId)?.name ?? t.projectName}</span> : <span className="ramble__none">Inbox</span>}
                  </button>
                  {menuAt === i ? (
                    <TaskFieldsMenu
                      value={{ due: rowDue(t), priority: t.priority, deadline: t.deadline ?? "", projectId: t.projectId ?? "", sectionId: t.sectionId ?? "" }}
                      todayIso={todayIso}
                      onChange={({ due, ...patch }) =>
                        setTasks((l) => l && l.map((x, j) => (j === i ? { ...x, ...patch, ...(due === undefined ? {} : { dueText: due }) } : x)))
                      }
                    />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {error ? <p className="taskedit__error">{error}</p> : null}
          <div className="taskedit__actions">
            <button type="button" className="taskedit__cancel" onClick={() => setTasks(null)}>
              Back
            </button>
            <button type="button" className="taskedit__done" disabled={adding || picked === 0} onClick={() => void add()}>
              {adding ? "Adding…" : `Add ${picked} task${picked === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="ramble__lead">
            {canListen ? "Talk through everything on your mind. I'll split it into tasks with dates and projects." : "Type or paste everything on your mind. I'll split it into tasks with dates and projects."}
          </p>
          {canListen ? (
            <button type="button" className={`ramble__mic${listening ? " is-on" : ""}`} onClick={listening ? stop : listen} aria-pressed={listening}>
              <MicIcon />
              {listening ? "Listening… tap to pause" : text ? "Keep talking" : "Start talking"}
            </button>
          ) : null}
          <textarea
            className="taskedit__textarea ramble__text"
            rows={5}
            placeholder={canListen ? "Your words show up here; you can edit them too." : "e.g. finish the pset by Friday, call mom tomorrow at 6, buy groceries"}
            value={interim ? `${text}${text ? " " : ""}${interim}` : text}
            onChange={(e) => {
              setInterim("");
              setText(e.target.value);
            }}
          />
          {canListen ? <p className="taskedit__hint">Speech is turned into text by your browser. Only the text goes to your AI model.</p> : null}
          {error ? <p className="taskedit__error">{error}</p> : null}
          <div className="taskedit__actions">
            <button type="button" className="taskedit__done" disabled={thinking || !`${text}${interim}`.trim()} onClick={() => void makeTasks()}>
              {thinking ? "Making tasks…" : "Make tasks"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

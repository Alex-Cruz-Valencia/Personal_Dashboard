"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { closingLine, firstUp, type ReviewMode } from "@/lib/day-review";
import { formatHour } from "@/lib/format";
import { loadTaskMeta } from "@/lib/task-meta";
import { revertPatch, uncompleteRequest } from "@/lib/task-undo";
import type { Task, WeekDay } from "@/lib/types";
import { offerUndo, write } from "@/lib/undo";
import { quickDates } from "./TaskMenu";

/**
 * The day review: go through tasks one at a time and give each a real next step. In the morning
 * that's what went overdue; from wind down it's whatever is still open, so tomorrow starts planned.
 * It takes over the task card, like Clarify. Each choice writes at once and can be undone.
 */
export function DayReview({
  tasks,
  mode,
  todayIso,
  tomorrow,
  use24,
  onExit,
}: {
  tasks: Task[];
  mode: ReviewMode;
  todayIso: string;
  tomorrow: WeekDay | null;
  use24: boolean;
  onExit: () => void;
}) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  // A snapshot: the page refreshing behind this mustn't reshuffle the list mid-decision.
  const [queue, setQueue] = useState(tasks);
  const [counts, setCounts] = useState({ finished: 0, moved: 0, removed: 0 });
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [somedayId, setSomedayId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [day, setDay] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    loadTaskMeta().then((m) => alive && setSomedayId(m.projects.find((p) => p.name.toLowerCase() === "someday")?.id ?? ""));
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.current?.closest(".card")?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    root.current?.focus({ preventScroll: true });
    return () => {
      alive = false;
    };
  }, []);

  const waiting = queue.filter((t) => !skipped.has(t.id as string));
  const current = waiting[0] ?? null;
  const dates = quickDates(todayIso);
  const tomorrowIso = dates.find((d) => d.key === "tomorrow")?.date as string;
  const nextWeek = dates.find((d) => d.key === "nextweek");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (!root.current?.contains(el) || el.matches("input") || e.metaKey || e.ctrlKey) return;
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const resetCard = () => {
    setPicking(false);
    setDay("");
    setConfirming(false);
    setError(null);
  };

  type Count = keyof typeof counts;
  const tally = (key: Count, by: number) => setCounts((c) => ({ ...c, [key]: c[key] + by }));

  /** Do the write, drop the task from the queue, and offer its reverse. */
  const settle = async (task: Task, key: Count, run: () => Promise<void>, text?: string, undo?: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await run();
      setQueue((q) => q.filter((t) => t.id !== task.id));
      tally(key, 1);
      resetCard();
      router.refresh();
      if (text && undo) {
        offerUndo(text, async () => {
          await undo();
          setQueue((q) => [task, ...q]);
          tally(key, -1);
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  const moveTo = (task: Task, date: string, label: string) =>
    settle(
      task,
      "moved",
      () => send(`/api/tasks/${task.id}`, "PATCH", { date }),
      `Moved to ${label}`,
      () => write(`/api/tasks/${task.id}`, "PATCH", revertPatch(task, { date })),
    );

  const finish = (task: Task) => {
    const back = uncompleteRequest(task);
    return settle(task, "finished", () => send(`/api/tasks/${task.id}/complete`, "POST"), "Task completed", () => write(back.path, back.method, back.body));
  };

  const someday = (task: Task) =>
    settle(
      task,
      "moved",
      () => send(`/api/tasks/${task.id}`, "PATCH", { projectId: somedayId, date: null }),
      "Moved to Someday",
      () => write(`/api/tasks/${task.id}`, "PATCH", { ...revertPatch(task, { projectId: somedayId }), ...revertPatch(task, { date: null }) }),
    );

  /** Tired-night button: everything left goes to tomorrow, and one undo brings it all back. */
  const moveRest = async () => {
    const rest = queue;
    setBusy(true);
    setError(null);
    const moved: Task[] = [];
    for (const task of rest) {
      try {
        await send(`/api/tasks/${task.id}`, "PATCH", { date: tomorrowIso });
        moved.push(task);
      } catch {
        break; // the rest stay in the queue, so nothing is lost or moved twice
      }
    }
    const ids = new Set(moved.map((t) => t.id));
    setQueue((q) => q.filter((t) => !ids.has(t.id)));
    tally("moved", moved.length);
    resetCard();
    if (moved.length < rest.length) setError(`Moved ${moved.length} of ${rest.length}. The rest are still here.`);
    router.refresh();
    if (moved.length) {
      offerUndo(`Moved ${moved.length} to tomorrow`, async () => {
        for (const task of moved) await write(`/api/tasks/${task.id}`, "PATCH", revertPatch(task, { date: tomorrowIso }));
        setQueue((q) => [...moved, ...q]);
        tally("moved", -moved.length);
      });
    }
    setBusy(false);
  };

  const first = firstUp(tomorrow);
  const closing = closingLine(counts.finished, counts.moved, counts.removed);
  const title = mode === "night" ? "Close the day" : "Overdue";

  return (
    <div ref={root} className="clarify review" tabIndex={-1} role="region" aria-label={title}>
      <div className="card__head">
        <h2 className="card__title">{title}</h2>
        <div className="card__count">{waiting.length} left</div>
        <button type="button" className="tasks__add clarify__back" onClick={onExit}>
          Back to tasks
        </button>
      </div>

      <div className="card__body">
        {current ? (
          <article className="review__card">
            <h3 className="clarify__raw">{current.name}</h3>
            <p className="clarify__from">
              {current.meta}
              {current.overdueDays ? ` · ${current.overdueDays} ${current.overdueDays === 1 ? "day" : "days"} late` : ""}
              {current.isRecurring ? " · repeats" : ""}
            </p>

            <div className="review__choices">
              {mode === "morning" ? (
                <button type="button" className="rq__btn rq__btn--primary" disabled={busy} onClick={() => moveTo(current, todayIso, "today")}>
                  Today
                </button>
              ) : null}
              <button type="button" className={`rq__btn${mode === "night" ? " rq__btn--primary" : ""}`} disabled={busy} onClick={() => moveTo(current, tomorrowIso, "tomorrow")}>
                Tomorrow
              </button>
              {nextWeek ? (
                <button type="button" className="rq__btn" disabled={busy} onClick={() => moveTo(current, nextWeek.date, "next week")}>
                  Next week
                </button>
              ) : null}
              <button type="button" className="rq__btn" disabled={busy} aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
                Pick a day
              </button>
              {somedayId ? (
                <button type="button" className="rq__btn" disabled={busy} onClick={() => someday(current)}>
                  Someday
                </button>
              ) : null}
            </div>

            {picking ? (
              <div className="review__pick">
                <input type="date" className="taskedit__text" aria-label="Move to this day" value={day} min={todayIso} disabled={busy} onChange={(e) => setDay(e.target.value)} />
                <button type="button" className="rq__btn" disabled={busy || !day || day < todayIso} onClick={() => moveTo(current, day, day)}>
                  Move
                </button>
              </div>
            ) : null}

            {error ? <p className="taskedit__error">{error}</p> : null}

            <div className="clarify__others">
              <button type="button" className="rq__btn" disabled={busy} onClick={() => finish(current)}>
                Done
              </button>
              {confirming ? (
                <>
                  <button type="button" className="rq__btn rq__btn--danger" disabled={busy} onClick={() => settle(current, "removed", () => send(`/api/tasks/${current.id}`, "DELETE"))}>
                    Delete it
                  </button>
                  <button type="button" className="rq__btn" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className="rq__btn" disabled={busy} onClick={() => setConfirming(true)}>
                  Delete
                </button>
              )}
              <button
                type="button"
                className="rq__btn clarify__skip"
                disabled={busy}
                onClick={() => {
                  resetCard();
                  setSkipped((s) => new Set(s).add(current.id as string));
                }}
              >
                Skip
              </button>
            </div>

            {queue.length > 1 ? (
              <button type="button" className="tasks__add review__rest" disabled={busy} onClick={moveRest}>
                {busy ? "Moving…" : `Move the remaining ${queue.length} to tomorrow`}
              </button>
            ) : null}
          </article>
        ) : (
          <div className="clarify__end">
            <p className="clarify__end-big">{queue.length ? `You skipped ${queue.length === 1 ? "one" : queue.length}.` : mode === "night" ? "Day closed." : "All caught up."}</p>
            {closing ? <p className="clarify__note">{closing}</p> : null}
            {mode === "night" && first ? (
              <p className="clarify__note">
                First up tomorrow: {first.name}, {formatHour(first.start, use24)}
              </p>
            ) : null}
            {queue.length ? (
              <button type="button" className="rq__btn rq__btn--primary" onClick={() => setSkipped(new Set())}>
                Go through {queue.length === 1 ? "it" : "them"} again
              </button>
            ) : null}
            <button type="button" className="rq__btn" onClick={onExit}>
              Back to tasks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "That didn't go through. Try again.");
}

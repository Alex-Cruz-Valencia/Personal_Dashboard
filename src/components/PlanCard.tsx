"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { decimalHourToTimeInput, formatHour } from "@/lib/format";
import { buildPlan, minutesLabel, type OpenGap, type ScheduledTask, type Suggestion } from "@/lib/plan";
import type { DashboardSettings } from "@/lib/settings";
import { use24Hour } from "@/lib/settings";
import type { AgendaEvent, ArcWindow, SliceSource, Task, TodayInfo } from "@/lib/types";
import { useEventDetail } from "./EventDetail";
import { StaleTag } from "./StaleTag";
import { useTaskDetail } from "./TaskDetail";

interface PlanCardProps {
  agenda: AgendaEvent[];
  tasks: Task[];
  today: TodayInfo;
  arc: ArcWindow;
  settings: DashboardSettings;
  sources: { calendar: SliceSource; tasks: SliceSource };
}

/** Show at most this many open gaps — the rest of the day can wait. */
const MAX_GAPS = 4;

/**
 * Replaces the agenda (the day arc already shows the schedule): a
 * countdown to the next event, and today's open time with Todoist tasks
 * that fit — one click blocks a task at the start of its gap on Google
 * Calendar (the Todoist task itself is never changed).
 */
export function PlanCard({ agenda, tasks, today, arc, settings, sources }: PlanCardProps) {
  const use24 = use24Hour(settings);
  const router = useRouter();
  const { open: openEvent } = useEventDetail();
  const { open: openTask } = useTaskDetail();

  // Tasks set aside this session ("suggest something else").
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const plan = useMemo(
    () => buildPlan(agenda, tasks, today.nowHour, arc.to, skipped),
    [agenda, tasks, today.nowHour, arc.to, skipped],
  );
  const canBlock = sources.calendar === "live";
  const hasTasks = sources.tasks !== "off";
  const gaps = plan.gaps.slice(0, MAX_GAPS);

  const skip = (taskId: string) => setSkipped((s) => new Set(s).add(taskId));

  // Blocking always starts at the beginning of the gap — "now" for a gap
  // that's already under way. It only creates the calendar event; the
  // Todoist task is left exactly as it was.
  const block = async (gap: OpenGap, { task, minutes }: Suggestion) => {
    const taskId = task.id!;
    const start = gap.start;
    const end = gap.start + minutes / 60;
    setPending(taskId);
    setNotice(null);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: task.name,
          date: today.iso,
          startTime: decimalHourToTimeInput(start),
          endTime: decimalHourToTimeInput(end),
          taskId,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Couldn't add it (${res.status})`);
      setNotice({
        kind: "ok",
        text: `On your calendar ${formatHour(start, use24)}–${formatHour(end, use24)}. The task stays open in Todoist.`,
      });
      router.refresh();
    } catch (err) {
      setNotice({ kind: "error", text: (err as Error).message });
    } finally {
      setPending(null);
    }
  };

  // Removes only the calendar block — the task itself is untouched.
  const unblock = async ({ task, event }: ScheduledTask) => {
    setPending(task.id!);
    setNotice(null);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id!)}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Couldn't remove it (${res.status})`);
      router.refresh();
    } catch (err) {
      setNotice({ kind: "error", text: (err as Error).message });
    } finally {
      setPending(null);
    }
  };

  const nothingConnected = sources.calendar === "off" && sources.tasks === "off";

  return (
    <section className="card column--plan">
      <div className="card__head">
        <h2 className="card__title">Plan</h2>
        {!nothingConnected && !plan.dayOver ? (
          <div className="card__count">{minutesLabel(plan.freeMinutes)} free</div>
        ) : null}
        <StaleTag source={sources.calendar} />
      </div>

      <div className="card__body">
        {nothingConnected ? (
          <p className="card__empty card__empty--first">
            Connect Google Calendar and Todoist to plan your day.
          </p>
        ) : (
          <>
            {plan.countdown ? (
              <Countdown
                countdown={plan.countdown}
                use24={use24}
                onOpen={(el) => openEvent(plan.countdown!.event, el)}
              />
            ) : (
              <p className="plan__breather plan__breather--top">
                Nothing else on the calendar today.
              </p>
            )}

            <div className="plan__label">Open time</div>
            {plan.dayOver ? (
              <p className="card__empty">That’s the day — nothing left to plan.</p>
            ) : gaps.length === 0 ? (
              <p className="card__empty">
                Booked solid until {formatHour(arc.to, use24)}.
              </p>
            ) : (
              <ul className="plan__gaps">
                {gaps.map((g) => (
                  <li key={g.start} className="plan__gap">
                    <div className="plan__gap-head">
                      <span className="plan__gap-time">
                        {formatHour(g.start, use24)} – {formatHour(g.end, use24)}
                      </span>
                      <span className="plan__gap-len">{minutesLabel(g.minutes)}</span>
                    </div>
                    {g.suggestions.length > 0 ? (
                      <ul className="plan__slots">
                        {g.suggestions.map((sug) => (
                          <li key={sug.task.id} className="plan__slot">
                            <i className={`plan__prio plan__prio--p${sug.task.priority}`} />
                            <button
                              type="button"
                              className="plan__task"
                              onClick={(ev) => openTask(sug.task, ev.currentTarget)}
                            >
                              {sug.task.name}
                              <span>{minutesLabel(sug.minutes)}</span>
                            </button>
                            <div className="plan__actions">
                              {canBlock ? (
                                <button
                                  type="button"
                                  className="plan__block"
                                  disabled={pending !== null}
                                  onClick={() => block(g, sug)}
                                  title={`Put it on your calendar, ${formatHour(g.start, use24)}–${formatHour(g.start + sug.minutes / 60, use24)}`}
                                >
                                  {pending === sug.task.id ? "Adding…" : "Block"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="plan__skip"
                                aria-label={`Suggest something other than ${sug.task.name}`}
                                title="Suggest something else"
                                onClick={() => skip(sug.task.id!)}
                              >
                                ↻
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="plan__breather">
                        {hasTasks
                          ? "Nothing on your list fits — a breather."
                          : "Connect Todoist to fill this."}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {plan.scheduled.length > 0 ? (
              <>
                <div className="plan__label plan__label--gap">Scheduled</div>
                <ul className="plan__slots">
                  {plan.scheduled.map((st) => (
                    <li key={st.task.id} className="plan__slot plan__slot--scheduled">
                      <i className="plan__check" aria-hidden="true" />
                      <button
                        type="button"
                        className="plan__task"
                        onClick={(ev) => openTask(st.task, ev.currentTarget)}
                      >
                        {st.task.name}
                        <span>
                          {formatHour(st.event.start, use24)} – {formatHour(st.event.end, use24)}
                        </span>
                      </button>
                      <div className="plan__actions">
                        <button
                          type="button"
                          className="plan__unblock"
                          disabled={pending !== null}
                          onClick={() => unblock(st)}
                          title="Remove this block from your calendar (the task stays in Todoist)"
                        >
                          {pending === st.task.id ? "Removing…" : "Unblock"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {notice ? (
              <p className={`plan__notice plan__notice--${notice.kind}`} role="status">
                {notice.text}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/** Ring + number: how long until the next event (or how long is left in this one). */
function Countdown({
  countdown: { mode, minutes, fraction, event, thenMinutes },
  use24,
  onOpen,
}: {
  countdown: NonNullable<ReturnType<typeof buildPlan>["countdown"]>;
  use24: boolean;
  onOpen: (el: HTMLElement) => void;
}) {
  const R = 20;
  const C = 2 * Math.PI * R;
  const showJoin = event.meetingLink && (mode === "now" || minutes <= 15);
  const sub =
    mode === "now"
      ? `left in this event${thenMinutes != null ? ` · next in ${minutesLabel(thenMinutes)}` : ""}`
      : `until your next event · ${formatHour(event.start, use24)}`;
  return (
    <div
      className={`plan__clock plan__clock--${mode}`}
      role="button"
      tabIndex={0}
      aria-label={`${minutesLabel(minutes)} ${sub}. Show event`}
      onClick={(ev) => onOpen(ev.currentTarget)}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onOpen(ev.currentTarget);
        }
      }}
    >
      <svg className="plan__ring" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="plan__ring-track" cx="24" cy="24" r={R} />
        <circle
          className="plan__ring-fill"
          cx="24"
          cy="24"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.max(0, Math.min(1, fraction)))}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <div className="plan__clock-text">
        <div className="plan__clock-big">{minutesLabel(minutes)}</div>
        <div className="plan__clock-sub">{sub}</div>
      </div>
      {showJoin ? (
        <a
          className="plan__join"
          href={event.meetingLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(ev) => ev.stopPropagation()}
        >
          Join
        </a>
      ) : null}
    </div>
  );
}

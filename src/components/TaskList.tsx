import { buildTasks, taskCountLabel } from "@/lib/format";
import type { DashboardSettings } from "@/lib/settings";
import type { Task } from "@/lib/types";

interface TaskListProps {
  tasks: Task[];
  settings: DashboardSettings;
}

export function TaskList({ tasks, settings }: TaskListProps) {
  const rows = buildTasks(tasks, settings.density);

  return (
    <section className="card column--tasks">
      <div className="card__head">
        <h2 className="card__title">Today&rsquo;s tasks</h2>
        <div className="card__count">{taskCountLabel(rows)}</div>
      </div>
      <div className="card__body">
        <ul className="tasks">
          {rows.map((t, i) => (
            <li key={t.id ?? `task${i}`} className={t.cls}>
              <i className="task__check" />
              <div className="task__body">
                <div className="task__name">{t.name}</div>
                <div className="task__meta">
                  <span className={t.tagCls}>{t.priorityLabel}</span>
                  <span className="task__tag">{t.meta}</span>
                </div>
              </div>
              <div className="task__due">{t.due}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

"use client";

import { agendaCountLabel, buildAgenda } from "@/lib/format";
import type { DashboardSettings } from "@/lib/settings";
import { use24Hour } from "@/lib/settings";
import type { AgendaEvent, TodayInfo } from "@/lib/types";
import { useEventDetail } from "./EventDetail";

interface CalendarAgendaProps {
  agenda: AgendaEvent[];
  today: TodayInfo;
  settings: DashboardSettings;
}

export function CalendarAgenda({ agenda, today, settings }: CalendarAgendaProps) {
  const { open, isSelected } = useEventDetail();
  const rows = buildAgenda(agenda, today.nowHour, use24Hour(settings));

  return (
    <section className="card column--agenda">
      <div className="card__head">
        <h2 className="card__title">Agenda</h2>
        <div className="card__count">{agendaCountLabel(agenda)}</div>
      </div>
      <div className="card__body">
        <ul className="agenda">
          {rows.map((e, i) => {
            const event = agenda[i];
            const selected = isSelected(event);
            return (
              <li
                key={`event${i}`}
                className={`${e.cls}${selected ? " event--selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${e.name}, details`}
                onClick={(ev) => open(event, ev.currentTarget)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    open(event, ev.currentTarget);
                  }
                }}
              >
                <i className="event__rail" />
                <div className="event__time">
                  {e.start}
                  <span>{e.duration}</span>
                </div>
                <div className="event__body">
                  <p className="event__name">{e.name}</p>
                  <div className="event__where">{e.where}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

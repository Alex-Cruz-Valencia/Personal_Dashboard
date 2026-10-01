import { splitNote } from "@/lib/day-note";
import { dateLineFor, greetingFor } from "@/lib/format";
import type { TodayInfo, UserInfo } from "@/lib/types";

interface HelloCardProps {
  user: UserInfo;
  today: TodayInfo;
  /** One-sentence "shape of the day" note; `**…**` marks the task (bold). */
  dayNote: string;
}

export function HelloCard({ user, today, dayNote }: HelloCardProps) {
  return (
    <header className="card hello">
      <div className="hello__date">{dateLineFor(today.iso)}</div>
      <h1 className="hello__greeting">{greetingFor(today.nowHour, user.name)}</h1>
      <div className="hello__note">
        <div className="hello__note-tag">Shape of the day</div>
        <p className="hello__note-text">
          {splitNote(dayNote).map((part, i) =>
            part.bold ? <strong key={i}>{part.text}</strong> : part.text,
          )}
        </p>
      </div>
    </header>
  );
}

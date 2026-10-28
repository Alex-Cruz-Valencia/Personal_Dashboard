import type { ReactNode } from "react";
import { dateLineFor, greetingFor } from "@/lib/format";
import type { TodayInfo, UserInfo } from "@/lib/types";

interface HelloCardProps {
  user: UserInfo;
  today: TodayInfo;
  /** A quiet line under the greeting (the sun line). */
  sub?: ReactNode;
  /** The live clock, shown on the right of the same card. */
  children?: ReactNode;
}

export function HelloCard({ user, today, sub, children }: HelloCardProps) {
  return (
    <header className="card hello">
      <div className="hello__text">
        <div className="hello__date">{dateLineFor(today.iso)}</div>
        <h1 className="hello__greeting">{greetingFor(today.nowHour, user.name)}</h1>
        {sub}
      </div>
      <div className="hello__time">{children}</div>
    </header>
  );
}

import { buildReplies, replyCountLabel } from "@/lib/format";
import type { Reply } from "@/lib/types";

interface EmailListProps {
  replies: Reply[];
}

export function EmailList({ replies }: EmailListProps) {
  const rows = buildReplies(replies);

  return (
    <section className="card column--replies">
      <div className="card__head">
        <h2 className="card__title">Needs a reply</h2>
        <div className="card__count">{replyCountLabel(replies)}</div>
      </div>
      <div className="card__body">
        <ul className="replies">
          {rows.map((r, i) => (
            <li key={r.id ?? `reply${i}`} className="reply">
              <div className="reply__avatar">{r.initials}</div>
              <div className="reply__body">
                <div className="reply__top">
                  <div className="reply__from">{r.from}</div>
                  <div className="reply__age">{r.age}</div>
                </div>
                <div className="reply__subject">{r.subject}</div>
                <span className={r.noteCls}>{r.note}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

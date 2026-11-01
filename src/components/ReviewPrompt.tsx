"use client";

import { promptText, type ReviewMode } from "@/lib/day-review";
import { hideReviewPrompt, setReviewOpen, useReviewLater, useReviewOpen } from "@/lib/review-state";

/** The banner that offers the day review, once for each review, until it's done or put off. */
export function ReviewPrompt({ count, mode, todayIso }: { count: number; mode: ReviewMode; todayIso: string }) {
  const slot = `${todayIso}:${mode}`;
  const later = useReviewLater();
  const open = useReviewOpen();
  if (count === 0 || open || later === slot) return null;
  return (
    <section className={`attn review-prompt review-prompt--${mode}`} aria-label="Day review">
      <span>{promptText(count, mode)}</span>
      <span className="review-prompt__actions">
        <button
          type="button"
          className="review-prompt__go"
          onClick={() => {
            setReviewOpen(true);
          }}
        >
          Go through {count === 1 ? "it" : "them"}
        </button>
        <button type="button" className="review-prompt__later" onClick={() => hideReviewPrompt(slot)}>
          Later
        </button>
      </span>
    </section>
  );
}

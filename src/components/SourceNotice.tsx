import type { SourceStatus } from "@/lib/types";

/**
 * Says so at the top of the page when a configured source failed and sample data stands in for
 * it, since sample events and weather otherwise look real. Silent for `live` and `off`.
 */
export function SourceNotice({ sources, reconnect, connectFailed = false }: { sources: SourceStatus; reconnect: boolean; connectFailed?: boolean }) {
  if (connectFailed) {
    return (
      <section className="source-notice" role="status" aria-label="Google connection failed">
        <span>Couldn&apos;t connect Google. Nothing changed.</span>
        <a className="source-notice__link" href="/api/auth/google">
          Try again
        </a>
      </section>
    );
  }
  const sample = [
    sources.calendar === "mock" && "calendar events",
    sources.tasks === "mock" && "tasks",
    sources.weather === "mock" && "weather",
  ].filter(Boolean);
  const noMail = sources.email === "mock";
  if (!sample.length && !noMail) return null;
  return (
    <section className="source-notice" role="status" aria-label="Data unavailable">
      <span>
        {reconnect ? "Google is disconnected. " : "Some live data isn't loading. "}
        {sample.length ? `Showing sample ${sample.join(", ")}, not your real data. ` : ""}
        {noMail ? "Emails can't be shown." : ""}
      </span>
      {reconnect ? (
        <a className="source-notice__link" href="/api/auth/google">
          Reconnect Google
        </a>
      ) : null}
    </section>
  );
}

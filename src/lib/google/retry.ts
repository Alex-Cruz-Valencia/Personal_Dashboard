/**
 * One retry for a Google request whose connection dropped (the "fetch failed"
 * timeouts and "other side closed" resets seen in production).
 *
 * Only reads are repeated. A write whose connection died may already have been
 * applied by Google, so repeating it could create a second event, draft or
 * label. Nothing is retried when the caller aborted the request, and an HTTP
 * error response is returned as-is (this is about the network, not Google's
 * answers).
 */

export const RETRY_DELAY_MS = 300;

const isRead = (method?: string) => !method || method === "GET" || method === "HEAD";

export async function retryOnDroppedConnection(
  attempt: () => Promise<Response>,
  init: { method?: string; signal?: AbortSignal | null } = {},
  delayMs: number = RETRY_DELAY_MS,
): Promise<Response> {
  try {
    return await attempt();
  } catch (err) {
    if (!isRead(init.method?.toUpperCase()) || init.signal?.aborted) throw err;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return attempt();
  }
}

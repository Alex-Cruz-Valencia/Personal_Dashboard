import "server-only";
import { config } from "@/lib/config";

/** Upper bound on what one call may send, so a bug can't run up a bill. */
const MAX_INPUT_CHARS = 12_000;
const TIMEOUT_MS = 30_000;

export class LlmError extends Error {}

/**
 * One chat completion against an OpenAI-compatible endpoint.
 * The key stays on the server. Errors never include the request or response
 * body (either could contain mail text), and nothing is logged.
 */
export async function chat(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const { baseUrl, apiKey, model } = config.llm;
  if (!baseUrl || !apiKey || !model) throw new LlmError("The AI model isn't configured.");
  if (opts.system.length + opts.user.length > MAX_INPUT_CHARS) {
    throw new LlmError("That message is too long to draft from.");
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 500,
        temperature: 0.4,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new LlmError("Couldn't reach the AI service.");
  }
  if (!res.ok) throw new LlmError(`The AI service answered ${res.status}.`);

  const body = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const text = body?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new LlmError("The AI service returned nothing.");
  return text;
}

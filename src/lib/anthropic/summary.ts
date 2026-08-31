/**
 * Phase 5 — the "shape of the day" note via the Anthropic Messages API.
 *
 * Model defaults to `claude-opus-5` (override with ANTHROPIC_MODEL — a smaller
 * model like `claude-haiku-4-5` is plenty for a one-liner and much cheaper).
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";
import { formatHour } from "@/lib/format";
import type { AgendaEvent, Task, Weather } from "@/lib/types";

export interface SummaryInput {
  userName: string;
  nowHour: number;
  weather: Weather;
  tasks: Task[];
  agenda: AgendaEvent[];
}

const SYSTEM = [
  "You write the single 'Shape of the day' line for a personal morning dashboard.",
  "Rules: exactly one sentence, under 24 words. Plain and specific.",
  "No greeting, no name, no emoji, no preamble, no quotation marks.",
  "Look at the free time before the first meeting and the top priorities, and name the one thing that best fits that window.",
].join(" ");

function buildContext(input: SummaryInput): string {
  const use24 = false;
  const firstMeeting = input.agenda
    .filter((e) => e.kind === "meeting" && e.start > input.nowHour)
    .sort((a, b) => a.start - b.start)[0];
  const freeMins = firstMeeting
    ? Math.round((firstMeeting.start - input.nowHour) * 60)
    : 0;

  const lines = [
    `Now: ${formatHour(input.nowHour, use24)}`,
    firstMeeting
      ? `First meeting: "${firstMeeting.name}" at ${formatHour(firstMeeting.start, use24)} (${Math.floor(freeMins / 60)}h ${freeMins % 60}m from now)`
      : "No more meetings scheduled today",
    `Weather: ${input.weather.tempNow}°, ${input.weather.condition}`,
    "",
    "Today's tasks (priority 1 = urgent):",
    ...input.tasks.map(
      (t) => `- [P${t.priority}] ${t.name} (${t.meta}, due ${t.due})`,
    ),
    "",
    "Agenda:",
    ...input.agenda.map(
      (e) =>
        `- ${formatHour(e.start, use24)}–${formatHour(e.end, use24)} ${e.name} [${e.kind}]`,
    ),
  ];
  return lines.join("\n");
}

export async function getDaySummary(input: SummaryInput): Promise<string> {
  if (!config.anthropic.apiKey) throw new Error("Anthropic API key not configured");

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 512,
    output_config: { effort: "low" },
    system: SYSTEM,
    messages: [{ role: "user", content: buildContext(input) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Anthropic declined to summarise the day");
  }

  const text = response.content.find((b) => b.type === "text");
  const sentence = text && text.type === "text" ? text.text.trim() : "";
  if (!sentence) throw new Error("Empty summary from Anthropic");
  return sentence.replace(/^["']|["']$/g, "");
}

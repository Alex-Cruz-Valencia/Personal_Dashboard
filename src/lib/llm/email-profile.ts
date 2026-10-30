import "server-only";
import { Redis } from "@upstash/redis";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * "How I handle email": a few rules plus anonymised examples, used as few-shot
 * guidance by the triage prompt. Built once with the person (`npm run
 * email:profile`), then kept private: in the same Redis as the Google tokens,
 * or in the gitignored `.data/` folder. It is never in the repo, and the public
 * demo has neither store configured, so it never sees one.
 */

export type TriageAction = "trash" | "task" | "reply" | "file" | "leave";
export const TRIAGE_ACTIONS: readonly TriageAction[] = ["trash", "task", "reply", "file", "leave"];

export interface ProfileExample {
  /** A kind of sender, not a person: "Recruiter at a company", "Bank (alerts)". */
  from: string;
  subject: string;
  snippet?: string;
  action: TriageAction;
  /** The Gmail label for "file", or the label to file into after a reply. */
  label?: string;
}

export interface EmailProfile {
  rules: string[];
  examples: ProfileExample[];
  updatedAt?: string;
}

const PROFILE_FILE = join(process.cwd(), ".data", "email-profile.json");
export const PROFILE_KEY = "dashboard:email-profile";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const kv = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

/** Caps, so a hand-edited profile can't blow the prompt's input budget. */
const MAX_RULES = 16;
const MAX_EXAMPLES = 14;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function clean(raw: unknown): EmailProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rules = Array.isArray(r.rules) ? r.rules.map((x) => str(x, 200)).filter(Boolean).slice(0, MAX_RULES) : [];
  const examples = (Array.isArray(r.examples) ? r.examples : [])
    .flatMap((x): ProfileExample[] => {
      const e = (x ?? {}) as Record<string, unknown>;
      const action = TRIAGE_ACTIONS.find((a) => a === e.action);
      const from = str(e.from, 80);
      const subject = str(e.subject, 120);
      if (!action || !from || !subject) return [];
      const label = str(e.label, 60);
      const snippet = str(e.snippet, 160);
      return [{ from, subject, action, ...(snippet ? { snippet } : {}), ...(label ? { label } : {}) }];
    })
    .slice(0, MAX_EXAMPLES);
  return rules.length || examples.length ? { rules, examples } : null;
}

/** The stored profile, or null when none was built (triage then uses general rules only). */
export async function readEmailProfile(): Promise<EmailProfile | null> {
  try {
    if (kv) return clean(await kv.get(PROFILE_KEY));
    return clean(JSON.parse(await readFile(PROFILE_FILE, "utf8")));
  } catch {
    return null;
  }
}

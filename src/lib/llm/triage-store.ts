import "server-only";
import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Nudge, TriageSuggestion } from "@/lib/types";
import { cleanStored, KEEP_MS, type StoredTriage } from "./triage-keys";

/**
 * Triage done ahead of time, so the reply queue and Waiting on open already filled in. In the same
 * Redis as the Google tokens (each entry expires on its own), or in the gitignored `.data/` folder
 * when running locally. Holds model output only (an action, a short reason, a follow-up draft),
 * never the emails themselves.
 */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const kv = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const FILE = join(process.cwd(), ".data", "triage.json");
const redisKey = (key: string) => `dashboard:triage:${key}`;

async function readFileStore(): Promise<Record<string, StoredTriage>> {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredTriage>) : {};
  } catch {
    return {};
  }
}

/** Whatever is stored for these keys (`r:<messageId>`, `w:<messageId>`); missing keys are left out. */
export async function readTriage(keys: string[]): Promise<Map<string, StoredTriage>> {
  const out = new Map<string, StoredTriage>();
  if (!keys.length) return out;
  const now = Date.now();
  if (kv) {
    const values = await kv.mget<unknown[]>(...keys.map(redisKey));
    keys.forEach((k, i) => {
      const v = cleanStored(values[i], now);
      if (v) out.set(k, v);
    });
    return out;
  }
  const store = await readFileStore();
  for (const k of keys) {
    const v = cleanStored(store[k], now);
    if (v) out.set(k, v);
  }
  return out;
}

/** Remember these results. Locally, entries past their keep time are dropped on the way. */
export async function writeTriage(entries: Map<string, StoredTriage>): Promise<void> {
  if (!entries.size) return;
  if (kv) {
    const seconds = Math.round(KEEP_MS / 1000);
    await Promise.all([...entries].map(([k, v]) => kv.set(redisKey(k), v, { ex: seconds })));
    return;
  }
  const now = Date.now();
  const store = await readFileStore();
  const next: Record<string, StoredTriage> = {};
  for (const [k, v] of Object.entries(store)) if (cleanStored(v, now)) next[k] = v;
  for (const [k, v] of entries) next[k] = v;
  await mkdir(join(process.cwd(), ".data"), { recursive: true });
  // Write-then-rename isn't needed for a cache: a torn file reads as empty and is simply redone.
  await writeFile(FILE, JSON.stringify(next));
}

export type { Nudge, TriageSuggestion };

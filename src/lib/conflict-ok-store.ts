import "server-only";
import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { keysForDay, MAX_OK_PER_DAY, okKeyDay } from "./conflict-ok";

/**
 * "It's fine" on a conflict, shared by every device: in the same Redis as the
 * Google tokens (one set per day, gone after two days), or in the gitignored
 * `.data/` folder when running locally. Nothing is written to Google.
 */

const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const kv = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const FILE = join(process.cwd(), ".data", "ok-conflicts.json");
const KEEP_SECONDS = 2 * 86_400;
const redisKey = (day: string) => `dashboard:ok-conflicts:${day}`;

async function readFileStore(): Promise<Record<string, string[]>> {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

/** The keys marked fine for `day`. */
export async function readOkConflicts(day: string): Promise<string[]> {
  if (kv) return keysForDay(await kv.smembers(redisKey(day)), day);
  return keysForDay((await readFileStore())[day], day);
}

/** Remember one key; false when it's malformed or the day is full. */
export async function addOkConflict(key: string): Promise<boolean> {
  const day = okKeyDay(key);
  if (!day) return false;
  if (kv) {
    if ((await kv.scard(redisKey(day))) >= MAX_OK_PER_DAY) return false;
    await kv.sadd(redisKey(day), key);
    await kv.expire(redisKey(day), KEEP_SECONDS);
    return true;
  }
  const store = await readFileStore();
  const kept = keysForDay(store[day], day);
  if (kept.length >= MAX_OK_PER_DAY) return false;
  // Earlier days are never read again, so only this one is kept.
  const next = { [day]: [...new Set([...kept, key])] };
  await mkdir(join(process.cwd(), ".data"), { recursive: true });
  await writeFile(FILE, JSON.stringify(next));
  return true;
}

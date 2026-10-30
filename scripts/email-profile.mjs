// The "how I handle email" profile behind AI triage (src/lib/llm/email-profile.ts).
//   npm run email:profile mine   read-only look through past Gmail -> .data/email-history.json
//                                (what was replied to, trashed, filed, archived, left, made a task)
//   npm run email:profile push   .data/email-profile.json -> the Redis/KV store, when one is configured
//   npm run email:profile show   print what's stored
// Mining only GETs from Gmail. Both files live in the gitignored .data/ folder; the profile is
// written from the history together with the person, never committed, never on the public demo.
import { readFileSync, writeFileSync } from "node:fs";

const env = process.env;
const kvUrl = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
const kvTok = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
const KEY = "dashboard:email-profile";
const PROFILE = ".data/email-profile.json";
const HISTORY = ".data/email-history.json";
const kv = (cmd, ...args) =>
  fetch(kvUrl, { method: "POST", headers: { authorization: `Bearer ${kvTok}` }, body: JSON.stringify([cmd, ...args]) })
    .then((r) => r.json())
    .then((d) => d.result);

const mode = process.argv[2];
if (mode === "push") {
  const profile = readFileSync(PROFILE, "utf8");
  JSON.parse(profile);
  if (!kvUrl || !kvTok) console.log(`No Redis/KV configured; the app reads ${PROFILE} directly.`);
  else console.log("stored:", await kv("SET", KEY, profile));
} else if (mode === "show") {
  console.log(kvUrl && kvTok ? await kv("GET", KEY) : readFileSync(PROFILE, "utf8"));
} else if (mode === "mine") {
  await mine();
} else {
  console.error("usage: npm run email:profile -- mine | push | show");
  process.exit(1);
}

async function mine() {
  const tokens = kvUrl && kvTok ? JSON.parse(await kv("GET", "dashboard:google-tokens")) : JSON.parse(readFileSync(".data/google-tokens.json", "utf8"));

  let access = tokens.accessToken;
  if (tokens.expiresAt - Date.now() < 60_000) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refreshToken, grant_type: "refresh_token",
      }),
    });
    access = (await res.json()).access_token; // not persisted; the stored refresh token stays valid
  }
  const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
  async function get(path, params = {}) {
    const u = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(params)) for (const x of [].concat(v)) u.searchParams.append(k, x);
    const res = await fetch(u, { headers: { authorization: `Bearer ${access}` } });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return res.json();
  }
  const H = ["From", "To", "Subject", "List-Unsubscribe", "Precedence"];
  const hdr = (m, n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";
  const me = (await get("/profile")).emailAddress.toLowerCase();
  const labels = Object.fromEntries((await get("/labels")).labels.map((l) => [l.id, l]));

  async function list(q, max) {
    const d = await get("/messages", { q, maxResults: String(max) });
    return (d.messages ?? []).map((m) => m.id);
  }
  const meta = (id) => get(`/messages/${id}`, { format: "metadata", metadataHeaders: H });
  function shape(m, signal) {
    const ids = m.labelIds ?? [];
    return {
      id: m.id, threadId: m.threadId, signal,
      from: hdr(m, "From"), subject: hdr(m, "Subject"), snippet: m.snippet,
      date: new Date(Number(m.internalDate)).toISOString().slice(0, 10),
      bulk: Boolean(hdr(m, "List-Unsubscribe")) || /bulk|list/i.test(hdr(m, "Precedence")),
      cats: ids.filter((x) => x.startsWith("CATEGORY_")).map((x) => x.slice(9).toLowerCase()),
      important: ids.includes("IMPORTANT"),
      userLabels: ids.filter((x) => labels[x]?.type === "user").map((x) => labels[x].name),
    };
  }
  const items = [];
  const seen = new Set();
  const add = (x) => { if (!seen.has(x.threadId)) { seen.add(x.threadId); items.push(x); } };

  // Replied: my sent replies → the incoming message just before mine in the thread.
  for (const id of await list("in:sent newer_than:180d subject:re", 60)) {
    const s = await meta(id);
    const t = await get(`/threads/${s.threadId}`, { format: "metadata", metadataHeaders: H });
    const idx = t.messages.findIndex((m) => m.id === id);
    const prev = t.messages.slice(0, idx).reverse().find((m) => !hdr(m, "From").toLowerCase().includes(me));
    if (prev) add(shape(prev, "replied"));
  }
  // Trashed (Gmail keeps Trash 30 days).
  for (const id of await list("in:trash -from:me", 60)) add(shape(await meta(id), "trashed"));
  // Moved to a user label and out of the inbox.
  for (const id of await list("-in:inbox -in:sent -in:trash -in:spam -in:draft has:userlabels -from:me newer_than:180d", 40)) add(shape(await meta(id), "labeled"));
  // Archived with no label.
  for (const id of await list("-in:inbox -in:sent -in:trash -in:spam -in:draft -has:userlabels -from:me newer_than:90d", 50)) add(shape(await meta(id), "archived"));
  // Still in the inbox, read, older than a week: left alone.
  for (const id of await list("in:inbox -is:unread -from:me older_than:7d newer_than:120d", 40)) add(shape(await meta(id), "left"));

  // Tasks: Todoist tasks made from an email carry its Gmail link.
  if (env.TODOIST_API_TOKEN) {
    try {
      const res = await fetch("https://api.todoist.com/api/v1/tasks/filter?query=" + encodeURIComponent("search: mail.google.com"), {
        headers: { authorization: `Bearer ${env.TODOIST_API_TOKEN}` },
      });
      const d = res.ok ? await res.json() : { results: [] };
      for (const t of d.results ?? []) {
        const mid = (t.description ?? "").match(/#inbox\/([A-Za-z0-9]+)/)?.[1];
        if (!mid) continue;
        try { add({ ...shape(await meta(mid), "task"), task: t.content }); } catch {}
      }
    } catch {}
  }

  writeFileSync(HISTORY, JSON.stringify(items, null, 1));
  const counts = {};
  for (const x of items) counts[x.signal] = (counts[x.signal] ?? 0) + 1;
  console.log(JSON.stringify(counts), "non-bulk:", items.filter((x) => !x.bulk && !x.cats.some((c) => c === "promotions" || c === "social")).length);
}

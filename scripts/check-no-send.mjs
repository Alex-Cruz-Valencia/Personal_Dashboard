// Fails the build if code that could SEND email is added. This app only drafts;
// see src/lib/google/no-send.ts. Run automatically before `next build` and by `npm run lint`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../src", import.meta.url).pathname;
const SKIP = new Set(["src/lib/google/no-send.ts"]);
const FORBIDDEN = [
  [/\/(messages|drafts)\/send\b/i, "a Gmail send endpoint"],
  [/auth\/gmail\.(send|compose)\b/i, "a Gmail scope that grants sending"],
  [/["'`]https:\/\/mail\.google\.com\/["'`]/, "the full-mailbox Gmail scope"],
  [/\.send\(\s*\{[^}]*\b(raw|userId)\b/, "a Gmail client send call"],
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) yield p;
  }
}

const hits = [];
for (const file of files(ROOT)) {
  const rel = relative(join(ROOT, ".."), file);
  if (SKIP.has(rel)) continue;
  const text = readFileSync(file, "utf8");
  for (const [re, what] of FORBIDDEN) if (re.test(text)) hits.push(`${rel}: ${what}`);
}
if (hits.length) {
  console.error("Never-send guardrail failed. This app saves drafts only:\n" + hits.map((h) => "  - " + h).join("\n"));
  process.exit(1);
}
console.log("never-send check: ok");

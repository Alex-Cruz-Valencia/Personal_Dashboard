// Prints the model ids your LLM endpoint offers, so you can pick LLM_MODEL.
// Run: npm run llm:models   (reads LLM_BASE_URL and LLM_API_KEY from .env.local)
// The key is sent only to LLM_BASE_URL and is never printed.

const base = (process.env.LLM_BASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.LLM_API_KEY ?? "";

if (!base || !key) {
  console.error("Set LLM_BASE_URL and LLM_API_KEY in .env.local first (see .env.example).");
  process.exit(1);
}

try {
  const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) {
    console.error(`The server answered ${res.status}. Check LLM_BASE_URL and that the key is current.`);
    process.exit(1);
  }
  const body = await res.json();
  const models = Array.isArray(body) ? body : (body.data ?? body.models ?? []);
  if (!models.length) {
    console.log("Connected, but the server returned no models.");
  }
  for (const m of models) {
    const id = m.id ?? m.name ?? "(unknown)";
    const label = m.name && m.name !== id ? `  (${m.name})` : "";
    console.log(`${id}${label}`);
  }
} catch (err) {
  console.error(`Could not reach ${base}: ${err instanceof Error ? err.message : "network error"}`);
  process.exit(1);
}

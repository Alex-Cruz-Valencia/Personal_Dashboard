/**
 * Which `Host` a local dashboard answers to. A site can point its own domain at 127.0.0.1
 * (DNS rebinding), and the browser then treats the dashboard as that site's own, so comparing
 * Origin to Host proves nothing. Vercel only routes the project's own domains, so it's exempt.
 */
export function hostAllowed(host: string | null, extra: string[] = []): boolean {
  if (!host) return true; // not a browser: only browsers can be tricked this way
  const name = host.replace(/:\d+$/, "").toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name === "[::1]" || name.endsWith(".localhost") || extra.includes(name);
}

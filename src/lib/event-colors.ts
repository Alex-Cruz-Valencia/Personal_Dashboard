/**
 * Google Calendar colors, carried into the dashboard as a *family* name rather
 * than Google's hex: the page paints each family in its own palette (see the
 * `--ev-*` tokens in globals.css), so a "Tomato" event reads red here too, just
 * in the dashboard's style. Server- and client-safe.
 */

export type EventColor =
  | "tomato"
  | "flamingo"
  | "tangerine"
  | "banana"
  | "sage"
  | "basil"
  | "peacock"
  | "blueberry"
  | "lavender"
  | "grape"
  | "graphite";

/** An event's own `colorId` (Google's 11 event colors) → family. */
const BY_COLOR_ID: Record<string, EventColor> = {
  "1": "lavender",
  "2": "sage",
  "3": "grape",
  "4": "flamingo",
  "5": "banana",
  "6": "tangerine",
  "7": "peacock",
  "8": "graphite",
  "9": "blueberry",
  "10": "basil",
  "11": "tomato",
};

export function colorFromId(colorId: string | undefined): EventColor | undefined {
  return colorId ? BY_COLOR_ID[colorId] : undefined;
}

/** Reference hues (degrees) for snapping a calendar's own hex to a family. */
const HUES: [EventColor, number][] = [
  ["tomato", 4],
  ["flamingo", 352],
  ["tangerine", 24],
  ["banana", 45],
  ["basil", 140],
  ["sage", 160],
  ["peacock", 192],
  ["blueberry", 225],
  ["lavender", 240],
  ["grape", 285],
];

/**
 * A calendar's `backgroundColor` (any hex Google uses) → the nearest family by
 * hue; washed-out greys go to graphite. Flamingo vs. tomato is split by
 * lightness, since they share a hue.
 */
export function colorFromHex(hex: string | undefined): EventColor | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? "");
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.18) return "graphite";
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  let best: EventColor = "graphite";
  let bestDist = Infinity;
  for (const [name, ref] of HUES) {
    const dist = Math.min(Math.abs(h - ref), 360 - Math.abs(h - ref));
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  if (best === "tomato" || best === "flamingo") return l > 0.62 ? "flamingo" : "tomato";
  return best;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { WeatherScene } from "@/components/WeatherScene";
import { DAY_PARTS, sceneSky, partHour } from "@/lib/day-part";
import { parseSkyPreview } from "@/lib/weather/codes";

const SKIES = ["clear", "drizzle", "rain", "storm", "snow"] as const;
/** A typical day for the sheet; the links below open each cell against the viewer's real sun. */
const SUN = { sunrise: 6.5, sunset: 19.5 };
const MODES = [
  ["dark", "Dark"],
  ["light", "Clean daylight"],
  ["clay", "Desert clay"],
  ["blue", "Clean daylight, pale blue"],
  ["clayblue", "Desert clay, pale blue"],
] as const;

/** Dev only: every weather against every part of the day, for one theme at a time. */
export default async function SkySheet({ searchParams }: PageProps<"/sky">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const mode = MODES.find(([m]) => m === sp.mode)?.[0] ?? "dark";
  const theme = mode === "dark" ? "dark" : "light";
  const palette = mode.startsWith("clay") ? "clay" : "daylight";
  const lightSky = mode.endsWith("blue") ? "blue" : "cream";
  return (
    <div className="morning skysheet" data-theme={theme} data-palette={palette} data-lightsky={lightSky}>
      <nav className="skysheet__nav">
        {MODES.map(([m, label]) => (
          <Link key={m} href={`/sky?mode=${m}`} aria-current={m === mode ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="skysheet__grid">
        <span />
        {DAY_PARTS.map((part) => (
          <b key={part}>{part}</b>
        ))}
        {SKIES.map((kind) => (
          <div key={kind} className="skysheet__row">
            <b>{kind}</b>
            {DAY_PARTS.map((part) => {
              const now = partHour(part, SUN);
              const sky = parseSkyPreview({ sky: kind })!;
              return (
                <Link key={part} className="card card--scene skysheet__cell" href={`/?sky=${kind}&part=${part}&theme=${theme}&palette=${palette}&lightsky=${lightSky}`} aria-label={`${kind}, ${part}`}>
                  <WeatherScene sky={sky} {...sceneSky(now, SUN, { skyTheme: "time", skyPart: "auto" })} />
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

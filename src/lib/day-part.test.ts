import { describe, expect, it } from "vitest";
import { DAY_PARTS, dayPart, eveningFrom, partHour, sceneSky, skyTime } from "./day-part";

const sun = { sunrise: 6.5, sunset: 19.5 };

describe("dayPart", () => {
  it("follows the sun through the day", () => {
    const seen = [5, 6.5, 9, 13, 16, 18.8, 20, 22].map((h) => dayPart(h, sun));
    expect(seen).toEqual(["night", "dawn", "morning", "noon", "afternoon", "golden", "dusk", "night"]);
  });

  it("moves with the season", () => {
    expect(dayPart(17.5, { sunrise: 7.5, sunset: 17 })).toBe("dusk");
    expect(dayPart(17.5, sun)).toBe("afternoon");
  });
});

it("gives each part an hour that lands in it", () => {
  for (const part of DAY_PARTS) expect(dayPart(partHour(part, sun), sun)).toBe(part);
});

it("arcs the sun from left to right, highest at noon", () => {
  expect(skyTime(sun.sunrise, sun).sunX).toBe(8);
  expect(skyTime(sun.sunset, sun).sunX).toBe(92);
  expect(skyTime(13, sun).sunY).toBe(0);
});

describe("sceneSky", () => {
  it("leaves the sky alone when themes are off", () => {
    expect(sceneSky(13, sun, { skyTheme: "plain", skyPart: "auto" }).time).toBeUndefined();
  });

  it("keeps the original night sky", () => {
    expect(sceneSky(23, sun, { skyTheme: "time", skyPart: "auto" })).toEqual({ isDay: false, time: undefined });
  });

  it("moves only the sky when a part is picked", () => {
    expect(sceneSky(23, sun, { skyTheme: "time", skyPart: "golden" }).time?.part).toBe("golden");
  });
});

describe("eveningFrom", () => {
  it("starts at nightfall when that's before wind-down", () => {
    expect(eveningFrom(21, 16.9)).toBeCloseTo(17.65);
  });

  it("starts at wind-down when that's earlier than nightfall", () => {
    expect(eveningFrom(19, 20.5)).toBe(19);
  });

  it("stays off when wind-down is midnight", () => {
    expect(eveningFrom(24, 16.9)).toBe(24);
  });
});

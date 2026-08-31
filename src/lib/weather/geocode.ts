/**
 * Reverse geocoding for the small "where this weather is" label on the
 * weather card. BigDataCloud's client endpoint is keyless and CORS-enabled
 * (so `LocationSync` can also call it and cache the label in the cookie).
 *
 * Never throws — a missing label just means the card shows no place.
 */

import "server-only";

interface BdcResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  principalSubdivisionCode?: string; // e.g. "US-NH"
  countryCode?: string;
  countryName?: string;
}

/** e.g. (43.70, -72.29) → "Hanover, NH"; (64.13, -21.9) → "Reykjavík, IS". */
export function formatPlace(d: BdcResponse): string | null {
  const place = d.city?.trim() || d.locality?.trim();
  if (!place) return d.principalSubdivision || d.countryName || null;

  const region =
    d.principalSubdivisionCode?.split("-").pop()?.trim() ||
    d.principalSubdivision?.trim();

  if (d.countryCode && d.countryCode !== "US") {
    return `${place}, ${d.countryCode}`;
  }
  return region ? `${place}, ${region}` : place;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  try {
    const url = new URL(
      "https://api.bigdatacloud.net/data/reverse-geocode-client",
    );
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("localityLanguage", "en");

    const res = await fetch(url, { next: { revalidate: 86_400 } });
    if (!res.ok) return null;
    return formatPlace((await res.json()) as BdcResponse);
  } catch {
    return null;
  }
}

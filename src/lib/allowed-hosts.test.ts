import { expect, it } from "vitest";
import { hostAllowed } from "./allowed-hosts";

it("answers to local names on any port", () => {
  for (const h of ["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "app.localhost:3000"]) expect(hostAllowed(h)).toBe(true);
});

it("refuses anything else", () => {
  expect(hostAllowed("evil.test:3000")).toBe(false);
  expect(hostAllowed("localhost.evil.test")).toBe(false);
});

it("takes extra hosts from the deployment", () => {
  expect(hostAllowed("dash.home:3000", ["dash.home"])).toBe(true);
});

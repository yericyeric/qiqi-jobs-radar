import { it, expect } from "vitest";
import { session, validSession, sameSecret, allowLogin } from "../server/auth";
it("accepts signed unexpired session and rejects tampering/expiry", () => {
  const secret = "x".repeat(40),
    now = 100000000;
  const token = session(secret, now);
  expect(validSession(token, secret, now)).toBe(true);
  expect(validSession(token + "a", secret, now)).toBe(false);
  expect(validSession(token, "y".repeat(40), now)).toBe(false);
  expect(validSession(token, secret, now + 13 * 3600000)).toBe(false);
  expect(validSession(undefined, secret, now)).toBe(false);
});
it("compares access keys exactly and limits failed logins", () => {
  expect(sameSecret("abc", "abcd")).toBe(false);
  expect(sameSecret("abc", "abc")).toBe(true);
  for (let i = 0; i < 10; i++) expect(allowLogin("test", 1)).toBe(true);
  expect(allowLogin("test", 1)).toBe(false);
  expect(allowLogin("test", 1000000)).toBe(true);
});

import { it, expect } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../pages/api/[...path].api";
import { session } from "../server/auth";
async function request(
  path: string,
  method: string,
  body: unknown,
  origin: string | undefined,
  cookie = "",
) {
  let status = 200,
    payload: unknown;
  const headers: Record<string, unknown> = {};
  const req = {
    query: { path: path.split("/") },
    method,
    body,
    headers: { origin },
    socket: { remoteAddress: "api-test" },
    cookies: { radar_session: cookie },
  } as unknown as NextApiRequest;
  const res = {
    setHeader: (key: string, value: unknown) => {
      headers[key] = value;
    },
    status: (n: number) => {
      status = n;
      return res;
    },
    json: (data: unknown) => {
      payload = data;
      return res;
    },
  } as unknown as NextApiResponse;
  await handler(req, res);
  return { status, payload, headers };
}
it("API fails closed, rejects cross-origin writes and accepts a valid owner login", async () => {
  process.env.SESSION_SECRET = "s".repeat(64);
  process.env.RADAR_ACCESS_KEY = "a".repeat(64);
  process.env.APP_ORIGIN = "https://radar.example.com";
  expect((await request("state", "GET", undefined, undefined)).status).toBe(
    401,
  );
  expect(
    (
      await request(
        "login",
        "POST",
        { key: process.env.RADAR_ACCESS_KEY },
        "https://attacker.example.com",
      )
    ).status,
  ).toBe(403);
  expect(
    (await request("login", "POST", { key: "wrong" }, process.env.APP_ORIGIN))
      .status,
  ).toBe(401);
  const login = await request(
    "login",
    "POST",
    { key: process.env.RADAR_ACCESS_KEY },
    process.env.APP_ORIGIN,
  );
  expect(login.status).toBe(200);
  expect(login.headers["Set-Cookie"]).toContain("HttpOnly");
  expect(login.headers["Set-Cookie"]).toContain("Secure");
  const cookie = session(process.env.SESSION_SECRET);
  expect(
    (
      await request(
        "import",
        "POST",
        [{ title: "Incomplete" }],
        process.env.APP_ORIGIN,
        cookie,
      )
    ).status,
  ).toBe(400);
  expect(
    (await request("logout", "POST", {}, process.env.APP_ORIGIN, cookie))
      .headers["Set-Cookie"],
  ).toContain("Max-Age=0");
});

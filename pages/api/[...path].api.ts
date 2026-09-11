import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
  actions,
  applicationSchema,
  jobInputSchema,
  profileSchema,
  organizationSchema,
} from "../../lib/contracts";
import { act, importJobs, refresh } from "../../lib/state";
import { normalize } from "../../lib/engine";
import { readState, mutate } from "../../server/repository";
import {
  sameSecret,
  session,
  validSession,
  allowLogin,
} from "../../server/auth";
import { ManualImportAdapter } from "../../lib/adapters";
export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const path = ((req.query.path as string[]) || []).join("/");
  const secret = process.env.SESSION_SECRET || "",
    access = process.env.RADAR_ACCESS_KEY || "",
    origin = process.env.APP_ORIGIN || "";
  if (secret.length < 32 || access.length < 24 || !origin)
    return res
      .status(503)
      .json({
        error:
          "Server setup needed: configure DATABASE_URL, APP_ORIGIN and strong access/session keys.",
      });
  if (req.method !== "GET" && req.headers.origin !== origin)
    return res.status(403).json({ error: "Request origin is not allowed." });
  const cookieOptions = `Path=${process.env.NEXT_PUBLIC_BASE_PATH || ""}/; HttpOnly; SameSite=Strict; ${origin.startsWith("https:") ? "Secure; " : ""}`;
  if (path === "login" && req.method === "POST") {
    if (!allowLogin(req.socket.remoteAddress || "unknown"))
      return res
        .status(429)
        .json({ error: "Too many attempts. Try again in 15 minutes." });
    if (typeof req.body?.key !== "string" || !sameSecret(req.body.key, access))
      return res.status(401).json({ error: "Incorrect access key." });
    res.setHeader(
      "Set-Cookie",
      `radar_session=${session(secret)}; ${cookieOptions}Max-Age=43200`,
    );
    return res.json({ ok: true });
  }
  if (!validSession(req.cookies.radar_session, secret))
    return res.status(401).json({ error: "Sign in to your private radar." });
  if (path === "logout" && req.method === "POST") {
    res.setHeader("Set-Cookie", `radar_session=; ${cookieOptions}Max-Age=0`);
    return res.json({ ok: true });
  }
  try {
    if (path === "state" && req.method === "GET")
      return res.json(await readState());
    if (path === "profile" && req.method === "PUT") {
      const profile = profileSchema.parse(req.body);
      return res.json(await mutate((s) => refresh({ ...s, profile })));
    }
    if (path === "import" && req.method === "POST") {
      const records = await new ManualImportAdapter(
        z.array(jobInputSchema).min(1).max(100).parse(req.body),
      ).discover();
      if (records.some((j) => j.isDemo || j.organization.isDemo))
        return res
          .status(400)
          .json({ error: "Demo data cannot be imported into the live radar." });
      return res.json(await mutate((s) => importJobs(s, records)));
    }
    if (path === "organization" && req.method === "POST") {
      const org = organizationSchema.parse(req.body);
      if (org.isDemo)
        return res
          .status(400)
          .json({ error: "Demo organization cannot be imported." });
      return res.json(
        await mutate((s) => {
          const i = s.organizations.findIndex(
            (o) => normalize(o.name) === normalize(org.name),
          );
          if (i >= 0)
            s.organizations[i] = { ...org, id: s.organizations[i].id };
          else {
            if (s.organizations.some((o) => o.id === org.id))
              throw new Error("Organization ID already used");
            s.organizations.push(org);
          }
          return s;
        }),
      );
    }
    if (path === "action" && req.method === "POST") {
      const b = z
        .object({ jobId: z.string(), action: z.enum(actions) })
        .parse(req.body);
      return res.json(await mutate((s) => act(s, b.jobId, b.action)));
    }
    if (path === "application" && req.method === "PUT") {
      const app = applicationSchema.parse(req.body);
      return res.json(
        await mutate((s) => {
          let next = s;
          const existing = s.applications.find((a) => a.jobId === app.jobId);
          if (!existing || existing.stage !== app.stage)
            next = act(s, app.jobId, app.stage);
          next.applications = next.applications.map((a) =>
            a.jobId === app.jobId ? app : a,
          );
          return next;
        }),
      );
    }
    return res.status(404).json({ error: "Endpoint not found." });
  } catch (error) {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
    if (
      error instanceof Error &&
      ["Job not found", "Organization ID already used"].includes(error.message)
    )
      return res.status(400).json({ error: error.message });
    console.error(
      "Radar request failed",
      error instanceof Error ? error.name : "unknown",
    );
    return res
      .status(503)
      .json({
        error:
          "Database unavailable. Check the connection, migrations and seed; no changes were saved.",
      });
  }
}

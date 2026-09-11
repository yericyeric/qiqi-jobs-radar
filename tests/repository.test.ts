import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { readFileSync } from "node:fs";
import { makeSample, sampleProfile } from "../lib/sample";
import { act, importJobs } from "../lib/state";
it("Prisma persists import, canonical sources, profile and application history transactionally over PostgreSQL protocol", async () => {
  const pg = await PGlite.create();
  await pg.exec(
    readFileSync("prisma/migrations/202609050001_init/migration.sql", "utf8"),
  );
  const socket = new PGLiteSocketServer({
    db: pg,
    port: 0,
    host: "127.0.0.1",
    maxConnections: 1,
  });
  await socket.start();
  process.env.DATABASE_URL = `postgresql://postgres@${socket.getServerConn()}/postgres?connection_limit=1&sslmode=disable`;
  const { db } = await import("../server/db");
  const { writeProfile, readState, mutate } =
    await import("../server/repository");
  try {
    await db.$transaction((tx) => writeProfile(tx, sampleProfile));
    expect((await readState()).jobs).toHaveLength(0);
    const job = makeSample().jobs[0];
    await mutate((s) => importJobs(s, [job]));
    const imported = await readState();
    expect(imported.jobs).toHaveLength(1);
    const id = imported.jobs[0].id;
    await mutate((s) => act(s, id, "Applied"));
    expect((await readState()).applications[0].stage).toBe("Applied");
    expect(await db.userJobAction.count()).toBe(1);
    expect(await db.candidateSkill.count()).toBe(sampleProfile.skills.length);
    await mutate((s) =>
      importJobs(s, [
        {
          ...job,
          sources: [
            {
              ...job.sources[0],
              name: "LinkedIn",
              kind: "LINKEDIN",
              url: "https://example.com/another-source",
            },
          ],
        },
      ]),
    );
    expect(await db.job.count()).toBe(1);
    expect(await db.jobSource.count()).toBe(2);
    expect(await db.jobScore.count()).toBeGreaterThanOrEqual(2);
    await expect(
      mutate((s) => {
        s.organizations.push({
          ...job.organization,
          id: "collision",
          name: job.organization.name,
        });
        return s;
      }),
    ).rejects.toThrow();
    expect(await db.organization.count()).toBe(1);
  } finally {
    await db.$disconnect();
    await socket.stop();
    await pg.close();
  }
}, 60000);

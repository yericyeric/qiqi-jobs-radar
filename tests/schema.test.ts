import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
it("PostgreSQL migration creates all 17 tables and enforces score and affiliation constraints", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      readFileSync("prisma/migrations/202609050001_init/migration.sql", "utf8"),
    );
    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    expect(tables.rows).toHaveLength(17);
    await db.exec(
      `INSERT INTO organizations (id,name,"normalizedName",website,"organizationType",city,county,details) VALUES ('org','Test','test','https://example.com','Production','Miami','Miami-Dade','{}');`,
    );
    await expect(
      db.exec(
        `INSERT INTO organization_affiliations (id, "organizationId", label, evidence, "sourceUrl", "publiclyExplicit") VALUES ('bad','org','Asian-affiliated','surname','https://example.com',false)`,
      ),
    ).rejects.toThrow(/affiliation_requires_evidence/);
    await db.exec(
      `INSERT INTO organization_affiliations (id, "organizationId", label, evidence, "sourceUrl", "publiclyExplicit") VALUES ('valid','org','China-related','Official mission: China-US cultural exchange','https://example.com/mission',true)`,
    );
    expect(
      (await db.query("SELECT * FROM organization_affiliations")).rows,
    ).toHaveLength(1);
    await expect(
      db.exec(
        `INSERT INTO jobs (id,"companyId",title,"canonicalUrl",location,county,category,"employmentType",description,"fitScore","requirementMatch",details) VALUES ('j','org','Coordinator','https://example.com/job','Miami','Miami-Dade','Events','Full-time','Event logistics',101,'STRETCH','{}')`,
      ),
    ).rejects.toThrow(/jobs_fit_score_range/);
  } finally {
    await db.close();
  }
}, 30000);

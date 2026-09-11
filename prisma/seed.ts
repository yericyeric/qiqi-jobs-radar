import { db } from "../server/db";
import { writeProfile, CANDIDATE_ID } from "../server/repository";
import { sampleProfile } from "../lib/sample";
async function main() {
  if (await db.candidate.findUnique({ where: { id: CANDIDATE_ID } })) {
    console.log("Candidate exists; preserving edits.");
    return;
  }
  await db.$transaction((tx) => writeProfile(tx, sampleProfile));
  console.log(
    "Qiqi profile created. No fictional jobs inserted into the live database.",
  );
}
main()
  .catch(() => {
    console.error("Seed failed. Verify database connection and migration.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

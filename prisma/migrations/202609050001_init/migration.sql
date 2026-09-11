-- Phase 1 PostgreSQL schema. Prisma supplies cuid IDs and updatedAt values.

CREATE TABLE "candidates" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "profile" JSONB NOT NULL,
  "learnedPreferences" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "candidate_skills" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "name" TEXT NOT NULL
);

CREATE TABLE "candidate_experience" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "description" TEXT NOT NULL
);

CREATE TABLE "candidate_education" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "description" TEXT NOT NULL
);

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "website" TEXT NOT NULL,
  "organizationType" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "county" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "lastCheckedForJobs" TIMESTAMP(3)
);

CREATE TABLE "organization_contacts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "sourceUrl" TEXT NOT NULL
);

CREATE TABLE "organization_affiliations" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "publiclyExplicit" BOOLEAN NOT NULL
);

CREATE TABLE "organization_sources" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "canonicalUrl" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "county" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "employmentType" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "originalPostedAt" TIMESTAMP(3),
  "estimatedPostedAt" TIMESTAMP(3),
  "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastVerifiedAt" TIMESTAMP(3),
  "activeStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "freshnessConfidence" TEXT NOT NULL DEFAULT 'Unknown',
  "fitScore" INTEGER NOT NULL,
  "requirementMatch" TEXT NOT NULL,
  "isRepost" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "details" JSONB NOT NULL
);

CREATE TABLE "job_sources" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "externalId" TEXT,
  "details" JSONB NOT NULL
);

CREATE TABLE "job_requirements" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "details" JSONB NOT NULL
);

CREATE TABLE "job_scores" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "total" INTEGER NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "job_verifications" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "user_job_actions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "applications" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "alerts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3)
);

CREATE TABLE "search_runs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "details" JSONB NOT NULL
);

CREATE UNIQUE INDEX "candidate_skills_candidateId_name_key" ON "candidate_skills"("candidateId","name");
CREATE UNIQUE INDEX "organizations_normalizedName_key" ON "organizations"("normalizedName");
CREATE INDEX "jobs_fitScore_originalPostedAt_idx" ON "jobs"("fitScore","originalPostedAt");
CREATE INDEX "jobs_companyId_title_idx" ON "jobs"("companyId","title");
CREATE INDEX "user_job_actions_candidateId_jobId_at_idx" ON "user_job_actions"("candidateId","jobId","at");
CREATE UNIQUE INDEX "applications_candidateId_jobId_key" ON "applications"("candidateId","jobId");
CREATE UNIQUE INDEX "alerts_candidateId_jobId_channel_key" ON "alerts"("candidateId","jobId","channel");

ALTER TABLE "candidate_skills" ADD CONSTRAINT "candidate_skills_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_experience" ADD CONSTRAINT "candidate_experience_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_education" ADD CONSTRAINT "candidate_education_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_contacts" ADD CONSTRAINT "organization_contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_affiliations" ADD CONSTRAINT "organization_affiliations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_sources" ADD CONSTRAINT "organization_sources_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_sources" ADD CONSTRAINT "job_sources_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_verifications" ADD CONSTRAINT "job_verifications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_job_actions" ADD CONSTRAINT "user_job_actions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_job_actions" ADD CONSTRAINT "user_job_actions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "jobs" ADD CONSTRAINT "jobs_fit_score_range" CHECK ("fitScore" BETWEEN 0 AND 100);
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_total_range" CHECK ("total" BETWEEN 0 AND 100);
ALTER TABLE "organization_affiliations" ADD CONSTRAINT "affiliation_requires_evidence" CHECK ("publiclyExplicit" = true AND length("evidence") >= 15 AND "sourceUrl" ~ '^https?://');

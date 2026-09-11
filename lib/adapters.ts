import {
  jobInputSchema,
  type JobInput,
  type Job,
  type Verification,
  type Profile,
} from "./contracts";
export interface SourceContext {
  queries: string[];
  profile: Profile;
  since: string;
  signal: AbortSignal;
}
export interface SourceAdapter {
  id: string;
  cadenceHours: number;
  discover(context: SourceContext): Promise<JobInput[]>;
  verify(job: Job): Promise<Verification | null>;
}
/** Phase 1 deliberately imports evidence without making network verification claims. */
export class ManualImportAdapter implements SourceAdapter {
  id = "manual";
  cadenceHours = 0;
  constructor(private records: unknown[]) {}
  async discover() {
    return this.records.map((record) => jobInputSchema.parse(record));
  }
  async verify(job: Job) {
    return job.verification;
  }
}
export interface NlpClassifier {
  classify(
    description: string,
  ): Promise<{
    category: JobInput["category"];
    responsibilitySummary: string;
    warnings: string[];
  }>;
}
export const cadence = {
  fastHours: 3,
  organizationHours: 12,
  discoveryHours: 24,
  deepRefreshHours: 168,
};

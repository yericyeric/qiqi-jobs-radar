import type { JobInput, Profile } from "./contracts";

// Career relevance is a gate, not a score that generic coordination can outweigh.
export function careerRelated(
  job: Pick<JobInput, "title" | "description">,
  profile?: Profile,
): boolean {
  if (
    profile &&
    !/stage|event|production|broadcast|journalis|video|media|entertainment/i.test(
      [...profile.skills, ...profile.experience, ...profile.education].join(
        " ",
      ),
    )
  )
    return false;
  const title = job.title,
    description = job.description;
  if (
    /\bchef\b|\bcook\b|bartender|\bwaiter\b|\bserver\b|medical interpreter|interpreter|video data collect|insurance|mortgage|loan officer|software|data engineer|machine learning|manufactur|assembly|warehouse|pharmaceutical|food factory|chemical|plant operator|factory|cybersecurity|accountant|nurse|physician|human resources|recruiter|talent sourc|sales representative/i.test(
      title,
    )
  )
    return false;
  if (
    /door.to.door|commission.only|multi.level marketing|street sales/i.test(
      title + " " + description,
    )
  )
    return false;
  const direct =
    /\b(?:events?|stagehand|backstage|broadcast|journalis\w*|videograph\w*|video|filmmak\w*|audiovisual|audio.visual|theat(?:re|er)|festival|experiential)\b|stage manag|venue (?:operat|coordinat|assist)|production (?:assist|coordinat|support|office)|content (?:creat|produc|editor)|studio (?:assist|coordinat)|show (?:operat|produc|assist)|motion graphics/i.test(
      title,
    );
  if (direct) return true;
  const duties =
    /(?:plan|coordinat|organiz|produc|edit|film|shoot|support|execut|manag|assist)\w*[^.!?]{0,100}(?:live events?|event (?:operations|logistics|production)|video(?:s| production| content)?|broadcast|backstage|stage production|run.of.show|concert|festival|media production|content production)/i.test(
      description,
    );
  const domainRole =
    /producer|editor|content|media|communications|publicity|programming|marketing|coordinator|program|arts|museum/i.test(
      title,
    );
  return duties && domainRole;
}

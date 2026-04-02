import type { LocalAppSettings, SessionRecord } from "@notesmith/domain";

export type ReviewBucket = "people" | "domains" | "projects" | "activities";
export type MetadataReviewState = Record<ReviewBucket, string[]>;

export const EMPTY_METADATA_REVIEW: MetadataReviewState = {
  people: [],
  domains: [],
  projects: [],
  activities: [],
};

const parseTokenList = (value: string) =>
  value
    .split(/[,\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const buildKnownSet = (values: string[]) => new Set(values.map((entry) => entry.trim().toLocaleLowerCase()).filter(Boolean));

export const buildMetadataReview = (session: SessionRecord | null, settings: LocalAppSettings | null): MetadataReviewState => {
  if (!session || !settings) {
    return EMPTY_METADATA_REVIEW;
  }

  const knownPeople = buildKnownSet(settings.savedParticipants);
  const knownDomains = buildKnownSet(settings.savedDomains);
  const knownProjects = buildKnownSet(settings.savedProjects);
  const knownActivities = buildKnownSet(settings.savedActivities);

  return {
    people: parseTokenList(session.participantText).filter((entry) => !knownPeople.has(entry.toLocaleLowerCase())),
    domains: session.domain.trim() && !knownDomains.has(session.domain.trim().toLocaleLowerCase()) ? [session.domain.trim()] : [],
    projects: session.project.trim() && !knownProjects.has(session.project.trim().toLocaleLowerCase()) ? [session.project.trim()] : [],
    activities:
      session.activity.trim() && !knownActivities.has(session.activity.trim().toLocaleLowerCase()) ? [session.activity.trim()] : [],
  };
};

export const EMPTY_METADATA_REVIEW = {
    people: [],
    domains: [],
    projects: [],
    activities: [],
};
const parseTokenList = (value) => value
    .split(/[,\n;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
const buildKnownSet = (values) => new Set(values.map((entry) => entry.trim().toLocaleLowerCase()).filter(Boolean));
export const buildMetadataReview = (session, settings) => {
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
        activities: session.activity.trim() && !knownActivities.has(session.activity.trim().toLocaleLowerCase()) ? [session.activity.trim()] : [],
    };
};

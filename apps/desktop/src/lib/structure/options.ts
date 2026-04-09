import type { ActivityRecord, ProjectLinkRecord, SessionRecord, TodoRecord } from "@notesmith/domain";

export type StructureOptions = {
  domains: string[];
  projects: string[];
  activities: string[];
  projectDomains: Record<string, string[]>;
  activityProjects: Record<string, string[]>;
  activityDomains: Record<string, string[]>;
};

type StructureOptionInputs = {
  savedDomains: string[];
  savedProjects: string[];
  savedActivities: string[];
  projectLinks: ProjectLinkRecord[];
  sessions: SessionRecord[];
  todos: TodoRecord[];
  activities: ActivityRecord[];
};

const normalize = (value: string) => value.trim();

const addToMap = (map: Map<string, Set<string>>, key: string, value: string) => {
  const nextKey = normalize(key);
  const nextValue = normalize(value);
  if (!nextKey || !nextValue) return;
  if (!map.has(nextKey)) {
    map.set(nextKey, new Set());
  }
  map.get(nextKey)?.add(nextValue);
};

const toSortedArray = (values: Iterable<string>) =>
  Array.from(new Set(Array.from(values).map(normalize).filter(Boolean))).sort((left, right) => left.localeCompare(right));

const mapToRecord = (map: Map<string, Set<string>>) =>
  Object.fromEntries(Array.from(map.entries()).map(([key, values]) => [key, toSortedArray(values)])) as Record<string, string[]>;

export const createEmptyStructureOptions = (): StructureOptions => ({
  domains: [],
  projects: [],
  activities: [],
  projectDomains: {},
  activityProjects: {},
  activityDomains: {},
});

export const buildStructureOptions = ({
  savedDomains,
  savedProjects,
  savedActivities,
  projectLinks,
  sessions,
  todos,
  activities,
}: StructureOptionInputs): StructureOptions => {
  const domainValues = new Set<string>(savedDomains.map(normalize).filter(Boolean));
  const projectValues = new Set<string>(savedProjects.map(normalize).filter(Boolean));
  const activityValues = new Set<string>(savedActivities.map(normalize).filter(Boolean));
  const projectDomains = new Map<string, Set<string>>();
  const activityProjects = new Map<string, Set<string>>();
  const activityDomains = new Map<string, Set<string>>();

  projectLinks.forEach((entry) => {
    const project = normalize(entry.project);
    const domain = normalize(entry.domain);
    if (project) projectValues.add(project);
    if (domain) domainValues.add(domain);
    addToMap(projectDomains, project, domain);
  });

  sessions.forEach((session) => {
    const domain = normalize(session.domain);
    const project = normalize(session.project);
    const activity = normalize(session.activity);
    if (domain) domainValues.add(domain);
    if (project) projectValues.add(project);
    if (activity) activityValues.add(activity);
    addToMap(projectDomains, project, domain);
    addToMap(activityProjects, activity, project);
    addToMap(activityDomains, activity, domain);
    const linkedDomain = domain || projectDomains.get(project)?.values().next().value || "";
    addToMap(activityDomains, activity, linkedDomain);
  });

  todos.forEach((todo) => {
    const domain = normalize(todo.domain);
    const project = normalize(todo.project);
    const activity = normalize(todo.activity);
    if (domain) domainValues.add(domain);
    if (project) projectValues.add(project);
    if (activity) activityValues.add(activity);
    addToMap(projectDomains, project, domain);
    addToMap(activityProjects, activity, project);
    addToMap(activityDomains, activity, domain);
    const linkedDomain = domain || projectDomains.get(project)?.values().next().value || "";
    addToMap(activityDomains, activity, linkedDomain);
  });

  activities.forEach((entry) => {
    const domain = normalize(entry.domain);
    const project = normalize(entry.project);
    const activity = normalize(entry.activity);
    const description = normalize(entry.description);
    if (domain) domainValues.add(domain);
    if (project) projectValues.add(project);
    if (activity) activityValues.add(activity);
    if (description) activityValues.add(description);
    addToMap(projectDomains, project, domain);
    [activity, description].forEach((label) => {
      addToMap(activityProjects, label, project);
      addToMap(activityDomains, label, domain);
      const linkedDomain = domain || projectDomains.get(project)?.values().next().value || "";
      addToMap(activityDomains, label, linkedDomain);
    });
  });

  return {
    domains: toSortedArray(domainValues),
    projects: toSortedArray(projectValues),
    activities: toSortedArray(activityValues),
    projectDomains: mapToRecord(projectDomains),
    activityProjects: mapToRecord(activityProjects),
    activityDomains: mapToRecord(activityDomains),
  };
};

export const getProjectsForDomain = (options: StructureOptions, domain: string) => {
  const nextDomain = normalize(domain);
  if (!nextDomain) return options.projects;
  return options.projects.filter((project) => (options.projectDomains[project] || []).includes(nextDomain));
};

export const getActivitiesForSelection = (options: StructureOptions, domain: string, project: string) => {
  const nextDomain = normalize(domain);
  const nextProject = normalize(project);
  if (!nextDomain && !nextProject) {
    return options.activities;
  }

  return options.activities.filter((activity) => {
    const activityProjects = options.activityProjects[activity] || [];
    const activityDomains = options.activityDomains[activity] || [];

    if (nextProject) {
      if (!activityProjects.includes(nextProject)) {
        return false;
      }
    }

    if (nextDomain) {
      if (activityDomains.includes(nextDomain)) {
        return true;
      }
      return activityProjects.some((candidateProject) => (options.projectDomains[candidateProject] || []).includes(nextDomain));
    }

    return true;
  });
};

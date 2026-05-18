const RULE_KIND_PRIORITY = {
    todo: ["todo", "activity", "meeting"],
    activity: ["activity", "meeting", "todo"],
    meeting: ["meeting", "activity", "todo"],
};
const GENERIC_STRUCTURE_VALUES = new Set([
    "",
    "other",
    "background",
    "no domain",
    "no project",
    "no activity",
    "unassigned",
]);
const TITLE_STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "att",
    "av",
    "det",
    "en",
    "ett",
    "for",
    "för",
    "fran",
    "från",
    "from",
    "i",
    "in",
    "med",
    "meeting",
    "mot",
    "möte",
    "note",
    "notes",
    "och",
    "of",
    "on",
    "or",
    "session",
    "task",
    "the",
    "to",
    "todo",
    "with",
]);
const normalizeMatchText = (value) => (typeof value === "string" ? value.trim().toLocaleLowerCase() : "");
export const normalizeStructureInferenceRuleTitle = (value) => normalizeMatchText(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
const isMeaningfulStructureValue = (value) => {
    const normalized = normalizeMatchText(value);
    return Boolean(normalized) && !GENERIC_STRUCTURE_VALUES.has(normalized);
};
const tokenizeTitle = (value) => Array.from(new Set((normalizeMatchText(value).match(/[\p{L}\p{N}]+/gu) ?? []).filter((token) => (token.length > 1 || /\d/.test(token)) && !TITLE_STOP_WORDS.has(token))));
const countSharedTokens = (left, right) => {
    if (!left.length || !right.length)
        return 0;
    const rightSet = new Set(right);
    return left.reduce((count, token) => count + (rightSet.has(token) ? 1 : 0), 0);
};
const mergeMissingStructure = (base, patch) => ({
    domain: base.domain || patch.domain || "",
    project: base.project || patch.project || "",
    activity: base.activity || patch.activity || "",
});
const scoreHintAgainstTitle = (title, titleTokens, hint) => {
    const label = normalizeMatchText(hint.label);
    if (!label)
        return 0;
    const labelTokens = tokenizeTitle(hint.label);
    if (!labelTokens.length)
        return 0;
    const titleTokenSet = new Set(titleTokens);
    const sharedTokens = labelTokens.filter((token) => titleTokenSet.has(token)).length;
    const containsFullLabel = label.length >= 4 && title.includes(label);
    const allHintTokensPresent = labelTokens.every((token) => titleTokenSet.has(token));
    const exact = title === label;
    return ((exact ? 600 : 0) +
        (containsFullLabel ? 240 : 0) +
        (allHintTokensPresent ? labelTokens.length * 75 : 0) +
        sharedTokens * 45 +
        hint.weight * 8 +
        label.length);
};
const buildRecencyBonus = (value) => {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp))
        return 0;
    const ageDays = Math.max(0, (Date.now() - timestamp) / 86400000);
    return Math.max(0, 40 - Math.floor(ageDays / 14));
};
const normalizeStructureInferenceRule = (rule) => {
    const normalizedTitle = normalizeStructureInferenceRuleTitle(typeof rule.normalizedTitle === "string" && rule.normalizedTitle ? rule.normalizedTitle : typeof rule.title === "string" ? rule.title : "");
    const kind = rule.kind === "meeting" || rule.kind === "activity" || rule.kind === "todo" ? rule.kind : "todo";
    const domain = typeof rule.domain === "string" ? rule.domain.trim() : "";
    const project = typeof rule.project === "string" ? rule.project.trim() : "";
    const activity = typeof rule.activity === "string" ? rule.activity.trim() : "";
    if (!normalizedTitle)
        return null;
    if (!isMeaningfulStructureValue(domain) && !isMeaningfulStructureValue(project) && !isMeaningfulStructureValue(activity)) {
        return null;
    }
    const title = typeof rule.title === "string" && rule.title.trim() ? rule.title.trim() : normalizedTitle;
    const timestamp = typeof rule.updatedAt === "string" && rule.updatedAt ? rule.updatedAt : new Date().toISOString();
    return {
        id: typeof rule.id === "string" && rule.id.trim() ? rule.id : crypto.randomUUID(),
        kind,
        title,
        normalizedTitle,
        domain,
        project,
        activity,
        evidenceCount: Number.isFinite(Number(rule.evidenceCount)) ? Math.max(1, Math.round(Number(rule.evidenceCount))) : 1,
        createdAt: typeof rule.createdAt === "string" && rule.createdAt ? rule.createdAt : timestamp,
        updatedAt: timestamp,
    };
};
const compareRulePriority = (left, right) => compareTimestamps(right.updatedAt, left.updatedAt) ||
    right.evidenceCount - left.evidenceCount ||
    left.title.localeCompare(right.title);
const compareTimestamps = (left, right) => (left || "").localeCompare(right || "");
export const normalizeStructureInferenceRules = (rules) => {
    const deduped = new Map();
    (rules ?? []).forEach((rule) => {
        const normalized = normalizeStructureInferenceRule(rule);
        if (!normalized)
            return;
        const key = `${normalized.kind}::${normalized.normalizedTitle}`;
        const existing = deduped.get(key);
        if (!existing || compareRulePriority(normalized, existing) < 0) {
            deduped.set(key, normalized);
        }
    });
    return Array.from(deduped.values()).sort(compareRulePriority);
};
export const upsertStructureInferenceRule = (rules, title, kind, structure, updatedAt = new Date().toISOString()) => {
    const normalizedTitle = normalizeStructureInferenceRuleTitle(title);
    const domain = typeof structure.domain === "string" ? structure.domain.trim() : "";
    const project = typeof structure.project === "string" ? structure.project.trim() : "";
    const activity = typeof structure.activity === "string" ? structure.activity.trim() : "";
    if (!normalizedTitle) {
        return normalizeStructureInferenceRules(rules ?? []);
    }
    if (!isMeaningfulStructureValue(domain) && !isMeaningfulStructureValue(project) && !isMeaningfulStructureValue(activity)) {
        return normalizeStructureInferenceRules(rules ?? []);
    }
    const normalizedRules = normalizeStructureInferenceRules(rules ?? []);
    const existing = normalizedRules.find((rule) => rule.kind === kind && rule.normalizedTitle === normalizedTitle);
    const nextRule = {
        id: existing?.id || crypto.randomUUID(),
        kind,
        title: title.trim() || existing?.title || normalizedTitle,
        normalizedTitle,
        domain,
        project,
        activity,
        evidenceCount: (existing?.evidenceCount ?? 0) + 1,
        createdAt: existing?.createdAt || updatedAt,
        updatedAt,
    };
    return normalizeStructureInferenceRules([
        ...normalizedRules.filter((rule) => !(rule.kind === kind && rule.normalizedTitle === normalizedTitle)),
        nextRule,
    ]);
};
const findBestLearnedRule = (rules, title, kind) => {
    const normalizedTitle = normalizeStructureInferenceRuleTitle(title);
    if (!normalizedTitle)
        return null;
    const kindOrder = RULE_KIND_PRIORITY[kind];
    return normalizeStructureInferenceRules(rules)
        .filter((rule) => rule.normalizedTitle === normalizedTitle)
        .sort((left, right) => {
        const kindDelta = kindOrder.indexOf(left.kind) - kindOrder.indexOf(right.kind);
        if (kindDelta !== 0)
            return kindDelta;
        return compareRulePriority(left, right);
    })[0] ?? null;
};
const scoreCandidateAgainstTitle = (title, titleTokens, kind, candidate) => {
    const candidateTitle = normalizeMatchText(candidate.title);
    if (!candidateTitle)
        return 0;
    const candidateTokens = tokenizeTitle(candidate.title);
    if (!candidateTokens.length)
        return 0;
    const sharedTokens = countSharedTokens(titleTokens, candidateTokens);
    const sharedRatio = sharedTokens / Math.max(titleTokens.length, candidateTokens.length);
    const exact = title === candidateTitle;
    const contains = title.length >= 6 &&
        candidateTitle.length >= 6 &&
        (title.includes(candidateTitle) || candidateTitle.includes(title));
    const firstTokenMatch = titleTokens.length > 0 && candidateTokens.length > 0 && titleTokens[0] === candidateTokens[0];
    return ((exact ? 900 : 0) +
        (contains ? 280 : 0) +
        sharedTokens * 85 +
        Math.round(sharedRatio * 180) +
        (firstTokenMatch ? 35 : 0) +
        (kind === candidate.kind ? 70 : 0) +
        buildRecencyBonus(candidate.updatedAt));
};
const collectStructureHistory = (snapshot) => {
    const projectHints = new Map();
    const activityHints = new Map();
    const domainHints = new Map();
    const candidates = [];
    const upsertProjectHint = (project, domain, weight) => {
        if (!isMeaningfulStructureValue(project))
            return;
        const key = normalizeMatchText(project);
        const existing = projectHints.get(key);
        if (existing) {
            existing.weight += weight;
            if (!existing.domain && isMeaningfulStructureValue(domain))
                existing.domain = domain;
            return;
        }
        projectHints.set(key, {
            label: project.trim(),
            domain: isMeaningfulStructureValue(domain) ? domain.trim() : "",
            project: project.trim(),
            weight,
        });
    };
    const upsertActivityHint = (activity, project, domain, weight) => {
        if (!isMeaningfulStructureValue(activity))
            return;
        const key = normalizeMatchText(activity);
        const existing = activityHints.get(key);
        if (existing) {
            existing.weight += weight;
            if (!existing.project && isMeaningfulStructureValue(project))
                existing.project = project;
            if (!existing.domain && isMeaningfulStructureValue(domain))
                existing.domain = domain;
            return;
        }
        activityHints.set(key, {
            label: activity.trim(),
            domain: isMeaningfulStructureValue(domain) ? domain.trim() : "",
            project: isMeaningfulStructureValue(project) ? project.trim() : "",
            weight,
        });
    };
    const upsertDomainHint = (domain, weight) => {
        if (!isMeaningfulStructureValue(domain))
            return;
        const key = normalizeMatchText(domain);
        const existing = domainHints.get(key);
        if (existing) {
            existing.weight += weight;
            return;
        }
        domainHints.set(key, {
            label: domain.trim(),
            domain: domain.trim(),
            project: "",
            weight,
        });
    };
    const registerStructure = (title, domain, project, activity, kind, updatedAt, weight) => {
        upsertDomainHint(domain, weight);
        upsertProjectHint(project, domain, weight);
        upsertActivityHint(activity, project, domain, weight);
        if (!title.trim())
            return;
        if (!isMeaningfulStructureValue(domain) && !isMeaningfulStructureValue(project) && !isMeaningfulStructureValue(activity)) {
            return;
        }
        candidates.push({
            title: title.trim(),
            domain: isMeaningfulStructureValue(domain) ? domain.trim() : "",
            project: isMeaningfulStructureValue(project) ? project.trim() : "",
            activity: isMeaningfulStructureValue(activity) ? activity.trim() : "",
            kind,
            updatedAt,
        });
    };
    snapshot.todos.forEach((todo) => registerStructure(todo.description, todo.domain, todo.project, todo.activity, "todo", todo.updatedAt || todo.createdAt, 3));
    snapshot.activities
        .filter((activity) => normalizeMatchText(activity.description) !== "background log")
        .forEach((activity) => registerStructure(activity.description, activity.domain, activity.project, activity.activity || activity.description, activity.type === "meeting" ? "meeting" : "activity", activity.updatedAt || activity.createdAt, 3));
    snapshot.sessions
        .filter((session) => !session.deletedAt)
        .forEach((session) => registerStructure(session.title, session.domain, session.project, session.activity, "session", session.updatedAt || session.createdAt, 1));
    return {
        projectHints: Array.from(projectHints.values()),
        activityHints: Array.from(activityHints.values()),
        domainHints: Array.from(domainHints.values()),
        projectHintMap: projectHints,
        activityHintMap: activityHints,
        candidates,
    };
};
const findBestHint = (title, titleTokens, hints) => {
    let bestHint = null;
    let bestScore = 0;
    hints.forEach((hint) => {
        const score = scoreHintAgainstTitle(title, titleTokens, hint);
        if (score > bestScore) {
            bestHint = hint;
            bestScore = score;
        }
    });
    return bestScore >= 110 ? bestHint : null;
};
const findBestHistoricalStructure = (title, titleTokens, kind, candidates) => {
    let bestCandidate = null;
    let bestScore = 0;
    candidates.forEach((candidate) => {
        const score = scoreCandidateAgainstTitle(title, titleTokens, kind, candidate);
        if (score > bestScore) {
            bestCandidate = candidate;
            bestScore = score;
        }
    });
    return bestScore >= 260 ? bestCandidate : null;
};
export const inferStructureFromTitle = (snapshot, title, kind, seed = {}) => {
    const trimmedTitle = title.trim();
    const initial = {
        domain: seed.domain?.trim() || "",
        project: seed.project?.trim() || "",
        activity: seed.activity?.trim() || "",
    };
    if (!trimmedTitle) {
        return initial;
    }
    const normalizedTitle = normalizeMatchText(trimmedTitle);
    const titleTokens = tokenizeTitle(trimmedTitle);
    const history = collectStructureHistory(snapshot);
    let inferred = { ...initial };
    const learnedRule = findBestLearnedRule(snapshot.settings?.structureInferenceRules, trimmedTitle, kind);
    if (learnedRule) {
        inferred = mergeMissingStructure(inferred, learnedRule);
    }
    if (!inferred.activity) {
        const activityHint = findBestHint(normalizedTitle, titleTokens, history.activityHints);
        if (activityHint) {
            inferred = mergeMissingStructure(inferred, {
                activity: activityHint.label,
                project: activityHint.project,
                domain: activityHint.domain,
            });
        }
    }
    if (!inferred.project) {
        const projectHint = findBestHint(normalizedTitle, titleTokens, history.projectHints);
        if (projectHint) {
            inferred = mergeMissingStructure(inferred, {
                project: projectHint.label,
                domain: projectHint.domain,
            });
        }
    }
    if (!inferred.domain) {
        const domainHint = findBestHint(normalizedTitle, titleTokens, history.domainHints);
        if (domainHint) {
            inferred = mergeMissingStructure(inferred, {
                domain: domainHint.label,
            });
        }
    }
    const historicalMatch = findBestHistoricalStructure(normalizedTitle, titleTokens, kind, history.candidates);
    if (historicalMatch) {
        inferred = mergeMissingStructure(inferred, historicalMatch);
    }
    const exactActivityHint = inferred.activity ? history.activityHintMap.get(normalizeMatchText(inferred.activity)) : null;
    if (exactActivityHint) {
        inferred = mergeMissingStructure(inferred, {
            project: exactActivityHint.project,
            domain: exactActivityHint.domain,
        });
    }
    const exactProjectHint = inferred.project ? history.projectHintMap.get(normalizeMatchText(inferred.project)) : null;
    if (exactProjectHint) {
        inferred = mergeMissingStructure(inferred, {
            domain: exactProjectHint.domain,
        });
    }
    return inferred;
};

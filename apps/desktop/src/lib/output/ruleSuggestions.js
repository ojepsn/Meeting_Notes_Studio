const SAFE_ABBREVIATION_SUGGESTIONS = {
    mtg: "meeting",
    mins: "minutes",
    wk: "week",
    wks: "weeks",
    dept: "department",
    proj: "project",
    req: "requirement",
    approx: "approximately",
};
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parsePeople = (value) => String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const hasMatchingSuggestion = (settings, type, sourceValue, suggestedValue) => settings.ruleSuggestions.some((entry) => entry.type === type
    && entry.sourceValue.toLocaleLowerCase() === sourceValue.toLocaleLowerCase()
    && entry.suggestedValue.toLocaleLowerCase() === suggestedValue.toLocaleLowerCase()
    && (entry.status === "accepted" || entry.ignoreForever));
export const collectRuleSuggestionObservations = (session, settings, sourceText) => {
    const observations = [];
    const normalizedSourceText = String(sourceText || "");
    if (!normalizedSourceText.trim()) {
        return observations;
    }
    const knownAbbreviations = new Set(settings.abbreviations.map((entry) => entry.shortForm.toLocaleLowerCase()));
    Object.entries(SAFE_ABBREVIATION_SUGGESTIONS).forEach(([shortForm, fullForm]) => {
        if (knownAbbreviations.has(shortForm)) {
            return;
        }
        if (hasMatchingSuggestion(settings, "abbreviation", shortForm, fullForm)) {
            return;
        }
        const pattern = new RegExp(`\\b${escapeRegExp(shortForm)}\\b`, "i");
        if (pattern.test(normalizedSourceText)) {
            observations.push({
                type: "abbreviation",
                sourceValue: shortForm,
                suggestedValue: fullForm,
                confidence: 0.86,
            });
        }
    });
    const existingPreferredNames = new Set(settings.preferredParticipantNames.map((entry) => `${entry.shortForm.toLocaleLowerCase()}::${entry.fullName.toLocaleLowerCase()}`));
    const sessionPeople = parsePeople(session.participantText);
    const uniqueFirstNames = new Map();
    const ambiguousFirstNames = new Set();
    sessionPeople.forEach((fullName) => {
        const firstName = fullName.split(/\s+/)[0]?.trim();
        if (!firstName || firstName.toLocaleLowerCase() === fullName.toLocaleLowerCase()) {
            return;
        }
        const key = firstName.toLocaleLowerCase();
        if (uniqueFirstNames.has(key) && uniqueFirstNames.get(key) !== fullName) {
            ambiguousFirstNames.add(key);
            uniqueFirstNames.delete(key);
            return;
        }
        if (!ambiguousFirstNames.has(key)) {
            uniqueFirstNames.set(key, fullName);
        }
    });
    uniqueFirstNames.forEach((fullName, firstNameKey) => {
        if (existingPreferredNames.has(`${firstNameKey}::${fullName.toLocaleLowerCase()}`)) {
            return;
        }
        const firstName = fullName.split(/\s+/)[0];
        if (hasMatchingSuggestion(settings, "preferred_name", firstName, fullName)) {
            return;
        }
        const pattern = new RegExp(`\\b${escapeRegExp(firstName)}\\b`, "i");
        if (pattern.test(normalizedSourceText)) {
            observations.push({
                type: "preferred_name",
                sourceValue: firstName,
                suggestedValue: fullName,
                confidence: 0.83,
            });
        }
    });
    return observations;
};
export const mergeRuleSuggestionObservations = (settings, sessionId, observations) => {
    if (!observations.length) {
        return { nextSettings: settings, visibleSuggestions: settings.ruleSuggestions.filter((entry) => entry.status === "pending" && !entry.ignoreForever && entry.evidenceCount >= 2) };
    }
    const nextSuggestions = [...settings.ruleSuggestions];
    const now = new Date().toISOString();
    observations.forEach((observation) => {
        const existingIndex = nextSuggestions.findIndex((entry) => entry.type === observation.type
            && entry.sourceValue.toLocaleLowerCase() === observation.sourceValue.toLocaleLowerCase()
            && entry.suggestedValue.toLocaleLowerCase() === observation.suggestedValue.toLocaleLowerCase());
        if (existingIndex >= 0) {
            const existing = nextSuggestions[existingIndex];
            if (existing.ignoreForever || existing.status === "accepted") {
                return;
            }
            if (existing.observedSessionIds.includes(sessionId)) {
                return;
            }
            nextSuggestions[existingIndex] = {
                ...existing,
                evidenceCount: existing.evidenceCount + 1,
                confidence: Math.max(existing.confidence, observation.confidence),
                observedSessionIds: [...existing.observedSessionIds, sessionId],
                updatedAt: now,
            };
            return;
        }
        nextSuggestions.push({
            id: crypto.randomUUID(),
            type: observation.type,
            sourceValue: observation.sourceValue,
            suggestedValue: observation.suggestedValue,
            evidenceCount: 1,
            confidence: observation.confidence,
            status: "pending",
            ignoreForever: false,
            observedSessionIds: [sessionId],
            createdAt: now,
            updatedAt: now,
        });
    });
    const nextSettings = {
        ...settings,
        ruleSuggestions: nextSuggestions,
    };
    return {
        nextSettings,
        visibleSuggestions: nextSuggestions.filter((entry) => entry.status === "pending" && !entry.ignoreForever && entry.evidenceCount >= 2),
    };
};
export const acceptRuleSuggestion = (settings, suggestionId) => {
    const suggestion = settings.ruleSuggestions.find((entry) => entry.id === suggestionId);
    if (!suggestion) {
        return settings;
    }
    const updatedAt = new Date().toISOString();
    const nextSettings = {
        ...settings,
        abbreviations: [...settings.abbreviations],
        preferredParticipantNames: [...settings.preferredParticipantNames],
        ruleSuggestions: settings.ruleSuggestions.map((entry) => entry.id === suggestionId
            ? { ...entry, status: "accepted", ignoreForever: false, updatedAt }
            : entry),
    };
    if (suggestion.type === "abbreviation") {
        const exists = nextSettings.abbreviations.some((entry) => entry.shortForm.toLocaleLowerCase() === suggestion.sourceValue.toLocaleLowerCase());
        if (!exists) {
            nextSettings.abbreviations = [
                ...nextSettings.abbreviations,
                {
                    id: crypto.randomUUID(),
                    shortForm: suggestion.sourceValue,
                    fullForm: suggestion.suggestedValue,
                },
            ].sort((left, right) => left.shortForm.localeCompare(right.shortForm, undefined, { sensitivity: "base" }));
        }
    }
    if (suggestion.type === "preferred_name") {
        const exists = nextSettings.preferredParticipantNames.some((entry) => entry.shortForm.toLocaleLowerCase() === suggestion.sourceValue.toLocaleLowerCase()
            && entry.fullName.toLocaleLowerCase() === suggestion.suggestedValue.toLocaleLowerCase());
        if (!exists) {
            nextSettings.preferredParticipantNames = [
                ...nextSettings.preferredParticipantNames,
                {
                    id: crypto.randomUUID(),
                    shortForm: suggestion.sourceValue,
                    fullName: suggestion.suggestedValue,
                },
            ].sort((left, right) => left.shortForm.localeCompare(right.shortForm, undefined, { sensitivity: "base" }));
        }
    }
    return nextSettings;
};
export const ignoreRuleSuggestion = (settings, suggestionId, { forever = true } = {}) => ({
    ...settings,
    ruleSuggestions: settings.ruleSuggestions.map((entry) => entry.id === suggestionId
        ? {
            ...entry,
            status: "ignored",
            ignoreForever: forever,
            updatedAt: new Date().toISOString(),
        }
        : entry),
});
export const restoreIgnoredRuleSuggestion = (settings, suggestionId) => ({
    ...settings,
    ruleSuggestions: settings.ruleSuggestions.map((entry) => entry.id === suggestionId
        ? {
            ...entry,
            status: "pending",
            ignoreForever: false,
            updatedAt: new Date().toISOString(),
        }
        : entry),
});

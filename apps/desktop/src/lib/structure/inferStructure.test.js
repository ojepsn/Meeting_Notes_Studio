import { inferStructureFromTitle, upsertStructureInferenceRule } from "./inferStructure";
describe("inferStructure", () => {
    it("uses a learned exact-title rule before fuzzy historical matching", () => {
        const rules = upsertStructureInferenceRule([], "Monthly time reporting staff", "todo", {
            domain: "Operations",
            project: "HR",
            activity: "Time reporting",
        }, "2026-05-18T08:00:00.000Z");
        const inferred = inferStructureFromTitle({
            todos: [
                {
                    id: "todo-1",
                    description: "Monthly time reporting",
                    participantText: "",
                    isDone: false,
                    completedAt: null,
                    isPrivate: false,
                    isPriority: false,
                    comments: "",
                    activityId: "",
                    domain: "Clinical",
                    project: "Abundly",
                    activity: "Administration",
                    doOn: "",
                    dueDate: "",
                    detailsHtml: "",
                    createdAt: "2026-05-01T08:00:00.000Z",
                    updatedAt: "2026-05-01T08:00:00.000Z",
                    sessionIds: [],
                },
            ],
            activities: [],
            sessions: [],
            settings: {
                structureInferenceRules: rules,
            },
        }, "Monthly time reporting staff", "todo");
        expect(inferred).toEqual({
            domain: "Operations",
            project: "HR",
            activity: "Time reporting",
        });
    });
    it("updates an existing learned rule when the user corrects the structure", () => {
        const initialRules = upsertStructureInferenceRule([], "CS meeting", "meeting", {
            domain: "Commercial",
            project: "Legacy Project",
            activity: "CS meeting",
        }, "2026-05-18T08:00:00.000Z");
        const correctedRules = upsertStructureInferenceRule(initialRules, "CS meeting", "meeting", {
            domain: "Commercial",
            project: "Clinical Success",
            activity: "CS meeting",
        }, "2026-05-18T09:00:00.000Z");
        expect(correctedRules).toHaveLength(1);
        expect(correctedRules[0]).toMatchObject({
            kind: "meeting",
            title: "CS meeting",
            normalizedTitle: "cs meeting",
            domain: "Commercial",
            project: "Clinical Success",
            activity: "CS meeting",
            evidenceCount: 2,
        });
    });
    it("falls back across kinds for an exact learned title when no same-kind rule exists", () => {
        const rules = upsertStructureInferenceRule([], "Protocol finalisation", "activity", {
            domain: "Clinical",
            project: "Study A",
            activity: "Protocol finalisation",
        }, "2026-05-18T08:00:00.000Z");
        const inferred = inferStructureFromTitle({
            todos: [],
            activities: [],
            sessions: [],
            settings: {
                structureInferenceRules: rules,
            },
        }, "Protocol finalisation", "meeting");
        expect(inferred).toEqual({
            domain: "Clinical",
            project: "Study A",
            activity: "Protocol finalisation",
        });
    });
});

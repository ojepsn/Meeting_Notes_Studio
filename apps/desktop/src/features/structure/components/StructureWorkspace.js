import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
const CHECKLIST_RECURRENCE_OPTIONS = [
    { value: "monthly", label: "Monthly" },
    { value: "weekly", label: "Weekly" },
];
const formatMinutes = (minutes) => {
    if (!minutes)
        return "0m";
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours)
        return `${rest}m`;
    if (!rest)
        return `${hours}h`;
    return `${hours}h ${rest}m`;
};
const getIsoWeekLabel = (value) => {
    const nextValue = new Date(value);
    nextValue.setHours(0, 0, 0, 0);
    nextValue.setDate(nextValue.getDate() + 3 - ((nextValue.getDay() + 6) % 7));
    const isoYear = nextValue.getFullYear();
    const weekOne = new Date(isoYear, 0, 4);
    const weekOneDay = (weekOne.getDay() + 6) % 7;
    weekOne.setDate(weekOne.getDate() - weekOneDay);
    const isoWeek = Math.round((nextValue.getTime() - weekOne.getTime()) / 604800000) + 1;
    return `${isoYear}-W${`${isoWeek}`.padStart(2, "0")}`;
};
const formatChecklistRecurrenceLabel = (cadence) => cadence === "weekly" ? "Weekly" : "Monthly";
const formatNextChecklistDueLabel = (cadence, value = new Date()) => {
    const nextValue = new Date(value);
    if (cadence === "weekly") {
        nextValue.setDate(nextValue.getDate() + 7);
        return `Next due ${getIsoWeekLabel(nextValue)}`;
    }
    nextValue.setMonth(nextValue.getMonth() + 1, 1);
    return `Next due ${nextValue.getFullYear()}-${`${nextValue.getMonth() + 1}`.padStart(2, "0")}`;
};
const formatLastCreatedChecklistLabel = (checklist) => checklist?.title ? `Last created ${checklist.title}` : "Not created yet";
export const StructureWorkspace = ({ activities, todos, checklists, checklistTemplates, checklistRecurrences, timeLogs, savedDomains, savedProjects, projectLinks, onAddDomain, onRenameDomain, onAddProject, onAddActivityToProject, onCreateProjectChecklist, onCreateProjectChecklistFromTemplate, onCreateProjectChecklistRecurrence, onSaveChecklist, onDeleteChecklist, onCreateChecklistTemplate, onSaveChecklistTemplate, onDeleteChecklistTemplate, onDeleteChecklistRecurrence, onRenameProject, onAssignProjectDomain, onOpenTodosForDomain, onOpenTodosForProject, onOpenTimeForDomain, onOpenTimeForProject, onOpenActivityDetail, onOpenTodoDetail, }) => {
    const [domainDraft, setDomainDraft] = useState("");
    const [projectDraft, setProjectDraft] = useState("");
    const [projectDomainDraft, setProjectDomainDraft] = useState("");
    const [editingDomain, setEditingDomain] = useState(null);
    const [editingDomainDraft, setEditingDomainDraft] = useState("");
    const [editingProject, setEditingProject] = useState(null);
    const [editingProjectDraft, setEditingProjectDraft] = useState("");
    const [editingProjectDomainDraft, setEditingProjectDomainDraft] = useState("");
    const [addingActivityToProject, setAddingActivityToProject] = useState(null);
    const [projectActivityDraft, setProjectActivityDraft] = useState("");
    const [projectActivityTypeDraft, setProjectActivityTypeDraft] = useState("task");
    const [addingChecklistToProject, setAddingChecklistToProject] = useState(null);
    const [projectChecklistDraft, setProjectChecklistDraft] = useState("");
    const [projectChecklistTemplateId, setProjectChecklistTemplateId] = useState("");
    const [projectChecklistRecurrenceCadence, setProjectChecklistRecurrenceCadence] = useState("monthly");
    const [checklistTemplateCategoryDraft, setChecklistTemplateCategoryDraft] = useState("General");
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [editingTemplateTitle, setEditingTemplateTitle] = useState("");
    const [editingTemplateCategory, setEditingTemplateCategory] = useState("General");
    const [checklistItemDrafts, setChecklistItemDrafts] = useState({});
    const [focus, setFocus] = useState(null);
    const projectDomainLookup = useMemo(() => Object.fromEntries(projectLinks.filter((entry) => entry.project).map((entry) => [entry.project, entry.domain])), [projectLinks]);
    const allDomains = useMemo(() => Array.from(new Set([...savedDomains, ...activities.map((activity) => activity.domain), ...todos.map((todo) => todo.domain)]
        .map((entry) => entry.trim())
        .filter(Boolean))).sort((left, right) => left.localeCompare(right)), [activities, savedDomains, todos]);
    const allProjects = useMemo(() => Array.from(new Set([...savedProjects, ...activities.map((activity) => activity.project), ...todos.map((todo) => todo.project)]
        .map((entry) => entry.trim())
        .filter(Boolean))).sort((left, right) => left.localeCompare(right)), [activities, savedProjects, todos]);
    const timeLogMinutesByActivityId = useMemo(() => {
        const grouped = new Map();
        timeLogs
            .filter((entry) => entry.targetType === "activity")
            .forEach((entry) => grouped.set(entry.targetId, (grouped.get(entry.targetId) || 0) + entry.durationMinutes));
        return grouped;
    }, [timeLogs]);
    const timeLogMinutesByTodoId = useMemo(() => {
        const grouped = new Map();
        timeLogs
            .filter((entry) => entry.targetType === "todo")
            .forEach((entry) => grouped.set(entry.targetId, (grouped.get(entry.targetId) || 0) + entry.durationMinutes));
        return grouped;
    }, [timeLogs]);
    const domainRows = useMemo(() => {
        const groups = new Map();
        const ensure = (label) => {
            const key = label || "No domain";
            if (!groups.has(key)) {
                groups.set(key, { activities: 0, todos: 0, minutes: 0, preview: { activities: [], todos: [] } });
            }
            return groups.get(key);
        };
        allDomains.forEach((label) => ensure(label));
        activities.forEach((activity) => {
            const entry = ensure(projectDomainLookup[activity.project || ""] || activity.domain || "No domain");
            entry.activities += 1;
            if (entry.preview.activities.length < 3) {
                entry.preview.activities.push(activity);
            }
            entry.minutes += timeLogMinutesByActivityId.get(activity.id) || 0;
        });
        todos.forEach((todo) => {
            const entry = ensure(projectDomainLookup[todo.project || ""] || todo.domain || "No domain");
            entry.todos += 1;
            if (entry.preview.todos.length < 3) {
                entry.preview.todos.push(todo);
            }
            entry.minutes += timeLogMinutesByTodoId.get(todo.id) || 0;
        });
        return Array.from(groups.entries())
            .map(([label, values]) => ({ label, ...values }))
            .sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
    }, [activities, allDomains, projectDomainLookup, timeLogMinutesByActivityId, timeLogMinutesByTodoId, todos]);
    const projectRows = useMemo(() => {
        const groups = new Map();
        const ensure = (label) => {
            const key = label || "No project";
            if (!groups.has(key)) {
                groups.set(key, { activities: 0, todos: 0, minutes: 0, domain: "", preview: { activities: [], todos: [] } });
            }
            return groups.get(key);
        };
        allProjects.forEach((label) => ensure(label));
        projectLinks.forEach((link) => {
            const entry = ensure(link.project || "No project");
            entry.domain ||= link.domain || "";
        });
        activities.forEach((activity) => {
            const entry = ensure(activity.project || "No project");
            entry.activities += 1;
            entry.domain ||= projectDomainLookup[activity.project || ""] || activity.domain || "";
            if (entry.preview.activities.length < 3) {
                entry.preview.activities.push(activity);
            }
            entry.minutes += timeLogMinutesByActivityId.get(activity.id) || 0;
        });
        todos.forEach((todo) => {
            const entry = ensure(todo.project || "No project");
            entry.todos += 1;
            entry.domain ||= projectDomainLookup[todo.project || ""] || todo.domain || "";
            if (entry.preview.todos.length < 3) {
                entry.preview.todos.push(todo);
            }
            entry.minutes += timeLogMinutesByTodoId.get(todo.id) || 0;
        });
        return Array.from(groups.entries())
            .map(([label, values]) => ({ label, ...values }))
            .sort((left, right) => right.minutes - left.minutes || left.label.localeCompare(right.label));
    }, [activities, allProjects, projectDomainLookup, projectLinks, timeLogMinutesByActivityId, timeLogMinutesByTodoId, todos]);
    const submitDomain = () => {
        const next = domainDraft.trim();
        if (!next)
            return;
        onAddDomain(next);
        setDomainDraft("");
    };
    const submitProject = () => {
        const next = projectDraft.trim();
        if (!next)
            return;
        onAddProject(next, projectDomainDraft.trim());
        setProjectDraft("");
        setProjectDomainDraft("");
    };
    const submitProjectActivity = (project, domain) => {
        const next = projectActivityDraft.trim();
        if (!next)
            return;
        onAddActivityToProject(next, project, domain, projectActivityTypeDraft);
        setAddingActivityToProject(null);
        setProjectActivityDraft("");
        setProjectActivityTypeDraft("task");
        setFocus({ kind: "project", label: project || "No project" });
    };
    const submitProjectChecklist = (project) => {
        const next = projectChecklistDraft.trim();
        if (!next)
            return;
        onCreateProjectChecklist(project, next);
        setAddingChecklistToProject(null);
        setProjectChecklistDraft("");
    };
    const setChecklistItemDraft = (checklistId, value) => setChecklistItemDrafts((current) => ({ ...current, [checklistId]: value }));
    const saveChecklistItems = (checklist, items) => {
        onSaveChecklist({
            ...checklist,
            items,
            updatedAt: new Date().toISOString(),
        });
    };
    const toggleChecklistItem = (checklist, itemId) => {
        const timestamp = new Date().toISOString();
        saveChecklistItems(checklist, checklist.items.map((item) => item.id === itemId
            ? {
                ...item,
                isChecked: !item.isChecked,
                checkedAt: item.isChecked ? null : timestamp,
            }
            : item));
    };
    const addChecklistItem = (checklist) => {
        const nextLabel = (checklistItemDrafts[checklist.id] || "").trim();
        if (!nextLabel)
            return;
        saveChecklistItems(checklist, [
            ...checklist.items,
            {
                id: crypto.randomUUID(),
                label: nextLabel,
                isChecked: false,
                notes: "",
                position: checklist.items.length + 1,
                checkedAt: null,
            },
        ]);
        setChecklistItemDraft(checklist.id, "");
    };
    const deleteChecklistItem = (checklist, itemId) => {
        saveChecklistItems(checklist, checklist.items
            .filter((item) => item.id !== itemId)
            .map((item, index) => ({ ...item, position: index + 1 })));
    };
    const moveChecklistItem = (checklist, itemId, direction) => {
        const currentIndex = checklist.items.findIndex((item) => item.id === itemId);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= checklist.items.length)
            return;
        const nextItems = [...checklist.items];
        const [moved] = nextItems.splice(currentIndex, 1);
        nextItems.splice(nextIndex, 0, moved);
        saveChecklistItems(checklist, nextItems.map((item, index) => ({ ...item, position: index + 1 })));
    };
    const resetChecklist = (checklist) => {
        saveChecklistItems(checklist, checklist.items.map((item, index) => ({
            ...item,
            isChecked: false,
            checkedAt: null,
            position: index + 1,
        })));
    };
    const duplicateChecklist = (checklist) => {
        onSaveChecklist({
            ...checklist,
            id: crypto.randomUUID(),
            title: `${checklist.title} copy`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: checklist.items.map((item, index) => ({
                ...item,
                id: crypto.randomUUID(),
                isChecked: false,
                checkedAt: null,
                position: index + 1,
            })),
        });
    };
    const saveChecklistAsTemplate = (checklist) => {
        onCreateChecklistTemplate(checklist.title, checklistTemplateCategoryDraft, checklist.items.map((item, index) => ({
            ...item,
            id: crypto.randomUUID(),
            isChecked: false,
            checkedAt: null,
            position: index + 1,
        })));
    };
    const templateCategories = useMemo(() => Array.from(new Set(checklistTemplates
        .map((template) => template.category?.trim() || "General")
        .filter(Boolean)
        .concat(["General", "Monthly", "Weekly", "People", "Compliance"]))).sort((left, right) => left.localeCompare(right)), [checklistTemplates]);
    const templatesByCategory = useMemo(() => {
        const grouped = new Map();
        checklistTemplates.forEach((template) => {
            const category = template.category?.trim() || "General";
            grouped.set(category, [...(grouped.get(category) || []), template]);
        });
        return Array.from(grouped.entries()).sort((left, right) => left[0].localeCompare(right[0]));
    }, [checklistTemplates]);
    const beginTemplateEdit = (template) => {
        setEditingTemplateId(template.id);
        setEditingTemplateTitle(template.title);
        setEditingTemplateCategory(template.category?.trim() || "General");
    };
    const cancelTemplateEdit = () => {
        setEditingTemplateId(null);
        setEditingTemplateTitle("");
        setEditingTemplateCategory("General");
    };
    const commitTemplateEdit = (template) => {
        const nextTitle = editingTemplateTitle.trim();
        if (!nextTitle)
            return;
        onSaveChecklistTemplate({
            ...template,
            title: nextTitle,
            category: editingTemplateCategory.trim() || "General",
            updatedAt: new Date().toISOString(),
        });
        cancelTemplateEdit();
    };
    const focusedActivities = useMemo(() => {
        if (!focus)
            return [];
        return activities.filter((activity) => {
            if (focus.kind === "project") {
                return (activity.project || "No project") === focus.label;
            }
            return (projectDomainLookup[activity.project || ""] || activity.domain || "No domain") === focus.label;
        });
    }, [activities, focus, projectDomainLookup]);
    const focusedTodos = useMemo(() => {
        if (!focus)
            return [];
        return todos.filter((todo) => {
            if (focus.kind === "project") {
                return (todo.project || "No project") === focus.label;
            }
            return (projectDomainLookup[todo.project || ""] || todo.domain || "No domain") === focus.label;
        });
    }, [focus, projectDomainLookup, todos]);
    const focusedMinutes = useMemo(() => focusedActivities.reduce((sum, activity) => sum + (timeLogMinutesByActivityId.get(activity.id) || 0), 0) +
        focusedTodos.reduce((sum, todo) => sum + (timeLogMinutesByTodoId.get(todo.id) || 0), 0), [focusedActivities, focusedTodos, timeLogMinutesByActivityId, timeLogMinutesByTodoId]);
    return (_jsxs("div", { className: "card todos-workspace todos-workspace-minimal structure-workspace-card", children: [_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsxs("div", { children: [_jsx("h2", { children: "Structure" }), _jsx("p", { className: "muted", children: "Create and organize domains, projects, and project-owned activities here. Structure is now the home for this layer of the app." })] }) }), _jsxs("div", { className: "structure-creation-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "New domain" }), _jsx("p", { className: "muted", children: "Use this for slower, deliberate structure work. Settings still remains the fallback admin home." })] }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "structure-domain-draft", children: "Domain" }), _jsx("input", { id: "structure-domain-draft", value: domainDraft, onChange: (event) => setDomainDraft(event.target.value), onKeyDown: (event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        submitDomain();
                                                    }
                                                }, placeholder: "Add a new domain" })] }), _jsx("button", { className: "primary-button", type: "button", onClick: submitDomain, children: "Add" })] })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "New project" }), _jsx("p", { className: "muted", children: "Projects can be set up here, then reused quickly in Notes, Calendar, Tasks, and Timelogs." })] }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "structure-project-draft", children: "Project" }), _jsx("input", { id: "structure-project-draft", value: projectDraft, onChange: (event) => setProjectDraft(event.target.value), onKeyDown: (event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        submitProject();
                                                    }
                                                }, placeholder: "Add a new project" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "structure-project-domain", children: "Domain" }), _jsxs("select", { id: "structure-project-domain", value: projectDomainDraft, onChange: (event) => setProjectDomainDraft(event.target.value), children: [_jsx("option", { value: "", children: "No domain" }), allDomains.map((domain) => (_jsx("option", { value: domain, children: domain }, domain)))] })] }), _jsx("button", { className: "primary-button", type: "button", onClick: submitProject, children: "Add" })] })] })] }), focus ? (_jsxs("div", { className: "sidebar-card structure-focus-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsxs("h3", { children: [focus.kind === "domain" ? "Domain focus" : "Project focus", ": ", focus.label] }), _jsx("p", { className: "muted", children: "Inspect the linked work here before drilling further into Tasks or Time." })] }), _jsxs("div", { className: "page-actions", children: [_jsxs("span", { className: "status-chip", children: [focusedActivities.length, " activities"] }), _jsxs("span", { className: "status-chip", children: [focusedTodos.length, " todos"] }), _jsx("span", { className: "status-chip", children: formatMinutes(focusedMinutes) }), _jsx("button", { className: "small-button", type: "button", onClick: () => setFocus(null), children: "Clear focus" })] })] }), _jsxs("div", { className: "structure-focus-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("h4", { children: "Linked activities" }), _jsx("div", { className: "section-list", children: focusedActivities.length ? (focusedActivities.map((activity) => (_jsxs("button", { className: "list-item list-item-button", type: "button", onClick: () => onOpenActivityDetail(activity.id), children: [_jsxs("div", { children: [_jsx("strong", { children: activity.description }), _jsxs("div", { className: "tiny-text", children: [activity.project || activity.domain || "No project", " - ", activity.type] })] }), _jsx("span", { children: formatMinutes(timeLogMinutesByActivityId.get(activity.id) || 0) })] }, activity.id)))) : (_jsx("p", { className: "muted", children: "No linked activities yet." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h4", { children: "Linked todos" }), _jsx("div", { className: "section-list", children: focusedTodos.length ? (focusedTodos.map((todo) => (_jsxs("button", { className: "list-item list-item-button", type: "button", onClick: () => onOpenTodoDetail(todo.id), children: [_jsxs("div", { children: [_jsx("strong", { children: todo.description }), _jsxs("div", { className: "tiny-text", children: [todo.project || todo.domain || "No project", todo.activity ? ` - ${todo.activity}` : ""] })] }), _jsx("span", { children: formatMinutes(timeLogMinutesByTodoId.get(todo.id) || 0) })] }, todo.id)))) : (_jsx("p", { className: "muted", children: "No linked todos yet." })) })] })] })] })) : null, _jsxs("div", { className: "time-workspace-layout", children: [_jsx("section", { className: "time-workspace-main", children: _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Domains" }), _jsx("p", { className: "muted", children: "Top-level business areas with linked work inline." })] }) }), _jsx("div", { className: "time-log-table", children: domainRows.map((row) => {
                                        const domain = row.label === "No domain" ? "" : row.label;
                                        const isEditing = editingDomain === row.label;
                                        return (_jsxs("div", { className: "structure-card", children: [_jsxs("div", { className: "structure-row", children: [_jsx("div", { className: "structure-main", children: isEditing ? (_jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: `structure-domain-edit-${row.label}`, children: "Rename domain" }), _jsx("input", { id: `structure-domain-edit-${row.label}`, value: editingDomainDraft, onChange: (event) => setEditingDomainDraft(event.target.value) })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                            onRenameDomain(row.label, editingDomainDraft);
                                                                            setEditingDomain(null);
                                                                            setEditingDomainDraft("");
                                                                        }, children: "Save" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                            setEditingDomain(null);
                                                                            setEditingDomainDraft("");
                                                                        }, children: "Cancel" })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: row.label }), _jsxs("div", { className: "tiny-text", children: [row.activities, " activities - ", row.todos, " tasks - ", formatMinutes(row.minutes)] })] })) }), !isEditing ? (_jsxs("div", { className: "page-actions", children: [domain ? (_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        setEditingDomain(row.label);
                                                                        setEditingDomainDraft(row.label);
                                                                    }, children: "Edit" })) : null, _jsx("button", { className: "small-button", type: "button", onClick: () => setFocus({ kind: "domain", label: row.label }), children: "Inspect" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenTodosForDomain(domain), children: "Tasks" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenTimeForDomain(domain), children: "Time" })] })) : null] }), _jsxs("div", { className: "structure-preview-row", children: [row.preview.activities.length ? (_jsxs("div", { className: "structure-preview-group", children: [_jsx("span", { className: "tiny-text", children: "Activities" }), _jsx("div", { className: "structure-preview-chips", children: row.preview.activities.map((activity) => (_jsx("button", { className: "status-chip status-chip-button", type: "button", onClick: () => onOpenActivityDetail(activity.id), children: activity.description }, activity.id))) })] })) : null, row.preview.todos.length ? (_jsxs("div", { className: "structure-preview-group", children: [_jsx("span", { className: "tiny-text", children: "Tasks" }), _jsx("div", { className: "structure-preview-chips", children: row.preview.todos.map((todo) => (_jsx("button", { className: "status-chip status-chip-button", type: "button", onClick: () => onOpenTodoDetail(todo.id), children: todo.description }, todo.id))) })] })) : null] })] }, row.label));
                                    }) })] }) }), _jsx("aside", { className: "time-workspace-detail", children: _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Projects" }), _jsx("p", { className: "muted", children: "This is the authoritative place to create activities inside projects and connect them to the rest of the app." })] }) }), _jsxs("details", { className: "workspace-disclosure", children: [_jsx("summary", { children: "Checklist templates" }), _jsx("div", { className: "workspace-disclosure-body stack", children: templatesByCategory.length ? (_jsx("div", { className: "structure-checklist-list", children: templatesByCategory.map(([category, templates]) => (_jsxs("details", { className: "structure-checklist-card", open: true, children: [_jsxs("summary", { children: [_jsx("span", { children: category }), _jsxs("span", { className: "tiny-text", children: [templates.length, " templates"] })] }), _jsx("div", { className: "structure-checklist-body", children: templates.map((template) => (_jsx("div", { className: "structure-checklist-card", children: _jsx("div", { className: "structure-checklist-body", children: editingTemplateId === template.id ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: `structure-template-title-${template.id}`, children: "Template title" }), _jsx("input", { id: `structure-template-title-${template.id}`, value: editingTemplateTitle, onChange: (event) => setEditingTemplateTitle(event.target.value) })] }), _jsxs("div", { className: "field structure-template-category-field", children: [_jsx("label", { htmlFor: `structure-template-category-edit-${template.id}`, children: "Category" }), _jsx("select", { id: `structure-template-category-edit-${template.id}`, value: editingTemplateCategory, onChange: (event) => setEditingTemplateCategory(event.target.value), children: templateCategories.map((categoryOption) => (_jsx("option", { value: categoryOption, children: categoryOption }, categoryOption))) })] })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => commitTemplateEdit(template), children: "Save" }), _jsx("button", { className: "small-button", type: "button", onClick: cancelTemplateEdit, children: "Cancel" })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "structure-checklist-header", children: [_jsx("strong", { children: template.title }), _jsxs("span", { className: "tiny-text", children: [template.items.length, " items"] })] }), _jsx("p", { className: "muted", children: template.items.map((item) => item.label).slice(0, 3).join(", ") || "No template items yet." }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => beginTemplateEdit(template), children: "Edit" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDeleteChecklistTemplate(template.id), children: "Delete template" })] })] })) }) }, template.id))) })] }, category))) })) : (_jsx("p", { className: "muted", children: "No checklist templates yet. Save a project or task checklist as a template to reuse it later. Reused templates create fresh checklist names with the current YYYY-MM." })) })] }), _jsx("div", { className: "time-log-table", children: projectRows.map((row) => {
                                        const project = row.label === "No project" ? "" : row.label;
                                        const isEditing = editingProject === row.label;
                                        const projectChecklists = checklists
                                            .filter((checklist) => checklist.ownerType === "project" && checklist.ownerId === project)
                                            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
                                        const projectChecklistRecurrences = checklistRecurrences
                                            .filter((rule) => rule.ownerType === "project" && rule.ownerId === project)
                                            .sort((left, right) => left.cadence.localeCompare(right.cadence) || right.updatedAt.localeCompare(left.updatedAt));
                                        return (_jsxs("div", { className: "structure-card", children: [_jsxs("div", { className: "structure-row", children: [_jsx("div", { className: "structure-main", children: isEditing ? (_jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: `structure-project-edit-${row.label}`, children: "Rename project" }), _jsx("input", { id: `structure-project-edit-${row.label}`, value: editingProjectDraft, onChange: (event) => setEditingProjectDraft(event.target.value) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `structure-project-domain-${row.label}`, children: "Domain" }), _jsxs("select", { id: `structure-project-domain-${row.label}`, value: editingProjectDomainDraft, onChange: (event) => setEditingProjectDomainDraft(event.target.value), children: [_jsx("option", { value: "", children: "No domain" }), allDomains.map((domain) => (_jsx("option", { value: domain, children: domain }, domain)))] })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                            onRenameProject(row.label, editingProjectDraft);
                                                                            onAssignProjectDomain(editingProjectDraft.trim() || row.label, editingProjectDomainDraft.trim());
                                                                            setEditingProject(null);
                                                                            setEditingProjectDraft("");
                                                                            setEditingProjectDomainDraft("");
                                                                        }, children: "Save" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                            setEditingProject(null);
                                                                            setEditingProjectDraft("");
                                                                            setEditingProjectDomainDraft("");
                                                                        }, children: "Cancel" })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: row.label }), _jsxs("div", { className: "tiny-text", children: [row.domain || "No domain", " - ", row.activities, " activities - ", row.todos, " tasks - ", formatMinutes(row.minutes)] })] })) }), !isEditing ? (_jsxs("div", { className: "page-actions", children: [project ? (_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        setAddingChecklistToProject((current) => (current === row.label ? null : row.label));
                                                                        setProjectChecklistDraft("");
                                                                        setProjectChecklistTemplateId("");
                                                                        setProjectChecklistRecurrenceCadence("monthly");
                                                                    }, children: addingChecklistToProject === row.label ? "Close checklist" : "New checklist" })) : null, project ? (_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        setAddingActivityToProject((current) => (current === row.label ? null : row.label));
                                                                        setProjectActivityDraft("");
                                                                        setProjectActivityTypeDraft("task");
                                                                    }, children: addingActivityToProject === row.label ? "Close new activity" : "New activity" })) : null, project ? (_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        setEditingProject(row.label);
                                                                        setEditingProjectDraft(row.label);
                                                                        setEditingProjectDomainDraft(projectDomainLookup[row.label] || row.domain || "");
                                                                    }, children: "Edit" })) : null, _jsx("button", { className: "small-button", type: "button", onClick: () => setFocus({ kind: "project", label: row.label }), children: "Inspect" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenTodosForProject(project), children: "Tasks" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenTimeForProject(project), children: "Time" })] })) : null] }), addingActivityToProject === row.label ? (_jsxs("div", { className: "todos-workspace-input-row structure-inline-create-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `structure-project-activity-type-${row.label}`, children: "Type" }), _jsxs("select", { id: `structure-project-activity-type-${row.label}`, value: projectActivityTypeDraft, onChange: (event) => setProjectActivityTypeDraft(event.target.value === "meeting" ? "meeting" : "task"), children: [_jsx("option", { value: "task", children: "Task" }), _jsx("option", { value: "meeting", children: "Meeting" })] })] }), _jsxs("div", { className: "field field-wide", children: [_jsxs("label", { htmlFor: `structure-project-activity-draft-${row.label}`, children: ["New activity in ", row.label] }), _jsx("input", { id: `structure-project-activity-draft-${row.label}`, value: projectActivityDraft, onChange: (event) => setProjectActivityDraft(event.target.value), onKeyDown: (event) => {
                                                                        if (event.key === "Enter" && !event.shiftKey) {
                                                                            event.preventDefault();
                                                                            submitProjectActivity(project, row.domain || "");
                                                                        }
                                                                    }, placeholder: projectActivityTypeDraft === "meeting" ? "Add a meeting activity inside this project" : "Add an activity inside this project" })] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => submitProjectActivity(project, row.domain || ""), children: "Add" })] })) : null, addingChecklistToProject === row.label ? (_jsxs("div", { className: "todos-workspace-input-row structure-inline-create-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsxs("label", { htmlFor: `structure-project-checklist-draft-${row.label}`, children: ["New checklist in ", row.label] }), _jsx("input", { id: `structure-project-checklist-draft-${row.label}`, value: projectChecklistDraft, onChange: (event) => setProjectChecklistDraft(event.target.value), onKeyDown: (event) => {
                                                                        if (event.key === "Enter" && !event.shiftKey) {
                                                                            event.preventDefault();
                                                                            submitProjectChecklist(project);
                                                                        }
                                                                    }, placeholder: "For example: Monthly reporting staff" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `structure-project-checklist-template-${row.label}`, children: "Template" }), _jsxs("select", { id: `structure-project-checklist-template-${row.label}`, value: projectChecklistTemplateId, onChange: (event) => setProjectChecklistTemplateId(event.target.value), children: [_jsx("option", { value: "", children: "No template" }), checklistTemplates.map((template) => (_jsx("option", { value: template.id, children: `${template.category || "General"} - ${template.title}` }, template.id)))] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `structure-project-checklist-recurrence-${row.label}`, children: "Recurring" }), _jsx("select", { id: `structure-project-checklist-recurrence-${row.label}`, value: projectChecklistRecurrenceCadence, onChange: (event) => setProjectChecklistRecurrenceCadence(event.target.value), children: CHECKLIST_RECURRENCE_OPTIONS.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => submitProjectChecklist(project), children: "Add" }), _jsx("button", { className: "small-button", type: "button", disabled: !projectChecklistTemplateId, onClick: () => {
                                                                if (!projectChecklistTemplateId)
                                                                    return;
                                                                onCreateProjectChecklistFromTemplate(project, projectChecklistTemplateId);
                                                                setProjectChecklistTemplateId("");
                                                                setAddingChecklistToProject(null);
                                                            }, children: "Use dated template" }), _jsx("button", { className: "small-button", type: "button", disabled: !projectChecklistTemplateId, onClick: () => {
                                                                if (!projectChecklistTemplateId)
                                                                    return;
                                                                onCreateProjectChecklistRecurrence(project, projectChecklistTemplateId, projectChecklistRecurrenceCadence);
                                                                setProjectChecklistTemplateId("");
                                                                setAddingChecklistToProject(null);
                                                            }, children: "Enable recurring" })] })) : null, _jsxs("div", { className: "structure-preview-row", children: [row.preview.activities.length ? (_jsxs("div", { className: "structure-preview-group", children: [_jsx("span", { className: "tiny-text", children: "Activities" }), _jsx("div", { className: "structure-preview-chips", children: row.preview.activities.map((activity) => (_jsx("button", { className: "status-chip status-chip-button", type: "button", onClick: () => onOpenActivityDetail(activity.id), children: activity.description }, activity.id))) })] })) : null, row.preview.todos.length ? (_jsxs("div", { className: "structure-preview-group", children: [_jsx("span", { className: "tiny-text", children: "Tasks" }), _jsx("div", { className: "structure-preview-chips", children: row.preview.todos.map((todo) => (_jsx("button", { className: "status-chip status-chip-button", type: "button", onClick: () => onOpenTodoDetail(todo.id), children: todo.description }, todo.id))) })] })) : null] }), project ? (_jsxs("div", { className: "structure-checklist-section", children: [_jsxs("div", { className: "structure-checklist-header", children: [_jsx("span", { className: "tiny-text", children: "Checklists" }), _jsx("span", { className: "status-chip", children: projectChecklists.length }), _jsxs("span", { className: "status-chip", children: [projectChecklistRecurrences.length, " recurring"] })] }), projectChecklistRecurrences.length ? (_jsx("div", { className: "structure-checklist-list", children: projectChecklistRecurrences.map((rule) => {
                                                                const template = checklistTemplates.find((entry) => entry.id === rule.templateId);
                                                                const latestChecklist = projectChecklists.find((checklist) => checklist.recurrenceRuleId === rule.id) || null;
                                                                return (_jsx("div", { className: "structure-checklist-card", children: _jsxs("div", { className: "structure-checklist-body", children: [_jsxs("div", { className: "structure-checklist-header", children: [_jsx("strong", { children: template?.title || "Missing template" }), _jsx("span", { className: "tiny-text", children: formatChecklistRecurrenceLabel(rule.cadence) })] }), _jsxs("p", { className: "muted", children: ["Automatically creates a fresh dated checklist for this project when a new ", rule.cadence === "weekly" ? "week" : "month", " starts."] }), _jsxs("div", { className: "tiny-text", children: [_jsx("div", { children: formatLastCreatedChecklistLabel(latestChecklist) }), _jsx("div", { children: formatNextChecklistDueLabel(rule.cadence) })] }), _jsx("div", { className: "page-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDeleteChecklistRecurrence(rule.id), children: "Disable recurring" }) })] }) }, rule.id));
                                                            }) })) : null, projectChecklists.length ? (_jsx("div", { className: "structure-checklist-list", children: projectChecklists.map((checklist) => {
                                                                const checkedCount = checklist.items.filter((item) => item.isChecked).length;
                                                                return (_jsxs("details", { className: "structure-checklist-card", children: [_jsxs("summary", { children: [_jsx("span", { children: checklist.title }), _jsxs("span", { className: "tiny-text", children: [checkedCount, "/", checklist.items.length] })] }), _jsxs("div", { className: "structure-checklist-body", children: [_jsxs("div", { className: "page-actions", children: [_jsxs("div", { className: "field structure-template-category-field", children: [_jsx("label", { htmlFor: `structure-template-category-${checklist.id}`, children: "Category" }), _jsx("select", { id: `structure-template-category-${checklist.id}`, value: checklistTemplateCategoryDraft, onChange: (event) => setChecklistTemplateCategoryDraft(event.target.value), children: templateCategories.map((category) => (_jsx("option", { value: category, children: category }, category))) })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => saveChecklistAsTemplate(checklist), children: "Save as template" }), _jsx("button", { className: "small-button", type: "button", onClick: () => duplicateChecklist(checklist), children: "Duplicate" }), _jsx("button", { className: "small-button", type: "button", onClick: () => resetChecklist(checklist), children: "Reset" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDeleteChecklist(checklist.id), children: "Delete checklist" })] }), checklist.items.length ? (_jsx("div", { className: "section-list", children: checklist.items.map((item) => (_jsxs("div", { className: "list-item", children: [_jsxs("label", { className: "structure-checklist-item", children: [_jsx("input", { type: "checkbox", checked: item.isChecked, onChange: () => toggleChecklistItem(checklist, item.id) }), _jsx("span", { children: item.label })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => moveChecklistItem(checklist, item.id, -1), disabled: item.position <= 1, children: "Up" }), _jsx("button", { className: "small-button", type: "button", onClick: () => moveChecklistItem(checklist, item.id, 1), disabled: item.position >= checklist.items.length, children: "Down" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => deleteChecklistItem(checklist, item.id), children: "Delete" })] })] }, item.id))) })) : (_jsx("p", { className: "muted", children: "No checklist items yet." })), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: `structure-checklist-item-${checklist.id}`, children: "New item" }), _jsx("input", { id: `structure-checklist-item-${checklist.id}`, value: checklistItemDrafts[checklist.id] || "", onChange: (event) => setChecklistItemDraft(checklist.id, event.target.value), onKeyDown: (event) => {
                                                                                                        if (event.key === "Enter" && !event.shiftKey) {
                                                                                                            event.preventDefault();
                                                                                                            addChecklistItem(checklist);
                                                                                                        }
                                                                                                    }, placeholder: "Add a checkbox item" })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => addChecklistItem(checklist), children: "Add item" })] })] })] }, checklist.id));
                                                            }) })) : (_jsx("p", { className: "muted", children: "No project checklists yet." }))] })) : null] }, row.label));
                                    }) })] }) })] })] }));
};

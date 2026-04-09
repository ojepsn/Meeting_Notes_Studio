import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
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
export const StructureWorkspace = ({ activities, todos, timeLogs, savedDomains, savedProjects, projectLinks, onAddDomain, onRenameDomain, onAddProject, onAddActivityToProject, onRenameProject, onAssignProjectDomain, onOpenActivitiesForDomain, onOpenActivitiesForProject, onOpenTodosForDomain, onOpenTodosForProject, onOpenTimeForDomain, onOpenTimeForProject, onOpenActivityDetail, onOpenTodoDetail, }) => {
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
    return (_jsxs("div", { className: "card todos-workspace todos-workspace-minimal structure-workspace-card", children: [_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsxs("div", { children: [_jsx("h2", { children: "Structure" }), _jsx("p", { className: "muted", children: "Create and organize domains, projects, and project-owned activities here. Use Activities as the operational work hub once something exists." })] }) }), _jsxs("div", { className: "structure-creation-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "New domain" }), _jsx("p", { className: "muted", children: "Use this for slower, deliberate structure work. Settings still remains the fallback admin home." })] }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "structure-domain-draft", children: "Domain" }), _jsx("input", { id: "structure-domain-draft", value: domainDraft, onChange: (event) => setDomainDraft(event.target.value), onKeyDown: (event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        submitDomain();
                                                    }
                                                }, placeholder: "Add a new domain" })] }), _jsx("button", { className: "primary-button", type: "button", onClick: submitDomain, children: "Add" })] })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "New project" }), _jsx("p", { className: "muted", children: "Projects can be set up here, then reused quickly in Notes, Calendar, Activities, and Todos." })] }) }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "structure-project-draft", children: "Project" }), _jsx("input", { id: "structure-project-draft", value: projectDraft, onChange: (event) => setProjectDraft(event.target.value), onKeyDown: (event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        submitProject();
                                                    }
                                                }, placeholder: "Add a new project" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "structure-project-domain", children: "Domain" }), _jsxs("select", { id: "structure-project-domain", value: projectDomainDraft, onChange: (event) => setProjectDomainDraft(event.target.value), children: [_jsx("option", { value: "", children: "No domain" }), allDomains.map((domain) => (_jsx("option", { value: domain, children: domain }, domain)))] })] }), _jsx("button", { className: "primary-button", type: "button", onClick: submitProject, children: "Add" })] })] })] }), focus ? (_jsxs("div", { className: "sidebar-card structure-focus-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsxs("h3", { children: [focus.kind === "domain" ? "Domain focus" : "Project focus", ": ", focus.label] }), _jsx("p", { className: "muted", children: "Inspect the linked work here before drilling further into Activities, Todos, or Time." })] }), _jsxs("div", { className: "page-actions", children: [_jsxs("span", { className: "status-chip", children: [focusedActivities.length, " activities"] }), _jsxs("span", { className: "status-chip", children: [focusedTodos.length, " todos"] }), _jsx("span", { className: "status-chip", children: formatMinutes(focusedMinutes) }), _jsx("button", { className: "small-button", type: "button", onClick: () => setFocus(null), children: "Clear focus" })] })] }), _jsxs("div", { className: "structure-focus-grid", children: [_jsxs("div", { className: "sidebar-card", children: [_jsx("h4", { children: "Linked activities" }), _jsx("div", { className: "section-list", children: focusedActivities.length ? (focusedActivities.map((activity) => (_jsxs("button", { className: "list-item list-item-button", type: "button", onClick: () => onOpenActivityDetail(activity.id), children: [_jsxs("div", { children: [_jsx("strong", { children: activity.description }), _jsxs("div", { className: "tiny-text", children: [activity.project || activity.domain || "No project", " - ", activity.type] })] }), _jsx("span", { children: formatMinutes(timeLogMinutesByActivityId.get(activity.id) || 0) })] }, activity.id)))) : (_jsx("p", { className: "muted", children: "No linked activities yet." })) })] }), _jsxs("div", { className: "sidebar-card", children: [_jsx("h4", { children: "Linked todos" }), _jsx("div", { className: "section-list", children: focusedTodos.length ? (focusedTodos.map((todo) => (_jsxs("button", { className: "list-item list-item-button", type: "button", onClick: () => onOpenTodoDetail(todo.id), children: [_jsxs("div", { children: [_jsx("strong", { children: todo.description }), _jsxs("div", { className: "tiny-text", children: [todo.project || todo.domain || "No project", todo.activity ? ` - ${todo.activity}` : ""] })] }), _jsx("span", { children: formatMinutes(timeLogMinutesByTodoId.get(todo.id) || 0) })] }, todo.id)))) : (_jsx("p", { className: "muted", children: "No linked todos yet." })) })] })] })] })) : null, _jsxs("div", { className: "time-workspace-layout", children: [_jsx("section", { className: "time-workspace-main", children: _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Domains" }), _jsx("p", { className: "muted", children: "Top-level business areas with linked work inline." })] }) }), _jsx("div", { className: "time-log-table", children: domainRows.map((row) => {
                                        const domain = row.label === "No domain" ? "" : row.label;
                                        const isEditing = editingDomain === row.label;
                                        return (_jsxs("div", { className: "structure-card", children: [_jsxs("div", { className: "structure-row", children: [_jsx("div", { className: "structure-main", children: isEditing ? (_jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: `structure-domain-edit-${row.label}`, children: "Rename domain" }), _jsx("input", { id: `structure-domain-edit-${row.label}`, value: editingDomainDraft, onChange: (event) => setEditingDomainDraft(event.target.value) })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                            onRenameDomain(row.label, editingDomainDraft);
                                                                            setEditingDomain(null);
                                                                            setEditingDomainDraft("");
                                                                        }, children: "Save" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                            setEditingDomain(null);
                                                                            setEditingDomainDraft("");
                                                                        }, children: "Cancel" })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: row.label }), _jsxs("div", { className: "tiny-text", children: [row.activities, " activities - ", row.todos, " todos - ", formatMinutes(row.minutes)] })] })) }), !isEditing ? (_jsxs("div", { className: "page-actions", children: [domain ? (_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        setEditingDomain(row.label);
                                                                        setEditingDomainDraft(row.label);
                                                                    }, children: "Edit" })) : null, _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenActivitiesForDomain(domain), children: "Activities" }), _jsx("button", { className: "small-button", type: "button", onClick: () => setFocus({ kind: "domain", label: row.label }), children: "Inspect" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenTodosForDomain(domain), children: "Todos" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenTimeForDomain(domain), children: "Time" })] })) : null] }), _jsxs("div", { className: "structure-preview-row", children: [row.preview.activities.length ? (_jsxs("div", { className: "structure-preview-group", children: [_jsx("span", { className: "tiny-text", children: "Activities" }), _jsx("div", { className: "structure-preview-chips", children: row.preview.activities.map((activity) => (_jsx("button", { className: "status-chip status-chip-button", type: "button", onClick: () => onOpenActivityDetail(activity.id), children: activity.description }, activity.id))) })] })) : null, row.preview.todos.length ? (_jsxs("div", { className: "structure-preview-group", children: [_jsx("span", { className: "tiny-text", children: "Todos" }), _jsx("div", { className: "structure-preview-chips", children: row.preview.todos.map((todo) => (_jsx("button", { className: "status-chip status-chip-button", type: "button", onClick: () => onOpenTodoDetail(todo.id), children: todo.description }, todo.id))) })] })) : null] })] }, row.label));
                                    }) })] }) }), _jsx("aside", { className: "time-workspace-detail", children: _jsxs("div", { className: "sidebar-card", children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h3", { children: "Projects" }), _jsx("p", { className: "muted", children: "This is the authoritative place to create activities inside projects, then open them in Activities for execution." })] }) }), _jsx("div", { className: "time-log-table", children: projectRows.map((row) => {
                                        const project = row.label === "No project" ? "" : row.label;
                                        const isEditing = editingProject === row.label;
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
                                                                        }, children: "Cancel" })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: row.label }), _jsxs("div", { className: "tiny-text", children: [row.domain || "No domain", " - ", row.activities, " activities - ", row.todos, " todos - ", formatMinutes(row.minutes)] })] })) }), !isEditing ? (_jsxs("div", { className: "page-actions", children: [project ? (_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        setAddingActivityToProject((current) => (current === row.label ? null : row.label));
                                                                        setProjectActivityDraft("");
                                                                        setProjectActivityTypeDraft("task");
                                                                    }, children: addingActivityToProject === row.label ? "Close new activity" : "New activity" })) : null, project ? (_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        setEditingProject(row.label);
                                                                        setEditingProjectDraft(row.label);
                                                                        setEditingProjectDomainDraft(projectDomainLookup[row.label] || row.domain || "");
                                                                    }, children: "Edit" })) : null, _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenActivitiesForProject(project), children: "Activities" }), _jsx("button", { className: "small-button", type: "button", onClick: () => setFocus({ kind: "project", label: row.label }), children: "Inspect" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenTodosForProject(project), children: "Todos" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onOpenTimeForProject(project), children: "Time" })] })) : null] }), addingActivityToProject === row.label ? (_jsxs("div", { className: "todos-workspace-input-row structure-inline-create-row", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `structure-project-activity-type-${row.label}`, children: "Type" }), _jsxs("select", { id: `structure-project-activity-type-${row.label}`, value: projectActivityTypeDraft, onChange: (event) => setProjectActivityTypeDraft(event.target.value === "meeting" ? "meeting" : "task"), children: [_jsx("option", { value: "task", children: "Task" }), _jsx("option", { value: "meeting", children: "Meeting" })] })] }), _jsxs("div", { className: "field field-wide", children: [_jsxs("label", { htmlFor: `structure-project-activity-draft-${row.label}`, children: ["New activity in ", row.label] }), _jsx("input", { id: `structure-project-activity-draft-${row.label}`, value: projectActivityDraft, onChange: (event) => setProjectActivityDraft(event.target.value), onKeyDown: (event) => {
                                                                        if (event.key === "Enter" && !event.shiftKey) {
                                                                            event.preventDefault();
                                                                            submitProjectActivity(project, row.domain || "");
                                                                        }
                                                                    }, placeholder: projectActivityTypeDraft === "meeting" ? "Add a meeting activity inside this project" : "Add an activity inside this project" })] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => submitProjectActivity(project, row.domain || ""), children: "Add" })] })) : null, _jsxs("div", { className: "structure-preview-row", children: [row.preview.activities.length ? (_jsxs("div", { className: "structure-preview-group", children: [_jsx("span", { className: "tiny-text", children: "Activities" }), _jsx("div", { className: "structure-preview-chips", children: row.preview.activities.map((activity) => (_jsx("button", { className: "status-chip status-chip-button", type: "button", onClick: () => onOpenActivityDetail(activity.id), children: activity.description }, activity.id))) })] })) : null, row.preview.todos.length ? (_jsxs("div", { className: "structure-preview-group", children: [_jsx("span", { className: "tiny-text", children: "Todos" }), _jsx("div", { className: "structure-preview-chips", children: row.preview.todos.map((todo) => (_jsx("button", { className: "status-chip status-chip-button", type: "button", onClick: () => onOpenTodoDetail(todo.id), children: todo.description }, todo.id))) })] })) : null] })] }, row.label));
                                    }) })] }) })] })] }));
};

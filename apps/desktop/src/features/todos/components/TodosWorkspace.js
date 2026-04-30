import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { DateInput } from "../../../components/DateInput";
import { TokenPicker } from "../../../components/TokenPicker";
import { getActivitiesForSelection, getProjectsForDomain } from "../../../lib/structure/options";
import { calculateLiveDurationMinutes, formatTrackedMinutes, getRunningTimeLog, isTimeLogRunning } from "../../../lib/time/tracking";
const CHECKLIST_RECURRENCE_OPTIONS = [
    { value: "monthly", label: "Monthly" },
    { value: "weekly", label: "Weekly" },
];
const createBlankTodoDraft = (description = "") => ({
    id: "",
    description,
    isDone: false,
    isPrivate: false,
    isPriority: false,
    comments: "",
    activityId: "",
    domain: "",
    project: "",
    activity: "",
    doOn: "",
    dueDate: "",
    detailsHtml: "",
    createdAt: "",
    sessionIds: [],
});
const createBlankTimeLogDraft = (targetId) => {
    const now = new Date();
    const date = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, "0")}-${`${now.getDate()}`.padStart(2, "0")}`;
    const time = `${`${now.getHours()}`.padStart(2, "0")}:${`${now.getMinutes()}`.padStart(2, "0")}`;
    return {
        id: crypto.randomUUID(),
        targetType: "todo",
        targetId,
        date,
        startTime: time,
        endTime: time,
        durationMinutes: 0,
        notes: "",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };
};
const normalizeValue = (value) => value.trim().toLowerCase();
const emptyColumnFilters = {
    createdAt: "",
    description: "",
    domain: "",
    project: "",
    activity: "",
    doOn: "",
    dueDate: "",
    details: "",
};
const defaultColumnWidths = {
    description: 420,
    domain: 140,
    project: 140,
    activity: 140,
    doOn: 130,
    dueDate: 130,
    details: 220,
};
const minColumnWidths = {
    description: 220,
    domain: 100,
    project: 100,
    activity: 100,
    doOn: 110,
    dueDate: 110,
    details: 140,
};
const stripHtmlToText = (html) => html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
const escapeHtml = (value) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const textToDetailsHtml = (value) => {
    const trimmed = value.trim();
    return trimmed ? `<p>${escapeHtml(trimmed)}</p>` : "";
};
const calculateDurationMinutes = (date, startTime, endTime) => {
    const start = new Date(`${date}T${startTime || "00:00"}:00`);
    const end = new Date(`${date}T${endTime || startTime || "00:00"}:00`);
    const diff = Math.round((end.getTime() - start.getTime()) / 60000);
    return Number.isFinite(diff) ? Math.max(0, diff) : 0;
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
export const TodosWorkspace = ({ todos, checklists, checklistTemplates, checklistRecurrences, activities, timeLogs, structureOptions, requestedTodoId, requestedDomain, requestedProject, onEditorClose, onToggle, onAdd, onSave, onDelete, onCreateChecklist, onCreateChecklistFromTemplate, onCreateChecklistRecurrence, onSaveChecklist, onDeleteChecklist, onCreateChecklistTemplate, onSaveChecklistTemplate, onDeleteChecklistTemplate, onDeleteChecklistRecurrence, onConvertToActivity, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, onOpenActivityDetail, }) => {
    const [draft, setDraft] = useState("");
    const [sortKey, setSortKey] = useState("createdAt");
    const [sortDirection, setSortDirection] = useState("desc");
    const [columnFilters, setColumnFilters] = useState(emptyColumnFilters);
    const [columnWidths, setColumnWidths] = useState(defaultColumnWidths);
    const [visibilityFilter, setVisibilityFilter] = useState("open");
    const [selectedTodoId, setSelectedTodoId] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [editingDraft, setEditingDraft] = useState(createBlankTodoDraft());
    const [editingTimeLogId, setEditingTimeLogId] = useState(null);
    const [timeLogDraft, setTimeLogDraft] = useState(null);
    const [addingChecklist, setAddingChecklist] = useState(false);
    const [checklistDraft, setChecklistDraft] = useState("");
    const [checklistTemplateId, setChecklistTemplateId] = useState("");
    const [checklistRecurrenceCadence, setChecklistRecurrenceCadence] = useState("monthly");
    const [checklistTemplateCategoryDraft, setChecklistTemplateCategoryDraft] = useState("General");
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [editingTemplateTitle, setEditingTemplateTitle] = useState("");
    const [editingTemplateCategory, setEditingTemplateCategory] = useState("General");
    const [checklistItemDrafts, setChecklistItemDrafts] = useState({});
    const [now, setNow] = useState(() => new Date());
    const detailsEditorRef = useRef(null);
    const activityLookup = useMemo(() => Object.fromEntries(activities.map((activity) => [activity.id, activity])), [activities]);
    const openTodos = useMemo(() => todos.filter((todo) => !todo.isDone), [todos]);
    const completedTodos = useMemo(() => todos.filter((todo) => todo.isDone).slice(0, 8), [todos]);
    const todoTimeLogs = useMemo(() => timeLogs.filter((entry) => entry.targetType === "todo"), [timeLogs]);
    const timeLogsByTodoId = useMemo(() => {
        const grouped = new Map();
        todoTimeLogs.forEach((entry) => grouped.set(entry.targetId, [...(grouped.get(entry.targetId) || []), entry]));
        return grouped;
    }, [todoTimeLogs]);
    const runningTodos = useMemo(() => openTodos.filter((todo) => (timeLogsByTodoId.get(todo.id) || []).some(isTimeLogRunning)), [openTodos, timeLogsByTodoId]);
    useEffect(() => {
        if (!runningTodos.length)
            return;
        const intervalId = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(intervalId);
    }, [runningTodos.length]);
    const getTodoColumnValue = (todo, key) => {
        switch (key) {
            case "createdAt":
                return todo.createdAt;
            case "description":
                return todo.description;
            case "domain":
                return todo.domain;
            case "project":
                return todo.project;
            case "activity":
                return activityLookup[todo.activityId]?.description || todo.activity;
            case "doOn":
                return todo.doOn;
            case "dueDate":
                return todo.dueDate;
            case "details":
            default:
                return stripHtmlToText(todo.detailsHtml || todo.comments || "");
        }
    };
    const filteredTodos = useMemo(() => {
        const statusFiltered = todos.filter((todo) => {
            if (visibilityFilter === "open")
                return !todo.isDone;
            if (visibilityFilter === "done")
                return todo.isDone;
            return true;
        });
        const filtered = statusFiltered.filter((todo) => Object.entries(columnFilters).every(([key, filterValue]) => {
            const normalizedFilter = normalizeValue(filterValue);
            if (!normalizedFilter)
                return true;
            return normalizeValue(getTodoColumnValue(todo, key)).includes(normalizedFilter);
        }));
        const valueForSort = (todo) => {
            switch (sortKey) {
                case "createdAt":
                    return todo.createdAt || "";
                case "description":
                    return normalizeValue(todo.description);
                case "domain":
                    return normalizeValue(todo.domain);
                case "project":
                    return normalizeValue(todo.project);
                case "activity":
                    return normalizeValue(activityLookup[todo.activityId]?.description || todo.activity);
                case "doOn":
                    return todo.doOn || "9999-99-99";
                case "dueDate":
                    return todo.dueDate || "9999-99-99";
                case "details":
                default:
                    return normalizeValue(stripHtmlToText(todo.detailsHtml || todo.comments || ""));
            }
        };
        return [...filtered].sort((left, right) => {
            const comparison = valueForSort(left).localeCompare(valueForSort(right));
            return sortDirection === "asc" ? comparison : comparison * -1;
        });
    }, [activityLookup, columnFilters, sortDirection, sortKey, todos, visibilityFilter]);
    useEffect(() => {
        if (requestedDomain !== undefined && requestedDomain !== null) {
            setColumnFilters((current) => ({ ...current, domain: requestedDomain || "" }));
        }
    }, [requestedDomain]);
    useEffect(() => {
        if (requestedProject !== undefined && requestedProject !== null) {
            setColumnFilters((current) => ({ ...current, project: requestedProject || "" }));
        }
    }, [requestedProject]);
    useEffect(() => {
        if (requestedTodoId) {
            setSelectedTodoId(requestedTodoId);
            setIsDetailOpen(true);
        }
    }, [requestedTodoId]);
    useEffect(() => {
        if (selectedTodoId && todos.some((entry) => entry.id === selectedTodoId)) {
            return;
        }
        if (requestedTodoId && todos.some((entry) => entry.id === requestedTodoId)) {
            setSelectedTodoId(requestedTodoId);
            return;
        }
        setSelectedTodoId(null);
        setIsDetailOpen(false);
    }, [requestedTodoId, selectedTodoId, todos]);
    useEffect(() => {
        if (!selectedTodoId) {
            setEditingDraft(createBlankTodoDraft());
            return;
        }
        const todo = todos.find((entry) => entry.id === selectedTodoId);
        if (!todo) {
            setSelectedTodoId(null);
            setEditingDraft(createBlankTodoDraft());
            return;
        }
        setEditingDraft(todo);
    }, [selectedTodoId, todos]);
    useEffect(() => {
        if (!detailsEditorRef.current)
            return;
        const nextHtml = editingDraft.detailsHtml || "<p></p>";
        if (detailsEditorRef.current.innerHTML !== nextHtml) {
            detailsEditorRef.current.innerHTML = nextHtml;
        }
    }, [editingDraft.detailsHtml, editingDraft.id]);
    useEffect(() => {
        setAddingChecklist(false);
        setChecklistDraft("");
        setChecklistTemplateId("");
        setChecklistRecurrenceCadence("monthly");
    }, [selectedTodoId]);
    const submitDraft = () => {
        const nextValue = draft.trim();
        if (!nextValue)
            return;
        onAdd(nextValue);
        setDraft("");
    };
    const currentTimeLogs = selectedTodoId ? timeLogsByTodoId.get(selectedTodoId) || [] : [];
    const currentChecklists = useMemo(() => selectedTodoId
        ? checklists
            .filter((checklist) => checklist.ownerType === "todo" && checklist.ownerId === selectedTodoId)
            .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        : [], [checklists, selectedTodoId]);
    const currentChecklistRecurrences = useMemo(() => selectedTodoId
        ? checklistRecurrences
            .filter((rule) => rule.ownerType === "todo" && rule.ownerId === selectedTodoId)
            .sort((left, right) => left.cadence.localeCompare(right.cadence) || right.updatedAt.localeCompare(left.updatedAt))
        : [], [checklistRecurrences, selectedTodoId]);
    const activeTimeLog = getRunningTimeLog(currentTimeLogs);
    const hasOpenTimer = Boolean(activeTimeLog);
    const currentActivity = editingDraft.activityId ? activityLookup[editingDraft.activityId] : null;
    const editorProjectOptions = getProjectsForDomain(structureOptions, editingDraft.domain);
    const editorActivityOptions = getActivitiesForSelection(structureOptions, editingDraft.domain, editingDraft.project);
    const handleDraftDomainChange = (domain) => {
        const nextProjects = getProjectsForDomain(structureOptions, domain);
        const nextProject = nextProjects.includes(editingDraft.project) ? editingDraft.project : "";
        const nextActivities = getActivitiesForSelection(structureOptions, domain, nextProject);
        const nextActivity = nextActivities.includes(editingDraft.activity) ? editingDraft.activity : "";
        const linkedActivity = editingDraft.activityId ? activityLookup[editingDraft.activityId] : null;
        const nextActivityId = linkedActivity &&
            (!domain || !linkedActivity.domain || linkedActivity.domain === domain) &&
            (!nextProject || !linkedActivity.project || linkedActivity.project === nextProject)
            ? editingDraft.activityId
            : "";
        setEditingDraft({ ...editingDraft, domain, project: nextProject, activity: nextActivity, activityId: nextActivityId });
    };
    const handleDraftProjectChange = (project) => {
        const nextActivities = getActivitiesForSelection(structureOptions, editingDraft.domain, project);
        const nextActivity = nextActivities.includes(editingDraft.activity) ? editingDraft.activity : "";
        const linkedActivity = editingDraft.activityId ? activityLookup[editingDraft.activityId] : null;
        const nextActivityId = linkedActivity &&
            (!editingDraft.domain || !linkedActivity.domain || linkedActivity.domain === editingDraft.domain) &&
            (!project || !linkedActivity.project || linkedActivity.project === project)
            ? editingDraft.activityId
            : "";
        setEditingDraft({ ...editingDraft, project, activity: nextActivity, activityId: nextActivityId });
    };
    const clearSelection = () => {
        setSelectedTodoId(null);
        setIsDetailOpen(false);
        setEditingTimeLogId(null);
        setTimeLogDraft(null);
        onEditorClose?.();
    };
    const saveChecklistItems = (checklist, items) => {
        onSaveChecklist({
            ...checklist,
            items,
            updatedAt: new Date().toISOString(),
        });
    };
    const setChecklistItemDraft = (checklistId, value) => {
        setChecklistItemDrafts((current) => ({ ...current, [checklistId]: value }));
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
    const deleteSelectedTodo = () => {
        if (!selectedTodoId)
            return;
        onDelete(selectedTodoId);
        clearSelection();
    };
    const updateColumnFilter = (key, value) => {
        setColumnFilters((current) => ({ ...current, [key]: value }));
    };
    const toggleSort = (key) => {
        if (sortKey === key) {
            setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
            return;
        }
        setSortKey(key);
        setSortDirection("asc");
    };
    const openTodoDetail = (todoId) => {
        setSelectedTodoId(todoId);
        setIsDetailOpen(true);
    };
    const stopTableEditPropagation = (event) => {
        event.stopPropagation();
    };
    const saveTodoPatch = (todo, patch) => {
        onSave({ ...todo, ...patch });
    };
    const startColumnResize = (key, event) => {
        event.preventDefault();
        event.stopPropagation();
        const startX = event.clientX;
        const startWidth = columnWidths[key];
        const handlePointerMove = (moveEvent) => {
            const nextWidth = Math.max(minColumnWidths[key], startWidth + moveEvent.clientX - startX);
            setColumnWidths((current) => ({ ...current, [key]: nextWidth }));
        };
        const handlePointerUp = () => {
            window.removeEventListener("mousemove", handlePointerMove);
            window.removeEventListener("mouseup", handlePointerUp);
            document.body.classList.remove("todos-column-resizing");
        };
        document.body.classList.add("todos-column-resizing");
        window.addEventListener("mousemove", handlePointerMove);
        window.addEventListener("mouseup", handlePointerUp);
    };
    const tableStyle = {
        "--todo-col-description": `${columnWidths.description}px`,
        "--todo-col-domain": `${columnWidths.domain}px`,
        "--todo-col-project": `${columnWidths.project}px`,
        "--todo-col-activity": `${columnWidths.activity}px`,
        "--todo-col-doOn": `${columnWidths.doOn}px`,
        "--todo-col-dueDate": `${columnWidths.dueDate}px`,
        "--todo-col-details": `${columnWidths.details}px`,
    };
    const todoColumns = [
        { key: "description", label: "Task", placeholder: "Filter task" },
        { key: "domain", label: "Domain", placeholder: "Filter domain" },
        { key: "project", label: "Project", placeholder: "Filter project" },
        { key: "activity", label: "Activity", placeholder: "Filter activity" },
        { key: "doOn", label: "Do on", placeholder: "Filter date" },
        { key: "dueDate", label: "Due date", placeholder: "Filter date" },
        { key: "details", label: "Details", placeholder: "Filter details" },
    ];
    return (_jsxs("div", { className: "card todos-workspace todos-workspace-minimal todos-hub-card", children: [_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsxs("div", { children: [_jsx("h2", { children: "Tasks" }), _jsx("p", { className: "muted", children: "Execution happens here. Start work fast, stay in context, and correct time afterward when needed." })] }) }), _jsxs("form", { className: "todos-workspace-input-row", onSubmit: (event) => {
                    event.preventDefault();
                    submitDraft();
                }, children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "todos-workspace-draft", children: "New task" }), _jsx("input", { id: "todos-workspace-draft", value: draft, onChange: (event) => setDraft(event.target.value), onKeyDown: (event) => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        submitDraft();
                                    }
                                }, placeholder: "Add a focused next action" })] }), _jsx("button", { className: "primary-button", type: "submit", children: "Add" })] }), _jsxs("div", { className: "todos-hub-shell", children: [_jsxs("section", { className: "todos-hub-list-panel todos-table-panel", children: [_jsxs("div", { className: "todos-table-summary", children: [_jsxs("span", { className: "status-chip", children: [filteredTodos.length, " shown"] }), _jsxs("span", { className: "status-chip", children: [openTodos.length, " open"] }), _jsxs("span", { className: "status-chip", children: [todos.length - openTodos.length, " completed"] }), _jsxs("label", { className: "todos-visibility-control", children: [_jsx("span", { children: "Show" }), _jsxs("select", { value: visibilityFilter, onChange: (event) => setVisibilityFilter(event.target.value), children: [_jsx("option", { value: "open", children: "Open only" }), _jsx("option", { value: "all", children: "All tasks" }), _jsx("option", { value: "done", children: "Done only" })] })] }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: deleteSelectedTodo, disabled: !selectedTodoId, children: "Delete selected" }), _jsx("span", { className: "muted", children: "Click a row to select. Double-click to open the full task card." })] }), runningTodos.length ? (_jsxs("div", { className: "todos-running-strip", children: [_jsx("strong", { children: "Running now" }), _jsx("div", { className: "todos-running-list", children: runningTodos.map((todo) => {
                                            const runningLog = getRunningTimeLog(timeLogsByTodoId.get(todo.id) || []);
                                            const elapsedLabel = runningLog
                                                ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now))
                                                : "Running";
                                            return (_jsxs("div", { className: "todos-running-chip", children: [_jsxs("button", { type: "button", className: "status-chip", onClick: () => setSelectedTodoId(todo.id), children: [todo.description, " \u2022 ", elapsedLabel] }), _jsx("button", { className: "small-button", type: "button", onClick: () => onStopTracking("todo", todo.id), children: "Stop" })] }, todo.id));
                                        }) })] })) : null, _jsx("div", { className: "todos-dense-table-shell", children: _jsxs("table", { className: "todos-dense-table", style: tableStyle, children: [_jsxs("thead", { children: [_jsx("tr", { children: todoColumns.map((column) => (_jsx("th", { scope: "col", children: _jsxs("div", { className: "todos-header-cell", children: [_jsxs("button", { className: "todos-sort-button", type: "button", onClick: () => toggleSort(column.key), children: [_jsx("span", { children: column.label }), _jsx("span", { "aria-hidden": "true", children: sortKey === column.key ? (sortDirection === "asc" ? "↑" : "↓") : "↕" })] }), _jsx("button", { className: "todos-column-resize-handle", type: "button", "aria-label": `Resize ${column.label} column`, onMouseDown: (event) => startColumnResize(column.key, event) })] }) }, column.key))) }), _jsxs("tr", { className: "todos-filter-row", children: [todoColumns.map((column) => (_jsx("th", { scope: "col", children: _jsx("input", { "aria-label": `Filter ${column.label}`, value: columnFilters[column.key], onChange: (event) => updateColumnFilter(column.key, event.target.value), placeholder: column.placeholder }) }, column.key))), _jsx("th", { scope: "col", children: _jsx("div", { className: "todos-header-cell", children: _jsx("span", { className: "todos-sort-button", children: "Actions" }) }) })] })] }), _jsx("tbody", { children: filteredTodos.length ? (filteredTodos.map((todo) => {
                                                const logs = timeLogsByTodoId.get(todo.id) || [];
                                                const totalMinutes = logs.reduce((sum, entry) => sum + entry.durationMinutes, 0);
                                                const runningLog = getRunningTimeLog(logs);
                                                const running = Boolean(runningLog);
                                                const elapsedLabel = runningLog
                                                    ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now))
                                                    : "";
                                                const activityLabel = activityLookup[todo.activityId]?.description || todo.activity || "";
                                                const detailsText = stripHtmlToText(todo.detailsHtml || todo.comments || "");
                                                const doOnLabel = todo.doOn || "";
                                                const dueDateLabel = todo.dueDate || "";
                                                return (_jsxs("tr", { className: `${selectedTodoId === todo.id ? "todos-dense-row-selected" : ""}${todo.isDone ? " todos-dense-row-done" : ""}`, onClick: () => setSelectedTodoId(todo.id), onDoubleClick: () => openTodoDetail(todo.id), tabIndex: 0, onKeyDown: (event) => {
                                                        if (event.key === "Enter") {
                                                            event.preventDefault();
                                                            openTodoDetail(todo.id);
                                                        }
                                                    }, children: [_jsx("td", { children: _jsxs("div", { className: "todos-dense-title-cell", children: [_jsx("input", { type: "checkbox", "aria-label": `Mark ${todo.description} ${todo.isDone ? "open" : "done"}`, checked: todo.isDone, onChange: (event) => {
                                                                            event.stopPropagation();
                                                                            onToggle({ ...todo, isDone: !todo.isDone });
                                                                        } }), _jsxs("div", { className: "todos-dense-title-copy", children: [_jsx("input", { className: "todos-inline-title-input", "aria-label": "Task title", value: todo.description, onClick: stopTableEditPropagation, onDoubleClick: stopTableEditPropagation, onKeyDown: stopTableEditPropagation, onChange: (event) => saveTodoPatch(todo, { description: event.target.value }), placeholder: "Untitled task" }), _jsx("span", { children: running ? `Running • ${elapsedLabel}` : totalMinutes ? formatTrackedMinutes(totalMinutes) : "No time logged" })] })] }) }), _jsx("td", { children: _jsx("input", { className: "todos-inline-cell-input", "aria-label": "Task domain", value: todo.domain, onClick: stopTableEditPropagation, onDoubleClick: stopTableEditPropagation, onKeyDown: stopTableEditPropagation, onChange: (event) => saveTodoPatch(todo, { domain: event.target.value }), placeholder: "Domain" }) }), _jsx("td", { children: _jsx("input", { className: "todos-inline-cell-input", "aria-label": "Task project", value: todo.project, onClick: stopTableEditPropagation, onDoubleClick: stopTableEditPropagation, onKeyDown: stopTableEditPropagation, onChange: (event) => saveTodoPatch(todo, { project: event.target.value }), placeholder: "Project" }) }), _jsx("td", { children: _jsx("input", { className: "todos-inline-cell-input", "aria-label": "Task activity", value: activityLabel, onClick: stopTableEditPropagation, onDoubleClick: stopTableEditPropagation, onKeyDown: stopTableEditPropagation, onChange: (event) => saveTodoPatch(todo, { activity: event.target.value, activityId: "" }), placeholder: "Activity" }) }), _jsx("td", { children: _jsx(DateInput, { id: `todo-dense-do-on-${todo.id}`, className: "todos-inline-date-input", "aria-label": "Task do on date", value: doOnLabel, onClick: stopTableEditPropagation, onDoubleClick: stopTableEditPropagation, onKeyDown: stopTableEditPropagation, onChange: (event) => saveTodoPatch(todo, { doOn: event.target.value }) }) }), _jsx("td", { children: _jsx(DateInput, { id: `todo-dense-due-${todo.id}`, className: "todos-inline-date-input", "aria-label": "Task due date", value: dueDateLabel, onClick: stopTableEditPropagation, onDoubleClick: stopTableEditPropagation, onKeyDown: stopTableEditPropagation, onChange: (event) => saveTodoPatch(todo, { dueDate: event.target.value }) }) }), _jsx("td", { children: _jsx("div", { className: "todos-dense-details-cell", children: _jsx("input", { className: "todos-inline-cell-input", "aria-label": "Task details", value: detailsText, onClick: stopTableEditPropagation, onDoubleClick: stopTableEditPropagation, onKeyDown: stopTableEditPropagation, onChange: (event) => saveTodoPatch(todo, { detailsHtml: textToDetailsHtml(event.target.value) }), placeholder: "No details" }) }) }), _jsx("td", { children: _jsxs("div", { className: "todos-dense-actions-cell", children: [_jsx("button", { className: `small-button${running ? " primary-button" : ""}`, type: "button", onClick: (event) => {
                                                                            event.stopPropagation();
                                                                            if (running) {
                                                                                onStopTracking("todo", todo.id);
                                                                                return;
                                                                            }
                                                                            onStartTracking("todo", todo.id);
                                                                        }, children: running ? "Stop" : "Start" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: (event) => {
                                                                            event.stopPropagation();
                                                                            onDelete(todo.id);
                                                                        }, children: "Delete" })] }) })] }, todo.id));
                                            })) : (_jsx("tr", { children: _jsx("td", { colSpan: todoColumns.length + 1, children: _jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No tasks match the current filters" }), _jsx("p", { children: "Clear one or more column filters, or add a new focused next action above." })] }) }) })) })] }) }), _jsx("div", { className: "todos-compact-list", children: filteredTodos.length ? (filteredTodos.map((todo) => {
                                    const logs = timeLogsByTodoId.get(todo.id) || [];
                                    const totalMinutes = logs.reduce((sum, entry) => sum + entry.durationMinutes, 0);
                                    const runningLog = getRunningTimeLog(logs);
                                    const running = Boolean(runningLog);
                                    const elapsedLabel = runningLog
                                        ? formatTrackedMinutes(calculateLiveDurationMinutes(runningLog, now))
                                        : "";
                                    return (_jsxs("button", { type: "button", className: `todos-compact-item${selectedTodoId === todo.id ? " todos-compact-item-selected" : ""}`, onClick: () => setSelectedTodoId(todo.id), children: [_jsxs("div", { className: "todos-compact-item-main", children: [_jsxs("div", { className: "todos-compact-item-head", children: [_jsx("input", { type: "checkbox", checked: todo.isDone, onChange: (event) => {
                                                                    event.stopPropagation();
                                                                    onToggle({ ...todo, isDone: !todo.isDone });
                                                                } }), _jsx("strong", { children: todo.description })] }), _jsxs("div", { className: "todos-compact-item-meta", children: [_jsx("span", { children: activityLookup[todo.activityId]?.description || todo.activity || "Unassigned" }), _jsx("span", { children: todo.project || "No project" }), _jsx("span", { children: todo.dueDate || todo.doOn || "-" }), _jsx("span", { children: running ? `Running • ${elapsedLabel}` : totalMinutes ? formatTrackedMinutes(totalMinutes) : "No time" })] })] }), _jsx("div", { className: "todos-compact-item-actions", children: _jsx("button", { className: `small-button${running ? " primary-button" : ""}`, type: "button", onClick: (event) => {
                                                        event.stopPropagation();
                                                        if (running) {
                                                            onStopTracking("todo", todo.id);
                                                            return;
                                                        }
                                                        onStartTracking("todo", todo.id);
                                                    }, children: running ? "Stop" : "Start" }) })] }, todo.id));
                                })) : (_jsxs("div", { className: "empty-state-card compact-empty-state", children: [_jsx("h3", { children: "No open tasks" }), _jsx("p", { children: "Capture the next action here, or type `td` followed by text in any input across the app." })] })) }), completedTodos.length ? (_jsxs("details", { className: "workspace-disclosure", children: [_jsx("summary", { children: "Recently completed" }), _jsx("div", { className: "workspace-disclosure-body todos-workspace-completed", children: completedTodos.map((todo) => (_jsxs("label", { className: "todos-workspace-main todos-workspace-main-completed", children: [_jsx("input", { type: "checkbox", checked: todo.isDone, onChange: () => onToggle({ ...todo, isDone: !todo.isDone }) }), _jsxs("span", { className: "todos-workspace-copy", children: [_jsx("strong", { children: todo.description }), _jsx("span", { className: "muted", children: todo.createdAt.slice(0, 10) })] })] }, todo.id))) })] })) : null] }), isDetailOpen ? (_jsx("section", { className: "todos-hub-detail-panel todos-detail-modal", children: selectedTodoId ? (_jsxs("div", { className: "stack", children: [_jsxs("div", { className: "card-header activities-detail-header", children: [_jsxs("div", { children: [_jsx("h3", { children: editingDraft.description || "Task" }), _jsxs("div", { className: "calendar-editor-meta", children: [currentActivity ? _jsx("span", { className: "status-chip", children: currentActivity.description }) : _jsx("span", { className: "status-chip", children: "Unassigned" }), editingDraft.project ? _jsx("span", { className: "status-chip", children: editingDraft.project }) : null, editingDraft.domain ? _jsx("span", { className: "status-chip", children: editingDraft.domain }) : null, _jsx("span", { className: "status-chip", children: hasOpenTimer ? "Timer running" : `${currentTimeLogs.reduce((sum, entry) => sum + entry.durationMinutes, 0)} min logged` })] })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: clearSelection, children: "Close" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => {
                                                        onDelete(editingDraft.id);
                                                        clearSelection();
                                                    }, children: "Delete" })] })] }), _jsxs("div", { className: "activities-detail-grid", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "todo-edit-description", children: "Task" }), _jsx("input", { id: "todo-edit-description", value: editingDraft.description, onChange: (event) => setEditingDraft({ ...editingDraft, description: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-domain", children: "Domain" }), _jsx(TokenPicker, { value: editingDraft.domain, savedOptions: structureOptions.domains, suggestedOptions: structureOptions.domains, placeholder: "Search or add domain", suggestionSummary: "Domains", suggestionBadgeText: "Available", mode: "single", onChange: handleDraftDomainChange })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-project", children: "Project" }), _jsx(TokenPicker, { value: editingDraft.project, savedOptions: editorProjectOptions, suggestedOptions: editorProjectOptions, placeholder: "Search or add project", suggestionSummary: "Projects", suggestionBadgeText: "Available", mode: "single", onChange: handleDraftProjectChange })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-activity-label", children: "Activity" }), _jsx(TokenPicker, { value: editingDraft.activity, savedOptions: editorActivityOptions, suggestedOptions: editorActivityOptions, placeholder: "Search or add activity", suggestionSummary: "Activities", suggestionBadgeText: "Available", mode: "single", onChange: (value) => setEditingDraft({ ...editingDraft, activity: value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-do-on", children: "Do on" }), _jsx(DateInput, { id: "todo-edit-do-on", value: editingDraft.doOn, onChange: (event) => setEditingDraft({ ...editingDraft, doOn: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-due-date", children: "Due date" }), _jsx(DateInput, { id: "todo-edit-due-date", value: editingDraft.dueDate, onChange: (event) => setEditingDraft({ ...editingDraft, dueDate: event.target.value }) })] }), _jsxs("div", { className: "field activity-private-field", children: [_jsx("span", { children: "Private" }), _jsxs("div", { className: "compact-private-toggle", children: [_jsx("input", { id: "todo-edit-private", type: "checkbox", checked: editingDraft.isPrivate, onChange: (event) => setEditingDraft({ ...editingDraft, isPrivate: event.target.checked }) }), _jsx("label", { htmlFor: "todo-edit-private", className: "checkbox-label", children: "Private" })] })] })] }), currentActivity ? (_jsxs("div", { className: "prompt-actions-row", children: [_jsxs("div", { className: "prompt-actions-copy", children: [_jsx("strong", { children: "Linked activity" }), _jsx("span", { className: "muted", children: "Keep this task inside its parent work stream, or jump there for broader planning." })] }), onOpenActivityDetail ? (_jsx("button", { className: "small-button", type: "button", onClick: () => onOpenActivityDetail(currentActivity.id), children: "Open activity" })) : null] })) : null, _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-edit-details", children: "Details" }), _jsx("div", { id: "todo-edit-details", ref: detailsEditorRef, className: "rich-text-surface todo-rich-text-surface", contentEditable: true, suppressContentEditableWarning: true, onInput: (event) => setEditingDraft({ ...editingDraft, detailsHtml: event.currentTarget.innerHTML }) })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Checklists" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "page-actions", children: [_jsxs("span", { className: "status-chip", children: [currentChecklists.length, " checklists"] }), _jsxs("span", { className: "status-chip", children: [currentChecklistRecurrences.length, " recurring"] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                setAddingChecklist((current) => !current);
                                                                setChecklistDraft("");
                                                                setChecklistTemplateId("");
                                                            }, children: addingChecklist ? "Close checklist" : "New checklist" })] }), addingChecklist ? (_jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "todo-checklist-draft", children: "Checklist title" }), _jsx("input", { id: "todo-checklist-draft", value: checklistDraft, onChange: (event) => setChecklistDraft(event.target.value), onKeyDown: (event) => {
                                                                        if (event.key === "Enter" && !event.shiftKey) {
                                                                            event.preventDefault();
                                                                            const nextTitle = checklistDraft.trim();
                                                                            if (!nextTitle || !editingDraft.id)
                                                                                return;
                                                                            onCreateChecklist(editingDraft.id, nextTitle);
                                                                            setChecklistDraft("");
                                                                            setAddingChecklist(false);
                                                                        }
                                                                    }, placeholder: "For example: Monthly reporting staff" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-checklist-template", children: "Template" }), _jsxs("select", { id: "todo-checklist-template", value: checklistTemplateId, onChange: (event) => setChecklistTemplateId(event.target.value), children: [_jsx("option", { value: "", children: "No template" }), checklistTemplates.map((template) => (_jsx("option", { value: template.id, children: `${template.category || "General"} - ${template.title}` }, template.id)))] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "todo-checklist-recurrence", children: "Recurring" }), _jsx("select", { id: "todo-checklist-recurrence", value: checklistRecurrenceCadence, onChange: (event) => setChecklistRecurrenceCadence(event.target.value), children: CHECKLIST_RECURRENCE_OPTIONS.map((option) => (_jsx("option", { value: option.value, children: option.label }, option.value))) })] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => {
                                                                const nextTitle = checklistDraft.trim();
                                                                if (!nextTitle || !editingDraft.id)
                                                                    return;
                                                                onCreateChecklist(editingDraft.id, nextTitle);
                                                                setChecklistDraft("");
                                                                setAddingChecklist(false);
                                                            }, children: "Add" }), _jsx("button", { className: "small-button", type: "button", disabled: !checklistTemplateId || !editingDraft.id, onClick: () => {
                                                                if (!checklistTemplateId || !editingDraft.id)
                                                                    return;
                                                                onCreateChecklistFromTemplate(editingDraft.id, checklistTemplateId);
                                                                setChecklistTemplateId("");
                                                                setAddingChecklist(false);
                                                            }, children: "Use dated template" }), _jsx("button", { className: "small-button", type: "button", disabled: !checklistTemplateId || !editingDraft.id, onClick: () => {
                                                                if (!checklistTemplateId || !editingDraft.id)
                                                                    return;
                                                                onCreateChecklistRecurrence(editingDraft.id, checklistTemplateId, checklistRecurrenceCadence);
                                                                setChecklistTemplateId("");
                                                                setAddingChecklist(false);
                                                            }, children: "Enable recurring" })] })) : null, currentChecklistRecurrences.length ? (_jsx("div", { className: "structure-checklist-list", children: currentChecklistRecurrences.map((rule) => {
                                                        const template = checklistTemplates.find((entry) => entry.id === rule.templateId);
                                                        const latestChecklist = currentChecklists.find((checklist) => checklist.recurrenceRuleId === rule.id) || null;
                                                        return (_jsx("div", { className: "structure-checklist-card", children: _jsxs("div", { className: "structure-checklist-body", children: [_jsxs("div", { className: "structure-checklist-header", children: [_jsx("strong", { children: template?.title || "Missing template" }), _jsx("span", { className: "tiny-text", children: formatChecklistRecurrenceLabel(rule.cadence) })] }), _jsxs("p", { className: "muted", children: ["Automatically creates a fresh dated checklist for this task when a new ", rule.cadence === "weekly" ? "week" : "month", " starts."] }), _jsxs("div", { className: "tiny-text", children: [_jsx("div", { children: formatLastCreatedChecklistLabel(latestChecklist) }), _jsx("div", { children: formatNextChecklistDueLabel(rule.cadence) })] }), _jsx("div", { className: "page-actions", children: _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDeleteChecklistRecurrence(rule.id), children: "Disable recurring" }) })] }) }, rule.id));
                                                    }) })) : null, currentChecklists.length ? (_jsx("div", { className: "structure-checklist-list", children: currentChecklists.map((checklist) => {
                                                        const checkedCount = checklist.items.filter((item) => item.isChecked).length;
                                                        return (_jsxs("details", { className: "structure-checklist-card", open: true, children: [_jsxs("summary", { children: [_jsx("span", { children: checklist.title }), _jsxs("span", { className: "tiny-text", children: [checkedCount, "/", checklist.items.length] })] }), _jsxs("div", { className: "structure-checklist-body", children: [_jsxs("div", { className: "page-actions", children: [_jsxs("div", { className: "field structure-template-category-field", children: [_jsx("label", { htmlFor: `todo-template-category-${checklist.id}`, children: "Category" }), _jsx("select", { id: `todo-template-category-${checklist.id}`, value: checklistTemplateCategoryDraft, onChange: (event) => setChecklistTemplateCategoryDraft(event.target.value), children: templateCategories.map((category) => (_jsx("option", { value: category, children: category }, category))) })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => saveChecklistAsTemplate(checklist), children: "Save as template" }), _jsx("button", { className: "small-button", type: "button", onClick: () => duplicateChecklist(checklist), children: "Duplicate" }), _jsx("button", { className: "small-button", type: "button", onClick: () => resetChecklist(checklist), children: "Reset" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDeleteChecklist(checklist.id), children: "Delete checklist" })] }), checklist.items.length ? (_jsx("div", { className: "section-list", children: checklist.items.map((item) => (_jsxs("div", { className: "list-item structure-checklist-row", children: [_jsxs("label", { className: "structure-checklist-item", children: [_jsx("input", { type: "checkbox", checked: item.isChecked, onChange: () => toggleChecklistItem(checklist, item.id) }), _jsx("span", { children: item.label })] }), _jsxs("div", { className: "page-actions structure-checklist-actions", children: [_jsx("button", { className: "small-button structure-checklist-action-button", type: "button", onClick: () => moveChecklistItem(checklist, item.id, -1), disabled: item.position <= 1, children: "Up" }), _jsx("button", { className: "small-button structure-checklist-action-button", type: "button", onClick: () => moveChecklistItem(checklist, item.id, 1), disabled: item.position >= checklist.items.length, children: "Down" }), _jsx("button", { className: "small-button danger-button structure-checklist-action-button", type: "button", onClick: () => deleteChecklistItem(checklist, item.id), children: "Delete" })] })] }, item.id))) })) : (_jsx("p", { className: "muted", children: "No checklist items yet." })), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: `todo-checklist-item-${checklist.id}`, children: "New item" }), _jsx("input", { id: `todo-checklist-item-${checklist.id}`, value: checklistItemDrafts[checklist.id] || "", onChange: (event) => setChecklistItemDraft(checklist.id, event.target.value), onKeyDown: (event) => {
                                                                                                if (event.key === "Enter" && !event.shiftKey) {
                                                                                                    event.preventDefault();
                                                                                                    addChecklistItem(checklist);
                                                                                                }
                                                                                            }, placeholder: "Add a checkbox item" })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => addChecklistItem(checklist), children: "Add item" })] })] })] }, checklist.id));
                                                    }) })) : (_jsx("p", { className: "muted", children: "No task checklists yet. Use these for grouped checkbox tracking that should not become separate tasks." })), checklistTemplates.length ? (_jsxs("details", { className: "workspace-disclosure", children: [_jsx("summary", { children: "Checklist templates" }), _jsx("div", { className: "workspace-disclosure-body stack", children: templatesByCategory.map(([category, templates]) => (_jsxs("details", { className: "structure-checklist-card", open: true, children: [_jsxs("summary", { children: [_jsx("span", { children: category }), _jsxs("span", { className: "tiny-text", children: [templates.length, " templates"] })] }), _jsx("div", { className: "structure-checklist-body", children: templates.map((template) => (_jsx("div", { className: "structure-checklist-card", children: _jsx("div", { className: "structure-checklist-body", children: editingTemplateId === template.id ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: `todo-template-title-${template.id}`, children: "Template title" }), _jsx("input", { id: `todo-template-title-${template.id}`, value: editingTemplateTitle, onChange: (event) => setEditingTemplateTitle(event.target.value) })] }), _jsxs("div", { className: "field structure-template-category-field", children: [_jsx("label", { htmlFor: `todo-template-category-edit-${template.id}`, children: "Category" }), _jsx("select", { id: `todo-template-category-edit-${template.id}`, value: editingTemplateCategory, onChange: (event) => setEditingTemplateCategory(event.target.value), children: templateCategories.map((categoryOption) => (_jsx("option", { value: categoryOption, children: categoryOption }, categoryOption))) })] })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => commitTemplateEdit(template), children: "Save" }), _jsx("button", { className: "small-button", type: "button", onClick: cancelTemplateEdit, children: "Cancel" })] })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "structure-checklist-header", children: [_jsx("strong", { children: template.title }), _jsxs("span", { className: "tiny-text", children: [template.items.length, " items"] })] }), _jsx("p", { className: "muted", children: template.items.map((item) => item.label).slice(0, 3).join(", ") || "No template items yet." }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => beginTemplateEdit(template), children: "Edit" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDeleteChecklistTemplate(template.id), children: "Delete template" })] })] })) }) }, template.id))) })] }, category))) })] })) : (_jsx("p", { className: "muted", children: "Save a checklist as a template to reuse it later. Reused templates create fresh checklist names with the current YYYY-MM." }))] })] }), _jsxs("details", { className: "workspace-disclosure", open: true, children: [_jsx("summary", { children: "Time logs" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "page-actions", children: [_jsx("span", { className: "status-chip", children: hasOpenTimer && activeTimeLog
                                                                ? `Running • ${formatTrackedMinutes(calculateLiveDurationMinutes(activeTimeLog, now))}`
                                                                : `${currentTimeLogs.reduce((sum, entry) => sum + entry.durationMinutes, 0)} min logged` }), _jsx("button", { className: "primary-button", type: "button", onClick: () => (hasOpenTimer ? onStopTracking("todo", editingDraft.id) : onStartTracking("todo", editingDraft.id)), children: hasOpenTimer ? "Stop" : "Start" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                const draftLog = createBlankTimeLogDraft(editingDraft.id);
                                                                setEditingTimeLogId(draftLog.id);
                                                                setTimeLogDraft(draftLog);
                                                            }, children: "Add manual log" })] }), timeLogDraft ? (_jsxs("div", { className: "list-item timelog-editor-card", children: [_jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "Date" }), _jsx(DateInput, { value: timeLogDraft.date, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, date: event.target.value, durationMinutes: calculateDurationMinutes(event.target.value, timeLogDraft.startTime, timeLogDraft.endTime) }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "Start" }), _jsx("input", { type: "time", value: timeLogDraft.startTime, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, startTime: event.target.value, durationMinutes: calculateDurationMinutes(timeLogDraft.date, event.target.value, timeLogDraft.endTime) }) })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { children: "End" }), _jsx("input", { type: "time", value: timeLogDraft.endTime, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, endTime: event.target.value, durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, event.target.value) }) })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { children: "Notes" }), _jsx("input", { value: timeLogDraft.notes, onChange: (event) => setTimeLogDraft({ ...timeLogDraft, notes: event.target.value }), placeholder: "Optional context" })] }), _jsxs("div", { className: "page-actions", children: [_jsxs("span", { className: "status-chip", children: [timeLogDraft.durationMinutes, " min"] }), _jsx("button", { className: "primary-button", type: "button", onClick: () => {
                                                                        onSaveTimeLog({
                                                                            ...timeLogDraft,
                                                                            durationMinutes: calculateDurationMinutes(timeLogDraft.date, timeLogDraft.startTime, timeLogDraft.endTime),
                                                                        });
                                                                        setEditingTimeLogId(null);
                                                                        setTimeLogDraft(null);
                                                                    }, children: "Save log" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                                        setEditingTimeLogId(null);
                                                                        setTimeLogDraft(null);
                                                                    }, children: "Cancel" })] })] })) : null, currentTimeLogs.length ? currentTimeLogs.map((entry) => (_jsxs("button", { className: "list-item timelog-list-item", type: "button", onClick: () => {
                                                        setEditingTimeLogId(entry.id);
                                                        setTimeLogDraft(entry);
                                                    }, children: [_jsx("strong", { children: entry.date }), _jsxs("span", { children: [entry.startTime, " to ", entry.endTime] }), _jsxs("span", { children: [entry.durationMinutes, " min"] })] }, entry.id))) : _jsx("p", { className: "muted", children: "No time logged yet. Start a timer or add a manual entry here." }), editingTimeLogId && timeLogDraft && currentTimeLogs.some((entry) => entry.id === editingTimeLogId) ? (_jsx("div", { className: "page-actions", children: _jsx("button", { className: "danger-button small-button", type: "button", onClick: () => {
                                                            onDeleteTimeLog(editingTimeLogId);
                                                            setEditingTimeLogId(null);
                                                            setTimeLogDraft(null);
                                                        }, children: "Delete selected log" }) })) : null] })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: () => onSave({ ...editingDraft, activity: currentActivity?.description || editingDraft.activity }), children: "Save" }), _jsx("button", { className: "shell-button", type: "button", onClick: () => onConvertToActivity(editingDraft), children: "Convert to activity" })] })] })) : null })) : null] })] }));
};

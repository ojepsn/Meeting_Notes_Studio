import { useMemo, useState } from "react";
import type { ActivityRecord, ChecklistRecord, ChecklistRecurrenceCadence, ChecklistRecurrenceRecord, ChecklistTemplateRecord, ProjectLinkRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";

type StructureWorkspaceProps = {
  activities: ActivityRecord[];
  todos: TodoRecord[];
  checklists: ChecklistRecord[];
  checklistTemplates: ChecklistTemplateRecord[];
  checklistRecurrences: ChecklistRecurrenceRecord[];
  timeLogs: TimeLogRecord[];
  savedDomains: string[];
  savedProjects: string[];
  projectLinks: ProjectLinkRecord[];
  onAddDomain: (domain: string) => void;
  onRenameDomain: (previousValue: string, nextValue: string) => void;
  onAddProject: (project: string, domain: string) => void;
  onAddActivityToProject: (description: string, project: string, domain: string, type: ActivityRecord["type"]) => void;
  onCreateProjectChecklist: (project: string, title: string) => void;
  onCreateProjectChecklistFromTemplate: (project: string, templateId: string) => void;
  onCreateProjectChecklistRecurrence: (project: string, templateId: string, cadence: ChecklistRecurrenceCadence) => void;
  onSaveChecklist: (checklist: ChecklistRecord) => void;
  onDeleteChecklist: (id: string) => void;
  onCreateChecklistTemplate: (title: string, category?: string, items?: ChecklistTemplateRecord["items"]) => void;
  onSaveChecklistTemplate: (template: ChecklistTemplateRecord) => void;
  onDeleteChecklistTemplate: (id: string) => void;
  onDeleteChecklistRecurrence: (id: string) => void;
  onRenameProject: (previousValue: string, nextValue: string) => void;
  onAssignProjectDomain: (project: string, domain: string) => void;
  onOpenTodosForDomain: (domain: string) => void;
  onOpenTodosForProject: (project: string) => void;
  onOpenTimeForDomain: (domain: string) => void;
  onOpenTimeForProject: (project: string) => void;
  onOpenActivityDetail: (activityId: string) => void;
  onOpenTodoDetail: (todoId: string) => void;
};

type LinkedWorkPreview = {
  activities: ActivityRecord[];
  todos: TodoRecord[];
};

type StructureFocus = {
  kind: "domain" | "project";
  label: string;
} | null;

const CHECKLIST_RECURRENCE_OPTIONS: Array<{ value: ChecklistRecurrenceCadence; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
];

const formatMinutes = (minutes: number) => {
  if (!minutes) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
};

const getIsoWeekLabel = (value: Date) => {
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

const formatChecklistRecurrenceLabel = (cadence: ChecklistRecurrenceCadence) =>
  cadence === "weekly" ? "Weekly" : "Monthly";

const formatNextChecklistDueLabel = (cadence: ChecklistRecurrenceCadence, value = new Date()) => {
  const nextValue = new Date(value);
  if (cadence === "weekly") {
    nextValue.setDate(nextValue.getDate() + 7);
    return `Next due ${getIsoWeekLabel(nextValue)}`;
  }
  nextValue.setMonth(nextValue.getMonth() + 1, 1);
  return `Next due ${nextValue.getFullYear()}-${`${nextValue.getMonth() + 1}`.padStart(2, "0")}`;
};

const formatLastCreatedChecklistLabel = (checklist: ChecklistRecord | null) =>
  checklist?.title ? `Last created ${checklist.title}` : "Not created yet";

export const StructureWorkspace = ({
  activities,
  todos,
  checklists,
  checklistTemplates,
  checklistRecurrences,
  timeLogs,
  savedDomains,
  savedProjects,
  projectLinks,
  onAddDomain,
  onRenameDomain,
  onAddProject,
  onAddActivityToProject,
  onCreateProjectChecklist,
  onCreateProjectChecklistFromTemplate,
  onCreateProjectChecklistRecurrence,
  onSaveChecklist,
  onDeleteChecklist,
  onCreateChecklistTemplate,
  onSaveChecklistTemplate,
  onDeleteChecklistTemplate,
  onDeleteChecklistRecurrence,
  onRenameProject,
  onAssignProjectDomain,
  onOpenTodosForDomain,
  onOpenTodosForProject,
  onOpenTimeForDomain,
  onOpenTimeForProject,
  onOpenActivityDetail,
  onOpenTodoDetail,
}: StructureWorkspaceProps) => {
  const [domainDraft, setDomainDraft] = useState("");
  const [projectDraft, setProjectDraft] = useState("");
  const [projectDomainDraft, setProjectDomainDraft] = useState("");
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [editingDomainDraft, setEditingDomainDraft] = useState("");
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingProjectDraft, setEditingProjectDraft] = useState("");
  const [editingProjectDomainDraft, setEditingProjectDomainDraft] = useState("");
  const [addingActivityToProject, setAddingActivityToProject] = useState<string | null>(null);
  const [projectActivityDraft, setProjectActivityDraft] = useState("");
  const [projectActivityTypeDraft, setProjectActivityTypeDraft] = useState<ActivityRecord["type"]>("task");
  const [addingChecklistToProject, setAddingChecklistToProject] = useState<string | null>(null);
  const [projectChecklistDraft, setProjectChecklistDraft] = useState("");
  const [projectChecklistTemplateId, setProjectChecklistTemplateId] = useState("");
  const [projectChecklistRecurrenceCadence, setProjectChecklistRecurrenceCadence] = useState<ChecklistRecurrenceCadence>("monthly");
  const [checklistTemplateCategoryDraft, setChecklistTemplateCategoryDraft] = useState("General");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplateTitle, setEditingTemplateTitle] = useState("");
  const [editingTemplateCategory, setEditingTemplateCategory] = useState("General");
  const [checklistItemDrafts, setChecklistItemDrafts] = useState<Record<string, string>>({});
  const [focus, setFocus] = useState<StructureFocus>(null);

  const projectDomainLookup = useMemo(
    () =>
      Object.fromEntries(projectLinks.filter((entry) => entry.project).map((entry) => [entry.project, entry.domain])) as Record<string, string>,
    [projectLinks],
  );

  const allDomains = useMemo(
    () =>
      Array.from(
        new Set(
          [...savedDomains, ...activities.map((activity) => activity.domain), ...todos.map((todo) => todo.domain)]
            .map((entry) => entry.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [activities, savedDomains, todos],
  );

  const allProjects = useMemo(
    () =>
      Array.from(
        new Set(
          [...savedProjects, ...activities.map((activity) => activity.project), ...todos.map((todo) => todo.project)]
            .map((entry) => entry.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [activities, savedProjects, todos],
  );

  const timeLogMinutesByActivityId = useMemo(() => {
    const grouped = new Map<string, number>();
    timeLogs
      .filter((entry) => entry.targetType === "activity")
      .forEach((entry) => grouped.set(entry.targetId, (grouped.get(entry.targetId) || 0) + entry.durationMinutes));
    return grouped;
  }, [timeLogs]);

  const timeLogMinutesByTodoId = useMemo(() => {
    const grouped = new Map<string, number>();
    timeLogs
      .filter((entry) => entry.targetType === "todo")
      .forEach((entry) => grouped.set(entry.targetId, (grouped.get(entry.targetId) || 0) + entry.durationMinutes));
    return grouped;
  }, [timeLogs]);

  const domainRows = useMemo(() => {
    const groups = new Map<
      string,
      { activities: number; todos: number; minutes: number; preview: LinkedWorkPreview }
    >();

    const ensure = (label: string) => {
      const key = label || "No domain";
      if (!groups.has(key)) {
        groups.set(key, { activities: 0, todos: 0, minutes: 0, preview: { activities: [], todos: [] } });
      }
      return groups.get(key)!;
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
    const groups = new Map<
      string,
      { activities: number; todos: number; minutes: number; domain: string; preview: LinkedWorkPreview }
    >();

    const ensure = (label: string) => {
      const key = label || "No project";
      if (!groups.has(key)) {
        groups.set(key, { activities: 0, todos: 0, minutes: 0, domain: "", preview: { activities: [], todos: [] } });
      }
      return groups.get(key)!;
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
    if (!next) return;
    onAddDomain(next);
    setDomainDraft("");
  };

  const submitProject = () => {
    const next = projectDraft.trim();
    if (!next) return;
    onAddProject(next, projectDomainDraft.trim());
    setProjectDraft("");
    setProjectDomainDraft("");
  };

  const submitProjectActivity = (project: string, domain: string) => {
    const next = projectActivityDraft.trim();
    if (!next) return;
    onAddActivityToProject(next, project, domain, projectActivityTypeDraft);
    setAddingActivityToProject(null);
    setProjectActivityDraft("");
    setProjectActivityTypeDraft("task");
    setFocus({ kind: "project", label: project || "No project" });
  };

  const submitProjectChecklist = (project: string) => {
    const next = projectChecklistDraft.trim();
    if (!next) return;
    onCreateProjectChecklist(project, next);
    setAddingChecklistToProject(null);
    setProjectChecklistDraft("");
  };

  const setChecklistItemDraft = (checklistId: string, value: string) =>
    setChecklistItemDrafts((current) => ({ ...current, [checklistId]: value }));

  const saveChecklistItems = (checklist: ChecklistRecord, items: ChecklistRecord["items"]) => {
    onSaveChecklist({
      ...checklist,
      items,
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleChecklistItem = (checklist: ChecklistRecord, itemId: string) => {
    const timestamp = new Date().toISOString();
    saveChecklistItems(
      checklist,
      checklist.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              isChecked: !item.isChecked,
              checkedAt: item.isChecked ? null : timestamp,
            }
          : item,
      ),
    );
  };

  const addChecklistItem = (checklist: ChecklistRecord) => {
    const nextLabel = (checklistItemDrafts[checklist.id] || "").trim();
    if (!nextLabel) return;
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

  const deleteChecklistItem = (checklist: ChecklistRecord, itemId: string) => {
    saveChecklistItems(
      checklist,
      checklist.items
        .filter((item) => item.id !== itemId)
        .map((item, index) => ({ ...item, position: index + 1 })),
    );
  };

  const moveChecklistItem = (checklist: ChecklistRecord, itemId: string, direction: -1 | 1) => {
    const currentIndex = checklist.items.findIndex((item) => item.id === itemId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= checklist.items.length) return;
    const nextItems = [...checklist.items];
    const [moved] = nextItems.splice(currentIndex, 1);
    nextItems.splice(nextIndex, 0, moved);
    saveChecklistItems(
      checklist,
      nextItems.map((item, index) => ({ ...item, position: index + 1 })),
    );
  };

  const resetChecklist = (checklist: ChecklistRecord) => {
    saveChecklistItems(
      checklist,
      checklist.items.map((item, index) => ({
        ...item,
        isChecked: false,
        checkedAt: null,
        position: index + 1,
      })),
    );
  };

  const duplicateChecklist = (checklist: ChecklistRecord) => {
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

  const saveChecklistAsTemplate = (checklist: ChecklistRecord) => {
    onCreateChecklistTemplate(
      checklist.title,
      checklistTemplateCategoryDraft,
      checklist.items.map((item, index) => ({
        ...item,
        id: crypto.randomUUID(),
        isChecked: false,
        checkedAt: null,
        position: index + 1,
      })),
    );
  };

  const templateCategories = useMemo(
    () =>
      Array.from(
        new Set(
          checklistTemplates
            .map((template) => template.category?.trim() || "General")
            .filter(Boolean)
            .concat(["General", "Monthly", "Weekly", "People", "Compliance"]),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [checklistTemplates],
  );

  const templatesByCategory = useMemo(() => {
    const grouped = new Map<string, ChecklistTemplateRecord[]>();
    checklistTemplates.forEach((template) => {
      const category = template.category?.trim() || "General";
      grouped.set(category, [...(grouped.get(category) || []), template]);
    });
    return Array.from(grouped.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [checklistTemplates]);

  const beginTemplateEdit = (template: ChecklistTemplateRecord) => {
    setEditingTemplateId(template.id);
    setEditingTemplateTitle(template.title);
    setEditingTemplateCategory(template.category?.trim() || "General");
  };

  const cancelTemplateEdit = () => {
    setEditingTemplateId(null);
    setEditingTemplateTitle("");
    setEditingTemplateCategory("General");
  };

  const commitTemplateEdit = (template: ChecklistTemplateRecord) => {
    const nextTitle = editingTemplateTitle.trim();
    if (!nextTitle) return;
    onSaveChecklistTemplate({
      ...template,
      title: nextTitle,
      category: editingTemplateCategory.trim() || "General",
      updatedAt: new Date().toISOString(),
    });
    cancelTemplateEdit();
  };

  const focusedActivities = useMemo(() => {
    if (!focus) return [];
    return activities.filter((activity) => {
      if (focus.kind === "project") {
        return (activity.project || "No project") === focus.label;
      }
      return (projectDomainLookup[activity.project || ""] || activity.domain || "No domain") === focus.label;
    });
  }, [activities, focus, projectDomainLookup]);

  const focusedTodos = useMemo(() => {
    if (!focus) return [];
    return todos.filter((todo) => {
      if (focus.kind === "project") {
        return (todo.project || "No project") === focus.label;
      }
      return (projectDomainLookup[todo.project || ""] || todo.domain || "No domain") === focus.label;
    });
  }, [focus, projectDomainLookup, todos]);

  const focusedMinutes = useMemo(
    () =>
      focusedActivities.reduce((sum, activity) => sum + (timeLogMinutesByActivityId.get(activity.id) || 0), 0) +
      focusedTodos.reduce((sum, todo) => sum + (timeLogMinutesByTodoId.get(todo.id) || 0), 0),
    [focusedActivities, focusedTodos, timeLogMinutesByActivityId, timeLogMinutesByTodoId],
  );

  return (
    <div className="card todos-workspace todos-workspace-minimal structure-workspace-card">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Structure</h2>
          <p className="muted">Create and organize domains, projects, and project-owned activities here. Structure is now the home for this layer of the app.</p>
        </div>
      </div>

      <div className="structure-creation-grid">
        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>New domain</h3>
              <p className="muted">Use this for slower, deliberate structure work. Settings still remains the fallback admin home.</p>
            </div>
          </div>
          <div className="todos-workspace-input-row">
            <div className="field field-wide">
              <label htmlFor="structure-domain-draft">Domain</label>
              <input
                id="structure-domain-draft"
                value={domainDraft}
                onChange={(event) => setDomainDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitDomain();
                  }
                }}
                placeholder="Add a new domain"
              />
            </div>
            <button className="primary-button" type="button" onClick={submitDomain}>
              Add
            </button>
          </div>
        </div>

        <div className="sidebar-card">
          <div className="card-header">
            <div>
              <h3>New project</h3>
              <p className="muted">Projects can be set up here, then reused quickly in Notes, Calendar, Tasks, and Timelogs.</p>
            </div>
          </div>
          <div className="todos-workspace-input-row">
            <div className="field field-wide">
              <label htmlFor="structure-project-draft">Project</label>
              <input
                id="structure-project-draft"
                value={projectDraft}
                onChange={(event) => setProjectDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitProject();
                  }
                }}
                placeholder="Add a new project"
              />
            </div>
            <div className="field">
              <label htmlFor="structure-project-domain">Domain</label>
              <select id="structure-project-domain" value={projectDomainDraft} onChange={(event) => setProjectDomainDraft(event.target.value)}>
                <option value="">No domain</option>
                {allDomains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </div>
            <button className="primary-button" type="button" onClick={submitProject}>
              Add
            </button>
          </div>
        </div>
      </div>

      {focus ? (
        <div className="sidebar-card structure-focus-card">
          <div className="card-header">
            <div>
              <h3>
                {focus.kind === "domain" ? "Domain focus" : "Project focus"}: {focus.label}
              </h3>
              <p className="muted">Inspect the linked work here before drilling further into Tasks or Time.</p>
            </div>
            <div className="page-actions">
              <span className="status-chip">{focusedActivities.length} activities</span>
              <span className="status-chip">{focusedTodos.length} todos</span>
              <span className="status-chip">{formatMinutes(focusedMinutes)}</span>
              <button className="small-button" type="button" onClick={() => setFocus(null)}>
                Clear focus
              </button>
            </div>
          </div>
          <div className="structure-focus-grid">
            <div className="sidebar-card">
              <h4>Linked activities</h4>
              <div className="section-list">
                {focusedActivities.length ? (
                  focusedActivities.map((activity) => (
                    <button key={activity.id} className="list-item list-item-button" type="button" onClick={() => onOpenActivityDetail(activity.id)}>
                      <div>
                        <strong>{activity.description}</strong>
                        <div className="tiny-text">
                          {activity.project || activity.domain || "No project"} - {activity.type}
                        </div>
                      </div>
                      <span>{formatMinutes(timeLogMinutesByActivityId.get(activity.id) || 0)}</span>
                    </button>
                  ))
                ) : (
                  <p className="muted">No linked activities yet.</p>
                )}
              </div>
            </div>
            <div className="sidebar-card">
              <h4>Linked todos</h4>
              <div className="section-list">
                {focusedTodos.length ? (
                  focusedTodos.map((todo) => (
                    <button key={todo.id} className="list-item list-item-button" type="button" onClick={() => onOpenTodoDetail(todo.id)}>
                      <div>
                        <strong>{todo.description}</strong>
                        <div className="tiny-text">
                          {todo.project || todo.domain || "No project"}
                          {todo.activity ? ` - ${todo.activity}` : ""}
                        </div>
                      </div>
                      <span>{formatMinutes(timeLogMinutesByTodoId.get(todo.id) || 0)}</span>
                    </button>
                  ))
                ) : (
                  <p className="muted">No linked todos yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="time-workspace-layout">
        <section className="time-workspace-main">
          <div className="sidebar-card">
            <div className="card-header">
              <div>
                <h3>Domains</h3>
                <p className="muted">Top-level business areas with linked work inline.</p>
              </div>
            </div>
            <div className="time-log-table">
              {domainRows.map((row) => {
                const domain = row.label === "No domain" ? "" : row.label;
                const isEditing = editingDomain === row.label;
                return (
                  <div key={row.label} className="structure-card">
                    <div className="structure-row">
                      <div className="structure-main">
                        {isEditing ? (
                          <div className="todos-workspace-input-row">
                            <div className="field field-wide">
                              <label htmlFor={`structure-domain-edit-${row.label}`}>Rename domain</label>
                              <input
                                id={`structure-domain-edit-${row.label}`}
                                value={editingDomainDraft}
                                onChange={(event) => setEditingDomainDraft(event.target.value)}
                              />
                            </div>
                            <button
                              className="small-button"
                              type="button"
                              onClick={() => {
                                onRenameDomain(row.label, editingDomainDraft);
                                setEditingDomain(null);
                                setEditingDomainDraft("");
                              }}
                            >
                              Save
                            </button>
                            <button
                              className="small-button"
                              type="button"
                              onClick={() => {
                                setEditingDomain(null);
                                setEditingDomainDraft("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <strong>{row.label}</strong>
                          <div className="tiny-text">
                              {row.activities} activities - {row.todos} tasks - {formatMinutes(row.minutes)}
                            </div>
                          </>
                        )}
                      </div>
                      {!isEditing ? (
                        <div className="page-actions">
                          {domain ? (
                            <button
                              className="small-button"
                              type="button"
                              onClick={() => {
                                setEditingDomain(row.label);
                                setEditingDomainDraft(row.label);
                              }}
                            >
                              Edit
                            </button>
                          ) : null}
                          <button className="small-button" type="button" onClick={() => setFocus({ kind: "domain", label: row.label })}>
                            Inspect
                          </button>
                          <button className="small-button" type="button" onClick={() => onOpenTodosForDomain(domain)}>
                            Tasks
                          </button>
                          <button className="small-button" type="button" onClick={() => onOpenTimeForDomain(domain)}>
                            Time
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="structure-preview-row">
                      {row.preview.activities.length ? (
                        <div className="structure-preview-group">
                          <span className="tiny-text">Activities</span>
                          <div className="structure-preview-chips">
                            {row.preview.activities.map((activity) => (
                              <button
                                key={activity.id}
                                className="status-chip status-chip-button"
                                type="button"
                                onClick={() => onOpenActivityDetail(activity.id)}
                              >
                                {activity.description}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {row.preview.todos.length ? (
                        <div className="structure-preview-group">
                          <span className="tiny-text">Tasks</span>
                          <div className="structure-preview-chips">
                            {row.preview.todos.map((todo) => (
                              <button
                                key={todo.id}
                                className="status-chip status-chip-button"
                                type="button"
                                onClick={() => onOpenTodoDetail(todo.id)}
                              >
                                {todo.description}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="time-workspace-detail">
          <div className="sidebar-card">
            <div className="card-header">
              <div>
                <h3>Projects</h3>
                <p className="muted">This is the authoritative place to create activities inside projects and connect them to the rest of the app.</p>
              </div>
            </div>
            <details className="workspace-disclosure">
              <summary>Checklist templates</summary>
              <div className="workspace-disclosure-body stack">
                {templatesByCategory.length ? (
                  <div className="structure-checklist-list">
                    {templatesByCategory.map(([category, templates]) => (
                      <details key={category} className="structure-checklist-card" open>
                        <summary>
                          <span>{category}</span>
                          <span className="tiny-text">{templates.length} templates</span>
                        </summary>
                        <div className="structure-checklist-body">
                          {templates.map((template) => (
                            <div key={template.id} className="structure-checklist-card">
                              <div className="structure-checklist-body">
                                {editingTemplateId === template.id ? (
                                  <>
                                    <div className="todos-workspace-input-row">
                                      <div className="field field-wide">
                                        <label htmlFor={`structure-template-title-${template.id}`}>Template title</label>
                                        <input
                                          id={`structure-template-title-${template.id}`}
                                          value={editingTemplateTitle}
                                          onChange={(event) => setEditingTemplateTitle(event.target.value)}
                                        />
                                      </div>
                                      <div className="field structure-template-category-field">
                                        <label htmlFor={`structure-template-category-edit-${template.id}`}>Category</label>
                                        <select
                                          id={`structure-template-category-edit-${template.id}`}
                                          value={editingTemplateCategory}
                                          onChange={(event) => setEditingTemplateCategory(event.target.value)}
                                        >
                                          {templateCategories.map((categoryOption) => (
                                            <option key={categoryOption} value={categoryOption}>
                                              {categoryOption}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                    <div className="page-actions">
                                      <button className="small-button" type="button" onClick={() => commitTemplateEdit(template)}>
                                        Save
                                      </button>
                                      <button className="small-button" type="button" onClick={cancelTemplateEdit}>
                                        Cancel
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="structure-checklist-header">
                                      <strong>{template.title}</strong>
                                      <span className="tiny-text">{template.items.length} items</span>
                                    </div>
                                    <p className="muted">{template.items.map((item) => item.label).slice(0, 3).join(", ") || "No template items yet."}</p>
                                    <div className="page-actions">
                                      <button className="small-button" type="button" onClick={() => beginTemplateEdit(template)}>
                                        Edit
                                      </button>
                                      <button
                                        className="small-button danger-button"
                                        type="button"
                                        onClick={() => onDeleteChecklistTemplate(template.id)}
                                      >
                                        Delete template
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No checklist templates yet. Save a project or task checklist as a template to reuse it later. Reused templates create fresh checklist names with the current YYYY-MM.</p>
                )}
              </div>
            </details>
            <div className="time-log-table">
              {projectRows.map((row) => {
                const project = row.label === "No project" ? "" : row.label;
                const isEditing = editingProject === row.label;
                const projectChecklists = checklists
                  .filter((checklist) => checklist.ownerType === "project" && checklist.ownerId === project)
                  .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
                const projectChecklistRecurrences = checklistRecurrences
                  .filter((rule) => rule.ownerType === "project" && rule.ownerId === project)
                  .sort((left, right) => left.cadence.localeCompare(right.cadence) || right.updatedAt.localeCompare(left.updatedAt));
                return (
                  <div key={row.label} className="structure-card">
                    <div className="structure-row">
                      <div className="structure-main">
                        {isEditing ? (
                          <div className="todos-workspace-input-row">
                            <div className="field field-wide">
                              <label htmlFor={`structure-project-edit-${row.label}`}>Rename project</label>
                              <input
                                id={`structure-project-edit-${row.label}`}
                                value={editingProjectDraft}
                                onChange={(event) => setEditingProjectDraft(event.target.value)}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor={`structure-project-domain-${row.label}`}>Domain</label>
                              <select
                                id={`structure-project-domain-${row.label}`}
                                value={editingProjectDomainDraft}
                                onChange={(event) => setEditingProjectDomainDraft(event.target.value)}
                              >
                                <option value="">No domain</option>
                                {allDomains.map((domain) => (
                                  <option key={domain} value={domain}>
                                    {domain}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              className="small-button"
                              type="button"
                              onClick={() => {
                                onRenameProject(row.label, editingProjectDraft);
                                onAssignProjectDomain(editingProjectDraft.trim() || row.label, editingProjectDomainDraft.trim());
                                setEditingProject(null);
                                setEditingProjectDraft("");
                                setEditingProjectDomainDraft("");
                              }}
                            >
                              Save
                            </button>
                            <button
                              className="small-button"
                              type="button"
                              onClick={() => {
                                setEditingProject(null);
                                setEditingProjectDraft("");
                                setEditingProjectDomainDraft("");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <strong>{row.label}</strong>
                            <div className="tiny-text">
                              {row.domain || "No domain"} - {row.activities} activities - {row.todos} tasks - {formatMinutes(row.minutes)}
                            </div>
                          </>
                        )}
                      </div>
                      {!isEditing ? (
                        <div className="page-actions">
                          {project ? (
                            <button
                              className="small-button"
                              type="button"
                              onClick={() => {
                                setAddingChecklistToProject((current) => (current === row.label ? null : row.label));
                                setProjectChecklistDraft("");
                                setProjectChecklistTemplateId("");
                                setProjectChecklistRecurrenceCadence("monthly");
                              }}
                            >
                              {addingChecklistToProject === row.label ? "Close checklist" : "New checklist"}
                            </button>
                          ) : null}
                          {project ? (
                            <button
                              className="small-button"
                              type="button"
                              onClick={() => {
                                setAddingActivityToProject((current) => (current === row.label ? null : row.label));
                                setProjectActivityDraft("");
                                setProjectActivityTypeDraft("task");
                              }}
                            >
                              {addingActivityToProject === row.label ? "Close new activity" : "New activity"}
                            </button>
                          ) : null}
                          {project ? (
                            <button
                              className="small-button"
                              type="button"
                              onClick={() => {
                                setEditingProject(row.label);
                                setEditingProjectDraft(row.label);
                                setEditingProjectDomainDraft(projectDomainLookup[row.label] || row.domain || "");
                              }}
                            >
                              Edit
                            </button>
                          ) : null}
                          <button className="small-button" type="button" onClick={() => setFocus({ kind: "project", label: row.label })}>
                            Inspect
                          </button>
                          <button className="small-button" type="button" onClick={() => onOpenTodosForProject(project)}>
                            Tasks
                          </button>
                          <button className="small-button" type="button" onClick={() => onOpenTimeForProject(project)}>
                            Time
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {addingActivityToProject === row.label ? (
                      <div className="todos-workspace-input-row structure-inline-create-row">
                        <div className="field">
                          <label htmlFor={`structure-project-activity-type-${row.label}`}>Type</label>
                          <select
                            id={`structure-project-activity-type-${row.label}`}
                            value={projectActivityTypeDraft}
                            onChange={(event) => setProjectActivityTypeDraft(event.target.value === "meeting" ? "meeting" : "task")}
                          >
                            <option value="task">Task</option>
                            <option value="meeting">Meeting</option>
                          </select>
                        </div>
                        <div className="field field-wide">
                          <label htmlFor={`structure-project-activity-draft-${row.label}`}>New activity in {row.label}</label>
                          <input
                            id={`structure-project-activity-draft-${row.label}`}
                            value={projectActivityDraft}
                            onChange={(event) => setProjectActivityDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                submitProjectActivity(project, row.domain || "");
                              }
                            }}
                            placeholder={projectActivityTypeDraft === "meeting" ? "Add a meeting activity inside this project" : "Add an activity inside this project"}
                          />
                        </div>
                        <button className="primary-button" type="button" onClick={() => submitProjectActivity(project, row.domain || "")}>
                          Add
                        </button>
                      </div>
                    ) : null}
                    {addingChecklistToProject === row.label ? (
                      <div className="todos-workspace-input-row structure-inline-create-row">
                        <div className="field field-wide">
                          <label htmlFor={`structure-project-checklist-draft-${row.label}`}>New checklist in {row.label}</label>
                          <input
                            id={`structure-project-checklist-draft-${row.label}`}
                            value={projectChecklistDraft}
                            onChange={(event) => setProjectChecklistDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                submitProjectChecklist(project);
                              }
                            }}
                            placeholder="For example: Monthly reporting staff"
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`structure-project-checklist-template-${row.label}`}>Template</label>
                          <select
                            id={`structure-project-checklist-template-${row.label}`}
                            value={projectChecklistTemplateId}
                            onChange={(event) => setProjectChecklistTemplateId(event.target.value)}
                          >
                            <option value="">No template</option>
                            {checklistTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {`${template.category || "General"} - ${template.title}`}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`structure-project-checklist-recurrence-${row.label}`}>Recurring</label>
                          <select
                            id={`structure-project-checklist-recurrence-${row.label}`}
                            value={projectChecklistRecurrenceCadence}
                            onChange={(event) => setProjectChecklistRecurrenceCadence(event.target.value as ChecklistRecurrenceCadence)}
                          >
                            {CHECKLIST_RECURRENCE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <button className="primary-button" type="button" onClick={() => submitProjectChecklist(project)}>
                          Add
                        </button>
                        <button
                          className="small-button"
                          type="button"
                          disabled={!projectChecklistTemplateId}
                          onClick={() => {
                            if (!projectChecklistTemplateId) return;
                            onCreateProjectChecklistFromTemplate(project, projectChecklistTemplateId);
                            setProjectChecklistTemplateId("");
                            setAddingChecklistToProject(null);
                          }}
                        >
                          Use dated template
                        </button>
                        <button
                          className="small-button"
                          type="button"
                          disabled={!projectChecklistTemplateId}
                          onClick={() => {
                            if (!projectChecklistTemplateId) return;
                            onCreateProjectChecklistRecurrence(project, projectChecklistTemplateId, projectChecklistRecurrenceCadence);
                            setProjectChecklistTemplateId("");
                            setAddingChecklistToProject(null);
                          }}
                        >
                          Enable recurring
                        </button>
                      </div>
                    ) : null}
                    <div className="structure-preview-row">
                      {row.preview.activities.length ? (
                        <div className="structure-preview-group">
                          <span className="tiny-text">Activities</span>
                          <div className="structure-preview-chips">
                            {row.preview.activities.map((activity) => (
                              <button
                                key={activity.id}
                                className="status-chip status-chip-button"
                                type="button"
                                onClick={() => onOpenActivityDetail(activity.id)}
                              >
                                {activity.description}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {row.preview.todos.length ? (
                        <div className="structure-preview-group">
                          <span className="tiny-text">Tasks</span>
                          <div className="structure-preview-chips">
                            {row.preview.todos.map((todo) => (
                              <button
                                key={todo.id}
                                className="status-chip status-chip-button"
                                type="button"
                                onClick={() => onOpenTodoDetail(todo.id)}
                              >
                                {todo.description}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {project ? (
                      <div className="structure-checklist-section">
                        <div className="structure-checklist-header">
                          <span className="tiny-text">Checklists</span>
                          <span className="status-chip">{projectChecklists.length}</span>
                          <span className="status-chip">{projectChecklistRecurrences.length} recurring</span>
                        </div>
                        {projectChecklistRecurrences.length ? (
                          <div className="structure-checklist-list">
                            {projectChecklistRecurrences.map((rule) => {
                              const template = checklistTemplates.find((entry) => entry.id === rule.templateId);
                              const latestChecklist = projectChecklists.find((checklist) => checklist.recurrenceRuleId === rule.id) || null;
                              return (
                                <div key={rule.id} className="structure-checklist-card">
                                  <div className="structure-checklist-body">
                                    <div className="structure-checklist-header">
                                      <strong>{template?.title || "Missing template"}</strong>
                                      <span className="tiny-text">{formatChecklistRecurrenceLabel(rule.cadence)}</span>
                                    </div>
                                    <p className="muted">
                                      Automatically creates a fresh dated checklist for this project when a new {rule.cadence === "weekly" ? "week" : "month"} starts.
                                    </p>
                                    <div className="tiny-text">
                                      <div>{formatLastCreatedChecklistLabel(latestChecklist)}</div>
                                      <div>{formatNextChecklistDueLabel(rule.cadence)}</div>
                                    </div>
                                    <div className="page-actions">
                                      <button className="small-button danger-button" type="button" onClick={() => onDeleteChecklistRecurrence(rule.id)}>
                                        Disable recurring
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        {projectChecklists.length ? (
                          <div className="structure-checklist-list">
                            {projectChecklists.map((checklist) => {
                              const checkedCount = checklist.items.filter((item) => item.isChecked).length;
                              return (
                                <details key={checklist.id} className="structure-checklist-card">
                                  <summary>
                                    <span>{checklist.title}</span>
                                    <span className="tiny-text">
                                      {checkedCount}/{checklist.items.length}
                                    </span>
                                  </summary>
                                  <div className="structure-checklist-body">
                                    <div className="page-actions">
                                      <div className="field structure-template-category-field">
                                        <label htmlFor={`structure-template-category-${checklist.id}`}>Category</label>
                                        <select
                                          id={`structure-template-category-${checklist.id}`}
                                          value={checklistTemplateCategoryDraft}
                                          onChange={(event) => setChecklistTemplateCategoryDraft(event.target.value)}
                                        >
                                          {templateCategories.map((category) => (
                                            <option key={category} value={category}>
                                              {category}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <button className="small-button" type="button" onClick={() => saveChecklistAsTemplate(checklist)}>
                                        Save as template
                                      </button>
                                      <button className="small-button" type="button" onClick={() => duplicateChecklist(checklist)}>
                                        Duplicate
                                      </button>
                                      <button className="small-button" type="button" onClick={() => resetChecklist(checklist)}>
                                        Reset
                                      </button>
                                      <button className="small-button danger-button" type="button" onClick={() => onDeleteChecklist(checklist.id)}>
                                        Delete checklist
                                      </button>
                                    </div>
                                    {checklist.items.length ? (
                                      <div className="section-list">
                                        {checklist.items.map((item) => (
                                          <div key={item.id} className="list-item">
                                            <label className="structure-checklist-item">
                                              <input
                                                type="checkbox"
                                                checked={item.isChecked}
                                                onChange={() => toggleChecklistItem(checklist, item.id)}
                                              />
                                              <span>{item.label}</span>
                                            </label>
                                            <div className="page-actions">
                                              <button
                                                className="small-button"
                                                type="button"
                                                onClick={() => moveChecklistItem(checklist, item.id, -1)}
                                                disabled={item.position <= 1}
                                              >
                                                Up
                                              </button>
                                              <button
                                                className="small-button"
                                                type="button"
                                                onClick={() => moveChecklistItem(checklist, item.id, 1)}
                                                disabled={item.position >= checklist.items.length}
                                              >
                                                Down
                                              </button>
                                              <button
                                                className="small-button danger-button"
                                                type="button"
                                                onClick={() => deleteChecklistItem(checklist, item.id)}
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="muted">No checklist items yet.</p>
                                    )}
                                    <div className="todos-workspace-input-row">
                                      <div className="field field-wide">
                                        <label htmlFor={`structure-checklist-item-${checklist.id}`}>New item</label>
                                        <input
                                          id={`structure-checklist-item-${checklist.id}`}
                                          value={checklistItemDrafts[checklist.id] || ""}
                                          onChange={(event) => setChecklistItemDraft(checklist.id, event.target.value)}
                                          onKeyDown={(event) => {
                                            if (event.key === "Enter" && !event.shiftKey) {
                                              event.preventDefault();
                                              addChecklistItem(checklist);
                                            }
                                          }}
                                          placeholder="Add a checkbox item"
                                        />
                                      </div>
                                      <button className="small-button" type="button" onClick={() => addChecklistItem(checklist)}>
                                        Add item
                                      </button>
                                    </div>
                                  </div>
                                </details>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="muted">No project checklists yet.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

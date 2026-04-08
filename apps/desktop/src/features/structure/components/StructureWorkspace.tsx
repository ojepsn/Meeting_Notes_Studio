import { useMemo, useState } from "react";
import type { ActivityRecord, ProjectLinkRecord, TimeLogRecord, TodoRecord } from "@notesmith/domain";

type StructureWorkspaceProps = {
  activities: ActivityRecord[];
  todos: TodoRecord[];
  timeLogs: TimeLogRecord[];
  savedDomains: string[];
  savedProjects: string[];
  projectLinks: ProjectLinkRecord[];
  onAddDomain: (domain: string) => void;
  onRenameDomain: (previousValue: string, nextValue: string) => void;
  onAddProject: (project: string, domain: string) => void;
  onRenameProject: (previousValue: string, nextValue: string) => void;
  onAssignProjectDomain: (project: string, domain: string) => void;
  onOpenActivitiesForDomain: (domain: string) => void;
  onOpenActivitiesForProject: (project: string) => void;
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

const formatMinutes = (minutes: number) => {
  if (!minutes) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
};

export const StructureWorkspace = ({
  activities,
  todos,
  timeLogs,
  savedDomains,
  savedProjects,
  projectLinks,
  onAddDomain,
  onRenameDomain,
  onAddProject,
  onRenameProject,
  onAssignProjectDomain,
  onOpenActivitiesForDomain,
  onOpenActivitiesForProject,
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
          <p className="muted">Create and maintain domains and projects here, then jump straight into the linked work when you need to act.</p>
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
              <p className="muted">Projects can be set up here, then reused quickly in Notes, Calendar, Activities, and Todos.</p>
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
              <p className="muted">Inspect the linked work here before drilling further into Activities, Todos, or Time.</p>
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
                              {row.activities} activities - {row.todos} todos - {formatMinutes(row.minutes)}
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
                          <button className="small-button" type="button" onClick={() => onOpenActivitiesForDomain(domain)}>
                            Activities
                          </button>
                          <button className="small-button" type="button" onClick={() => setFocus({ kind: "domain", label: row.label })}>
                            Inspect
                          </button>
                          <button className="small-button" type="button" onClick={() => onOpenTodosForDomain(domain)}>
                            Todos
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
                          <span className="tiny-text">Todos</span>
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
                <p className="muted">Project-level structure with direct paths into the linked work.</p>
              </div>
            </div>
            <div className="time-log-table">
              {projectRows.map((row) => {
                const project = row.label === "No project" ? "" : row.label;
                const isEditing = editingProject === row.label;
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
                              {row.domain || "No domain"} - {row.activities} activities - {row.todos} todos - {formatMinutes(row.minutes)}
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
                                setEditingProject(row.label);
                                setEditingProjectDraft(row.label);
                                setEditingProjectDomainDraft(projectDomainLookup[row.label] || row.domain || "");
                              }}
                            >
                              Edit
                            </button>
                          ) : null}
                          <button className="small-button" type="button" onClick={() => onOpenActivitiesForProject(project)}>
                            Activities
                          </button>
                          <button className="small-button" type="button" onClick={() => setFocus({ kind: "project", label: row.label })}>
                            Inspect
                          </button>
                          <button className="small-button" type="button" onClick={() => onOpenTodosForProject(project)}>
                            Todos
                          </button>
                          <button className="small-button" type="button" onClick={() => onOpenTimeForProject(project)}>
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
                          <span className="tiny-text">Todos</span>
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
        </aside>
      </div>
    </div>
  );
};

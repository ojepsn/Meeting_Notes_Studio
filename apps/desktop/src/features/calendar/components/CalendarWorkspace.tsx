interface CalendarWorkspaceProps {
  todos: unknown[];
  activities: unknown[];
  calendarItems: unknown[];
  onCreateFromText: (date: string, startSlot: number, value: string) => void;
  onMoveItem: (id: string, date: string, startSlot: number) => void;
  onOpenTodoWorkspace: () => void;
  onOpenActivityWorkspace: (activityId: string) => void;
}

export const CalendarWorkspace = ({
  todos,
  activities,
  calendarItems,
  onOpenTodoWorkspace,
}: CalendarWorkspaceProps) => {
  return (
    <div className="card calendar-workspace">
      <div className="card-header session-editor-header-minimal">
        <div>
          <h2>Calendar</h2>
          <p className="tiny-text">Diagnostic imported component</p>
        </div>
      </div>
      <div className="stack">
        <span className="status-chip">{Array.isArray(todos) ? todos.length : 0} todos loaded</span>
        <span className="status-chip">{Array.isArray(activities) ? activities.length : 0} activities loaded</span>
        <span className="status-chip">{Array.isArray(calendarItems) ? calendarItems.length : 0} calendar items loaded</span>
        <button className="shell-button" type="button" onClick={onOpenTodoWorkspace}>
          Open Todos
        </button>
      </div>
    </div>
  );
};

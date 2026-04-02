import { useMemo, useState } from "react";
import type { SessionRecord } from "@notesmith/domain";

interface SessionsSidebarProps {
  sessions: SessionRecord[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export const SessionsSidebar = ({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
}: SessionsSidebarProps) => {
  const [filter, setFilter] = useState("");

  const filteredSessions = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return sessions;
    return sessions.filter((session) =>
      [session.title, session.date, session.participantText, session.project, session.department, session.tagsText, session.manualNotes, session.liveTranscript]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [filter, sessions]);

  return (
    <aside className="sidebar-card" id="desktop-sessions-card">
      <div className="card-header">
        <div>
          <h3>All Sessions</h3>
          <p>SQLite-backed session history will live here once the full Tauri runtime is in place.</p>
        </div>
        <button className="primary-button" type="button" onClick={onCreate}>
          + New Session
        </button>
      </div>
      <div className="field">
        <label htmlFor="session-filter-desktop">Filter sessions</label>
        <input
          id="session-filter-desktop"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search title, notes, transcript, people, project, tags"
        />
      </div>
      <div className="session-list">
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            className="list-item"
            style={{
              background: session.id === activeSessionId ? "rgba(223, 231, 204, 0.92)" : undefined,
            }}
          >
            <button
              type="button"
              style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
              onClick={() => onSelect(session.id)}
            >
              <strong>
                {session.date || "No date"} {session.title || "Untitled session"}
              </strong>
              <span className="muted">
                {[session.participantText, session.project, session.department, session.tagsText].filter(Boolean).join(" · ") || "No metadata yet"}
              </span>
            </button>
            <div className="list-item-actions">
              <button className="small-button" type="button" onClick={() => onSelect(session.id)}>
                Open
              </button>
              <button className="small-button danger-button" type="button" onClick={() => onDelete(session.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

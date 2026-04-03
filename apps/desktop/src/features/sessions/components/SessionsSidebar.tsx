import { useMemo, useState } from "react";
import type { SessionRecord } from "@notesmith/domain";

interface SessionsSidebarProps {
  sessions: SessionRecord[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  compact?: boolean;
  title?: string;
}

export const SessionsSidebar = ({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
  compact = false,
  title = "All Sessions",
}: SessionsSidebarProps) => {
  const [filter, setFilter] = useState("");
  const [showPublic, setShowPublic] = useState(true);
  const [showPrivate, setShowPrivate] = useState(true);

  const filteredSessions = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return sessions.filter((session) => {
      if (session.isPrivate && !showPrivate) {
        return false;
      }
      if (!session.isPrivate && !showPublic) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        session.title,
        session.date,
        session.participantText,
        session.domain,
        session.project,
        session.activity,
        session.tagsText,
        session.manualNotes,
        session.liveTranscript,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [filter, sessions, showPrivate, showPublic]);

  return (
    <aside className="sidebar-card" id="desktop-sessions-card">
      <div className="card-header">
        <div>
          <h3>{title}</h3>
          {!compact ? <p>Browse and reopen saved sessions from local desktop storage.</p> : null}
        </div>
        {!compact ? (
          <button className="primary-button" type="button" onClick={onCreate}>
            + New Session
          </button>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor={`session-filter-${compact ? "compact" : "desktop"}`}>{compact ? "Search" : "Filter sessions"}</label>
        <input
          id={`session-filter-${compact ? "compact" : "desktop"}`}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search title, notes, transcript, people, project, tags"
        />
      </div>
      <div className="session-visibility-filters">
        <label className="checkbox-label">
          <input type="checkbox" checked={showPublic} onChange={(event) => setShowPublic(event.target.checked)} />
          <span>Show public</span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={showPrivate} onChange={(event) => setShowPrivate(event.target.checked)} />
          <span>Show private</span>
        </label>
      </div>
      <div className={`session-list${compact ? " session-list-compact" : ""}`}>
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            className={`list-item${compact ? " compact-session-item" : ""}`}
            style={{
              background: session.id === activeSessionId ? "rgba(223, 231, 204, 0.92)" : undefined,
            }}
          >
            <button
              type="button"
              style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
              onClick={() => onSelect(session.id)}
            >
              {compact ? (
                <div className="compact-session-row">
                  <strong>{session.title || "Untitled session"}</strong>
                  <span className="muted">
                    {[session.date || "No date", session.isPrivate ? "Private" : "Public"].join(" · ")}
                  </span>
                </div>
              ) : (
                <>
                  <strong>{session.title || "Untitled session"}</strong>
                  <span className="muted">
                    {[session.date || "No date", session.isPrivate ? "Private" : "", session.participantText, session.domain, session.project, session.activity, session.tagsText]
                      .filter(Boolean)
                      .join(" · ") || "No metadata yet"}
                  </span>
                </>
              )}
            </button>
            {!compact ? (
              <div className="list-item-actions">
                <button className="small-button" type="button" onClick={() => onSelect(session.id)}>
                  Open
                </button>
                <button className="small-button danger-button" type="button" onClick={() => onDelete(session.id)}>
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
};

import { useMemo, useState } from "react";
import type { SessionRecord } from "@notesmith/domain";

interface SessionsSidebarProps {
  sessions: SessionRecord[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose?: () => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  compact?: boolean;
  title?: string;
}

const formatDeletedLabel = (value: string | null | undefined) => {
  if (!value) {
    return "Deleted";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Deleted";
  }
  return `Deleted ${date.toLocaleDateString()}`;
};

const richTextToPlainText = (value: string) => {
  if (!value) return "";
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value;
  const text = typeof wrapper.innerText === "string" ? wrapper.innerText : wrapper.textContent || "";
  return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};

export const SessionsSidebar = ({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onClose,
  onDelete,
  onRestore,
  onDeleteForever,
  compact = false,
  title = "All Sessions",
}: SessionsSidebarProps) => {
  const [filter, setFilter] = useState("");
  const [showPublic, setShowPublic] = useState(true);
  const [showPrivate, setShowPrivate] = useState(true);
  const [showTrash, setShowTrash] = useState(false);

  const filteredSessions = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return sessions.filter((session) => {
      if (showTrash) {
        if (!session.deletedAt) {
          return false;
        }
      } else {
        if (session.deletedAt) {
          return false;
        }
        if (session.isPrivate && !showPrivate) {
          return false;
        }
        if (!session.isPrivate && !showPublic) {
          return false;
        }
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
        richTextToPlainText(session.manualNotes),
        session.liveTranscript,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [filter, sessions, showPrivate, showPublic, showTrash]);

  if (compact) {
    return (
      <aside className="sidebar-card sessions-sidebar-pwa" id="desktop-sessions-card">
        <div className="panel-heading sessions-sidebar-pwa-heading">
          <div>
            <p className="section-label">Recent Sessions</p>
            <h3>Your note shelf</h3>
          </div>
          {onClose ? (
            <button className="ghost-button sessions-panel-toggle" type="button" onClick={onClose}>
              Close
            </button>
          ) : null}
        </div>
        <div className="field field-tight session-filter-field">
          <label htmlFor="session-filter-compact">Filter sessions</label>
          <input
            id="session-filter-compact"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Type to filter sessions"
          />
        </div>
        <div className="session-list session-list-compact session-list-pwa-compact">
          {filteredSessions.filter((session) => !session.deletedAt).map((session) => {
            const isActive = session.id === activeSessionId;
            const subtitle = [session.captureMode === "meeting-note" ? "Meeting" : session.captureMode === "voice-note" ? "Voice note" : "Quick note", session.date, session.startTime].filter(Boolean).join(" · ");
            const preview = session.output.trim() || richTextToPlainText(session.manualNotes) || session.liveTranscript.trim() || "Open to continue capturing or polishing this session.";

            return (
              <div key={session.id} className={`list-item compact-session-item session-card-pwa${isActive ? " session-card-pwa-active" : ""}`}>
                <div className="compact-session-row compact-session-row-pwa">
                  <button className="compact-session-link compact-session-link-pwa" type="button" onClick={() => onSelect(session.id)}>
                    <div className="compact-session-main compact-session-main-pwa">
                      <strong>{session.title || "Untitled session"}</strong>
                      <span className="muted">{subtitle || "No metadata yet"}</span>
                      <p className="compact-session-preview">{preview}</p>
                    </div>
                  </button>
                  <div className="compact-session-actions">
                    <button className="compact-session-delete" type="button" onClick={() => onDelete(session.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {!filteredSessions.filter((session) => !session.deletedAt).length ? (
            <div className="empty-sessions">
              <p>No saved sessions yet. Start with a fresh note and it will appear here automatically.</p>
            </div>
          ) : null}
        </div>
      </aside>
    );
  }

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
          <input
            type="checkbox"
            checked={showPublic}
            onChange={(event) => setShowPublic(event.target.checked)}
            disabled={showTrash}
          />
          <span>Show public</span>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showPrivate}
            onChange={(event) => setShowPrivate(event.target.checked)}
            disabled={showTrash}
          />
          <span>Show private</span>
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={showTrash} onChange={(event) => setShowTrash(event.target.checked)} />
          <span>Show trash</span>
        </label>
      </div>
      <div className={`session-list${compact ? " session-list-compact" : ""}`}>
        {filteredSessions.map((session) => {
          const isActive = session.id === activeSessionId;
          const metadata = showTrash
            ? [formatDeletedLabel(session.deletedAt), session.isPrivate ? "Private" : "Public"]
            : [session.date || "No date", session.isPrivate ? "Private" : "Public"];
          const secondaryMetadata = showTrash
            ? [formatDeletedLabel(session.deletedAt), session.participantText, session.domain, session.project, session.activity, session.tagsText]
            : [session.date || "No date", session.isPrivate ? "Private" : "", session.participantText, session.domain, session.project, session.activity, session.tagsText];

          return (
            <div
              key={session.id}
              className={`list-item${compact ? " compact-session-item" : ""}`}
              style={{
                background: isActive && !showTrash ? "rgba(223, 231, 204, 0.92)" : undefined,
              }}
            >
              {compact ? (
                <div className="compact-session-row">
                  <button
                    className="compact-session-link"
                    type="button"
                    onClick={() => {
                      if (showTrash) return;
                      onSelect(session.id);
                    }}
                    disabled={showTrash}
                  >
                    <div className="compact-session-main">
                      <strong>{session.title || "Untitled session"}</strong>
                      <span className="muted">{metadata.filter(Boolean).join(" | ")}</span>
                    </div>
                  </button>
                  <div className="compact-session-actions">
                    {showTrash ? (
                      <>
                        <button
                          className="compact-session-restore"
                          type="button"
                          onClick={() => onRestore(session.id)}
                        >
                          Restore
                        </button>
                        <button
                          className="compact-session-delete"
                          type="button"
                          onClick={() => onDeleteForever(session.id)}
                        >
                          Delete now
                        </button>
                      </>
                    ) : (
                      <button className="compact-session-delete" type="button" onClick={() => onDelete(session.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="session-item-button"
                    type="button"
                    onClick={() => {
                      if (showTrash) return;
                      onSelect(session.id);
                    }}
                    disabled={showTrash}
                  >
                    <strong>{session.title || "Untitled session"}</strong>
                    <span className="muted">
                      {secondaryMetadata.filter(Boolean).join(" | ") || "No metadata yet"}
                    </span>
                  </button>
                  <div className="list-item-actions">
                    {showTrash ? (
                      <>
                        <button className="small-button" type="button" onClick={() => onRestore(session.id)}>
                          Restore
                        </button>
                        <button className="small-button danger-button" type="button" onClick={() => onDeleteForever(session.id)}>
                          Delete now
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="small-button" type="button" onClick={() => onSelect(session.id)}>
                          Open
                        </button>
                        <button className="small-button danger-button" type="button" onClick={() => onDelete(session.id)}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

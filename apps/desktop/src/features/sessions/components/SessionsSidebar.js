import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
export const SessionsSidebar = ({ sessions, activeSessionId, onSelect, onCreate, onDelete, compact = false, title = "All Sessions", }) => {
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
    return (_jsxs("aside", { className: "sidebar-card", id: "desktop-sessions-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h3", { children: title }), !compact ? _jsx("p", { children: "Browse and reopen saved sessions from local desktop storage." }) : null] }), !compact ? (_jsx("button", { className: "primary-button", type: "button", onClick: onCreate, children: "+ New Session" })) : null] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `session-filter-${compact ? "compact" : "desktop"}`, children: compact ? "Search" : "Filter sessions" }), _jsx("input", { id: `session-filter-${compact ? "compact" : "desktop"}`, value: filter, onChange: (event) => setFilter(event.target.value), placeholder: "Search title, notes, transcript, people, project, tags" })] }), _jsxs("div", { className: "session-visibility-filters", children: [_jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: showPublic, onChange: (event) => setShowPublic(event.target.checked) }), _jsx("span", { children: "Show public" })] }), _jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: showPrivate, onChange: (event) => setShowPrivate(event.target.checked) }), _jsx("span", { children: "Show private" })] })] }), _jsx("div", { className: `session-list${compact ? " session-list-compact" : ""}`, children: filteredSessions.map((session) => (_jsxs("div", { className: `list-item${compact ? " compact-session-item" : ""}`, style: {
                        background: session.id === activeSessionId ? "rgba(223, 231, 204, 0.92)" : undefined,
                    }, children: [_jsx("button", { type: "button", style: { all: "unset", cursor: "pointer", display: "block", width: "100%" }, onClick: () => onSelect(session.id), children: compact ? (_jsxs("div", { className: "compact-session-row", children: [_jsx("strong", { children: session.title || "Untitled session" }), _jsx("span", { className: "muted", children: [session.date || "No date", session.isPrivate ? "Private" : "Public"].join(" · ") })] })) : (_jsxs(_Fragment, { children: [_jsx("strong", { children: session.title || "Untitled session" }), _jsx("span", { className: "muted", children: [session.date || "No date", session.isPrivate ? "Private" : "", session.participantText, session.domain, session.project, session.activity, session.tagsText]
                                            .filter(Boolean)
                                            .join(" · ") || "No metadata yet" })] })) }), !compact ? (_jsxs("div", { className: "list-item-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => onSelect(session.id), children: "Open" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDelete(session.id), children: "Delete" })] })) : null] }, session.id))) })] }));
};

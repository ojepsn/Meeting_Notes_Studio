import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
export const SessionsSidebar = ({ sessions, activeSessionId, onSelect, onCreate, onDelete, }) => {
    const [filter, setFilter] = useState("");
    const filteredSessions = useMemo(() => {
        const query = filter.trim().toLowerCase();
        if (!query)
            return sessions;
        return sessions.filter((session) => [session.title, session.date, session.participantText, session.manualNotes, session.liveTranscript]
            .join(" ")
            .toLowerCase()
            .includes(query));
    }, [filter, sessions]);
    return (_jsxs("aside", { className: "sidebar-card", id: "desktop-sessions-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h3", { children: "All Sessions" }), _jsx("p", { children: "SQLite-backed session history will live here once the full Tauri runtime is in place." })] }), _jsx("button", { className: "primary-button", type: "button", onClick: onCreate, children: "+ New Session" })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "session-filter-desktop", children: "Filter sessions" }), _jsx("input", { id: "session-filter-desktop", value: filter, onChange: (event) => setFilter(event.target.value), placeholder: "Search title, notes, transcript, participants" })] }), _jsx("div", { className: "session-list", children: filteredSessions.map((session) => (_jsxs("div", { className: "list-item", style: {
                        background: session.id === activeSessionId ? "rgba(223, 231, 204, 0.92)" : undefined,
                    }, children: [_jsxs("button", { type: "button", style: { all: "unset", cursor: "pointer", display: "block", width: "100%" }, onClick: () => onSelect(session.id), children: [_jsxs("strong", { children: [session.date || "No date", " ", session.title || "Untitled session"] }), _jsx("span", { className: "muted", children: session.participantText || "No participants yet" })] }), _jsxs("div", { className: "list-item-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => onSelect(session.id), children: "Open" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDelete(session.id), children: "Delete" })] })] }, session.id))) })] }));
};

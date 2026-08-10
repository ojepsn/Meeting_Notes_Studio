import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from "react";
const formatDeletedLabel = (value) => {
    if (!value) {
        return "Deleted";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Deleted";
    }
    return `Deleted ${date.toLocaleDateString()}`;
};
const richTextToPlainText = (value) => {
    if (!value)
        return "";
    const wrapper = document.createElement("div");
    wrapper.innerHTML = value;
    const text = typeof wrapper.innerText === "string" ? wrapper.innerText : wrapper.textContent || "";
    return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
};
export const getPermanentSessionDeleteConfirmation = (title) => `Permanently delete "${title || "Untitled session"}"?\n\nThis cannot be undone. Attached recordings and files will also be deleted.`;
export const SessionsSidebar = ({ sessions, activeSessionId, onSelect, onCreate, onClose, onDelete, onRestore, onDeleteForever, compact = false, title = "All Sessions", }) => {
    const [filter, setFilter] = useState("");
    const [showPublic, setShowPublic] = useState(true);
    const [showPrivate, setShowPrivate] = useState(true);
    const [showTrash, setShowTrash] = useState(false);
    const handleDeleteForever = (session) => {
        if (window.confirm(getPermanentSessionDeleteConfirmation(session.title))) {
            onDeleteForever(session.id);
        }
    };
    const filteredSessions = useMemo(() => {
        const query = filter.trim().toLowerCase();
        return sessions.filter((session) => {
            if (showTrash) {
                if (!session.deletedAt) {
                    return false;
                }
            }
            else {
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
        return (_jsxs("aside", { className: "sidebar-card sessions-sidebar-pwa", id: "desktop-sessions-card", children: [_jsxs("div", { className: "panel-heading sessions-sidebar-pwa-heading", children: [_jsxs("div", { children: [_jsx("p", { className: "section-label", children: "Recent Sessions" }), _jsx("h3", { children: "Your note shelf" })] }), onClose ? (_jsx("button", { className: "ghost-button sessions-panel-toggle", type: "button", onClick: onClose, children: "Close" })) : null] }), _jsxs("div", { className: "field field-tight session-filter-field", children: [_jsx("label", { htmlFor: "session-filter-compact", children: "Filter sessions" }), _jsx("input", { id: "session-filter-compact", value: filter, onChange: (event) => setFilter(event.target.value), placeholder: "Type to filter sessions" })] }), _jsxs("div", { className: "session-list session-list-compact session-list-pwa-compact", children: [filteredSessions.filter((session) => !session.deletedAt).map((session) => {
                            const isActive = session.id === activeSessionId;
                            const subtitle = [session.captureMode === "meeting-note" ? "Meeting" : session.captureMode === "voice-note" ? "Voice note" : "Quick note", session.date, session.startTime].filter(Boolean).join(" · ");
                            const preview = session.output.trim() || richTextToPlainText(session.manualNotes) || session.liveTranscript.trim() || "Open to continue capturing or polishing this session.";
                            return (_jsx("div", { className: `list-item compact-session-item session-card-pwa${isActive ? " session-card-pwa-active" : ""}`, children: _jsxs("div", { className: "compact-session-row compact-session-row-pwa", children: [_jsx("button", { className: "compact-session-link compact-session-link-pwa", type: "button", onClick: () => onSelect(session.id), children: _jsxs("div", { className: "compact-session-main compact-session-main-pwa", children: [_jsx("strong", { children: session.title || "Untitled session" }), _jsx("span", { className: "muted", children: subtitle || "No metadata yet" }), _jsx("p", { className: "compact-session-preview", children: preview })] }) }), _jsx("div", { className: "compact-session-actions", children: _jsx("button", { className: "compact-session-delete", type: "button", onClick: () => onDelete(session.id), children: "Delete" }) })] }) }, session.id));
                        }), !filteredSessions.filter((session) => !session.deletedAt).length ? (_jsx("div", { className: "empty-sessions", children: _jsx("p", { children: "No saved sessions yet. Start with a fresh note and it will appear here automatically." }) })) : null] })] }));
    }
    return (_jsxs("aside", { className: "sidebar-card", id: "desktop-sessions-card", children: [_jsxs("div", { className: "card-header", children: [_jsxs("div", { children: [_jsx("h3", { children: title }), !compact ? _jsx("p", { children: "Browse and reopen saved sessions from local desktop storage." }) : null] }), !compact ? (_jsx("button", { className: "primary-button", type: "button", onClick: onCreate, children: "+ New Session" })) : null] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: `session-filter-${compact ? "compact" : "desktop"}`, children: compact ? "Search" : "Filter sessions" }), _jsx("input", { id: `session-filter-${compact ? "compact" : "desktop"}`, value: filter, onChange: (event) => setFilter(event.target.value), placeholder: "Search title, notes, transcript, people, project, tags" })] }), _jsxs("div", { className: "session-visibility-filters", children: [_jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: showPublic, onChange: (event) => setShowPublic(event.target.checked), disabled: showTrash }), _jsx("span", { children: "Show public" })] }), _jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: showPrivate, onChange: (event) => setShowPrivate(event.target.checked), disabled: showTrash }), _jsx("span", { children: "Show private" })] }), _jsxs("label", { className: "checkbox-label", children: [_jsx("input", { type: "checkbox", checked: showTrash, onChange: (event) => setShowTrash(event.target.checked) }), _jsx("span", { children: "Show trash" })] })] }), _jsx("div", { className: `session-list${compact ? " session-list-compact" : ""}`, children: filteredSessions.map((session) => {
                    const isActive = session.id === activeSessionId;
                    const metadata = showTrash
                        ? [formatDeletedLabel(session.deletedAt), session.isPrivate ? "Private" : "Public"]
                        : [session.date || "No date", session.isPrivate ? "Private" : "Public"];
                    const secondaryMetadata = showTrash
                        ? [formatDeletedLabel(session.deletedAt), session.participantText, session.domain, session.project, session.activity, session.tagsText]
                        : [session.date || "No date", session.isPrivate ? "Private" : "", session.participantText, session.domain, session.project, session.activity, session.tagsText];
                    return (_jsx("div", { className: `list-item${compact ? " compact-session-item" : ""}`, style: {
                            background: isActive && !showTrash ? "rgba(223, 231, 204, 0.92)" : undefined,
                        }, children: compact ? (_jsxs("div", { className: "compact-session-row", children: [_jsx("button", { className: "compact-session-link", type: "button", onClick: () => {
                                        if (showTrash)
                                            return;
                                        onSelect(session.id);
                                    }, disabled: showTrash, children: _jsxs("div", { className: "compact-session-main", children: [_jsx("strong", { children: session.title || "Untitled session" }), _jsx("span", { className: "muted", children: metadata.filter(Boolean).join(" | ") })] }) }), _jsx("div", { className: "compact-session-actions", children: showTrash ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "compact-session-restore", type: "button", onClick: () => onRestore(session.id), children: "Restore" }), _jsx("button", { className: "compact-session-delete", type: "button", onClick: () => handleDeleteForever(session), children: "Delete permanently" })] })) : (_jsx("button", { className: "compact-session-delete", type: "button", onClick: () => onDelete(session.id), children: "Delete" })) })] })) : (_jsxs(_Fragment, { children: [_jsxs("button", { className: "session-item-button", type: "button", onClick: () => {
                                        if (showTrash)
                                            return;
                                        onSelect(session.id);
                                    }, disabled: showTrash, children: [_jsx("strong", { children: session.title || "Untitled session" }), _jsx("span", { className: "muted", children: secondaryMetadata.filter(Boolean).join(" | ") || "No metadata yet" })] }), _jsx("div", { className: "list-item-actions", children: showTrash ? (_jsxs(_Fragment, { children: [_jsx("button", { className: "small-button", type: "button", onClick: () => onRestore(session.id), children: "Restore" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => handleDeleteForever(session), children: "Delete permanently" })] })) : (_jsxs(_Fragment, { children: [_jsx("button", { className: "small-button", type: "button", onClick: () => onSelect(session.id), children: "Open" }), _jsx("button", { className: "small-button danger-button", type: "button", onClick: () => onDelete(session.id), children: "Delete" })] })) })] })) }, session.id));
                }) })] }));
};

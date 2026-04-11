import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { PeoplePicker } from "../../../components/PeoplePicker";
import { TokenPicker } from "../../../components/TokenPicker";
import { AttachmentImagePreview } from "../../../components/AttachmentImagePreview";
import { DateInput } from "../../../components/DateInput";
import { getActivitiesForSelection, getProjectsForDomain } from "../../../lib/structure/options";
import { useState } from "react";
const parseFollowUpCandidate = (value) => {
    const trimmed = value.trim();
    const ownerMatch = trimmed.match(/(?:^|[\s(])@([A-Za-z][\w .-]{1,40})/);
    const explicitOwnerMatch = trimmed.match(/owner:\s*([A-Za-z][\w .-]{1,40})/i);
    const isoDateMatch = trimmed.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const todayMatch = trimmed.match(/\btoday\b/i);
    const tomorrowMatch = trimmed.match(/\btomorrow\b/i);
    const nextDate = (() => {
        if (isoDateMatch)
            return isoDateMatch[1];
        if (todayMatch)
            return new Date().toISOString().slice(0, 10);
        if (tomorrowMatch) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow.toISOString().slice(0, 10);
        }
        return "";
    })();
    const owner = explicitOwnerMatch?.[1]?.trim() || ownerMatch?.[1]?.trim() || "";
    const cleaned = trimmed
        .replace(/\b(20\d{2}-\d{2}-\d{2})\b/, "")
        .replace(/\btoday\b/i, "")
        .replace(/\btomorrow\b/i, "")
        .replace(/owner:\s*[A-Za-z][\w .-]{1,40}/i, "")
        .replace(/(?:^|[\s(])@[A-Za-z][\w .-]{1,40}/, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
        .replace(/^[-*]\s+/, "");
    return {
        description: cleaned,
        owner,
        date: nextDate,
    };
};
export const OutputWorkspace = ({ session, attachments, presentation = "full", showPresentationActions = true, onChange, savedPeople, suggestedPeople, savedProjects, suggestedProjects, savedDomains, suggestedDomains, savedActivities, suggestedActivities, structureOptions, savedTags, suggestedTags, isPrimaryActionRunning, isSecondaryActionRunning, isRevising, onPrimaryAction, onSecondaryAction, onTranslate, onRevise, onExportText, onExportMarkdown, onExportHtml, onExportDocx, onExportPdf, primaryActionLabel = "Generate", secondaryActionLabel = null, emptyStatePrimaryLabel = "Generate polished notes", emptyStateSecondaryLabel = null, linkedActivity = null, onOpenLinkedActivity, onAddFollowUpTodo, onAddFollowUpMeeting, }) => {
    const [revisionInstructions, setRevisionInstructions] = useState("");
    const [followUpDraft, setFollowUpDraft] = useState("");
    const [selectedFollowUps, setSelectedFollowUps] = useState([]);
    const [selectedExcerpt, setSelectedExcerpt] = useState("");
    const [reviewKind, setReviewKind] = useState("todo");
    const [reviewDescription, setReviewDescription] = useState("");
    const [reviewOwner, setReviewOwner] = useState("");
    const [reviewDate, setReviewDate] = useState("");
    const includedImages = attachments
        .filter((attachment) => attachment.kind === "image" && attachment.includeInOutput)
        .sort((left, right) => left.outputPosition - right.outputPosition || left.createdAt.localeCompare(right.createdAt));
    const hasOutput = Boolean(session.output.trim());
    const isMeetingNote = session.captureMode === "meeting-note";
    const isMinimal = presentation === "minimal";
    const filteredProjects = getProjectsForDomain(structureOptions, session.domain);
    const filteredActivities = getActivitiesForSelection(structureOptions, session.domain, session.project);
    const projectPickerOptions = filteredProjects.length ? filteredProjects : savedProjects;
    const activityPickerOptions = filteredActivities.length ? filteredActivities : savedActivities;
    const filteredProjectSet = new Set(projectPickerOptions);
    const filteredActivitySet = new Set(activityPickerOptions);
    const suggestedProjectsForSelection = suggestedProjects.filter((project) => filteredProjectSet.has(project));
    const suggestedActivitiesForSelection = suggestedActivities.filter((activity) => filteredActivitySet.has(activity));
    const followUpSuggestions = session.output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^([-*]\s+|\d+[.)]\s+)/.test(line))
        .map((line) => line.replace(/^([-*]\s+|\d+[.)]\s+)/, "").trim())
        .filter((line) => line.length >= 6)
        .slice(0, 8);
    const excerptPreview = selectedExcerpt.length > 180 ? `${selectedExcerpt.slice(0, 177).trimEnd()}...` : selectedExcerpt;
    const applyReviewSeed = (value, kind = "todo") => {
        const parsed = parseFollowUpCandidate(value);
        setReviewKind(kind);
        setReviewDescription(parsed.description || value.trim());
        setReviewOwner(parsed.owner);
        setReviewDate(parsed.date || session.date);
    };
    const ownerComment = reviewOwner ? `Owner: ${reviewOwner}` : "";
    const handleDomainChange = (domain) => {
        const nextProjects = getProjectsForDomain(structureOptions, domain);
        const nextProject = nextProjects.includes(session.project) ? session.project : "";
        const nextActivities = getActivitiesForSelection(structureOptions, domain, nextProject);
        const nextActivity = nextActivities.includes(session.activity) ? session.activity : "";
        onChange({
            ...session,
            domain,
            project: nextProject,
            activity: nextActivity,
        });
    };
    const handleProjectChange = (project) => {
        const nextActivities = getActivitiesForSelection(structureOptions, session.domain, project);
        const nextActivity = nextActivities.includes(session.activity) ? session.activity : "";
        onChange({
            ...session,
            project,
            activity: nextActivity,
        });
    };
    return (_jsxs("div", { className: `card output-workspace${isMinimal ? " output-workspace-minimal" : ""}`, children: [isMinimal && showPresentationActions ? (_jsx("div", { className: "card-header session-editor-header-minimal", children: _jsx("div", { className: "capture-minimal-actions", children: _jsx("span", { className: "tiny-text", children: "Minimal mode" }) }) })) : null, _jsx("div", { className: "field field-wide output-actions-card", children: _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "primary-button", type: "button", onClick: onPrimaryAction, children: isPrimaryActionRunning ? `${primaryActionLabel}...` : primaryActionLabel }), secondaryActionLabel && onSecondaryAction ? (_jsx("button", { className: "shell-button", type: "button", onClick: onSecondaryAction, children: isSecondaryActionRunning ? `${secondaryActionLabel}...` : secondaryActionLabel })) : null, _jsx("button", { className: "shell-button", type: "button", onClick: onTranslate, children: "Translate" }), _jsx("button", { className: "shell-button", type: "button", onClick: onExportDocx, children: "Export Word" }), _jsx("button", { className: "shell-button", type: "button", onClick: onExportPdf, children: "Export PDF" })] }) }), !hasOutput ? (_jsxs("div", { className: `empty-state-card compact-empty-state${isMinimal ? " output-empty-state-minimal" : ""}`, children: [_jsx("h3", { children: "Ready to generate" }), _jsxs("ol", { className: "empty-state-steps", children: [_jsx("li", { children: "Go back to Capture if you want to add rough notes, transcript text, or images first." }), _jsxs("li", { children: ["Click ", emptyStatePrimaryLabel, " to create the first Output draft for this session."] }), emptyStateSecondaryLabel ? _jsxs("li", { children: ["Or click ", emptyStateSecondaryLabel, " if you want the alternate output path instead."] }) : null, _jsx("li", { children: "Use Translate, Revise, and Export after the first polished draft appears here." })] })] })) : null, linkedActivity ? (_jsxs("details", { className: "field field-wide workspace-disclosure", open: isMinimal, children: [_jsx("summary", { children: "Linked activity and follow-up" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "prompt-actions-row", children: [_jsxs("div", { className: "prompt-actions-copy", children: [_jsx("strong", { children: linkedActivity.description }), _jsx("span", { className: "muted", children: "Keep follow-up work tied to the same activity so Calendar, Notes, and work execution stay aligned." })] }), onOpenLinkedActivity ? (_jsx("button", { className: "small-button", type: "button", onClick: () => onOpenLinkedActivity(linkedActivity.id), children: "Open linked activity" })) : null] }), _jsxs("div", { className: "todos-workspace-input-row", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "output-follow-up", children: "Add follow-up todo" }), _jsx("input", { id: "output-follow-up", value: followUpDraft, onChange: (event) => setFollowUpDraft(event.target.value), onKeyDown: (event) => {
                                                    if (event.key === "Enter" && !event.shiftKey && followUpDraft.trim() && onAddFollowUpTodo) {
                                                        event.preventDefault();
                                                        onAddFollowUpTodo(followUpDraft.trim(), { activityId: linkedActivity.id, doOn: session.date });
                                                        setFollowUpDraft("");
                                                    }
                                                }, placeholder: "Add a follow-up into this activity" })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                            if (!followUpDraft.trim() || !onAddFollowUpTodo)
                                                return;
                                            onAddFollowUpTodo(followUpDraft.trim(), { activityId: linkedActivity.id, doOn: session.date });
                                            setFollowUpDraft("");
                                        }, children: "Add follow-up" })] }), selectedExcerpt && (onAddFollowUpTodo || onAddFollowUpMeeting) ? (_jsxs("div", { className: "selected-output-excerpt-card", children: [_jsxs("div", { className: "prompt-actions-row", children: [_jsxs("div", { className: "prompt-actions-copy", children: [_jsx("strong", { children: "Selected output text" }), _jsx("span", { className: "muted", children: "Turn any selected output text into a follow-up item, not only bullet suggestions." })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => setSelectedExcerpt(""), children: "Clear selection" })] }), _jsx("p", { children: excerptPreview }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => applyReviewSeed(selectedExcerpt, "todo"), children: "Review selected text" }), onAddFollowUpTodo ? (_jsx("button", { className: "small-button", type: "button", onClick: () => onAddFollowUpTodo(selectedExcerpt, { activityId: linkedActivity.id, doOn: session.date }), children: "Add selected as todo" })) : null, onAddFollowUpMeeting ? (_jsx("button", { className: "small-button", type: "button", onClick: () => onAddFollowUpMeeting(selectedExcerpt, { parentActivityId: linkedActivity.id, doOn: session.date }), children: "Add selected as meeting" })) : null] })] })) : null, reviewDescription ? (_jsxs("div", { className: "selected-output-excerpt-card", children: [_jsxs("div", { className: "prompt-actions-row", children: [_jsxs("div", { className: "prompt-actions-copy", children: [_jsx("strong", { children: "Follow-up review" }), _jsx("span", { className: "muted", children: "Adjust the parsed description, suggested date, and optional owner note before creating the follow-up." })] }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                    setReviewDescription("");
                                                    setReviewOwner("");
                                                    setReviewDate("");
                                                }, children: "Clear review" })] }), _jsxs("div", { className: "form-grid", children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "follow-up-kind", children: "Type" }), _jsxs("select", { id: "follow-up-kind", value: reviewKind, onChange: (event) => setReviewKind(event.target.value), children: [_jsx("option", { value: "todo", children: "Todo" }), _jsx("option", { value: "meeting", children: "Meeting" })] })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "follow-up-date", children: "Date" }), _jsx(DateInput, { id: "follow-up-date", value: reviewDate, onChange: (event) => setReviewDate(event.target.value) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "follow-up-owner", children: "Owner note" }), _jsx(PeoplePicker, { value: reviewOwner, savedPeople: savedPeople, suggestedPeople: suggestedPeople, placeholder: "Optional owner", mode: "single", onChange: setReviewOwner })] }), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "follow-up-review-description", children: "Description" }), _jsx("textarea", { id: "follow-up-review-description", rows: 4, value: reviewDescription, onChange: (event) => setReviewDescription(event.target.value) })] })] }), _jsxs("div", { className: "page-actions", children: [reviewKind === "todo" && onAddFollowUpTodo ? (_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                    if (!reviewDescription.trim())
                                                        return;
                                                    onAddFollowUpTodo(reviewDescription.trim(), {
                                                        activityId: linkedActivity.id,
                                                        doOn: reviewDate || session.date,
                                                        comments: ownerComment || undefined,
                                                    });
                                                    setReviewDescription("");
                                                    setReviewOwner("");
                                                    setReviewDate("");
                                                }, children: "Create reviewed todo" })) : null, reviewKind === "meeting" && onAddFollowUpMeeting ? (_jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                    if (!reviewDescription.trim())
                                                        return;
                                                    onAddFollowUpMeeting(reviewDescription.trim(), {
                                                        parentActivityId: linkedActivity.id,
                                                        doOn: reviewDate || session.date,
                                                        comments: ownerComment || undefined,
                                                    });
                                                    setReviewDescription("");
                                                    setReviewOwner("");
                                                    setReviewDate("");
                                                }, children: "Create reviewed meeting" })) : null] })] })) : null, followUpSuggestions.length && onAddFollowUpTodo ? (_jsxs("div", { className: "stack", children: [_jsxs("div", { className: "prompt-actions-row", children: [_jsx("label", { children: "Suggested follow-up actions from this output" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                    selectedFollowUps.forEach((suggestion) => {
                                                        onAddFollowUpTodo?.(suggestion, { activityId: linkedActivity.id, doOn: session.date });
                                                    });
                                                    setSelectedFollowUps([]);
                                                }, disabled: !selectedFollowUps.length || !onAddFollowUpTodo, children: "Add selected as todo" }), _jsx("button", { className: "small-button", type: "button", onClick: () => {
                                                    selectedFollowUps.forEach((suggestion) => {
                                                        onAddFollowUpMeeting?.(suggestion, { parentActivityId: linkedActivity.id, doOn: session.date });
                                                    });
                                                    setSelectedFollowUps([]);
                                                }, disabled: !selectedFollowUps.length || !onAddFollowUpMeeting, children: "Add selected as meeting" })] }), _jsx("div", { className: "section-list", children: followUpSuggestions.map((suggestion) => (_jsxs("div", { className: "list-item", children: [_jsxs("label", { className: "todos-workspace-main", children: [_jsx("input", { type: "checkbox", checked: selectedFollowUps.includes(suggestion), onChange: (event) => setSelectedFollowUps((current) => event.target.checked
                                                                ? [...current, suggestion]
                                                                : current.filter((entry) => entry !== suggestion)) }), _jsx("span", { className: "todos-workspace-copy", children: _jsx("strong", { children: suggestion }) })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "small-button", type: "button", onClick: () => onAddFollowUpTodo?.(suggestion, { activityId: linkedActivity.id, doOn: session.date }), children: "Add todo" }), _jsx("button", { className: "small-button", type: "button", onClick: () => applyReviewSeed(suggestion, "todo"), children: "Review" }), _jsx("button", { className: "small-button", type: "button", onClick: () => onAddFollowUpMeeting?.(suggestion, { parentActivityId: linkedActivity.id, doOn: session.date }), children: "Add meeting" })] })] }, suggestion))) })] })) : null] })] })) : null, _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "session-output", children: "Output" }), _jsx("textarea", { className: `editor-textarea${isMinimal ? " editor-textarea-primary output-textarea-minimal" : ""}`, id: "session-output", value: session.output, onChange: (event) => onChange({ ...session, output: event.target.value }), onSelect: (event) => {
                            const nextExcerpt = event.currentTarget.value
                                .slice(event.currentTarget.selectionStart ?? 0, event.currentTarget.selectionEnd ?? 0)
                                .trim();
                            setSelectedExcerpt(nextExcerpt);
                        }, placeholder: "Generated notes will appear here." })] }), _jsxs("details", { className: "field field-wide workspace-disclosure", children: [_jsx("summary", { children: "Details" }), _jsxs("div", { className: "workspace-disclosure-body form-grid", children: [_jsxs("div", { className: `field field-wide${isMinimal ? " capture-title-field-minimal" : ""}`, children: [_jsx("label", { htmlFor: "output-title", children: "Title" }), _jsx("input", { className: isMinimal ? "minimal-title-input" : undefined, id: "output-title", value: session.title, onChange: (event) => onChange({ ...session, title: event.target.value }), placeholder: isMeetingNote ? "Weekly project meeting" : "Note title" })] }), _jsxs("div", { className: `field${isMinimal ? " capture-meta-field" : ""}`, children: [_jsx("label", { htmlFor: "output-date", children: "Date" }), _jsx(DateInput, { id: "output-date", value: session.date, onChange: (event) => onChange({ ...session, date: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-people", children: "People" }), _jsx(PeoplePicker, { value: session.participantText, savedPeople: savedPeople, suggestedPeople: suggestedPeople, onChange: (value) => onChange({ ...session, participantText: value }), placeholder: isMeetingNote ? "Search or add people" : "Search or add optional context" })] }), _jsx("div", { className: "field field-wide metadata-triplet", children: _jsxs("div", { className: "metadata-triplet-grid", children: [_jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "output-domain", children: "Domain" }), _jsx(TokenPicker, { value: session.domain, savedOptions: structureOptions.domains.length ? structureOptions.domains : savedDomains, suggestedOptions: suggestedDomains, placeholder: "Search or add domain", suggestionSummary: "Recent domains", suggestionBadgeText: "From saved Domains", mode: "single", onChange: handleDomainChange })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "output-project", children: "Project" }), _jsx(TokenPicker, { value: session.project, savedOptions: projectPickerOptions, suggestedOptions: suggestedProjectsForSelection, placeholder: "Search or add project", suggestionSummary: "Recent projects", suggestionBadgeText: "From saved Projects", mode: "single", onChange: handleProjectChange })] }), _jsxs("div", { className: "field metadata-subfield", children: [_jsx("label", { htmlFor: "output-activity", children: "Activity" }), _jsx(TokenPicker, { value: session.activity, savedOptions: activityPickerOptions, suggestedOptions: suggestedActivitiesForSelection, placeholder: "Search or add activity", suggestionSummary: "Recent activities", suggestionBadgeText: "From saved Activities", mode: "single", onChange: (value) => onChange({ ...session, activity: value }) })] })] }) }), isMeetingNote ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-start-time", children: "Start time" }), _jsx("input", { id: "output-start-time", type: "time", value: session.startTime, onChange: (event) => onChange({ ...session, startTime: event.target.value }) })] }), _jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-end-time", children: "End time" }), _jsx("input", { id: "output-end-time", type: "time", value: session.endTime, onChange: (event) => onChange({ ...session, endTime: event.target.value }) })] })] })) : (_jsxs("div", { className: "field", children: [_jsx("label", { htmlFor: "output-time", children: "Time" }), _jsx("input", { id: "output-time", type: "time", value: session.startTime, onChange: (event) => onChange({ ...session, startTime: event.target.value }) })] })), _jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "output-tags", children: "Tags" }), _jsx(TokenPicker, { value: session.tagsText, savedOptions: savedTags, suggestedOptions: suggestedTags, placeholder: "Add tags like q2-planning, budget, hiring", suggestionSummary: "Recent tags", suggestionBadgeText: "From saved Tags", onChange: (value) => onChange({ ...session, tagsText: value }) })] }), _jsxs("div", { className: `field capture-private-field${isMinimal ? " capture-meta-field" : ""}`, children: [_jsx("span", { children: "Privacy" }), _jsxs("div", { className: "compact-private-toggle", children: [_jsx("input", { id: "output-private", type: "checkbox", checked: session.isPrivate, onChange: (event) => onChange({ ...session, isPrivate: event.target.checked }) }), _jsx("label", { htmlFor: "output-private", className: "checkbox-label", children: "Private" })] })] })] })] }), includedImages.length ? (_jsxs("div", { className: "field field-wide", children: [_jsx("label", { children: "Images marked for polished output" }), _jsx("div", { className: "section-list", children: includedImages.map((attachment) => (_jsxs("div", { className: "list-item image-output-item", children: [_jsx(AttachmentImagePreview, { attachment: attachment }), _jsxs("div", { className: "image-attachment-details", children: [_jsx("strong", { children: attachment.caption || attachment.filename }), _jsx("span", { className: "muted", children: "This image is staged for future structured output and richer Word/PDF export." })] })] }, attachment.id))) })] })) : null, _jsxs("details", { className: "field field-wide workspace-disclosure", children: [_jsx("summary", { children: "Refine and export" }), _jsxs("div", { className: "workspace-disclosure-body stack", children: [_jsxs("div", { className: "field field-wide", children: [_jsx("label", { htmlFor: "revision-instructions", children: "Revision instructions" }), _jsx("textarea", { id: "revision-instructions", value: revisionInstructions, onChange: (event) => setRevisionInstructions(event.target.value), placeholder: "Example: Make the summary more concise, keep action owners explicit, and translate jargon into clearer client language." })] }), _jsxs("div", { className: "page-actions", children: [_jsx("button", { className: "shell-button", type: "button", onClick: () => {
                                            onRevise(revisionInstructions);
                                            if (revisionInstructions.trim()) {
                                                setRevisionInstructions("");
                                            }
                                        }, children: isRevising ? "Revising..." : "Revise with instructions" }), _jsx("button", { className: "shell-button", type: "button", onClick: onExportText, children: "Export text" }), _jsx("button", { className: "shell-button", type: "button", onClick: onExportMarkdown, children: "Export markdown" }), _jsx("button", { className: "shell-button", type: "button", onClick: onExportHtml, children: "Export HTML" })] })] })] })] }));
};

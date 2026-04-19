import { PeoplePicker } from "../../../components/PeoplePicker";
import { TokenPicker } from "../../../components/TokenPicker";
import { AttachmentImagePreview } from "../../../components/AttachmentImagePreview";
import { DateInput } from "../../../components/DateInput";
import { getActivitiesForSelection, getProjectsForDomain, type StructureOptions } from "../../../lib/structure/options";
import type {
  ActivityRecord,
  AttachmentRecord,
  CaptureWorkspaceDensity,
  RuleSuggestionRecord,
  SessionRecord,
  TemplateDefinition,
} from "@notesmith/domain";
import { useState } from "react";

type FollowUpKind = "todo" | "meeting";

const parseFollowUpCandidate = (value: string) => {
  const trimmed = value.trim();
  const ownerMatch = trimmed.match(/(?:^|[\s(])@([A-Za-z][\w .-]{1,40})/);
  const explicitOwnerMatch = trimmed.match(/owner:\s*([A-Za-z][\w .-]{1,40})/i);
  const isoDateMatch = trimmed.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const todayMatch = trimmed.match(/\btoday\b/i);
  const tomorrowMatch = trimmed.match(/\btomorrow\b/i);

  const nextDate = (() => {
    if (isoDateMatch) return isoDateMatch[1];
    if (todayMatch) return new Date().toISOString().slice(0, 10);
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

interface OutputWorkspaceProps {
  session: SessionRecord;
  template?: TemplateDefinition | null;
  displayedOutput?: string;
  outputVersions?: SessionRecord["outputVersions"];
  selectedOutputVersionId?: string | null;
  attachments: AttachmentRecord[];
  presentation?: CaptureWorkspaceDensity;
  showPresentationActions?: boolean;
  onChange: (session: SessionRecord) => void;
  savedPeople: string[];
  suggestedPeople: string[];
  savedProjects: string[];
  suggestedProjects: string[];
  savedDomains: string[];
  suggestedDomains: string[];
  savedActivities: string[];
  suggestedActivities: string[];
  structureOptions: StructureOptions;
  savedTags: string[];
  suggestedTags: string[];
  isPrimaryActionRunning: boolean;
  isSecondaryActionRunning: boolean;
  isRevising: boolean;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  onCopyOutput: () => void;
  onTranslate: () => void;
  onRevise: (instructions: string) => void;
  onRevertOutputVersion: () => void;
  onOpenOutputVersion?: (versionId: string) => void;
  onOpenLatestOutputVersion?: () => void;
  onExportText: () => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  onExportDocx: () => void;
  onExportPdf: () => void;
  ruleSuggestions?: RuleSuggestionRecord[];
  onAcceptRuleSuggestion?: (suggestionId: string) => void;
  onDismissRuleSuggestion?: (suggestionId: string) => void;
  onIgnoreRuleSuggestion?: (suggestionId: string) => void;
  primaryActionLabel?: string;
  secondaryActionLabel?: string | null;
  emptyStatePrimaryLabel?: string;
  emptyStateSecondaryLabel?: string | null;
  linkedActivity?: ActivityRecord | null;
  onOpenLinkedActivity?: (activityId: string) => void;
  onAddFollowUpTodo?: (description: string, options?: { activityId?: string; doOn?: string; comments?: string }) => void;
  onAddFollowUpMeeting?: (description: string, options?: { parentActivityId?: string; doOn?: string; comments?: string }) => void;
}

export const OutputWorkspace = ({
  session,
  template,
  displayedOutput = session.output,
  outputVersions = [],
  selectedOutputVersionId = null,
  attachments,
  presentation = "full",
  showPresentationActions = true,
  onChange,
  savedPeople,
  suggestedPeople,
  savedProjects,
  suggestedProjects,
  savedDomains,
  suggestedDomains,
  savedActivities,
  suggestedActivities,
  structureOptions,
  savedTags,
  suggestedTags,
  isPrimaryActionRunning,
  isSecondaryActionRunning,
  isRevising,
  onPrimaryAction,
  onSecondaryAction,
  onCopyOutput,
  onTranslate,
  onRevise,
  onRevertOutputVersion,
  onOpenOutputVersion,
  onOpenLatestOutputVersion,
  onExportText,
  onExportMarkdown,
  onExportHtml,
  onExportDocx,
  onExportPdf,
  ruleSuggestions = [],
  onAcceptRuleSuggestion,
  onDismissRuleSuggestion,
  onIgnoreRuleSuggestion,
  primaryActionLabel = "Generate",
  secondaryActionLabel = null,
  emptyStatePrimaryLabel = "Generate polished notes",
  emptyStateSecondaryLabel = null,
  linkedActivity = null,
  onOpenLinkedActivity,
  onAddFollowUpTodo,
  onAddFollowUpMeeting,
}: OutputWorkspaceProps) => {
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [selectedFollowUps, setSelectedFollowUps] = useState<string[]>([]);
  const [selectedExcerpt, setSelectedExcerpt] = useState("");
  const [reviewKind, setReviewKind] = useState<FollowUpKind>("todo");
  const [reviewDescription, setReviewDescription] = useState("");
  const [reviewOwner, setReviewOwner] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const includedImages = attachments
    .filter((attachment) => attachment.kind === "image" && attachment.includeInOutput)
    .sort((left, right) => left.outputPosition - right.outputPosition || left.createdAt.localeCompare(right.createdAt));
  const hasOutput = Boolean(displayedOutput.trim());
  const isViewingHistoricalVersion = Boolean(selectedOutputVersionId);
  const isMeetingNote = session.captureMode === "meeting-note";
  const isMinimal = presentation === "minimal";
  const orderedSections = [...(template?.sections ?? [])].sort((left, right) => left.position - right.position);
  const filteredProjects = getProjectsForDomain(structureOptions, session.domain);
  const filteredActivities = getActivitiesForSelection(structureOptions, session.domain, session.project);
  const projectPickerOptions = filteredProjects.length ? filteredProjects : savedProjects;
  const activityPickerOptions = filteredActivities.length ? filteredActivities : savedActivities;
  const filteredProjectSet = new Set(projectPickerOptions);
  const filteredActivitySet = new Set(activityPickerOptions);
  const suggestedProjectsForSelection = suggestedProjects.filter((project) => filteredProjectSet.has(project));
  const suggestedActivitiesForSelection = suggestedActivities.filter((activity) => filteredActivitySet.has(activity));
  const followUpSuggestions = displayedOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^([-*]\s+|\d+[.)]\s+)/.test(line))
    .map((line) => line.replace(/^([-*]\s+|\d+[.)]\s+)/, "").trim())
    .filter((line) => line.length >= 6)
    .slice(0, 8);
  const excerptPreview =
    selectedExcerpt.length > 180 ? `${selectedExcerpt.slice(0, 177).trimEnd()}...` : selectedExcerpt;
  const selectedOutputVersion = outputVersions.find((version) => version.id === selectedOutputVersionId) ?? null;
  const formatOutputVersionLabel = (generatedAt: string) => {
    const parsed = new Date(generatedAt);
    if (Number.isNaN(parsed.getTime())) {
      return generatedAt;
    }

    return parsed.toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderVersionHistory = () =>
    outputVersions.length ? (
      <details className={`workspace-disclosure pwa-disclosure-card${isMinimal ? "" : ""}`}>
        <summary>Version history</summary>
        <div className="workspace-disclosure-body stack">
          <p className="muted">
            Each generated output version is saved here with the time it was created.
          </p>
          <div className="section-list">
            {outputVersions.map((version, index) => (
              <div key={version.id} className="list-item output-version-row">
                <span className="list-item-copy">
                  <strong>{index === 0 ? "Current version" : `Version ${outputVersions.length - index}`}</strong>
                  <span className="muted">{formatOutputVersionLabel(version.generatedAt)}</span>
                </span>
                {index === 0 ? (
                  <button
                    className="small-button"
                    type="button"
                    onClick={onOpenLatestOutputVersion}
                    disabled={!selectedOutputVersionId}
                  >
                    {selectedOutputVersionId ? "Open latest" : "Viewing latest"}
                  </button>
                ) : (
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => onOpenOutputVersion?.(version.id)}
                    disabled={selectedOutputVersionId === version.id}
                  >
                    {selectedOutputVersionId === version.id ? "Viewing" : "Open"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </details>
    ) : null;

  const renderRuleSuggestions = () =>
    ruleSuggestions.length ? (
      <section className="config-card workflow-card suggestion-workflow-card" aria-label="Suggested rules">
        <div className="config-card-copy">
          <p className="section-label">Suggested rules</p>
          <h3>Save repeated patterns</h3>
        </div>
        <p className="support-text">
          The app noticed repeated shorthand or participant-name patterns in recent sessions. Add any you want to reuse.
        </p>
        <div className="rule-suggestion-list">
          {ruleSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="rule-suggestion-card">
              <div className="rule-suggestion-copy">
                <p className="section-label">
                  {suggestion.type === "abbreviation" ? "Suggested abbreviation" : "Preferred participant name"}
                </p>
                <h4>{`${suggestion.sourceValue} -> ${suggestion.suggestedValue}`}</h4>
                <p className="muted">Seen {suggestion.evidenceCount} times in recent sessions.</p>
              </div>
              <div className="list-item-actions">
                <button className="small-button" type="button" onClick={() => onAcceptRuleSuggestion?.(suggestion.id)}>
                  Add
                </button>
                <button className="small-button" type="button" onClick={() => onDismissRuleSuggestion?.(suggestion.id)}>
                  Not now
                </button>
                <button className="small-button danger-button" type="button" onClick={() => onIgnoreRuleSuggestion?.(suggestion.id)}>
                  Never suggest
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    ) : null;

  const handleSectionToggle = (sectionId: string, checked: boolean) => {
    const nextExcludedSectionIds = checked
      ? session.excludedSectionIds.filter((id) => id !== sectionId)
      : [...new Set([...session.excludedSectionIds, sectionId])];
    onChange({ ...session, excludedSectionIds: nextExcludedSectionIds });
  };

  const applyReviewSeed = (value: string, kind: FollowUpKind = "todo") => {
    const parsed = parseFollowUpCandidate(value);
    setReviewKind(kind);
    setReviewDescription(parsed.description || value.trim());
    setReviewOwner(parsed.owner);
    setReviewDate(parsed.date || session.date);
  };

  const ownerComment = reviewOwner ? `Owner: ${reviewOwner}` : "";

  const handleDomainChange = (domain: string) => {
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

  const handleProjectChange = (project: string) => {
    const nextActivities = getActivitiesForSelection(structureOptions, session.domain, project);
    const nextActivity = nextActivities.includes(session.activity) ? session.activity : "";
    onChange({
      ...session,
      project,
      activity: nextActivity,
    });
  };

  if (isMinimal) {
    return (
      <div className="card output-workspace output-workspace-minimal output-workspace-pwa">
        <div className="panel-heading output-workspace-pwa-heading">
          <div className="panel-heading-copy">
            <p className="section-label">Output</p>
          </div>
        </div>

        <div className="panel-actions panel-actions-output-top output-actions-row-pwa">
          <div className="panel-actions-page">
            <button className="shell-button" type="button" onClick={onExportDocx}>
              Export Word
            </button>
            <button className="shell-button" type="button" onClick={onExportPdf}>
              Export PDF
            </button>
            <button className="shell-button" type="button" onClick={onTranslate}>
              Translate
            </button>
          </div>
        </div>

        <div className="output-layout output-layout-pwa">
          <aside className="output-sidebar">
            <section className="config-card workflow-card output-workflow-card" aria-label="Generation controls">
              <div className="config-card-copy">
                <p className="section-label">Generate</p>
                <h3>Output actions</h3>
              </div>

              <div className="capture-toolbar capture-toolbar-sidebar">
                <button className="primary-button" type="button" onClick={onPrimaryAction}>
                  {isPrimaryActionRunning ? `${primaryActionLabel}...` : primaryActionLabel}
                </button>
                <button className="secondary-button" type="button" onClick={onCopyOutput}>
                  Copy Output
                </button>
              </div>

              <details className="workspace-disclosure pwa-disclosure-card output-generation-disclosure" open>
                <summary>Language and generation options</summary>
                <div className="workspace-disclosure-body stack">
                  <label className={`field config-field${session.transcribeOnly ? " is-disabled" : ""}`}>
                    <span className="field-label">Output language</span>
                    <select
                      value={session.outputLanguage}
                      onChange={(event) => onChange({ ...session, outputLanguage: event.target.value as SessionRecord["outputLanguage"] })}
                      disabled={session.transcribeOnly}
                    >
                      <option value="same">Same as notes</option>
                      <option value="sv">Swedish</option>
                      <option value="en">English</option>
                    </select>
                  </label>

                  <div className="generation-mode-group" role="radiogroup" aria-label="Generation mode">
                    <label className="config-option config-option-featured">
                      <input
                        checked={session.transcribeOnly === true}
                        name="desktop-generation-mode"
                        type="radio"
                        value="manual"
                        onChange={() => onChange({ ...session, transcribeOnly: true })}
                      />
                      <span className="config-option-copy">
                        <span className="config-option-title">Polish Manual notes without AI</span>
                      </span>
                    </label>

                    <label className="config-option config-option-featured">
                      <input
                        checked={session.transcribeOnly !== true}
                        name="desktop-generation-mode"
                        type="radio"
                        value="ai"
                        onChange={() => onChange({ ...session, transcribeOnly: false })}
                      />
                      <span className="config-option-copy">
                        <span className="config-option-title">Generate with AI</span>
                      </span>
                    </label>
                  </div>

                  <div className="output-section-grid">
                    {orderedSections.map((section) => {
                      const checked = !session.excludedSectionIds.includes(section.id);
                      return (
                        <label key={section.id} className="output-section-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => handleSectionToggle(section.id, event.target.checked)}
                          />
                          <span>{section.title}</span>
                        </label>
                      );
                    })}
                  </div>
                  <label className="field config-field output-detail-field">
                    <span className="field-label">Detail level</span>
                    <input
                      id="output-detail-level"
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={String(session.detailLevel)}
                      disabled={session.transcribeOnly}
                      onChange={(event) => onChange({ ...session, detailLevel: Number(event.target.value) })}
                    />
                    <span className="range-caption">
                      {session.detailLevel <= 1
                        ? "Minimal detail"
                        : session.detailLevel === 2
                          ? "Concise detail"
                          : session.detailLevel === 3
                            ? "Balanced detail"
                            : session.detailLevel === 4
                              ? "Detailed"
                            : "Comprehensive"}
                    </span>
                  </label>

                  <label className={`field config-field${session.transcribeOnly ? " is-disabled" : ""}`}>
                    <span className="field-label">Additional LLM instructions</span>
                    <textarea
                      rows={4}
                      value={session.additionalInstructions}
                      disabled={session.transcribeOnly}
                      onChange={(event) => onChange({ ...session, additionalInstructions: event.target.value })}
                      placeholder="Example: Focus more on risks and decisions, and exclude implementation details."
                    />
                  </label>
                </div>
              </details>
            </section>

            {renderRuleSuggestions()}
          </aside>

          <div className="output-main">
            <div className="output-card output-card-pwa">
              {!hasOutput ? (
                <div className="output-empty output-empty-pwa">
                  <h3>Your finished notes will appear here.</h3>
                  <p>
                    Add notes or transcript in the Capture section to the left, include highlights if useful, then click <strong>Generate</strong>.
                  </p>
                </div>
              ) : (
                <>
                  {selectedOutputVersion ? (
                    <p className="muted output-version-note">
                      Viewing the version generated {formatOutputVersionLabel(selectedOutputVersion.generatedAt)}. Open the latest version to keep editing.
                    </p>
                  ) : null}
                  <textarea
                    className="editor-textarea editor-textarea-primary output-textarea-minimal output-textarea-pwa"
                    id="session-output"
                    value={displayedOutput}
                    onChange={(event) => onChange({ ...session, output: event.target.value })}
                    onSelect={(event) => {
                      const nextExcerpt = event.currentTarget.value
                        .slice(event.currentTarget.selectionStart ?? 0, event.currentTarget.selectionEnd ?? 0)
                        .trim();
                      setSelectedExcerpt(nextExcerpt);
                    }}
                    readOnly={isViewingHistoricalVersion}
                    placeholder="Generated notes will appear here."
                  />
                </>
              )}
            </div>

            <details className="workspace-disclosure pwa-disclosure-card">
              <summary>Refine output</summary>
              <div className="workspace-disclosure-body stack">
                <div className="field field-wide">
                  <label htmlFor="revision-instructions">Comments to improve the output</label>
                  <textarea
                    id="revision-instructions"
                    value={revisionInstructions}
                    onChange={(event) => setRevisionInstructions(event.target.value)}
                    placeholder="Example: Make the summary shorter, emphasize risks more, and make the action items more specific."
                  />
                </div>
                <div className="capture-toolbar output-feedback-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      if (isViewingHistoricalVersion) return;
                      onRevise(revisionInstructions);
                      if (revisionInstructions.trim()) {
                        setRevisionInstructions("");
                      }
                    }}
                    disabled={isViewingHistoricalVersion}
                  >
                    {isRevising ? "Updating..." : "Update Output"}
                  </button>
                  <button className="ghost-button" type="button" onClick={onRevertOutputVersion}>
                    {selectedOutputVersionId ? "Open latest version" : "Revert to Previous Version"}
                  </button>
                </div>
                <p className="muted">
                  Add comments here when you want the polished output adjusted. Every generated version is saved in Version history.
                </p>
              </div>
            </details>

            {renderVersionHistory()}

            <details className="workspace-disclosure pwa-disclosure-card">
              <summary>Details</summary>
              <div className="workspace-disclosure-body form-grid">
                <div className="field field-wide">
                  <label htmlFor="output-title">Title</label>
                  <input
                    className="minimal-title-input"
                    id="output-title"
                    value={session.title}
                    onChange={(event) => onChange({ ...session, title: event.target.value })}
                    placeholder={isMeetingNote ? "Weekly project meeting" : "Note title"}
                  />
                </div>
                <div className="field">
                  <label htmlFor="output-date">Date</label>
                  <DateInput id="output-date" value={session.date} onChange={(event) => onChange({ ...session, date: event.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="output-people">People</label>
                  <PeoplePicker
                    value={session.participantText}
                    savedPeople={savedPeople}
                    suggestedPeople={suggestedPeople}
                    onChange={(value) => onChange({ ...session, participantText: value })}
                    placeholder={isMeetingNote ? "Search or add people" : "Search or add optional context"}
                  />
                </div>
                <div className="field field-wide metadata-triplet">
                  <div className="metadata-triplet-grid">
                    <div className="field metadata-subfield">
                      <label htmlFor="output-domain">Domain</label>
                      <TokenPicker
                        value={session.domain}
                        savedOptions={structureOptions.domains.length ? structureOptions.domains : savedDomains}
                        suggestedOptions={suggestedDomains}
                        placeholder="Search or add domain"
                        suggestionSummary="Recent domains"
                        suggestionBadgeText="From saved Domains"
                        mode="single"
                        onChange={handleDomainChange}
                      />
                    </div>
                    <div className="field metadata-subfield">
                      <label htmlFor="output-project">Project</label>
                      <TokenPicker
                        value={session.project}
                        savedOptions={projectPickerOptions}
                        suggestedOptions={suggestedProjectsForSelection}
                        placeholder="Search or add project"
                        suggestionSummary="Recent projects"
                        suggestionBadgeText="From saved Projects"
                        mode="single"
                        onChange={handleProjectChange}
                      />
                    </div>
                    <div className="field metadata-subfield">
                      <label htmlFor="output-activity">Activity</label>
                      <TokenPicker
                        value={session.activity}
                        savedOptions={activityPickerOptions}
                        suggestedOptions={suggestedActivitiesForSelection}
                        placeholder="Search or add activity"
                        suggestionSummary="Recent activities"
                        suggestionBadgeText="From saved Activities"
                        mode="single"
                        onChange={(value) => onChange({ ...session, activity: value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </details>

            {linkedActivity ? (
              <details className="workspace-disclosure pwa-disclosure-card">
                <summary>Linked activity and follow-up</summary>
                <div className="workspace-disclosure-body stack">
                  <div className="prompt-actions-row">
                    <div className="prompt-actions-copy">
                      <strong>{linkedActivity.description}</strong>
                      <span className="muted">
                        Keep follow-up work tied to the same activity so Calendar, Notes, and work execution stay aligned.
                      </span>
                    </div>
                    {onOpenLinkedActivity ? (
                      <button className="small-button" type="button" onClick={() => onOpenLinkedActivity(linkedActivity.id)}>
                        Open linked activity
                      </button>
                    ) : null}
                  </div>
                  <div className="todos-workspace-input-row">
                    <div className="field field-wide">
                      <label htmlFor="output-follow-up">Add follow-up todo</label>
                      <input
                        id="output-follow-up"
                        value={followUpDraft}
                        onChange={(event) => setFollowUpDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey && followUpDraft.trim() && onAddFollowUpTodo) {
                            event.preventDefault();
                            onAddFollowUpTodo(followUpDraft.trim(), { activityId: linkedActivity.id, doOn: session.date });
                            setFollowUpDraft("");
                          }
                        }}
                        placeholder="Add a follow-up into this activity"
                      />
                    </div>
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => {
                        if (!followUpDraft.trim() || !onAddFollowUpTodo) return;
                        onAddFollowUpTodo(followUpDraft.trim(), { activityId: linkedActivity.id, doOn: session.date });
                        setFollowUpDraft("");
                      }}
                    >
                      Add follow-up
                    </button>
                  </div>
                  {selectedExcerpt && (onAddFollowUpTodo || onAddFollowUpMeeting) ? (
                    <div className="selected-output-excerpt-card">
                      <div className="prompt-actions-row">
                        <div className="prompt-actions-copy">
                          <strong>Selected output text</strong>
                          <span className="muted">Turn any selected output text into a follow-up item, not only bullet suggestions.</span>
                        </div>
                        <button className="small-button" type="button" onClick={() => setSelectedExcerpt("")}>
                          Clear selection
                        </button>
                      </div>
                      <p>{excerptPreview}</p>
                      <div className="page-actions">
                        <button className="small-button" type="button" onClick={() => applyReviewSeed(selectedExcerpt, "todo")}>
                          Review selected text
                        </button>
                        {onAddFollowUpTodo ? (
                          <button className="small-button" type="button" onClick={() => onAddFollowUpTodo(selectedExcerpt, { activityId: linkedActivity.id, doOn: session.date })}>
                            Add selected as todo
                          </button>
                        ) : null}
                        {onAddFollowUpMeeting ? (
                          <button className="small-button" type="button" onClick={() => onAddFollowUpMeeting(selectedExcerpt, { parentActivityId: linkedActivity.id, doOn: session.date })}>
                            Add selected as meeting
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card output-workspace${isMinimal ? " output-workspace-minimal" : ""}`}>
      {isMinimal && showPresentationActions ? (
        <div className="card-header session-editor-header-minimal">
          <div className="capture-minimal-actions"><span className="tiny-text">Minimal mode</span></div>
        </div>
      ) : null}
      <div className="field field-wide output-actions-card">
        <div className="page-actions">
          <button className="primary-button" type="button" onClick={onPrimaryAction}>
            {isPrimaryActionRunning ? `${primaryActionLabel}...` : primaryActionLabel}
          </button>
          {secondaryActionLabel && onSecondaryAction ? (
            <button className="shell-button" type="button" onClick={onSecondaryAction}>
              {isSecondaryActionRunning ? `${secondaryActionLabel}...` : secondaryActionLabel}
            </button>
          ) : null}
          <button className="shell-button" type="button" onClick={onTranslate} disabled={isViewingHistoricalVersion}>
            Translate
          </button>
          <button className="shell-button" type="button" onClick={onExportDocx}>
            Export Word
          </button>
          <button className="shell-button" type="button" onClick={onExportPdf}>
            Export PDF
          </button>
        </div>
      </div>
      {!hasOutput ? (
        <div className={`empty-state-card compact-empty-state${isMinimal ? " output-empty-state-minimal" : ""}`}>
          <h3>Ready to generate</h3>
          <ol className="empty-state-steps">
            <li>Go back to Capture if you want to add rough notes, transcript text, or images first.</li>
            <li>Click {emptyStatePrimaryLabel} to create the first Output draft for this session.</li>
            {emptyStateSecondaryLabel ? <li>Or click {emptyStateSecondaryLabel} if you want the alternate output path instead.</li> : null}
            <li>Use Translate, Revise, and Export after the first polished draft appears here.</li>
          </ol>
        </div>
      ) : null}
      {linkedActivity ? (
        <details className="field field-wide workspace-disclosure" open={isMinimal}>
          <summary>Linked activity and follow-up</summary>
          <div className="workspace-disclosure-body stack">
            <div className="prompt-actions-row">
              <div className="prompt-actions-copy">
                <strong>{linkedActivity.description}</strong>
                <span className="muted">
                  Keep follow-up work tied to the same activity so Calendar, Notes, and work execution stay aligned.
                </span>
              </div>
              {onOpenLinkedActivity ? (
                <button className="small-button" type="button" onClick={() => onOpenLinkedActivity(linkedActivity.id)}>
                  Open linked activity
                </button>
              ) : null}
            </div>
            <div className="todos-workspace-input-row">
              <div className="field field-wide">
                <label htmlFor="output-follow-up">Add follow-up todo</label>
                <input
                  id="output-follow-up"
                  value={followUpDraft}
                  onChange={(event) => setFollowUpDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && followUpDraft.trim() && onAddFollowUpTodo) {
                      event.preventDefault();
                      onAddFollowUpTodo(followUpDraft.trim(), { activityId: linkedActivity.id, doOn: session.date });
                      setFollowUpDraft("");
                    }
                  }}
                  placeholder="Add a follow-up into this activity"
                />
              </div>
              <button
                className="small-button"
                type="button"
                onClick={() => {
                  if (!followUpDraft.trim() || !onAddFollowUpTodo) return;
                  onAddFollowUpTodo(followUpDraft.trim(), { activityId: linkedActivity.id, doOn: session.date });
                  setFollowUpDraft("");
                }}
              >
                Add follow-up
              </button>
            </div>
            {selectedExcerpt && (onAddFollowUpTodo || onAddFollowUpMeeting) ? (
              <div className="selected-output-excerpt-card">
                <div className="prompt-actions-row">
                  <div className="prompt-actions-copy">
                    <strong>Selected output text</strong>
                    <span className="muted">Turn any selected output text into a follow-up item, not only bullet suggestions.</span>
                  </div>
                  <button className="small-button" type="button" onClick={() => setSelectedExcerpt("")}>
                    Clear selection
                  </button>
                </div>
                <p>{excerptPreview}</p>
                <div className="page-actions">
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => applyReviewSeed(selectedExcerpt, "todo")}
                  >
                    Review selected text
                  </button>
                  {onAddFollowUpTodo ? (
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => onAddFollowUpTodo(selectedExcerpt, { activityId: linkedActivity.id, doOn: session.date })}
                    >
                      Add selected as todo
                    </button>
                  ) : null}
                  {onAddFollowUpMeeting ? (
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => onAddFollowUpMeeting(selectedExcerpt, { parentActivityId: linkedActivity.id, doOn: session.date })}
                    >
                      Add selected as meeting
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {reviewDescription ? (
              <div className="selected-output-excerpt-card">
                <div className="prompt-actions-row">
                  <div className="prompt-actions-copy">
                    <strong>Follow-up review</strong>
                    <span className="muted">Adjust the parsed description, suggested date, and optional owner note before creating the follow-up.</span>
                  </div>
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => {
                      setReviewDescription("");
                      setReviewOwner("");
                      setReviewDate("");
                    }}
                  >
                    Clear review
                  </button>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="follow-up-kind">Type</label>
                    <select id="follow-up-kind" value={reviewKind} onChange={(event) => setReviewKind(event.target.value as FollowUpKind)}>
                      <option value="todo">Todo</option>
                      <option value="meeting">Meeting</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="follow-up-date">Date</label>
                    <DateInput id="follow-up-date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} />
                  </div>
                  <div className="field">
                    <label htmlFor="follow-up-owner">Owner note</label>
                    <PeoplePicker
                      value={reviewOwner}
                      savedPeople={savedPeople}
                      suggestedPeople={suggestedPeople}
                      placeholder="Optional owner"
                      mode="single"
                      onChange={setReviewOwner}
                    />
                  </div>
                  <div className="field field-wide">
                    <label htmlFor="follow-up-review-description">Description</label>
                    <textarea
                      id="follow-up-review-description"
                      rows={4}
                      value={reviewDescription}
                      onChange={(event) => setReviewDescription(event.target.value)}
                    />
                  </div>
                </div>
                <div className="page-actions">
                  {reviewKind === "todo" && onAddFollowUpTodo ? (
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => {
                        if (!reviewDescription.trim()) return;
                        onAddFollowUpTodo(reviewDescription.trim(), {
                          activityId: linkedActivity.id,
                          doOn: reviewDate || session.date,
                          comments: ownerComment || undefined,
                        });
                        setReviewDescription("");
                        setReviewOwner("");
                        setReviewDate("");
                      }}
                    >
                      Create reviewed todo
                    </button>
                  ) : null}
                  {reviewKind === "meeting" && onAddFollowUpMeeting ? (
                    <button
                      className="small-button"
                      type="button"
                      onClick={() => {
                        if (!reviewDescription.trim()) return;
                        onAddFollowUpMeeting(reviewDescription.trim(), {
                          parentActivityId: linkedActivity.id,
                          doOn: reviewDate || session.date,
                          comments: ownerComment || undefined,
                        });
                        setReviewDescription("");
                        setReviewOwner("");
                        setReviewDate("");
                      }}
                    >
                      Create reviewed meeting
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {followUpSuggestions.length && onAddFollowUpTodo ? (
              <div className="stack">
                <div className="prompt-actions-row">
                  <label>Suggested follow-up actions from this output</label>
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => {
                      selectedFollowUps.forEach((suggestion) => {
                        onAddFollowUpTodo?.(suggestion, { activityId: linkedActivity.id, doOn: session.date });
                      });
                      setSelectedFollowUps([]);
                    }}
                    disabled={!selectedFollowUps.length || !onAddFollowUpTodo}
                  >
                    Add selected as todo
                  </button>
                  <button
                    className="small-button"
                    type="button"
                    onClick={() => {
                      selectedFollowUps.forEach((suggestion) => {
                        onAddFollowUpMeeting?.(suggestion, { parentActivityId: linkedActivity.id, doOn: session.date });
                      });
                      setSelectedFollowUps([]);
                    }}
                    disabled={!selectedFollowUps.length || !onAddFollowUpMeeting}
                  >
                    Add selected as meeting
                  </button>
                </div>
                <div className="section-list">
                  {followUpSuggestions.map((suggestion) => (
                    <div key={suggestion} className="list-item">
                      <label className="todos-workspace-main">
                        <input
                          type="checkbox"
                          checked={selectedFollowUps.includes(suggestion)}
                          onChange={(event) =>
                            setSelectedFollowUps((current) =>
                              event.target.checked
                                ? [...current, suggestion]
                                : current.filter((entry) => entry !== suggestion),
                            )
                          }
                        />
                        <span className="todos-workspace-copy">
                          <strong>{suggestion}</strong>
                        </span>
                      </label>
                      <div className="page-actions">
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => onAddFollowUpTodo?.(suggestion, { activityId: linkedActivity.id, doOn: session.date })}
                        >
                          Add todo
                        </button>
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => applyReviewSeed(suggestion, "todo")}
                        >
                          Review
                        </button>
                        <button
                          className="small-button"
                          type="button"
                          onClick={() => onAddFollowUpMeeting?.(suggestion, { parentActivityId: linkedActivity.id, doOn: session.date })}
                        >
                          Add meeting
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
      <div className="field field-wide">
        <label htmlFor="session-output">Output</label>
        {selectedOutputVersion ? (
          <p className="muted">Viewing the version generated {formatOutputVersionLabel(selectedOutputVersion.generatedAt)}. Open the latest version to keep editing.</p>
        ) : null}
        <textarea
          className={`editor-textarea${isMinimal ? " editor-textarea-primary output-textarea-minimal" : ""}`}
          id="session-output"
          value={displayedOutput}
          onChange={(event) => onChange({ ...session, output: event.target.value })}
          onSelect={(event) => {
            const nextExcerpt = event.currentTarget.value
              .slice(event.currentTarget.selectionStart ?? 0, event.currentTarget.selectionEnd ?? 0)
              .trim();
            setSelectedExcerpt(nextExcerpt);
          }}
          readOnly={isViewingHistoricalVersion}
          placeholder="Generated notes will appear here."
        />
      </div>
      {renderVersionHistory()}
      <details className="field field-wide workspace-disclosure">
        <summary>Details</summary>
        <div className="workspace-disclosure-body form-grid">
          <div className={`field field-wide${isMinimal ? " capture-title-field-minimal" : ""}`}>
            <label htmlFor="output-title">Title</label>
            <input
              className={isMinimal ? "minimal-title-input" : undefined}
              id="output-title"
              value={session.title}
              onChange={(event) => onChange({ ...session, title: event.target.value })}
              placeholder={isMeetingNote ? "Weekly project meeting" : "Note title"}
            />
          </div>
          <div className={`field${isMinimal ? " capture-meta-field" : ""}`}>
            <label htmlFor="output-date">Date</label>
            <DateInput id="output-date" value={session.date} onChange={(event) => onChange({ ...session, date: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="output-people">People</label>
            <PeoplePicker
              value={session.participantText}
              savedPeople={savedPeople}
              suggestedPeople={suggestedPeople}
              onChange={(value) => onChange({ ...session, participantText: value })}
              placeholder={isMeetingNote ? "Search or add people" : "Search or add optional context"}
            />
          </div>
          <div className="field field-wide metadata-triplet">
            <div className="metadata-triplet-grid">
              <div className="field metadata-subfield">
                <label htmlFor="output-domain">Domain</label>
                <TokenPicker
                  value={session.domain}
                  savedOptions={structureOptions.domains.length ? structureOptions.domains : savedDomains}
                  suggestedOptions={suggestedDomains}
                  placeholder="Search or add domain"
                  suggestionSummary="Recent domains"
                  suggestionBadgeText="From saved Domains"
                  mode="single"
                  onChange={handleDomainChange}
                />
              </div>
              <div className="field metadata-subfield">
                <label htmlFor="output-project">Project</label>
                <TokenPicker
                  value={session.project}
                  savedOptions={projectPickerOptions}
                  suggestedOptions={suggestedProjectsForSelection}
                  placeholder="Search or add project"
                  suggestionSummary="Recent projects"
                  suggestionBadgeText="From saved Projects"
                  mode="single"
                  onChange={handleProjectChange}
                />
              </div>
              <div className="field metadata-subfield">
                <label htmlFor="output-activity">Activity</label>
                <TokenPicker
                  value={session.activity}
                  savedOptions={activityPickerOptions}
                  suggestedOptions={suggestedActivitiesForSelection}
                  placeholder="Search or add activity"
                  suggestionSummary="Recent activities"
                  suggestionBadgeText="From saved Activities"
                  mode="single"
                  onChange={(value) => onChange({ ...session, activity: value })}
                />
              </div>
            </div>
          </div>
          {isMeetingNote ? (
            <>
              <div className="field">
                <label htmlFor="output-start-time">Start time</label>
                <input
                  id="output-start-time"
                  type="time"
                  value={session.startTime}
                  onChange={(event) => onChange({ ...session, startTime: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="output-end-time">End time</label>
                <input
                  id="output-end-time"
                  type="time"
                  value={session.endTime}
                  onChange={(event) => onChange({ ...session, endTime: event.target.value })}
                />
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor="output-time">Time</label>
              <input
                id="output-time"
                type="time"
                value={session.startTime}
                onChange={(event) => onChange({ ...session, startTime: event.target.value })}
              />
            </div>
          )}
          <div className="field field-wide">
            <label htmlFor="output-tags">Tags</label>
            <TokenPicker
              value={session.tagsText}
              savedOptions={savedTags}
              suggestedOptions={suggestedTags}
              placeholder="Add tags like q2-planning, budget, hiring"
              suggestionSummary="Recent tags"
              suggestionBadgeText="From saved Tags"
              onChange={(value) => onChange({ ...session, tagsText: value })}
            />
          </div>
          <div className={`field capture-private-field${isMinimal ? " capture-meta-field" : ""}`}>
            <span>Privacy</span>
            <div className="compact-private-toggle">
              <input
                id="output-private"
                type="checkbox"
                checked={session.isPrivate}
                onChange={(event) => onChange({ ...session, isPrivate: event.target.checked })}
              />
              <label htmlFor="output-private" className="checkbox-label">
                Private
              </label>
            </div>
          </div>
        </div>
      </details>
      {includedImages.length ? (
        <div className="field field-wide">
          <label>Images marked for polished output</label>
          <div className="section-list">
            {includedImages.map((attachment) => (
              <div key={attachment.id} className="list-item image-output-item">
                <AttachmentImagePreview attachment={attachment} />
                <div className="image-attachment-details">
                  <strong>{attachment.caption || attachment.filename}</strong>
                  <span className="muted">
                    This image is staged for future structured output and richer Word/PDF export.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <details className="field field-wide workspace-disclosure">
        <summary>Refine and export</summary>
        <div className="workspace-disclosure-body stack">
          <div className="field field-wide">
            <label htmlFor="revision-instructions">Revision instructions</label>
            <textarea
              id="revision-instructions"
              value={revisionInstructions}
              onChange={(event) => setRevisionInstructions(event.target.value)}
              placeholder="Example: Make the summary more concise, keep action owners explicit, and translate jargon into clearer client language."
            />
          </div>
          <div className="page-actions">
                <button
                  className="shell-button"
                  type="button"
                  onClick={() => {
                    if (isViewingHistoricalVersion) return;
                    onRevise(revisionInstructions);
                    if (revisionInstructions.trim()) {
                      setRevisionInstructions("");
                    }
                  }}
                  disabled={isViewingHistoricalVersion}
                >
                  {isRevising ? "Revising..." : "Revise with instructions"}
                </button>
            <button className="shell-button" type="button" onClick={onExportText}>
              Export text
            </button>
            <button className="shell-button" type="button" onClick={onExportMarkdown}>
              Export markdown
            </button>
            <button className="shell-button" type="button" onClick={onExportHtml}>
              Export HTML
            </button>
          </div>
        </div>
      </details>
    </div>
  );
};

import { PeoplePicker } from "../../../components/PeoplePicker";
import { TokenPicker } from "../../../components/TokenPicker";
import { AttachmentImagePreview } from "../../../components/AttachmentImagePreview";
import type { AttachmentRecord, SessionRecord } from "@notesmith/domain";
import { useState } from "react";

interface OutputWorkspaceProps {
  session: SessionRecord;
  attachments: AttachmentRecord[];
  onChange: (session: SessionRecord) => void;
  savedPeople: string[];
  suggestedPeople: string[];
  savedProjects: string[];
  suggestedProjects: string[];
  savedDomains: string[];
  suggestedDomains: string[];
  savedActivities: string[];
  suggestedActivities: string[];
  savedTags: string[];
  suggestedTags: string[];
  isPrimaryActionRunning: boolean;
  isSecondaryActionRunning: boolean;
  isRevising: boolean;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  onTranslate: () => void;
  onRevise: (instructions: string) => void;
  onExportText: () => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
  primaryActionLabel?: string;
  secondaryActionLabel?: string | null;
  emptyStatePrimaryLabel?: string;
  emptyStateSecondaryLabel?: string | null;
}

export const OutputWorkspace = ({
  session,
  attachments,
  onChange,
  savedPeople,
  suggestedPeople,
  savedProjects,
  suggestedProjects,
  savedDomains,
  suggestedDomains,
  savedActivities,
  suggestedActivities,
  savedTags,
  suggestedTags,
  isPrimaryActionRunning,
  isSecondaryActionRunning,
  isRevising,
  onPrimaryAction,
  onSecondaryAction,
  onTranslate,
  onRevise,
  onExportText,
  onExportMarkdown,
  onExportHtml,
  primaryActionLabel = "Generate",
  secondaryActionLabel = null,
  emptyStatePrimaryLabel = "Generate polished notes",
  emptyStateSecondaryLabel = null,
}: OutputWorkspaceProps) => {
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const [showAdvancedRefinement, setShowAdvancedRefinement] = useState(false);
  const includedImages = attachments
    .filter((attachment) => attachment.kind === "image" && attachment.includeInOutput)
    .sort((left, right) => left.outputPosition - right.outputPosition || left.createdAt.localeCompare(right.createdAt));
  const hasOutput = Boolean(session.output.trim());
  const isMeetingNote = session.captureMode === "meeting-note";

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Output</h2>
          <p>Use Output when you want polished notes, translation, revision, and exports. The document stays central; advanced actions stay secondary.</p>
        </div>
        <div className="page-actions">
          <button className="primary-button" type="button" onClick={onPrimaryAction}>
            {isPrimaryActionRunning ? `${primaryActionLabel}...` : primaryActionLabel}
          </button>
          {secondaryActionLabel && onSecondaryAction ? (
            <button className="shell-button" type="button" onClick={onSecondaryAction}>
              {isSecondaryActionRunning ? `${secondaryActionLabel}...` : secondaryActionLabel}
            </button>
          ) : null}
          <button className="shell-button" type="button" onClick={onTranslate}>
            Translate
          </button>
          <button className="shell-button" type="button" onClick={() => setShowAdvancedRefinement((current) => !current)}>
            {showAdvancedRefinement ? "Hide advanced actions" : "Show advanced actions"}
          </button>
        </div>
      </div>
      {!hasOutput ? (
        <div className="empty-state-card compact-empty-state">
          <h3>Ready to generate</h3>
          <ol className="empty-state-steps">
            <li>Go back to Capture if you want to add rough notes, transcript text, or images first.</li>
            <li>Click {emptyStatePrimaryLabel} to create the first Output draft for this session.</li>
            {emptyStateSecondaryLabel ? <li>Or click {emptyStateSecondaryLabel} if you want the alternate output path instead.</li> : null}
            <li>Use Translate, Revise, and Export after the first polished draft appears here.</li>
          </ol>
        </div>
      ) : null}
      <div className="field field-wide">
        <label htmlFor="output-title">Title</label>
        <input
          id="output-title"
          value={session.title}
          onChange={(event) => onChange({ ...session, title: event.target.value })}
          placeholder={isMeetingNote ? "Weekly project meeting" : "Note title"}
        />
      </div>
      <label className="list-item checkbox-label field field-wide session-privacy-toggle">
        <input
          type="checkbox"
          checked={session.isPrivate}
          onChange={(event) => onChange({ ...session, isPrivate: event.target.checked })}
        />
        <div>
          <strong>Private</strong>
          <span className="muted">Hide this note from normal public-only session views.</span>
        </div>
      </label>
      <details className="field field-wide workspace-disclosure">
        <summary>{isMeetingNote ? "Meeting details" : "Optional note details"}</summary>
        <div className="workspace-disclosure-body form-grid">
          <div className="field">
            <label htmlFor="output-date">Date</label>
            <input
              id="output-date"
              type="date"
              value={session.date}
              onChange={(event) => onChange({ ...session, date: event.target.value })}
            />
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
                  savedOptions={savedDomains}
                  suggestedOptions={suggestedDomains}
                  placeholder="Search or add domain"
                  suggestionSummary="Recent domains"
                  suggestionBadgeText="From saved Domains"
                  mode="single"
                  onChange={(value) => onChange({ ...session, domain: value })}
                />
              </div>
              <div className="field metadata-subfield">
                <label htmlFor="output-project">Project</label>
                <TokenPicker
                  value={session.project}
                  savedOptions={savedProjects}
                  suggestedOptions={suggestedProjects}
                  placeholder="Search or add project"
                  suggestionSummary="Recent projects"
                  suggestionBadgeText="From saved Projects"
                  mode="single"
                  onChange={(value) => onChange({ ...session, project: value })}
                />
              </div>
              <div className="field metadata-subfield">
                <label htmlFor="output-activity">Activity</label>
                <TokenPicker
                  value={session.activity}
                  savedOptions={savedActivities}
                  suggestedOptions={suggestedActivities}
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
        </div>
      </details>
      <div className="field field-wide">
        <label htmlFor="session-output">Polished output</label>
        <textarea
          id="session-output"
          value={session.output}
          onChange={(event) => onChange({ ...session, output: event.target.value })}
          placeholder="Generated notes will appear here. In the Tauri app this will later be backed by AI jobs, versioned outputs, and editable drafts."
        />
      </div>
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
      {showAdvancedRefinement ? (
        <div className="stack">
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
                onRevise(revisionInstructions);
                if (revisionInstructions.trim()) {
                  setRevisionInstructions("");
                }
              }}
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
      ) : null}
    </div>
  );
};

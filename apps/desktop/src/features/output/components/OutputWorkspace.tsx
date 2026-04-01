import { AttachmentImagePreview } from "../../../components/AttachmentImagePreview";
import type { AttachmentRecord, SessionRecord } from "@notesmith/domain";
import { useState } from "react";

interface OutputWorkspaceProps {
  session: SessionRecord;
  attachments: AttachmentRecord[];
  onChange: (session: SessionRecord) => void;
  isGenerating: boolean;
  isRevising: boolean;
  onGenerate: () => void;
  onTranslate: () => void;
  onRevise: (instructions: string) => void;
  onExportText: () => void;
  onExportMarkdown: () => void;
  onExportHtml: () => void;
}

export const OutputWorkspace = ({
  session,
  attachments,
  onChange,
  isGenerating,
  isRevising,
  onGenerate,
  onTranslate,
  onRevise,
  onExportText,
  onExportMarkdown,
  onExportHtml,
}: OutputWorkspaceProps) => {
  const [revisionInstructions, setRevisionInstructions] = useState("");
  const includedImages = attachments
    .filter((attachment) => attachment.kind === "image" && attachment.includeInOutput)
    .sort((left, right) => left.outputPosition - right.outputPosition || left.createdAt.localeCompare(right.createdAt));

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Output</h2>
          <p>This view is ready for the richer AI generation pipeline and later background jobs.</p>
        </div>
        <div className="page-actions">
          <button className="primary-button" type="button" onClick={onGenerate}>
            {isGenerating ? "Generating output..." : "Generate"}
          </button>
          <button className="shell-button" type="button" onClick={onTranslate}>
            Translate
          </button>
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
            {isRevising ? "Revising..." : "Revise"}
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
      <div className="field field-wide">
        <label htmlFor="revision-instructions">Revision instructions</label>
        <textarea
          id="revision-instructions"
          value={revisionInstructions}
          onChange={(event) => setRevisionInstructions(event.target.value)}
          placeholder="Example: Make the summary more concise, keep action owners explicit, and translate jargon into clearer client language."
        />
      </div>
    </div>
  );
};

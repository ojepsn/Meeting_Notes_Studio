import type { SessionRecord } from "@notesmith/domain";

interface OutputWorkspaceProps {
  session: SessionRecord;
  onChange: (session: SessionRecord) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  onTranslate: () => void;
  onExport: () => void;
}

export const OutputWorkspace = ({
  session,
  onChange,
  isGenerating,
  onGenerate,
  onTranslate,
  onExport,
}: OutputWorkspaceProps) => (
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
        <button className="shell-button" type="button" onClick={onExport}>
          Export text
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
  </div>
);

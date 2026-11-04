export interface GenerationProgressValue {
  value: number;
  label: string;
}

interface GenerationProgressProps {
  progress: GenerationProgressValue;
}

export const GenerationProgress = ({ progress }: GenerationProgressProps) => {
  const value = Math.max(0, Math.min(100, Math.round(progress.value)));

  return (
    <div className="generation-progress" role="progressbar" aria-label="Output generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={`${progress.label}, ${value}%`}>
      <div className="generation-progress-copy">
        <span>{progress.label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="generation-progress-track" aria-hidden="true">
        <span className="generation-progress-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
};

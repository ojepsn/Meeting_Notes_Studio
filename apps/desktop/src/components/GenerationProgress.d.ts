export interface GenerationProgressValue {
    value: number;
    label: string;
}
interface GenerationProgressProps {
    progress: GenerationProgressValue;
}
export declare const GenerationProgress: ({ progress }: GenerationProgressProps) => import("react/jsx-runtime").JSX.Element;
export {};

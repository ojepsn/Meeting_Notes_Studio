import { type TemplateDefinition } from "@notesmith/domain";
interface TemplatesCardProps {
    templates: TemplateDefinition[];
    onSave: (template: TemplateDefinition) => void;
    onResetTemplates: () => Promise<void>;
}
export declare const TemplatesCard: ({ templates, onSave, onResetTemplates }: TemplatesCardProps) => import("react/jsx-runtime").JSX.Element;
export {};

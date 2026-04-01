import type { TemplateDefinition } from "@notesmith/domain";
interface TemplatesCardProps {
    templates: TemplateDefinition[];
    onSave: (template: TemplateDefinition) => void;
}
export declare const TemplatesCard: ({ templates, onSave }: TemplatesCardProps) => import("react/jsx-runtime").JSX.Element;
export {};

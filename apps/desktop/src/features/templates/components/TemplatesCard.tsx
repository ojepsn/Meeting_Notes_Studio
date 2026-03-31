import type { TemplateDefinition } from "@notesmith/domain";

interface TemplatesCardProps {
  templates: TemplateDefinition[];
}

export const TemplatesCard = ({ templates }: TemplatesCardProps) => (
  <div className="sidebar-card">
    <div>
      <h3>Templates</h3>
      <p>The desktop rebuild keeps templates as first-class domain objects, ready for sync later.</p>
    </div>
    <div className="section-list">
      {templates.map((template) => (
        <div key={template.id} className="list-item">
          <strong>{template.name}</strong>
          <span className="muted">
            {template.fields.length} fields · {template.sections.length} output sections
          </span>
        </div>
      ))}
    </div>
  </div>
);

import type { ActivityRecord, ChecklistRecord, ChecklistRecurrenceCadence, ChecklistRecurrenceRecord, ChecklistTemplateRecord, TaskRecord, TimeLogRecord } from "@notesmith/domain";
import { type StructureOptions } from "../../../lib/structure/options";
interface TodosWorkspaceProps {
    todos: TaskRecord[];
    checklists: ChecklistRecord[];
    checklistTemplates: ChecklistTemplateRecord[];
    checklistRecurrences: ChecklistRecurrenceRecord[];
    activities: ActivityRecord[];
    timeLogs: TimeLogRecord[];
    structureOptions: StructureOptions;
    requestedTodoId?: string | null;
    requestedDomain?: string | null;
    requestedProject?: string | null;
    onEditorClose?: () => void;
    onToggle: (todo: TaskRecord) => void;
    onAdd: (description: string, options?: {
        activityId?: string;
    }) => void;
    onSave: (todo: TaskRecord) => void;
    onDelete: (id: string) => void;
    onCreateChecklist: (todoId: string, title: string) => void;
    onCreateChecklistFromTemplate: (todoId: string, templateId: string) => void;
    onCreateChecklistRecurrence: (todoId: string, templateId: string, cadence: ChecklistRecurrenceCadence) => void;
    onSaveChecklist: (checklist: ChecklistRecord) => void;
    onDeleteChecklist: (id: string) => void;
    onCreateChecklistTemplate: (title: string, category?: string, items?: ChecklistTemplateRecord["items"]) => void;
    onSaveChecklistTemplate: (template: ChecklistTemplateRecord) => void;
    onDeleteChecklistTemplate: (id: string) => void;
    onDeleteChecklistRecurrence: (id: string) => void;
    onConvertToActivity: (todo: TaskRecord) => void;
    onSaveTimeLog: (timeLog: TimeLogRecord) => void;
    onDeleteTimeLog: (id: string) => void;
    onStartTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onStopTracking: (targetType: "todo" | "activity", targetId: string) => void;
    onOpenActivityDetail?: (activityId: string) => void;
}
export declare const TodosWorkspace: ({ todos, checklists, checklistTemplates, checklistRecurrences, activities, timeLogs, structureOptions, requestedTodoId, requestedDomain, requestedProject, onEditorClose, onToggle, onAdd, onSave, onDelete, onCreateChecklist, onCreateChecklistFromTemplate, onCreateChecklistRecurrence, onSaveChecklist, onDeleteChecklist, onCreateChecklistTemplate, onSaveChecklistTemplate, onDeleteChecklistTemplate, onDeleteChecklistRecurrence, onConvertToActivity, onSaveTimeLog, onDeleteTimeLog, onStartTracking, onStopTracking, onOpenActivityDetail, }: TodosWorkspaceProps) => import("react/jsx-runtime").JSX.Element;
export {};

import type { SessionRecord } from "@notesmith/domain";
interface SessionsSidebarProps {
    sessions: SessionRecord[];
    activeSessionId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
    onRestore: (id: string) => void;
    onDeleteForever: (id: string) => void;
    compact?: boolean;
    title?: string;
}
export declare const SessionsSidebar: ({ sessions, activeSessionId, onSelect, onCreate, onDelete, onRestore, onDeleteForever, compact, title, }: SessionsSidebarProps) => import("react/jsx-runtime").JSX.Element;
export {};

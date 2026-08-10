import type { SessionRecord } from "@notesmith/domain";
interface SessionsSidebarProps {
    sessions: SessionRecord[];
    activeSessionId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onClose?: () => void;
    onDelete: (id: string) => void;
    onRestore: (id: string) => void;
    onDeleteForever: (id: string) => void;
    compact?: boolean;
    title?: string;
}
export declare const getPermanentSessionDeleteConfirmation: (title: string) => string;
export declare const SessionsSidebar: ({ sessions, activeSessionId, onSelect, onCreate, onClose, onDelete, onRestore, onDeleteForever, compact, title, }: SessionsSidebarProps) => import("react/jsx-runtime").JSX.Element;
export {};

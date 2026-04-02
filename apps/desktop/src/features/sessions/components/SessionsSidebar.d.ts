import type { SessionRecord } from "@notesmith/domain";
interface SessionsSidebarProps {
    sessions: SessionRecord[];
    activeSessionId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
    compact?: boolean;
    title?: string;
}
export declare const SessionsSidebar: ({ sessions, activeSessionId, onSelect, onCreate, onDelete, compact, title, }: SessionsSidebarProps) => import("react/jsx-runtime").JSX.Element;
export {};

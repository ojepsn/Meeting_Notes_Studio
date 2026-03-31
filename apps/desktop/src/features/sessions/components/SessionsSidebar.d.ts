import type { SessionRecord } from "@notesmith/domain";
interface SessionsSidebarProps {
    sessions: SessionRecord[];
    activeSessionId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
}
export declare const SessionsSidebar: ({ sessions, activeSessionId, onSelect, onCreate, onDelete, }: SessionsSidebarProps) => import("react/jsx-runtime").JSX.Element;
export {};

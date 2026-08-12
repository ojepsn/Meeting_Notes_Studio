import { type ReactNode, type RefObject } from "react";
import type { RichTextCommandRecord, RichTextSpellCheckMode } from "@notesmith/domain";
export interface RichTextCommand {
    trigger: string;
    label: string;
    description: string;
    template: string;
}
interface RichTextCommandProviderProps {
    customCommands?: RichTextCommandRecord[];
    spellCheckMode?: RichTextSpellCheckMode;
    children: ReactNode;
}
interface RichTextCommandMenuProps {
    editorRef: RefObject<HTMLDivElement | null>;
    onContentChange: (html: string) => void;
}
export declare const resolveRichTextCommandValue: (template: string, now?: Date) => string;
export declare const buildRichTextCommands: (customCommands?: RichTextCommandRecord[]) => RichTextCommand[];
export declare const findRichTextCommandQuery: (text: string, offset?: number) => {
    query: string;
    start: number;
    end: number;
} | null;
export declare const richTextCommandMatchesQuery: (command: RichTextCommand, query: string) => boolean;
export declare const getRichTextSpellCheckAttributes: (mode: RichTextSpellCheckMode | undefined) => {
    spellCheck: boolean;
    lang: string;
};
export declare const RichTextCommandProvider: ({ customCommands, spellCheckMode, children }: RichTextCommandProviderProps) => import("react/jsx-runtime").JSX.Element;
export declare const RichTextCommandMenu: ({ editorRef, onContentChange }: RichTextCommandMenuProps) => import("react/jsx-runtime").JSX.Element | null;
export {};

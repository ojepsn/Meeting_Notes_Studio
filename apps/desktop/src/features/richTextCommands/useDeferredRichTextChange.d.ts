export declare const useDeferredRichTextChange: (onChange: (html: string) => void, delayMs?: number) => {
    schedule: (html: string) => void;
    flush: () => void;
    commitNow: (html: string) => void;
};

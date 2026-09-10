export declare const RICH_TEXT_FONT_OPTIONS: readonly [{
    readonly label: "Aptos";
    readonly value: "Aptos, Calibri, sans-serif";
}, {
    readonly label: "Georgia";
    readonly value: "Georgia, serif";
}, {
    readonly label: "Garamond";
    readonly value: "Garamond, Georgia, serif";
}, {
    readonly label: "Calibri";
    readonly value: "Calibri, Arial, sans-serif";
}, {
    readonly label: "Arial";
    readonly value: "Arial, sans-serif";
}, {
    readonly label: "Verdana";
    readonly value: "Verdana, Geneva, sans-serif";
}, {
    readonly label: "Monospace";
    readonly value: "Consolas, 'Courier New', monospace";
}];
export declare const RICH_TEXT_FONT_SIZE_OPTIONS: readonly [{
    readonly label: "10 px";
    readonly commandValue: "1";
    readonly cssValue: "10px";
}, {
    readonly label: "13 px";
    readonly commandValue: "2";
    readonly cssValue: "13px";
}, {
    readonly label: "16 px";
    readonly commandValue: "3";
    readonly cssValue: "16px";
}, {
    readonly label: "18 px";
    readonly commandValue: "4";
    readonly cssValue: "18px";
}, {
    readonly label: "24 px";
    readonly commandValue: "5";
    readonly cssValue: "24px";
}, {
    readonly label: "32 px";
    readonly commandValue: "6";
    readonly cssValue: "32px";
}, {
    readonly label: "48 px";
    readonly commandValue: "7";
    readonly cssValue: "48px";
}];
export declare const resolveSafeRichTextHref: (value: string) => string;
export declare const resolveAllowedRichTextFont: (value: string) => "Aptos, Calibri, sans-serif" | "Georgia, serif" | "Garamond, Georgia, serif" | "Calibri, Arial, sans-serif" | "Arial, sans-serif" | "Verdana, Geneva, sans-serif" | "Consolas, 'Courier New', monospace" | "";
export declare const resolveToolbarFontFamily: (value: string) => "Aptos, Calibri, sans-serif" | "Georgia, serif" | "Garamond, Georgia, serif" | "Calibri, Arial, sans-serif" | "Arial, sans-serif" | "Verdana, Geneva, sans-serif" | "Consolas, 'Courier New', monospace" | "";
export declare const normalizeRichTextInlineFormatting: (wrapper: HTMLElement) => void;
export declare const preserveAllowedRichTextStyles: (element: Element) => void;
export declare const normalizePastedRichTextHtml: (value: string) => string;
export declare const applyRichTextFont: (editor: HTMLDivElement, fontFamily: string) => void;
export declare const applyRichTextFontSize: (editor: HTMLDivElement, commandValue: string) => void;

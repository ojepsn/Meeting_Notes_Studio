export interface OutputLayoutStyle {
    titleFont: string;
    headingFont: string;
    bodyFont: string;
    metaFont: string;
    titleSize: number;
    headingSize: number;
    bodySize: number;
    metaSize: number;
    lineHeight: number;
}
export interface OutputLayoutPreset {
    id: string;
    label: string;
    description: string;
    bestFor: string;
    style: OutputLayoutStyle;
    pdfFonts: {
        title: "helvetica" | "times" | "courier";
        heading: "helvetica" | "times" | "courier";
        body: "helvetica" | "times" | "courier";
        meta: "helvetica" | "times" | "courier";
    };
}
export declare const DEFAULT_OUTPUT_LAYOUT_PRESET_ID = "modern-aptos";
export declare const OUTPUT_LAYOUT_PRESETS: OutputLayoutPreset[];
export declare const isOutputLayoutPresetId: (value: string | undefined | null) => boolean;
export declare const getOutputLayoutPreset: (presetId: string | undefined | null) => OutputLayoutPreset;
export declare const getPrimaryFontFamily: (fontStack: string) => string;

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
    pageMargin: number;
    titleAlign: "left" | "center";
    metaAlign: "left" | "center";
    headingCase: "sentence" | "uppercase";
    headingColor: string;
    metaColor: string;
    paragraphSpacing: number;
    sectionSpacing: number;
    sectionDivider: "none" | "line";
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
export declare const DEFAULT_OUTPUT_LAYOUT_PRESET_ID = "modern-minutes";
export declare const OUTPUT_LAYOUT_PRESETS: OutputLayoutPreset[];
export declare const isOutputLayoutPresetId: (value: string | undefined | null) => boolean;
export declare const normalizeOutputLayoutPresetId: (value: string | undefined | null) => string;
export declare const getOutputLayoutPreset: (presetId: string | undefined | null) => OutputLayoutPreset;
export declare const getPrimaryFontFamily: (fontStack: string) => string;

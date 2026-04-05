export const DEFAULT_OUTPUT_LAYOUT_PRESET_ID = "modern-aptos";
export const OUTPUT_LAYOUT_PRESETS = [
    {
        id: "modern-aptos",
        label: "Modern Aptos",
        description: "Balanced Microsoft 365-style business typography with a calm sans-serif hierarchy.",
        bestFor: "General business notes, meetings, and polished internal documents.",
        style: {
            titleFont: "Aptos Display, Aptos, Calibri, Arial, sans-serif",
            headingFont: "Aptos, Calibri, Arial, sans-serif",
            bodyFont: "Aptos, Calibri, Arial, sans-serif",
            metaFont: "Aptos, Calibri, Arial, sans-serif",
            titleSize: 22,
            headingSize: 12.5,
            bodySize: 11,
            metaSize: 9.5,
            lineHeight: 1.5,
        },
        pdfFonts: {
            title: "helvetica",
            heading: "helvetica",
            body: "helvetica",
            meta: "helvetica",
        },
    },
    {
        id: "enterprise-helvetica",
        label: "Enterprise Sans",
        description: "Neutral, executive-ready sans serif pairing with slightly tighter spacing for efficient reading.",
        bestFor: "Board updates, status notes, and compact business communication.",
        style: {
            titleFont: "\"Helvetica Neue\", Helvetica, Arial, sans-serif",
            headingFont: "\"Helvetica Neue\", Helvetica, Arial, sans-serif",
            bodyFont: "Arial, Helvetica, sans-serif",
            metaFont: "Arial, Helvetica, sans-serif",
            titleSize: 21,
            headingSize: 12,
            bodySize: 10.5,
            metaSize: 9,
            lineHeight: 1.45,
        },
        pdfFonts: {
            title: "helvetica",
            heading: "helvetica",
            body: "helvetica",
            meta: "helvetica",
        },
    },
    {
        id: "editorial-georgia",
        label: "Editorial Serif",
        description: "Serif headlines with clean sans-serif body text for a more formal, client-facing tone.",
        bestFor: "Executive summaries, client notes, and more premium long-form documents.",
        style: {
            titleFont: "Georgia, Cambria, \"Times New Roman\", serif",
            headingFont: "Georgia, Cambria, \"Times New Roman\", serif",
            bodyFont: "Aptos, Calibri, Arial, sans-serif",
            metaFont: "Aptos, Calibri, Arial, sans-serif",
            titleSize: 24,
            headingSize: 13,
            bodySize: 11,
            metaSize: 9.5,
            lineHeight: 1.55,
        },
        pdfFonts: {
            title: "times",
            heading: "times",
            body: "helvetica",
            meta: "helvetica",
        },
    },
    {
        id: "board-briefing",
        label: "Board Briefing",
        description: "Compact hierarchy and disciplined spacing for dense but readable briefing packs.",
        bestFor: "Decision memos, board briefs, and concise weekly leadership readouts.",
        style: {
            titleFont: "Aptos Display, Aptos, Arial, sans-serif",
            headingFont: "Aptos, Arial, sans-serif",
            bodyFont: "Aptos, Arial, sans-serif",
            metaFont: "Aptos, Arial, sans-serif",
            titleSize: 20,
            headingSize: 11.5,
            bodySize: 10.5,
            metaSize: 8.5,
            lineHeight: 1.4,
        },
        pdfFonts: {
            title: "helvetica",
            heading: "helvetica",
            body: "helvetica",
            meta: "helvetica",
        },
    },
    {
        id: "digital-inter",
        label: "Digital Inter",
        description: "Contemporary product-and-operations typography with crisp screen-native rhythm.",
        bestFor: "Product teams, operational notes, and modern digital-first organizations.",
        style: {
            titleFont: "Inter, Segoe UI, Arial, sans-serif",
            headingFont: "Inter, Segoe UI, Arial, sans-serif",
            bodyFont: "\"Source Sans 3\", Inter, Segoe UI, Arial, sans-serif",
            metaFont: "\"Source Sans 3\", Inter, Segoe UI, Arial, sans-serif",
            titleSize: 21,
            headingSize: 12,
            bodySize: 10.5,
            metaSize: 9,
            lineHeight: 1.45,
        },
        pdfFonts: {
            title: "helvetica",
            heading: "helvetica",
            body: "helvetica",
            meta: "helvetica",
        },
    },
];
export const isOutputLayoutPresetId = (value) => Boolean(value && OUTPUT_LAYOUT_PRESETS.some((preset) => preset.id === value));
export const getOutputLayoutPreset = (presetId) => OUTPUT_LAYOUT_PRESETS.find((preset) => preset.id === presetId)
    ?? OUTPUT_LAYOUT_PRESETS.find((preset) => preset.id === DEFAULT_OUTPUT_LAYOUT_PRESET_ID)
    ?? OUTPUT_LAYOUT_PRESETS[0];
export const getPrimaryFontFamily = (fontStack) => fontStack
    .split(",")[0]
    ?.trim()
    .replace(/^["']|["']$/g, "")
    || "Aptos";

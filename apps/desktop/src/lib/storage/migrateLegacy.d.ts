import type { DesktopAppSnapshot } from "@notesmith/domain";
export declare const parseLegacyImportSnapshot: (payload: unknown) => DesktopAppSnapshot | null;
export declare const loadLegacyBrowserSnapshot: () => DesktopAppSnapshot | null;

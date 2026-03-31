export declare const checkForDesktopUpdates: () => Promise<{
    available: false;
    version?: undefined;
    install?: undefined;
} | {
    available: true;
    version: string;
    install: () => Promise<void>;
}>;

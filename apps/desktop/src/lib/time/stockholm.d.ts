export declare const getStockholmOffsetMinutes: (value?: Date) => 120 | 60;
export declare const getStockholmDateTimeParts: (value?: Date) => {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
    weekday: number;
};
export declare const formatStockholmDateParts: (year: number, month: number, day: number) => string;
export declare const formatStockholmDate: (value?: Date) => string;
export declare const formatStockholmMonth: (value?: Date) => string;
export declare const formatStockholmTime: (value?: Date) => string;
export declare const parseIsoDateUtc: (date: string) => Date;
export declare const formatIsoDateUtc: (value: Date) => string;
export declare const addDaysIso: (date: string, days: number) => string;
export declare const daysBetweenIso: (fromDate: string, toDate: string) => number;
export declare const formatStockholmDayLabel: (date: string) => string;
export declare const getStockholmIsoWeekParts: (value?: Date) => {
    isoYear: number;
    isoWeek: number;
};
export declare const formatStockholmIsoWeek: (value?: Date) => string;

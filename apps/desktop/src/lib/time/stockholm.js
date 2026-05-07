const STOCKHOLM_STANDARD_OFFSET_MINUTES = 60;
const STOCKHOLM_DST_OFFSET_MINUTES = 120;
const STOCKHOLM_DST_START_HOUR_UTC = 1;
const STOCKHOLM_DST_END_HOUR_UTC = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIME_ZONE = "Europe/Stockholm";
const SYSTEM_TIME_ZONE = typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE
    : DEFAULT_TIME_ZONE;
const pad = (value) => `${value}`.padStart(2, "0");
const stockholmPartsFormatter = typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("en-CA", {
        timeZone: SYSTEM_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })
    : null;
const getLastSundayOfMonthUtc = (year, monthIndex) => {
    const value = new Date(Date.UTC(year, monthIndex + 1, 0));
    value.setUTCDate(value.getUTCDate() - value.getUTCDay());
    return value;
};
export const getStockholmOffsetMinutes = (value = new Date()) => {
    const year = value.getUTCFullYear();
    const dstStartDate = getLastSundayOfMonthUtc(year, 2);
    const dstEndDate = getLastSundayOfMonthUtc(year, 9);
    const dstStart = Date.UTC(year, 2, dstStartDate.getUTCDate(), STOCKHOLM_DST_START_HOUR_UTC, 0, 0, 0);
    const dstEnd = Date.UTC(year, 9, dstEndDate.getUTCDate(), STOCKHOLM_DST_END_HOUR_UTC, 0, 0, 0);
    const timestamp = value.getTime();
    return timestamp >= dstStart && timestamp < dstEnd
        ? STOCKHOLM_DST_OFFSET_MINUTES
        : STOCKHOLM_STANDARD_OFFSET_MINUTES;
};
const toStockholmClock = (value = new Date()) => new Date(value.getTime() + getStockholmOffsetMinutes(value) * 60 * 1000);
const getLegacyStockholmDateTimeParts = (value = new Date()) => {
    const stockholmClock = toStockholmClock(value);
    return {
        year: stockholmClock.getUTCFullYear(),
        month: stockholmClock.getUTCMonth() + 1,
        day: stockholmClock.getUTCDate(),
        hours: stockholmClock.getUTCHours(),
        minutes: stockholmClock.getUTCMinutes(),
    };
};
const readPart = (parts, type) => {
    const value = parts.find((part) => part.type === type)?.value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
export const getStockholmDateTimeParts = (value = new Date()) => {
    if (stockholmPartsFormatter) {
        try {
            const parts = stockholmPartsFormatter.formatToParts(value);
            const year = readPart(parts, "year");
            const month = readPart(parts, "month");
            const day = readPart(parts, "day");
            const hours = readPart(parts, "hour");
            const minutes = readPart(parts, "minute");
            if (year !== null &&
                month !== null &&
                day !== null &&
                hours !== null &&
                minutes !== null) {
                return {
                    year,
                    month,
                    day,
                    hours,
                    minutes,
                    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
                };
            }
        }
        catch {
            // Fall through to the legacy offset-based fallback below.
        }
    }
    const legacy = getLegacyStockholmDateTimeParts(value);
    return {
        ...legacy,
        weekday: new Date(Date.UTC(legacy.year, legacy.month - 1, legacy.day)).getUTCDay(),
    };
};
export const formatStockholmDateParts = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;
export const formatStockholmDate = (value = new Date()) => {
    const { year, month, day } = getStockholmDateTimeParts(value);
    return formatStockholmDateParts(year, month, day);
};
export const formatStockholmMonth = (value = new Date()) => formatStockholmDate(value).slice(0, 7);
export const formatStockholmTime = (value = new Date()) => {
    const { hours, minutes } = getStockholmDateTimeParts(value);
    return `${pad(hours)}:${pad(minutes)}`;
};
export const parseIsoDateUtc = (date) => {
    const [year, month, day] = date.split("-").map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return new Date(Date.UTC(1970, 0, 1));
    }
    return new Date(Date.UTC(year, month - 1, day));
};
export const formatIsoDateUtc = (value) => `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
export const addDaysIso = (date, days) => {
    const next = parseIsoDateUtc(date);
    next.setUTCDate(next.getUTCDate() + days);
    return formatIsoDateUtc(next);
};
export const daysBetweenIso = (fromDate, toDate) => Math.round((parseIsoDateUtc(toDate).getTime() - parseIsoDateUtc(fromDate).getTime()) / DAY_MS) || 0;
export const formatStockholmDayLabel = (date) => {
    const value = parseIsoDateUtc(date);
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][value.getUTCDay()];
    return `${weekday} ${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
};
export const getStockholmIsoWeekParts = (value = new Date()) => {
    const { year, month, day } = getStockholmDateTimeParts(value);
    const nextValue = new Date(Date.UTC(year, month - 1, day));
    nextValue.setUTCDate(nextValue.getUTCDate() + 3 - ((nextValue.getUTCDay() + 6) % 7));
    const isoYear = nextValue.getUTCFullYear();
    const weekOne = new Date(Date.UTC(isoYear, 0, 4));
    weekOne.setUTCDate(weekOne.getUTCDate() - ((weekOne.getUTCDay() + 6) % 7));
    const isoWeek = Math.round((nextValue.getTime() - weekOne.getTime()) / (7 * DAY_MS)) + 1;
    return { isoYear, isoWeek };
};
export const formatStockholmIsoWeek = (value = new Date()) => {
    const { isoYear, isoWeek } = getStockholmIsoWeekParts(value);
    return `${isoYear}-W${pad(isoWeek)}`;
};

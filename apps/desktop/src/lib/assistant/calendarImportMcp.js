import { addDaysIso, formatStockholmDate } from "../time/stockholm";
import { isTauriRuntime } from "../storage/environment";
export const CALENDAR_IMPORT_MCP_EVENT = "notesmith-calendar-import-request";
export const CHATGPT_OUTLOOK_ACCOUNT_KEY = "chatgpt-outlook-calendar";
export const CHATGPT_CALENDAR_WINDOW_DAYS = 7;
const invokeTauri = async (command, args = {}) => {
    if (!isTauriRuntime())
        throw new Error("The NoteSmith MCP importer is available in the installed desktop app.");
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke(command, args);
};
export const startCalendarImportMcp = () => invokeTauri("start_calendar_import_mcp");
export const stopCalendarImportMcp = () => invokeTauri("stop_calendar_import_mcp");
export const getCalendarImportMcpStatus = () => invokeTauri("get_calendar_import_mcp_status");
export const completeCalendarImportMcp = (requestId, result, error) => invokeTauri("complete_calendar_import_mcp", {
    requestId,
    result,
    error: error || null,
});
const eventDate = (dateTime) => dateTime.match(/^(\d{4}-\d{2}-\d{2})T/)?.[1] ?? "";
export const getChatGptCalendarImportWindow = (now = new Date()) => {
    const fromDate = formatStockholmDate(now);
    return {
        fromDate,
        toDate: addDaysIso(fromDate, CHATGPT_CALENDAR_WINDOW_DAYS - 1),
    };
};
export const buildChatGptOutlookImportBatch = (request, now = new Date()) => {
    const window = getChatGptCalendarImportWindow(now);
    let rejectedOutsideWindow = 0;
    const events = request.events.flatMap((event) => {
        const date = eventDate(event.startDateTime);
        if (!date || date < window.fromDate || date > window.toDate) {
            rejectedOutsideWindow += 1;
            return [];
        }
        return [{
                id: event.externalId.trim(),
                iCalUId: event.iCalUId?.trim() || undefined,
                subject: event.title.trim() || "Outlook meeting",
                start: { dateTime: event.startDateTime, timeZone: "Europe/Stockholm" },
                end: { dateTime: event.endDateTime, timeZone: "Europe/Stockholm" },
                attendees: (event.attendeeNames ?? [])
                    .map((name) => name.trim())
                    .filter(Boolean)
                    .map((name) => ({ emailAddress: { name } })),
                location: { displayName: event.location?.trim() || "" },
                onlineMeeting: event.onlineMeetingUrl?.trim() ? { joinUrl: event.onlineMeetingUrl.trim() } : null,
                webLink: event.webLink?.trim() || "",
                lastModifiedDateTime: event.lastModifiedDateTime?.trim() || "",
                isCancelled: Boolean(event.isCancelled),
                sensitivity: event.isPrivate ? "private" : "normal",
            }];
    });
    return {
        batch: {
            accountKey: CHATGPT_OUTLOOK_ACCOUNT_KEY,
            events,
            fullSync: request.completeSnapshot,
            fromDate: window.fromDate,
            toDate: window.toDate,
            rangeKey: `${window.fromDate}:${window.toDate}:chatgpt-outlook-calendar`,
            syncedAt: now.toISOString(),
        },
        rejectedOutsideWindow,
    };
};

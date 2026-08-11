import { useCallback, useEffect, useRef } from "react";
const DEFAULT_RICH_TEXT_COMMIT_DELAY_MS = 280;
export const useDeferredRichTextChange = (onChange, delayMs = DEFAULT_RICH_TEXT_COMMIT_DELAY_MS) => {
    const onChangeRef = useRef(onChange);
    const pendingRef = useRef(null);
    const timerRef = useRef(null);
    onChangeRef.current = onChange;
    const flush = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending)
            pending.commit(pending.html);
    }, []);
    const schedule = useCallback((html) => {
        pendingRef.current = { html, commit: onChangeRef.current };
        if (timerRef.current)
            clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, delayMs);
    }, [delayMs, flush]);
    const commitNow = useCallback((html) => {
        pendingRef.current = { html, commit: onChangeRef.current };
        flush();
    }, [flush]);
    useEffect(() => flush, [flush]);
    return { schedule, flush, commitNow };
};

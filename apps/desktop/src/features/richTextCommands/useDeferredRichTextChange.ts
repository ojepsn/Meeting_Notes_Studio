import { useCallback, useEffect, useRef } from "react";

const DEFAULT_RICH_TEXT_COMMIT_DELAY_MS = 280;

export const useDeferredRichTextChange = (
  onChange: (html: string) => void,
  delayMs = DEFAULT_RICH_TEXT_COMMIT_DELAY_MS,
) => {
  const onChangeRef = useRef(onChange);
  const pendingRef = useRef<{ html: string; commit: (html: string) => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onChangeRef.current = onChange;

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) pending.commit(pending.html);
  }, []);

  const schedule = useCallback((html: string) => {
    pendingRef.current = { html, commit: onChangeRef.current };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, delayMs);
  }, [delayMs, flush]);

  const commitNow = useCallback((html: string) => {
    pendingRef.current = { html, commit: onChangeRef.current };
    flush();
  }, [flush]);

  useEffect(() => flush, [flush]);

  return { schedule, flush, commitNow };
};

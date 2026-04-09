import { jsx as _jsx } from "react/jsx-runtime";
import { forwardRef, useCallback } from "react";
const tryShowPicker = (input) => {
    if (!input || typeof input.showPicker !== "function")
        return;
    try {
        input.showPicker();
    }
    catch {
        // Ignore environments that expose but restrict showPicker.
    }
};
export const DateInput = forwardRef(function DateInput({ type = "date", onFocus, onClick, ...props }, ref) {
    const handleFocus = useCallback((event) => {
        tryShowPicker(event.currentTarget);
        onFocus?.(event);
    }, [onFocus]);
    const handleClick = useCallback((event) => {
        tryShowPicker(event.currentTarget);
        onClick?.(event);
    }, [onClick]);
    return _jsx("input", { ...props, ref: ref, type: type, onFocus: handleFocus, onClick: handleClick });
});

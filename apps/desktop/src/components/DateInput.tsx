import { forwardRef, useCallback, type InputHTMLAttributes, type MouseEvent, type FocusEvent } from "react";

type DateInputProps = InputHTMLAttributes<HTMLInputElement>;

type DateInputElement = HTMLInputElement & {
  showPicker?: () => void;
};

const tryShowPicker = (input: DateInputElement | null) => {
  if (!input || typeof input.showPicker !== "function") return;
  try {
    input.showPicker();
  } catch {
    // Ignore environments that expose but restrict showPicker.
  }
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { type = "date", onFocus, onClick, ...props },
  ref,
) {
  const handleFocus = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      tryShowPicker(event.currentTarget as DateInputElement);
      onFocus?.(event);
    },
    [onFocus],
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLInputElement>) => {
      tryShowPicker(event.currentTarget as DateInputElement);
      onClick?.(event);
    },
    [onClick],
  );

  return <input {...props} ref={ref} type={type} onFocus={handleFocus} onClick={handleClick} />;
});

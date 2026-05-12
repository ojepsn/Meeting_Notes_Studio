import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type DeferredTimeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "type" | "value"> & {
  value: string;
  onCommit: (value: string) => void;
  onDraftChange?: (value: string) => void;
};

const isCompleteTimeValue = (value: string) => value === "" || /^\d{2}:\d{2}$/.test(value);

export const DeferredTimeInput = ({
  value,
  onCommit,
  onDraftChange,
  onBlur,
  onFocus,
  onKeyDown,
  ...props
}: DeferredTimeInputProps) => {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const skipNextBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(value);
    }
  }, [value, isFocused]);

  const commitDraft = (nextValue: string) => {
    if (!isCompleteTimeValue(nextValue)) {
      setDraft(value);
      return;
    }
    if (nextValue !== value) {
      onCommit(nextValue);
    }
  };

  return (
    <input
      {...props}
      type="time"
      value={draft}
      onChange={(event) => {
        const nextValue = event.target.value;
        setDraft(nextValue);
        onDraftChange?.(nextValue);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setIsFocused(false);
        if (skipNextBlurCommitRef.current) {
          skipNextBlurCommitRef.current = false;
          setDraft(value);
        } else {
          commitDraft(event.currentTarget.value);
        }
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          skipNextBlurCommitRef.current = true;
          setDraft(value);
          event.currentTarget.blur();
          return;
        }
        onKeyDown?.(event);
      }}
    />
  );
};

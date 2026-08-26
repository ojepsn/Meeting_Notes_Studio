import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";

interface DeferredTextProps {
  value: string;
  onCommit: (value: string) => void;
  onDraftChange?: (value: string) => void;
  commitDelayMs?: number;
}

type DeferredTextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "defaultValue" | "onChange" | "value"> & DeferredTextProps;
type DeferredTextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "defaultValue" | "onChange" | "value"> & DeferredTextProps;

const useDeferredTextDraft = (value: string, onCommit: (value: string) => void, commitDelayMs: number) => {
  const [draft, setDraft] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onCommit);
  const draftRef = useRef(value);
  const externalValueRef = useRef(value);
  const lastCommittedRef = useRef(value);
  const skipNextBlurCommitRef = useRef(false);

  onCommitRef.current = onCommit;
  draftRef.current = draft;
  externalValueRef.current = value;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const commit = (nextValue: string) => {
    clearTimer();
    if (nextValue === lastCommittedRef.current) return;
    lastCommittedRef.current = nextValue;
    onCommitRef.current(nextValue);
  };

  const scheduleCommit = (nextValue: string) => {
    clearTimer();
    timerRef.current = setTimeout(() => commit(nextValue), commitDelayMs);
  };

  useEffect(() => {
    if (!isFocused) {
      setDraft(value);
      lastCommittedRef.current = value;
    } else if (value === draftRef.current) {
      lastCommittedRef.current = value;
    }
  }, [value, isFocused]);

  useEffect(() => () => clearTimer(), []);

  return {
    draft,
    isFocused,
    skipNextBlurCommitRef,
    setIsFocused,
    updateDraft: (nextValue: string, shouldSchedule = true) => {
      draftRef.current = nextValue;
      setDraft(nextValue);
      if (shouldSchedule) scheduleCommit(nextValue);
    },
    commit,
    restore: () => {
      clearTimer();
      const restored = externalValueRef.current;
      draftRef.current = restored;
      lastCommittedRef.current = restored;
      setDraft(restored);
    },
    scheduleCommit,
  };
};

export const DeferredTextInput = ({
  value,
  onCommit,
  onDraftChange,
  commitDelayMs = 400,
  onBlur,
  onFocus,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: DeferredTextInputProps) => {
  const state = useDeferredTextDraft(value, onCommit, commitDelayMs);
  const isComposingRef = useRef(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || isComposingRef.current) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      state.skipNextBlurCommitRef.current = true;
      state.restore();
      event.currentTarget.blur();
    }
  };

  return (
    <input
      {...props}
      value={state.draft}
      onChange={(event) => {
        const nextValue = event.target.value;
        state.updateDraft(nextValue, !isComposingRef.current);
        onDraftChange?.(nextValue);
      }}
      onFocus={(event) => {
        state.setIsFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        state.setIsFocused(false);
        if (state.skipNextBlurCommitRef.current) {
          state.skipNextBlurCommitRef.current = false;
        } else {
          state.commit(event.currentTarget.value);
        }
        onBlur?.(event);
      }}
      onKeyDown={handleKeyDown}
      onCompositionStart={(event) => {
        isComposingRef.current = true;
        onCompositionStart?.(event);
      }}
      onCompositionEnd={(event) => {
        isComposingRef.current = false;
        state.scheduleCommit(event.currentTarget.value);
        onCompositionEnd?.(event);
      }}
    />
  );
};

export const DeferredTextArea = ({
  value,
  onCommit,
  onDraftChange,
  commitDelayMs = 400,
  onBlur,
  onFocus,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  ...props
}: DeferredTextAreaProps) => {
  const state = useDeferredTextDraft(value, onCommit, commitDelayMs);
  const isComposingRef = useRef(false);

  return (
    <textarea
      {...props}
      value={state.draft}
      onChange={(event) => {
        const nextValue = event.target.value;
        state.updateDraft(nextValue, !isComposingRef.current);
        onDraftChange?.(nextValue);
      }}
      onFocus={(event) => {
        state.setIsFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        state.setIsFocused(false);
        if (state.skipNextBlurCommitRef.current) {
          state.skipNextBlurCommitRef.current = false;
        } else {
          state.commit(event.currentTarget.value);
        }
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || isComposingRef.current) return;
        if (event.key === "Escape") {
          event.preventDefault();
          state.skipNextBlurCommitRef.current = true;
          state.restore();
          event.currentTarget.blur();
        }
      }}
      onCompositionStart={(event) => {
        isComposingRef.current = true;
        onCompositionStart?.(event);
      }}
      onCompositionEnd={(event) => {
        isComposingRef.current = false;
        state.scheduleCommit(event.currentTarget.value);
        onCompositionEnd?.(event);
      }}
    />
  );
};

export const TODO_SHORTCUT_PATTERN = /^td\s+(.+)$/i;
export const ACTIVITY_SHORTCUT_PATTERN = /^act\s+(.+)$/i;

export const parseTodoShortcut = (value: string) => {
  const match = value.trim().match(TODO_SHORTCUT_PATTERN);
  return match?.[1]?.trim() || "";
};

export const parseActivityShortcut = (value: string) => {
  const match = value.trim().match(ACTIVITY_SHORTCUT_PATTERN);
  return match?.[1]?.trim() || "";
};

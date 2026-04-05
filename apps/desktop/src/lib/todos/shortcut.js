export const TODO_SHORTCUT_PATTERN = /^td\s+(.+)$/i;
export const parseTodoShortcut = (value) => {
    const match = value.trim().match(TODO_SHORTCUT_PATTERN);
    return match?.[1]?.trim() || "";
};

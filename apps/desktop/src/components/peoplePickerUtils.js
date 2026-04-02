export const parseTokenList = (value) => Array.from(new Map(value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => [entry.toLocaleLowerCase(), entry])).values());
export const buildVisibleQuickSuggestions = ({ suggestedPeople, selectedPeople, limit = 6, }) => {
    const selectedKeys = new Set(selectedPeople.map((entry) => entry.trim().toLocaleLowerCase()).filter(Boolean));
    return suggestedPeople
        .filter((entry) => {
        const normalized = entry.trim().toLocaleLowerCase();
        return normalized && !selectedKeys.has(normalized);
    })
        .slice(0, limit);
};
export const parsePeople = parseTokenList;

export const filterComboboxOptions = (options, query, limit = 8) => {
    const seen = new Set();
    const uniqueOptions = options.filter((option) => {
        const key = option.trim().toLocaleLowerCase();
        if (!key || seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery)
        return uniqueOptions.slice(0, limit);
    const prefixMatches = [];
    const containsMatches = [];
    uniqueOptions.forEach((option) => {
        const normalizedOption = option.toLocaleLowerCase();
        if (normalizedOption.startsWith(normalizedQuery)) {
            prefixMatches.push(option);
        }
        else if (normalizedOption.includes(normalizedQuery)) {
            containsMatches.push(option);
        }
    });
    return [...prefixMatches, ...containsMatches].slice(0, limit);
};

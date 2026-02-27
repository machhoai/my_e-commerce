export function parseTemplate(templateString: string, data: Record<string, string | number | undefined>): string {
    if (!templateString) return '';

    return templateString.replace(/\{(\w+)\}/g, (match, key) => {
        const value = data[key];
        // If the variable is provided, replace it. Otherwise, leave the placeholder intact or replace with empty space depending on preference.
        // We will default to empty space or fallback if the key isn't provided, to avoid leaking raw `{var}` syntax to the user.
        return value !== undefined && value !== null ? String(value) : '';
    });
}

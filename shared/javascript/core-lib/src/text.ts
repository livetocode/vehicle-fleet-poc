export function capitalize(value: string) {
    if (value) {
        return value.substring(0, 1).toLocaleUpperCase() + value.substring(1);
    }
    return '';
}
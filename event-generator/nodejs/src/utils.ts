export function calcCount(total: number, segment: number) {
    let count = Math.trunc(total / segment);
    const mod = total % segment;
    if (mod !== 0) {
        count += 1;
    }
    return count;
}


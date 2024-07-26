
export function computeHashNumber(value: string, digits: number = 6): number {
    const m = Math.pow(10, digits+1) - 1;
    const phi = Math.pow(10, digits) / 2 - 1;
    let n = 0;
    for (var i = 0; i < value.length; i++) {
        n = (n + phi * value.charCodeAt(i)) % m;
    }
    return n;
}

export function roundDecimals(value: number, decimals: number) {
    const pow = Math.pow(10, decimals)
    return Math.round(value * pow) / pow
}
  
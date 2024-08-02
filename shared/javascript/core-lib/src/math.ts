
export function computeHashNumber(value: string, digits: number = 6): number {
    const m = Math.pow(10, digits + 1) - 1;
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

export function formatBytes(value: number, decimals: number = 1) {
    const PB = 1024 * 1024 * 1024 * 1024 * 1024
    const TB = 1024 * 1024 * 1024 * 1024
    const GB = 1024 * 1024 * 1024
    const MB = 1024 * 1024
    const KB = 1024
    const absValue = Math.abs(value)
    if (absValue >= PB) {
        return {
            value: roundDecimals(value / PB, decimals),
            units: 'PB',
            factor: PB,
        }
    }
    if (absValue >= TB) {
        return {
            value: roundDecimals(value / TB, decimals),
            units: 'TB',
            factor: TB,
        }
    }
    if (absValue >= GB) {
        return {
            value: roundDecimals(value / GB, decimals),
            units: 'GB',
            factor: GB,
        }
    }
    if (absValue >= MB) {
        return {
            value: roundDecimals(value / MB, decimals),
            units: 'MB',
            factor: MB,
        }
    }
    if (absValue >= KB) {
        return {
            value: roundDecimals(value / KB, decimals),
            units: 'KB',
            factor: KB,
        }
    }
    if (absValue > 0) {
        return {
            value,
            units: 'B',
            factor: 1,
        }
    }
    // no unit for zero
    return {
        value: roundDecimals(value, decimals),
        units: '',
        factor: 1,
    }
}

export function formatCounts(value: number, decimals: number = 1) {
    const T = 1000 * 1000 * 1000 * 1000
    const B = 1000 * 1000 * 1000
    const M = 1000 * 1000
    const K = 1000
    const absValue = Math.abs(value)
    if (absValue >= T) {
        return {
            value: roundDecimals(value / T, decimals),
            units: 't',
            factor: T,
        }
    }
    if (absValue >= B) {
        return {
            value: roundDecimals(value / B, decimals),
            units: 'b',
            factor: B,
        }
    }
    if (absValue >= M) {
        return {
            value: roundDecimals(value / M, decimals),
            units: 'm',
            factor: M,
        }
    }
    if (absValue >= K) {
        return {
            value: roundDecimals(value / K, decimals),
            units: 'k',
            factor: K,
        }
    }
    return {
        value: roundDecimals(value, decimals),
        units: '',
        factor: 1,
    }
}
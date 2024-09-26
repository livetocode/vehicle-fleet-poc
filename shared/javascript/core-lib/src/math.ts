
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

export function formatDays(value: number, decimals: number = 1) {
    const YEAR = 365
    const MONTH = 30
    const absValue = Math.abs(value)
    if (absValue >= YEAR) {
      return {
        value: roundDecimals(value / YEAR, decimals),
        units: 'years',
        factor: YEAR,
      }
    }
    if (absValue >= MONTH) {
      return {
        value: roundDecimals(value / MONTH, decimals),
        units: 'months',
        factor: MONTH,
      }
    }
    if (absValue > 0) {
      return {
        value,
        units: 'days',
        factor: 1,
      }
    }
    // no unit for zero
    return {
      value: roundDecimals(value, 1),
      units: '',
      factor: 1,
    }
}

export function formatMSecs(value: number, decimals: number = 1) {
    const SEC = 1000;
    const MINUTE = 60*SEC;
    const HOUR = 60*MINUTE;
    if (value > HOUR) {
        return {
            value: roundDecimals(value / HOUR, decimals),
            units: 'h',
            factor: HOUR,
          }    
    }
    if (value > MINUTE) {
        return {
            value: roundDecimals(value / MINUTE, decimals),
            units: 'm',
            factor: MINUTE,
          }    
    }
    if (value > SEC) {
        return {
            value: roundDecimals(value / SEC, decimals),
            units: 's',
            factor: SEC,
          }    
    }
    if (value > 0) {
        return {
          value,
          units: 'ms',
          factor: 1,
        }
      }
    // no unit for zero
    return {
        value: roundDecimals(value, 1),
        units: '',
        factor: 1,
      }
}

export function formatNumber(
    value: number,
    units: string,
    decimals: number = 1,
    appendUnits: boolean = true,
    factor: number = 1,
    factorUnits?: string
  ) {
    let convertedValue = {
      value,
      units,
      factor,
    }
    if (factor > 1 && factorUnits) {
      convertedValue.value = roundDecimals(value / factor, decimals)
      convertedValue.units = factorUnits
    } else if (units === 'B' || units === 'Bytes') {
      convertedValue = formatBytes(value, decimals)
    } else if (units === '%') {
      convertedValue.value = roundDecimals(value, decimals)
    } else if (units === 'raw') {
      convertedValue.value = roundDecimals(value, decimals)
      convertedValue.units = ''
    } else if (units === 'days') {
      convertedValue = formatDays(roundDecimals(value, decimals))
    } else if (units === 'ms') {
      convertedValue = formatMSecs(roundDecimals(value, decimals))
    } else if (units) {
      throw new Error('Unknown units: ' + units)
    } else {
      convertedValue = formatCounts(value, decimals)
    }
    let text = (convertedValue.value || 0).toLocaleString()
    if (appendUnits && convertedValue.units) {
      text += ' ' + convertedValue.units
    }
    return {
      text,
      value: convertedValue.value,
      units: convertedValue.units,
      factor: convertedValue.factor,
      decimals,
      appendUnits,
    }
  }
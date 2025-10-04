export interface StatValue {
    value?: number;
    values?: { title: string; value: number; }[];
    flags?: string[];
    unitType?: string;
    decimals?: number;
    unitPlural: string;
}

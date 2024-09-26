export interface StatValue {
    value?: number;
    values?: { title: string; value: number; }[];
    unitType?: string;
    decimals?: number;
    unitPlural: string;
}

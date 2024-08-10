import os from 'os';
import { ProcessStats } from "core-lib";

export function getProcessStats(): ProcessStats {
    return {
        memory: process.memoryUsage(),
        loadAverage: os.loadavg(),
    }
}

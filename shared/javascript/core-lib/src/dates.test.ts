import { test, describe } from 'node:test';
import assert from 'node:assert';
import { generateTimePrefixes } from './dates.js';

function generateTimePrefixesToArray(startDate: Date, endDate: Date, windowInMin: number): string[] {
    const result: string[] = [];
    for (const prefix of generateTimePrefixes(startDate, endDate, windowInMin)) {
        result.push(prefix.join('-'));
    }
    return result;
}

describe('generateTimePrefixes', () => {

    test('same minutes range, inside', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-01T02:18:00Z'), new Date('2023-01-01T02:24:00Z'), 15);
        assert.deepEqual(result, [
            '2023-01-01-02-15',
        ]);
    });

    test('same minutes range, aligned to end of range', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-01T02:18:00Z'), new Date('2023-01-01T02:30:00Z'), 15);
        assert.deepEqual(result, [
            '2023-01-01-02-15',
        ]);
    });

    test('one full hour, one partial hour', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-01T02:02:00Z'), new Date('2023-01-01T03:02:00Z'), 15);
        assert.deepEqual(result, [
            '2023-01-01-02',
            '2023-01-01-03-00',
        ]);
    });

    test('one full hour', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-01T00:00:00Z'), new Date('2023-01-01T01:00:00Z'), 15);
        assert.deepEqual(result, [
            '2023-01-01-00',
        ]);
    });

    test('2 partial hours', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-01T00:34:00Z'), new Date('2023-01-01T01:51:00Z'), 15);
        assert.deepEqual(result, [
            '2023-01-01-00-30',
            '2023-01-01-00-45',
            '2023-01-01-01-00',
            '2023-01-01-01-15',
            '2023-01-01-01-30',
            '2023-01-01-01-45'
        ]);
    });

    test('1 partial hour and 1 full hour', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-01T00:34:00Z'), new Date('2023-01-01T02:00:00Z'), 15);
        assert.deepEqual(result, [
            '2023-01-01-00-30',
            '2023-01-01-00-45',
            '2023-01-01-01',
        ]);
    });

    test('1 full day', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-02T00:00:00Z'), new Date('2023-01-03T00:00:00Z'), 15);
        assert.deepEqual(result, [
            '2023-01-02',
        ]);
    });

    test('1 full month', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-01T00:00:00Z'), new Date('2023-02-01T00:00:00Z'), 15);
        assert.deepEqual(result, [
            '2023-01',
        ]);
    });

    test('1 full year', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-01T00:00:00Z'), new Date('2024-01-01T00:00:00Z'), 15);
        assert.deepEqual(result, [
            '2023',
        ]);
    });

    test('1 partial day, 1 full day, 1 partial day', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-01T22:34:00Z'), new Date('2023-01-03T02:22:00Z'), 15);
        assert.deepEqual(result, [
            '2023-01-01-22-30', 
            '2023-01-01-22-45',
            '2023-01-01-23',
            '2023-01-02',
            '2023-01-03-00',
            '2023-01-03-01',    
            '2023-01-03-02-00',
            '2023-01-03-02-15'
        ]);
    });

    test('1 partial month, 1 full month, 1 partial month', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-01-01T22:34:00Z'), new Date('2023-03-03T02:22:00Z'), 15);
        assert.deepEqual(result, [
            '2023-01-01-22-30', 
            '2023-01-01-22-45', 
            '2023-01-01-23',
            '2023-01-02',      
            '2023-01-03',       '2023-01-04',       '2023-01-05',       
            '2023-01-06',       '2023-01-07',
            '2023-01-08',       '2023-01-09',       '2023-01-10',
            '2023-01-11',       '2023-01-12',       '2023-01-13',
            '2023-01-14',       '2023-01-15',       '2023-01-16',
            '2023-01-17',       '2023-01-18',       '2023-01-19',
            '2023-01-20',       '2023-01-21',       '2023-01-22',
            '2023-01-23',       '2023-01-24',       '2023-01-25',
            '2023-01-26',       '2023-01-27',       '2023-01-28',
            '2023-01-29',       '2023-01-30',       '2023-01-31',
            '2023-02',          
            '2023-03-01',       
            '2023-03-02',
            '2023-03-03-00',    
            '2023-03-03-01',    
            '2023-03-03-02-00',
            '2023-03-03-02-15' 
        ]);
    });
    test('1 partial year, 1 full year, 1 partial year', (t) => {
        const result = generateTimePrefixesToArray(new Date('2023-11-01T22:34:00Z'), new Date('2025-02-03T01:22:00Z'), 15);
        assert.deepEqual(result, [
            '2023-11-01-22-30', '2023-11-01-22-45', '2023-11-01-23',
            '2023-11-02',       '2023-11-03',       '2023-11-04',
            '2023-11-05',       '2023-11-06',       '2023-11-07',
            '2023-11-08',       '2023-11-09',       '2023-11-10',
            '2023-11-11',       '2023-11-12',       '2023-11-13',
            '2023-11-14',       '2023-11-15',       '2023-11-16',
            '2023-11-17',       '2023-11-18',       '2023-11-19',
            '2023-11-20',       '2023-11-21',       '2023-11-22',
            '2023-11-23',       '2023-11-24',       '2023-11-25',
            '2023-11-26',       '2023-11-27',       '2023-11-28',
            '2023-11-29',       '2023-11-30',       
            '2023-12',
            '2024',             
            '2025-01',          
            '2025-02-01',
            '2025-02-02',       
            '2025-02-03-00',    
            '2025-02-03-01-00',
            '2025-02-03-01-15'
        ]);
    });

});


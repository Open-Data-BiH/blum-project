import { describe, expect, it } from 'vitest';
import { isReducedScheduleDay } from '../../src/scripts/features/lines/school-holidays';

describe('school holiday periods', () => {
    it('flags dates inside reduced schedule windows', () => {
        expect(isReducedScheduleDay(new Date('2026-07-10T12:00:00Z'))).toBe(true); // summer
        expect(isReducedScheduleDay(new Date('2026-12-30T12:00:00Z'))).toBe(true); // winter (dec)
        expect(isReducedScheduleDay(new Date('2026-01-10T12:00:00Z'))).toBe(true); // winter (jan)
    });

    it('does not flag dates outside reduced schedule windows', () => {
        expect(isReducedScheduleDay(new Date('2026-02-15T12:00:00Z'))).toBe(false);
        expect(isReducedScheduleDay(new Date('2026-09-20T12:00:00Z'))).toBe(false);
    });
});

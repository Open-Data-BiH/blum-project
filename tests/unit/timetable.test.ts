import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderTimetable } from '../../src/scripts/features/lines/timetable';
import type { TimetableEntry } from '../../src/types/timetable';

const timetable: TimetableEntry = {
    lineId: '1',
    lineName: { bhs: 'Test linija', en: 'Test line' },
    directions: {
        bhs: ['Polazište - Odredište', 'Odredište - Polazište'],
        en: ['Origin - Destination', 'Destination - Origin'],
    },
    stations: [
        {
            name: 'Polazište',
            times: {
                weekday: [['05:10', '06:00'], ['05:30']],
                saturday: [[], []],
                sunday: [['09:55', '10:40'], ['10:15']],
            },
        },
    ],
};

const boundaryTimetable: TimetableEntry = {
    ...timetable,
    stations: [
        {
            name: 'Polazište',
            times: {
                weekday: [['05:10'], ['06:30']],
                saturday: [[], []],
                sunday: [['23:30'], ['23:00']],
                weekdayReduced: [['05:10'], []],
                sundayReduced: [['23:30'], ['23:00']],
            },
        },
    ],
};

describe('lines page timetable', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 7, 23, 22, 30)); // Sunday
        document.body.innerHTML = '<div id="timetable-display"></div>';
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('shows the next weekday schedule after Sunday service is exhausted', () => {
        const container = document.getElementById('timetable-display');
        expect(container).not.toBeNull();

        renderTimetable(timetable, container!);

        expect(container?.querySelector('.day-btn[data-day="weekday"]')?.classList.contains('active')).toBe(true);
        expect(container?.querySelector('.day-btn[data-day="sunday"]')?.classList.contains('active')).toBe(false);

        const weekdayView = container?.querySelector<HTMLElement>('#timetable-weekday-1a');
        expect(weekdayView?.style.display).toBe('');
        expect(weekdayView?.dataset.serviceDate).toBe('2026-08-24');
        expect(weekdayView?.querySelector('.minute-box[data-minute="10"]')?.classList.contains('next')).toBe(true);

        const sundayView = container?.querySelector<HTMLElement>('#timetable-sunday-1a');
        expect(sundayView?.style.display).toBe('none');
        expect(sundayView?.querySelector('.minute-box.next')).toBeNull();
    });

    it('updates the selected schedule after the final departure passes', () => {
        vi.setSystemTime(new Date(2026, 1, 22, 10, 39)); // Sunday
        const container = document.getElementById('timetable-display');

        renderTimetable(timetable, container!);
        expect(container?.querySelector('.day-btn[data-day="sunday"]')?.classList.contains('active')).toBe(true);

        vi.advanceTimersByTime(2 * 60 * 1000 + 300);

        expect(container?.querySelector('.day-btn[data-day="weekday"]')?.classList.contains('active')).toBe(true);
        expect(container?.querySelector<HTMLElement>('#timetable-weekday-1a')?.dataset.serviceDate).toBe('2026-02-23');
    });

    it('loads the correct schedule variant when switching directions across a reduced-service boundary', () => {
        vi.setSystemTime(new Date(2026, 7, 30, 22, 59)); // Sunday
        const container = document.getElementById('timetable-display');

        renderTimetable(boundaryTimetable, container!);
        vi.setSystemTime(new Date(2026, 7, 30, 23, 1));
        container?.querySelector<HTMLElement>('.direction-btn[data-direction="1b"]')?.click();

        const weekdayView = container?.querySelector<HTMLElement>('#timetable-weekday-1b');
        expect(container?.querySelector('.direction-btn[data-direction="1b"]')?.classList.contains('active')).toBe(
            true,
        );
        expect(container?.querySelector('.day-btn[data-day="weekday"]')?.classList.contains('active')).toBe(true);
        expect(weekdayView?.style.display).toBe('block');
        expect(weekdayView?.dataset.serviceDate).toBe('2026-09-01');
        expect(weekdayView?.dataset.reduced).toBe('false');
        expect(weekdayView?.querySelector('.minute-box[data-minute="30"]')).not.toBeNull();
        expect(container?.querySelector<HTMLElement>('.timetable-reduced-notice')?.hidden).toBe(true);
    });
});

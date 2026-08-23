import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initLineDetailTabs } from '../../src/scripts/features/lines/line-detail-tabs';
import { getTimetableDay } from '../../src/scripts/features/lines/timetable-day';

const dayMarkup = (day: string, active = false): string => `
    <button
        class="ldp-day-tab${active ? ' is-active' : ''}"
        data-day-target="${day}"
        aria-selected="${active}"
    ></button>
`;

const panelMarkup = (id: string, active = false): string => `
    <article
        class="ldp-direction-panel${active ? ' is-active' : ''}"
        data-direction-panel="${id}"
        ${active ? '' : 'hidden'}
    >
        ${dayMarkup('weekday', true)}
        ${dayMarkup('saturday')}
        ${dayMarkup('sunday')}
        <div class="ldp-day-panel is-active" data-day-panel="weekday"></div>
        <div class="ldp-day-panel" data-day-panel="saturday" hidden></div>
        <div class="ldp-day-panel" data-day-panel="sunday" hidden>
            <div class="ldp-schedule ldp-schedule--regular">
                <table><tbody>
                    <tr data-hour="9">
                        <th class="hour-cell">09</th>
                        <td><span class="minute-box" data-minute="55">55</span></td>
                    </tr>
                    <tr data-hour="10"><th class="hour-cell">10</th><td>
                        <span class="minute-box" data-minute="5">05</span>
                        <span class="minute-box" data-minute="20">20</span>
                        <span class="minute-box" data-minute="40">40</span>
                    </td></tr>
                </tbody></table>
            </div>
        </div>
    </article>
`;

describe('line detail timetable tabs', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 1, 22, 10, 15)); // Sunday, outside reduced schedule periods.
        document.body.innerHTML = `
            <main id="line-detail">
                <button class="ldp-direction-tab is-active" data-direction-target="a" aria-selected="true"></button>
                <button class="ldp-direction-tab" data-direction-target="b" aria-selected="false"></button>
                ${panelMarkup('a', true)}
                ${panelMarkup('b')}
            </main>
        `;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('maps the current date to the correct timetable day', () => {
        expect(getTimetableDay(new Date(2026, 1, 20))).toBe('weekday');
        expect(getTimetableDay(new Date(2026, 1, 21))).toBe('saturday');
        expect(getTimetableDay(new Date(2026, 1, 22))).toBe('sunday');
    });

    it('selects today and highlights departures in both directions', () => {
        initLineDetailTabs();

        const panels = document.querySelectorAll<HTMLElement>('.ldp-direction-panel');
        panels.forEach((panel) => {
            expect(panel.querySelector('.ldp-day-tab[data-day-target="sunday"]')?.classList.contains('is-active')).toBe(
                true,
            );
            expect(panel.querySelector('.ldp-day-panel[data-day-panel="sunday"]')?.classList.contains('is-active')).toBe(
                true,
            );
            expect(panel.querySelector('tr[data-hour="10"]')?.classList.contains('current-hour')).toBe(true);
            expect(panel.querySelector('.minute-box[data-minute="5"]')?.classList.contains('past')).toBe(true);
            expect(panel.querySelector('.minute-box[data-minute="20"]')?.classList.contains('next')).toBe(true);
            expect(panel.querySelector('.minute-box[data-minute="40"]')?.classList.contains('upcoming')).toBe(true);
        });

        document.querySelector<HTMLElement>('[data-direction-target="b"]')?.click();
        expect(document.querySelector('[data-direction-panel="b"]')?.classList.contains('is-active')).toBe(true);
        expect(
            document
                .querySelector('[data-direction-panel="b"] .minute-box[data-minute="20"]')
                ?.classList.contains('next'),
        ).toBe(true);

        vi.advanceTimersByTime(10 * 60 * 1000);
        expect(
            document
                .querySelector('[data-direction-panel="b"] .minute-box[data-minute="20"]')
                ?.classList.contains('past'),
        ).toBe(true);
        expect(
            document
                .querySelector('[data-direction-panel="b"] .minute-box[data-minute="40"]')
                ?.classList.contains('next'),
        ).toBe(true);
    });
});

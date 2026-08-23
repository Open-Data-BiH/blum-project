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
        <div class="ldp-day-panel is-active" data-day-panel="weekday">
            <div class="ldp-schedule ldp-schedule--regular">
                <table><tbody>
                    <tr data-hour="5">
                        <th class="hour-cell">05</th>
                        <td><span class="minute-box" data-minute="10">10</span></td>
                    </tr>
                    <tr data-hour="6">
                        <th class="hour-cell">06</th>
                        <td><span class="minute-box" data-minute="0">00</span></td>
                    </tr>
                </tbody></table>
            </div>
        </div>
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
            expect(
                panel.querySelector('.ldp-day-panel[data-day-panel="sunday"]')?.classList.contains('is-active'),
            ).toBe(true);
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

    it('moves from an exhausted Sunday schedule to the next weekday service', () => {
        vi.setSystemTime(new Date(2026, 7, 23, 22, 30)); // Sunday

        initLineDetailTabs();

        document.querySelectorAll<HTMLElement>('.ldp-direction-panel').forEach((panel) => {
            expect(
                panel.querySelector('.ldp-day-tab[data-day-target="weekday"]')?.classList.contains('is-active'),
            ).toBe(true);
            expect(
                panel.querySelector<HTMLElement>('.ldp-day-panel[data-day-panel="weekday"]')?.dataset.serviceDate,
            ).toBe('2026-08-24');
            expect(
                panel.querySelector('.ldp-day-panel[data-day-panel="sunday"]')?.classList.contains('is-active'),
            ).toBe(false);
            expect(
                panel
                    .querySelector('.ldp-day-panel[data-day-panel="weekday"] [data-minute="10"]')
                    ?.classList.contains('next'),
            ).toBe(true);
            expect(
                panel
                    .querySelector('.ldp-day-panel[data-day-panel="weekday"] [data-minute="0"]')
                    ?.classList.contains('upcoming'),
            ).toBe(true);
        });
    });

    it('moves to the next date when consecutive days share the weekday schedule', () => {
        vi.setSystemTime(new Date(2026, 1, 23, 22, 30)); // Monday

        initLineDetailTabs();

        const weekdayPanel = document.querySelector<HTMLElement>(
            '[data-direction-panel="a"] .ldp-day-panel[data-day-panel="weekday"]',
        );
        expect(weekdayPanel?.classList.contains('is-active')).toBe(true);
        expect(weekdayPanel?.dataset.serviceDate).toBe('2026-02-24');
        expect(weekdayPanel?.querySelector('.minute-box[data-minute="10"]')?.classList.contains('next')).toBe(true);
    });

    it('uses the reduced schedule for the selected future service date', () => {
        vi.setSystemTime(new Date(2026, 7, 30, 23, 1)); // Sunday
        document
            .getElementById('line-detail')
            ?.insertAdjacentHTML('afterbegin', '<div class="timetable-reduced-notice" hidden></div>');
        document.querySelectorAll<HTMLElement>('.ldp-day-panel[data-day-panel="weekday"]').forEach((dayPanel) => {
            dayPanel.insertAdjacentHTML(
                'beforeend',
                '<div class="ldp-schedule ldp-schedule--reduced" hidden><table><tbody><tr data-hour="7"><td class="hour-cell">07</td><td><span class="minute-box" data-minute="15">15</span></td></tr></tbody></table></div>',
            );
        });

        initLineDetailTabs();

        const panel = document.querySelector<HTMLElement>('[data-direction-panel="a"]');
        expect(panel?.querySelector<HTMLElement>('.ldp-day-panel[data-day-panel="weekday"]')?.dataset.serviceDate).toBe(
            '2026-08-31',
        );
        expect(panel?.querySelector<HTMLElement>('.ldp-schedule--regular')?.hidden).toBe(true);
        expect(panel?.querySelector<HTMLElement>('.ldp-schedule--reduced')?.hidden).toBe(false);
        expect(panel?.querySelector('.ldp-schedule--reduced [data-minute="15"]')?.classList.contains('next')).toBe(
            true,
        );
        expect(document.querySelector<HTMLElement>('.timetable-reduced-notice')?.hidden).toBe(false);
    });

    it('keeps a day selected manually', () => {
        vi.setSystemTime(new Date(2026, 7, 23, 22, 30)); // Sunday

        initLineDetailTabs();
        const panel = document.querySelector<HTMLElement>('[data-direction-panel="a"]');
        panel?.querySelector<HTMLElement>('.ldp-day-tab[data-day-target="sunday"]')?.click();
        vi.advanceTimersByTime(60_000);

        expect(panel?.querySelector('.ldp-day-tab[data-day-target="sunday"]')?.classList.contains('is-active')).toBe(
            true,
        );
        expect(panel?.querySelector('.ldp-day-panel[data-day-panel="sunday"] .minute-box.next')).toBeNull();
        expect(
            panel
                ?.querySelector('.ldp-day-panel[data-day-panel="sunday"] .minute-box[data-minute="55"]')
                ?.classList.contains('past'),
        ).toBe(true);
    });

    it('skips a day without service', () => {
        vi.setSystemTime(new Date(2026, 7, 21, 22, 30)); // Friday

        initLineDetailTabs();

        const panel = document.querySelector<HTMLElement>('[data-direction-panel="a"]');
        expect(panel?.querySelector('.ldp-day-tab[data-day-target="sunday"]')?.classList.contains('is-active')).toBe(
            true,
        );
        expect(panel?.querySelector<HTMLElement>('.ldp-day-panel[data-day-panel="sunday"]')?.dataset.serviceDate).toBe(
            '2026-08-23',
        );
    });

    it('reselects the next service day when the final departure passes', () => {
        vi.setSystemTime(new Date(2026, 1, 22, 10, 39)); // Sunday

        initLineDetailTabs();
        expect(
            document
                .querySelector('[data-direction-panel="a"] .ldp-day-tab[data-day-target="sunday"]')
                ?.classList.contains('is-active'),
        ).toBe(true);

        vi.advanceTimersByTime(2 * 60 * 1000);

        expect(
            document
                .querySelector('[data-direction-panel="a"] .ldp-day-tab[data-day-target="weekday"]')
                ?.classList.contains('is-active'),
        ).toBe(true);
        expect(
            document.querySelector<HTMLElement>('[data-direction-panel="a"] .ldp-day-panel[data-day-panel="weekday"]')
                ?.dataset.serviceDate,
        ).toBe('2026-02-23');
    });
});

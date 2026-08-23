import { isReducedScheduleDay } from './school-holidays';
import { getTimetableDay } from './timetable-day';

let timeHighlightInterval: ReturnType<typeof setInterval> | null = null;

const updateScheduleTimeHighlighting = (schedule: Element, now: Date): void => {
    const currentHour = now.getHours();
    const currentTimeInMinutes = currentHour * 60 + now.getMinutes();
    const departures: { timeInMinutes: number; element: HTMLElement }[] = [];

    schedule.querySelectorAll<HTMLElement>('tbody tr[data-hour]').forEach((row) => {
        const hour = Number.parseInt(row.dataset.hour ?? '', 10);
        if (Number.isNaN(hour)) {
            return;
        }

        row.classList.toggle('current-hour', hour === currentHour);
        row.querySelectorAll<HTMLElement>('.minute-box[data-minute]').forEach((minuteBox) => {
            const minute = Number.parseInt(minuteBox.dataset.minute ?? '', 10);
            if (!Number.isNaN(minute)) {
                departures.push({ timeInMinutes: hour * 60 + minute, element: minuteBox });
            }
        });
    });

    departures.sort((a, b) => a.timeInMinutes - b.timeInMinutes);
    const nextDeparture = departures.find((departure) => departure.timeInMinutes >= currentTimeInMinutes) ?? null;

    departures.forEach((departure) => {
        departure.element.classList.remove('past', 'next', 'upcoming');
        if (departure.timeInMinutes < currentTimeInMinutes) {
            departure.element.classList.add('past');
        } else if (departure === nextDeparture) {
            departure.element.classList.add('next');
        } else {
            departure.element.classList.add('upcoming');
        }
    });
};

const updateTimeHighlighting = (root: HTMLElement, now: Date = new Date()): void => {
    root.querySelectorAll<HTMLElement>('.ldp-day-panel.is-active').forEach((dayPanel) => {
        const schedule = Array.from(dayPanel.querySelectorAll<HTMLElement>('.ldp-schedule')).find(
            (candidate) => !candidate.hidden,
        );
        if (schedule) {
            updateScheduleTimeHighlighting(schedule, now);
        }
    });
};

export const initLineDetailTabs = (): void => {
    const root = document.getElementById('line-detail');
    if (!root || root.dataset.lineDetailTabsInitialized === 'true') {
        return;
    }
    root.dataset.lineDetailTabsInitialized = 'true';

    if (isReducedScheduleDay()) {
        root.querySelectorAll<HTMLElement>('.ldp-schedule--regular').forEach((el) => {
            el.hidden = true;
        });
        root.querySelectorAll<HTMLElement>('.ldp-schedule--reduced').forEach((el) => {
            el.hidden = false;
        });
        root.querySelectorAll<HTMLElement>('.timetable-reduced-notice').forEach((el) => {
            el.hidden = false;
        });
    }

    const activateDirection = (targetId: string): void => {
        root.querySelectorAll<HTMLElement>('.ldp-direction-tab[data-direction-target]').forEach((tab) => {
            const isActive = tab.getAttribute('data-direction-target') === targetId;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        root.querySelectorAll<HTMLElement>('.ldp-direction-panel[data-direction-panel]').forEach((panel) => {
            const isActive = panel.getAttribute('data-direction-panel') === targetId;
            panel.classList.toggle('is-active', isActive);
            panel.hidden = !isActive;
        });

        updateTimeHighlighting(root);
    };

    const activateDay = (panel: Element, dayKey: string): void => {
        panel.querySelectorAll<HTMLElement>('.ldp-day-tab[data-day-target]').forEach((tab) => {
            const isActive = tab.getAttribute('data-day-target') === dayKey;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panel.querySelectorAll<HTMLElement>('.ldp-day-panel[data-day-panel]').forEach((dayPanel) => {
            const isActive = dayPanel.getAttribute('data-day-panel') === dayKey;
            dayPanel.classList.toggle('is-active', isActive);
            dayPanel.hidden = !isActive;
        });

        updateTimeHighlighting(root);
    };

    root.querySelectorAll<HTMLElement>('.ldp-direction-tab[data-direction-target]').forEach((tab) => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-direction-target');
            if (targetId) {
                activateDirection(targetId);
            }
        });
    });

    const todayDayType = getTimetableDay();
    root.querySelectorAll<HTMLElement>('.ldp-direction-panel[data-direction-panel]').forEach((panel) => {
        // Use today's column even when the line has no service, matching the timetable on the lines page.
        activateDay(panel, todayDayType);

        panel.querySelectorAll<HTMLElement>('.ldp-day-tab[data-day-target]').forEach((tab) => {
            tab.addEventListener('click', () => {
                const targetDay = tab.getAttribute('data-day-target');
                if (targetDay) {
                    activateDay(panel, targetDay);
                }
            });
        });
    });

    if (timeHighlightInterval) {
        clearInterval(timeHighlightInterval);
    }
    updateTimeHighlighting(root);
    timeHighlightInterval = setInterval(() => updateTimeHighlighting(root), 60_000);
};

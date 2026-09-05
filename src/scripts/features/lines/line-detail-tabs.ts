import { isReducedScheduleDay } from './school-holidays';
import {
    findNextServiceDay,
    formatServiceDate,
    getUpcomingServiceDays,
    type TimetableDay,
    type TimetableServiceDay,
} from './timetable-day';

let timeHighlightInterval: ReturnType<typeof setInterval> | null = null;

const getDepartureMinutes = (schedule: Element): number[] => {
    const departures: number[] = [];

    schedule.querySelectorAll<HTMLElement>('tbody tr[data-hour]').forEach((row) => {
        const hour = Number.parseInt(row.dataset.hour ?? '', 10);
        if (Number.isNaN(hour)) {
            return;
        }

        row.querySelectorAll<HTMLElement>('.minute-box[data-minute]').forEach((minuteBox) => {
            const minute = Number.parseInt(minuteBox.dataset.minute ?? '', 10);
            if (!Number.isNaN(minute)) {
                departures.push(hour * 60 + minute);
            }
        });
    });

    return departures.sort((a, b) => a - b);
};

const getScheduleForDate = (dayPanel: Element, date: Date): HTMLElement | null => {
    const preferredClass = isReducedScheduleDay(date) ? '.ldp-schedule--reduced' : '.ldp-schedule--regular';
    return (
        dayPanel.querySelector<HTMLElement>(preferredClass) ??
        dayPanel.querySelector<HTMLElement>('.ldp-schedule--regular') ??
        dayPanel.querySelector<HTMLElement>('.ldp-schedule')
    );
};

const getDayPanel = (panel: Element, day: TimetableDay): HTMLElement | null =>
    panel.querySelector<HTMLElement>(`.ldp-day-panel[data-day-panel="${day}"]`);

const findPanelServiceDay = (panel: Element, now: Date): TimetableServiceDay | null => {
    const departureCache = new Map<Element, number[]>();

    return findNextServiceDay(now, (serviceDay, earliestMinute) => {
        const dayPanel = getDayPanel(panel, serviceDay.day);
        const schedule = dayPanel ? getScheduleForDate(dayPanel, serviceDay.date) : null;
        if (!schedule) {
            return false;
        }

        const departures = departureCache.get(schedule) ?? getDepartureMinutes(schedule);
        departureCache.set(schedule, departures);
        return departures.some((departure) => departure >= earliestMinute);
    });
};

const updateScheduleTimeHighlighting = (schedule: Element, now: Date, serviceDate: string): void => {
    const currentHour = now.getHours();
    const currentTimeInMinutes = currentHour * 60 + now.getMinutes();
    const today = formatServiceDate(now);
    const isToday = serviceDate === today;
    const isFuture = serviceDate > today;
    const departures: { timeInMinutes: number; element: HTMLElement }[] = [];

    schedule.querySelectorAll<HTMLElement>('tbody tr[data-hour]').forEach((row) => {
        const hour = Number.parseInt(row.dataset.hour ?? '', 10);
        if (Number.isNaN(hour)) {
            return;
        }

        const isCurrentHour = isToday && hour === currentHour;
        const isPastHour = !isFuture && (!isToday || hour < currentHour);
        row.classList.toggle('current-hour', isCurrentHour);
        row.classList.toggle('past-hour', isPastHour);
        row.querySelectorAll<HTMLElement>('.minute-box[data-minute]').forEach((minuteBox) => {
            const minute = Number.parseInt(minuteBox.dataset.minute ?? '', 10);
            if (!Number.isNaN(minute)) {
                departures.push({ timeInMinutes: hour * 60 + minute, element: minuteBox });
            }
        });
    });

    departures.sort((a, b) => a.timeInMinutes - b.timeInMinutes);
    const nextDepartureMinute = isFuture
        ? (departures[0]?.timeInMinutes ?? null)
        : isToday
          ? (departures.find((departure) => departure.timeInMinutes >= currentTimeInMinutes)?.timeInMinutes ?? null)
          : null;

    departures.forEach((departure) => {
        departure.element.classList.remove('past', 'next', 'upcoming');
        if (!isFuture && (!isToday || departure.timeInMinutes < currentTimeInMinutes)) {
            departure.element.classList.add('past');
        } else if (nextDepartureMinute !== null && departure.timeInMinutes === nextDepartureMinute) {
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
            updateScheduleTimeHighlighting(schedule, now, dayPanel.dataset.serviceDate ?? formatServiceDate(now));
        }
    });
};

const updateReducedNotice = (root: HTMLElement): void => {
    const activePanel = root.querySelector<HTMLElement>('.ldp-direction-panel.is-active');
    const activeDay = activePanel?.querySelector<HTMLElement>('.ldp-day-panel.is-active');
    const activeSchedule = activeDay
        ? Array.from(activeDay.querySelectorAll<HTMLElement>('.ldp-schedule')).find((schedule) => !schedule.hidden)
        : null;
    const showingReduced = activeSchedule?.classList.contains('ldp-schedule--reduced') ?? false;

    root.querySelectorAll<HTMLElement>('.timetable-reduced-notice').forEach((notice) => {
        notice.hidden = !showingReduced;
    });
};

export const initLineDetailTabs = (): void => {
    const root = document.getElementById('line-detail');
    if (!root || root.dataset.lineDetailTabsInitialized === 'true') {
        return;
    }
    root.dataset.lineDetailTabsInitialized = 'true';

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

        updateReducedNotice(root);
        updateTimeHighlighting(root);
    };

    const activateDay = (panel: HTMLElement, serviceDay: TimetableServiceDay, automatic: boolean): void => {
        panel.querySelectorAll<HTMLElement>('.ldp-day-tab[data-day-target]').forEach((tab) => {
            const isActive = tab.getAttribute('data-day-target') === serviceDay.day;
            tab.classList.toggle('is-active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        panel.querySelectorAll<HTMLElement>('.ldp-day-panel[data-day-panel]').forEach((dayPanel) => {
            const isActive = dayPanel.getAttribute('data-day-panel') === serviceDay.day;
            dayPanel.classList.toggle('is-active', isActive);
            dayPanel.hidden = !isActive;

            if (isActive) {
                dayPanel.dataset.serviceDate = formatServiceDate(serviceDay.date);
                const selectedSchedule = getScheduleForDate(dayPanel, serviceDay.date);
                dayPanel.querySelectorAll<HTMLElement>('.ldp-schedule').forEach((schedule) => {
                    schedule.hidden = schedule !== selectedSchedule;
                });
            }
        });

        panel.dataset.automaticDaySelection = automatic ? 'true' : 'false';
        updateReducedNotice(root);
        updateTimeHighlighting(root);
    };

    const selectNextServiceDay = (panel: HTMLElement, now: Date): void => {
        const serviceDay = findPanelServiceDay(panel, now) ?? getUpcomingServiceDays(now, 0)[0];
        if (serviceDay) {
            activateDay(panel, serviceDay, true);
        }
    };

    root.querySelectorAll<HTMLElement>('.ldp-direction-tab[data-direction-target]').forEach((tab) => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-direction-target');
            if (targetId) {
                activateDirection(targetId);
            }
        });
    });

    const now = new Date();
    root.querySelectorAll<HTMLElement>('.ldp-direction-panel[data-direction-panel]').forEach((panel) => {
        selectNextServiceDay(panel, now);

        panel.querySelectorAll<HTMLElement>('.ldp-day-tab[data-day-target]').forEach((tab) => {
            tab.addEventListener('click', () => {
                const targetDay = tab.getAttribute('data-day-target') as TimetableDay | null;
                const serviceDay = targetDay
                    ? getUpcomingServiceDays(new Date()).find((candidate) => candidate.day === targetDay)
                    : null;
                if (serviceDay) {
                    activateDay(panel, serviceDay, false);
                }
            });
        });
    });

    if (timeHighlightInterval) {
        clearInterval(timeHighlightInterval);
    }
    updateReducedNotice(root);
    updateTimeHighlighting(root, now);
    timeHighlightInterval = setInterval(() => {
        const currentTime = new Date();
        root.querySelectorAll<HTMLElement>('.ldp-direction-panel[data-direction-panel]').forEach((panel) => {
            if (panel.dataset.automaticDaySelection === 'true') {
                selectNextServiceDay(panel, currentTime);
            }
        });
        updateTimeHighlighting(root, currentTime);
    }, 60_000);
};

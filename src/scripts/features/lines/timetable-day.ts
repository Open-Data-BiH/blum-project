export type TimetableDay = 'weekday' | 'saturday' | 'sunday';

export interface TimetableServiceDay {
    date: Date;
    day: TimetableDay;
    dayOffset: number;
}

// Weekly schedules can be interrupted by long reduced-service periods.
const SERVICE_DAY_LOOKAHEAD = 370;

export const getTimetableDay = (date: Date = new Date()): TimetableDay => {
    const day = date.getDay();
    if (day === 0) {
        return 'sunday';
    }
    if (day === 6) {
        return 'saturday';
    }
    return 'weekday';
};

export const getUpcomingServiceDays = (now: Date, maxDayOffset = 7): TimetableServiceDay[] =>
    Array.from({ length: maxDayOffset + 1 }, (_, dayOffset) => {
        const date = new Date(now);
        date.setDate(date.getDate() + dayOffset);

        return { date, day: getTimetableDay(date), dayOffset };
    });

export const findNextServiceDay = (
    now: Date,
    hasDeparture: (serviceDay: TimetableServiceDay, earliestMinute: number) => boolean,
): TimetableServiceDay | null => {
    const currentMinute = now.getHours() * 60 + now.getMinutes();

    return (
        getUpcomingServiceDays(now, SERVICE_DAY_LOOKAHEAD).find((serviceDay) =>
            hasDeparture(serviceDay, serviceDay.dayOffset === 0 ? currentMinute : 0),
        ) ?? null
    );
};

export const formatServiceDate = (date: Date): string =>
    [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join(
        '-',
    );

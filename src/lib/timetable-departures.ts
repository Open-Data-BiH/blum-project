import type { TimetableTime } from '../types/timetable';

export interface TimetableDeparture {
    time: string;
    note: string | null;
}

export const parseTimeToMinutes = (value: string): number => {
    const [hourRaw = '', minuteRaw = ''] = value.split(':');
    const hour = Number.parseInt(hourRaw, 10);
    const minute = Number.parseInt(minuteRaw, 10);

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return Number.POSITIVE_INFINITY;
    }

    return hour * 60 + minute;
};

export const compareDepartureNotes = (a: string | null, b: string | null): number => {
    if (a === b) {
        return 0;
    }
    if (!a) {
        return -1;
    }
    if (!b) {
        return 1;
    }
    return a.localeCompare(b);
};

export const parseTimetableDeparture = (value: TimetableTime): TimetableDeparture =>
    typeof value === 'string' ? { time: value, note: null } : { time: value.time, note: value.note };

export const sortDeparturesAscending = (departures: TimetableDeparture[]): TimetableDeparture[] =>
    [...departures].sort((a, b) => {
        const timeDiff = parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time);
        if (timeDiff !== 0) {
            return timeDiff;
        }

        return compareDepartureNotes(a.note, b.note);
    });

export const getUniqueSortedDeparturesFromParsed = (departures: TimetableDeparture[]): TimetableDeparture[] => {
    const groupedByTime = new Map<string, Map<string, TimetableDeparture>>();

    for (const departure of departures) {
        const timeGroup = groupedByTime.get(departure.time) ?? new Map<string, TimetableDeparture>();
        const noteKey = departure.note ?? '';

        if (departure.note) {
            // If any annotated departure exists for a given minute, it replaces the plain duplicate.
            timeGroup.delete('');
            if (!timeGroup.has(noteKey)) {
                timeGroup.set(noteKey, departure);
            }
        } else if (timeGroup.size === 0) {
            timeGroup.set(noteKey, departure);
        }

        groupedByTime.set(departure.time, timeGroup);
    }

    return sortDeparturesAscending(
        Array.from(groupedByTime.values()).flatMap((timeGroup) => Array.from(timeGroup.values())),
    );
};

export const getUniqueSortedDepartures = (times: TimetableTime[]): TimetableDeparture[] =>
    getUniqueSortedDeparturesFromParsed(times.map(parseTimetableDeparture));

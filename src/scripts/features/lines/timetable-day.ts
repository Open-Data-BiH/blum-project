export type TimetableDay = 'weekday' | 'saturday' | 'sunday';

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

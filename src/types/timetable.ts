// Type definitions for timetable data

import type { BilingualString } from './lines';

export type DayType = 'weekday' | 'saturday' | 'sunday';

/** A departure time — either a plain "HH:MM" string or an annotated object */
export type TimetableTime = string | { time: string; note: string };

/** Per-station departure times: times[dayType][directionIndex] = TimetableTime[] */
export interface StationTimes {
    weekday: TimetableTime[][];
    saturday: TimetableTime[][];
    sunday: TimetableTime[][];
    /** Reduced schedules — active during school holidays */
    weekdayReduced?: TimetableTime[][];
    saturdayReduced?: TimetableTime[][];
    sundayReduced?: TimetableTime[][];
}

export interface Station {
    id?: string;
    name: string | BilingualString;
    times: StationTimes;
}

export interface NoteDescription {
    bhs: string;
    en: string;
}

export interface TimetableEntry {
    lineId: string;
    lineName: BilingualString;
    directions: { bhs: string[]; en: string[] };
    stations: Station[];
    notes?: BilingualString;
    /** Descriptions for annotated departure notes, keyed by note letter (Latin) */
    noteDescriptions?: Record<string, NoteDescription>;
    /** Injected at runtime by setupTimetableSelection */
    lineType?: string;
}

export interface TimetableFile {
    urban: TimetableEntry[];
}

// Type definitions for timetable data

import type { BilingualString } from './lines';

export type DayType = 'weekday' | 'saturday' | 'sunday';

/** Per-station departure times: times[dayType][directionIndex] = string[] */
export interface StationTimes {
  weekday: [string[], string[]];
  saturday: [string[], string[]];
  sunday: [string[], string[]];
}

export interface Station {
  name: string;
  times: StationTimes;
}

export interface TimetableEntry {
  lineId: string;
  lineName: BilingualString;
  directions: BilingualString & { bhs: string[]; en: string[] };
  stations: Station[];
  notes?: BilingualString;
  /** Injected at runtime by setupTimetableSelection */
  lineType?: string;
}

export interface TimetableFile {
  urban: TimetableEntry[];
}

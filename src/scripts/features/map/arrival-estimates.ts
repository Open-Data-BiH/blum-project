import { getUniqueSortedDepartures } from '../../../lib/timetable-departures';
import { compareLineIds, getRoutesForStop, getStopIds, type TransitIndex } from '../../../lib/transit';
import type { DayType, TimetableEntry, TimetableTime } from '../../../types/timetable';
import type { TransitRoute, TransitStop } from '../../../types/transit';
import { normalizeForSearch } from '../../core/utils';
import { isReducedScheduleDay } from '../lines/school-holidays';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MAX_ARRIVALS = 2;
const EARTH_RADIUS_METRES = 6_371_000;

export type ArrivalEstimateStatus = 'estimated' | 'no-more-today' | 'unavailable';

export interface EstimatedArrivalTime {
    at: Date;
    /** Published clock time at the route origin. */
    departureTime: string;
    /** Rounded because the stop timing source is an estimate, not live telemetry. */
    travelMinutes: number;
    /** Calendar-day difference from `now`, used for the compact "tomorrow" label. */
    dayOffset: number;
    /** Distinguishes tomorrow's service from a current trip that merely crosses midnight. */
    serviceDayOffset: number;
}

export interface StopArrivalEstimate {
    lineId: string;
    route: TransitRoute | null;
    timetable: TimetableEntry | null;
    directionIndex: number | null;
    arrivals: EstimatedArrivalTime[];
    status: ArrivalEstimateStatus;
}

const splitDirectionLabel = (label: string): [string, string] | null => {
    const arrowParts = label.split(/\s*(?:→|->)\s*/).filter(Boolean);
    if (arrowParts.length >= 2) {
        return [arrowParts[0], arrowParts[arrowParts.length - 1]];
    }

    const dashParts = label.split(/\s+-\s+/).filter(Boolean);
    return dashParts.length >= 2 ? [dashParts[0], dashParts[dashParts.length - 1]] : null;
};

const endpointSimilarity = (left: string, right: string): number => {
    const a = normalizeForSearch(left);
    const b = normalizeForSearch(right);
    if (!a || !b) {
        return 0;
    }
    if (a === b) {
        return 1;
    }
    if (a.includes(b) || b.includes(a)) {
        return 0.9;
    }

    const aTokens = new Set(a.split(' '));
    const bTokens = new Set(b.split(' '));
    const common = [...aTokens].filter((token) => bTokens.has(token)).length;
    return common / Math.max(aTokens.size, bTokens.size);
};

/**
 * Timetable direction arrays are not consistently ordered like network route arrays, so
 * endpoint names are the primary join. The route's a/b metadata resolves circular lines
 * (notably line 14), whose two network variants have identical endpoints.
 */
export const resolveTimetableDirection = (timetable: TimetableEntry, route: TransitRoute): number | null => {
    const labels = timetable.directions.bhs.length > 0 ? timetable.directions.bhs : timetable.directions.en;
    const scored = labels.map((label, index) => {
        const endpoints = splitDirectionLabel(label);
        return {
            index,
            score: endpoints
                ? endpointSimilarity(route.origin, endpoints[0]) + endpointSimilarity(route.destination, endpoints[1])
                : 0,
        };
    });
    const ranked = [...scored].sort((a, b) => b.score - a.score);

    if (ranked[0] && ranked[0].score >= 1 && (!ranked[1] || ranked[0].score - ranked[1].score > 0.05)) {
        return ranked[0].index;
    }

    const fallback = route.direction === 'a' ? 0 : route.direction === 'b' ? 1 : null;
    return fallback !== null && fallback < labels.length ? fallback : null;
};

export const getDirectionDestination = (
    timetable: TimetableEntry | null,
    directionIndex: number | null,
    language: 'bhs' | 'en',
    fallback: string | null,
): string | null => {
    if (timetable && directionIndex !== null) {
        const label = timetable.directions[language][directionIndex] ?? timetable.directions.bhs[directionIndex] ?? '';
        const endpoints = splitDirectionLabel(label);
        if (endpoints?.[1]) {
            return endpoints[1].trim();
        }
    }
    return fallback;
};

const resolveBoundaryIndex = (
    index: TransitIndex,
    route: TransitRoute,
    role: 'start' | 'end',
    endpoint: string,
): number | null => {
    const candidates = route.stops
        .map((routeStop, position) => ({ routeStop, position }))
        .filter(({ routeStop }) => routeStop.role === role);
    if (candidates.length === 0) {
        return role === 'start' ? 0 : route.stops.length - 1;
    }
    if (candidates.length === 1) {
        return candidates[0].position;
    }

    const ranked = candidates
        .map((candidate) => ({
            ...candidate,
            score: endpointSimilarity(index.stopById.get(candidate.routeStop.stopId)?.name ?? '', endpoint),
        }))
        .sort((a, b) => b.score - a.score);

    if (ranked[0] && ranked[0].score >= 0.5 && (!ranked[1] || ranked[0].score - ranked[1].score > 0.05)) {
        return ranked[0].position;
    }

    // Composite routes can include an untimed extension before the ordinary service.
    // When names cannot settle it, a single zero-time start is the explicit timing anchor
    // (for example the generic Petrićevac endpoint on line 13P).
    if (role === 'start') {
        const zeroTimeStarts = candidates.filter(({ routeStop }) => routeStop.time === 0);
        if (zeroTimeStarts.length === 1) {
            return zeroTimeStarts[0].position;
        }
    }

    return null;
};

const distanceBetweenRouteStops = (
    index: TransitIndex,
    route: TransitRoute,
    leftPosition: number,
    rightPosition: number,
): number | null => {
    const left = index.stopById.get(route.stops[leftPosition].stopId);
    const right = index.stopById.get(route.stops[rightPosition].stopId);
    if (!left || !right) {
        return null;
    }

    const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
    const latDelta = toRadians(right.lat - left.lat);
    const lonDelta = toRadians(right.lon - left.lon);
    const leftLat = toRadians(left.lat);
    const rightLat = toRadians(right.lat);
    const haversine =
        Math.sin(latDelta / 2) ** 2 + Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(lonDelta / 2) ** 2;

    return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(haversine));
};

/**
 * Manual route corrections can insert a stop between two consecutive operator records.
 * The following source stop still carries the complete segment time, so split that time
 * by the distances between stop coordinates. This keeps the operator's total segment time
 * unchanged while providing a conservative offset for the inserted stop.
 */
const resolveInsertedSegment = (
    index: TransitIndex,
    route: TransitRoute,
    firstInsertedPosition: number,
    end: number,
): { nextSourcePosition: number; segmentSeconds: number[] } | null => {
    const previousSourcePosition = firstInsertedPosition - 1;
    const previousSource = route.stops[previousSourcePosition];
    if (!previousSource || previousSource.seq === null) {
        return null;
    }

    let nextSourcePosition = firstInsertedPosition;
    while (nextSourcePosition <= end && route.stops[nextSourcePosition].seq === null) {
        const inserted = route.stops[nextSourcePosition];
        if (inserted.time !== null || inserted.distance !== null) {
            return null;
        }
        nextSourcePosition += 1;
    }

    const nextSource = route.stops[nextSourcePosition];
    if (
        !nextSource ||
        nextSource.seq !== previousSource.seq + 1 ||
        nextSource.time === null ||
        !Number.isFinite(nextSource.time) ||
        nextSource.time < 0
    ) {
        return null;
    }
    const sourceSegmentSeconds = nextSource.time;

    const distances: number[] = [];
    for (let position = previousSourcePosition + 1; position <= nextSourcePosition; position += 1) {
        const distance = distanceBetweenRouteStops(index, route, position - 1, position);
        if (distance === null || !Number.isFinite(distance)) {
            return null;
        }
        distances.push(distance);
    }

    const totalDistance = distances.reduce((total, distance) => total + distance, 0);
    if (totalDistance <= 0) {
        return null;
    }

    return {
        nextSourcePosition,
        segmentSeconds: distances.map((distance) => (sourceSegmentSeconds * distance) / totalDistance),
    };
};

/**
 * Cumulative timing inside the nominal origin→destination slice. Several source routes
 * include extensions before or after that slice; those belong to annotated departures.
 */
export const getTravelMinutesToStop = (index: TransitIndex, route: TransitRoute, stop: TransitStop): number | null => {
    const stopIds = new Set(getStopIds(stop));
    const start = resolveBoundaryIndex(index, route, 'start', route.origin);
    if (start === null) {
        return null;
    }

    const target = route.stops.findIndex((routeStop, position) => position >= start && stopIds.has(routeStop.stopId));
    if (target < start) {
        return null;
    }

    let end = resolveBoundaryIndex(index, route, 'end', route.destination);
    if (end === null) {
        const possibleEnds = route.stops
            .map((routeStop, position) => ({ routeStop, position }))
            .filter(({ routeStop }) => routeStop.role === 'end')
            .map(({ position }) => position);

        // If the selected stop precedes every plausible end marker, ambiguity after the
        // stop cannot affect its cumulative arrival offset.
        if (possibleEnds.length > 0 && possibleEnds.every((position) => position >= target)) {
            end = Math.min(...possibleEnds);
        }
    }
    if (end === null || start > end || target > end) {
        return null;
    }

    let seconds = 0;

    for (let position = start; position <= end; position += 1) {
        const routeStop = route.stops[position];
        if (position > start) {
            const previous = route.stops[position - 1];
            const hasContiguousSourceSequence =
                previous.seq !== null && routeStop.seq !== null && routeStop.seq === previous.seq + 1;

            if (!hasContiguousSourceSequence) {
                if (routeStop.seq !== null) {
                    return null;
                }

                const insertedSegment = resolveInsertedSegment(index, route, position, end);
                if (!insertedSegment) {
                    return null;
                }

                for (
                    let segmentPosition = position;
                    segmentPosition <= insertedSegment.nextSourcePosition;
                    segmentPosition += 1
                ) {
                    seconds += insertedSegment.segmentSeconds[segmentPosition - position];
                    if (segmentPosition === target) {
                        return Math.round(seconds / 60);
                    }
                }

                position = insertedSegment.nextSourcePosition;
                continue;
            }

            if (routeStop.time === null || !Number.isFinite(routeStop.time) || routeStop.time < 0) {
                return null;
            }
            seconds += routeStop.time;
        }

        if (position === target) {
            return Math.round(seconds / 60);
        }
    }

    return null;
};

const getDayType = (date: Date): DayType => {
    const day = date.getDay();
    return day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday';
};

const lineHasReducedSchedule = (timetable: TimetableEntry): boolean =>
    timetable.stations.some(
        ({ times }) =>
            times.weekdayReduced !== undefined ||
            times.saturdayReduced !== undefined ||
            times.sundayReduced !== undefined,
    );

const getDepartureValues = (timetable: TimetableEntry, date: Date, directionIndex: number): TimetableTime[] => {
    const dayType = getDayType(date);
    const reducedKey = `${dayType}Reduced` as 'weekdayReduced' | 'saturdayReduced' | 'sundayReduced';
    const useReduced = isReducedScheduleDay(date) && lineHasReducedSchedule(timetable);

    return timetable.stations.flatMap((station) => {
        const regular = station.times[dayType] ?? [];
        const selected = useReduced ? (station.times[reducedKey] ?? regular) : regular;
        return selected[directionIndex] ?? [];
    });
};

/**
 * Notes describe short turns, extensions, or alternate origins. There is no machine-readable
 * mapping from those service patterns to network stops. Keep them as uncertainty boundaries:
 * a reliable trip before the next boundary is safe to show, but a later plain departure must
 * not be promoted while an annotated bus may serve the selected stop first.
 */
const getServiceDepartures = (timetable: TimetableEntry, date: Date, directionIndex: number) => {
    const departures = getUniqueSortedDepartures(getDepartureValues(timetable, date, directionIndex));
    return {
        departures: departures.filter(({ note }) => note === null).map(({ time }) => time),
        unmappedDepartures: departures.filter(({ note }) => note !== null).map(({ time }) => time),
    };
};

const parseClock = (value: string): [number, number] | null => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) {
        return null;
    }
    const hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2], 10);
    return hour <= 23 && minute <= 59 ? [hour, minute] : null;
};

const startOfDay = (date: Date): Date => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
};

const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const calendarDayOffset = (from: Date, to: Date): number => {
    const fromDay = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const toDay = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((toDay - fromDay) / DAY_MS);
};

const estimatesForDepartureTimes = (
    departureTimes: string[],
    serviceDate: Date,
    travelMinutes: number,
    now: Date,
): EstimatedArrivalTime[] =>
    departureTimes.flatMap((departureTime) => {
        const clock = parseClock(departureTime);
        if (!clock) {
            return [];
        }

        const departure = startOfDay(serviceDate);
        departure.setHours(clock[0], clock[1], 0, 0);
        const at = new Date(departure.getTime() + travelMinutes * MINUTE_MS);
        if (at.getTime() < now.getTime()) {
            return [];
        }

        return [
            {
                at,
                departureTime,
                travelMinutes,
                dayOffset: calendarDayOffset(now, at),
                serviceDayOffset: calendarDayOffset(now, departure),
            },
        ];
    });

const estimatesForServiceDate = (
    timetable: TimetableEntry,
    directionIndex: number,
    serviceDate: Date,
    travelMinutes: number,
    now: Date,
): EstimatedArrivalTime[] =>
    estimatesForDepartureTimes(
        getServiceDepartures(timetable, serviceDate, directionIndex).departures,
        serviceDate,
        travelMinutes,
        now,
    );

interface UnmappedDepartureBoundary {
    at: Date;
}

const getMaximumRouteMinutes = (route: TransitRoute): number =>
    Math.ceil(
        route.stops.reduce(
            (seconds, stop) =>
                stop.time !== null && Number.isFinite(stop.time) && stop.time > 0 ? seconds + stop.time : seconds,
            0,
        ) / 60,
    );

const unmappedBoundariesForServiceDate = (
    timetable: TimetableEntry,
    directionIndex: number,
    serviceDate: Date,
    maximumRouteMinutes: number,
    now: Date,
): UnmappedDepartureBoundary[] =>
    getServiceDepartures(timetable, serviceDate, directionIndex).unmappedDepartures.flatMap((departureTime) => {
        const clock = parseClock(departureTime);
        if (!clock) {
            return [];
        }

        const departure = startOfDay(serviceDate);
        departure.setHours(clock[0], clock[1], 0, 0);
        const mayStillBeRunningUntil = departure.getTime() + maximumRouteMinutes * MINUTE_MS;
        if (mayStillBeRunningUntil < now.getTime()) {
            return [];
        }

        // A special trip can start farther along the route, so its earliest possible arrival
        // is its published clock time. A trip already underway remains a boundary until the
        // maximum complete route duration has elapsed.
        return [{ at: departure.getTime() < now.getTime() ? new Date(now) : departure }];
    });

const beforeFirstUnmappedDeparture = (
    reliable: EstimatedArrivalTime[],
    unmapped: UnmappedDepartureBoundary[],
): EstimatedArrivalTime[] => {
    const firstUnmappedTime = unmapped[0]?.at.getTime() ?? Number.POSITIVE_INFINITY;
    return reliable.filter(({ at }) => at.getTime() < firstUnmappedTime);
};

const hasAnyReliableDeparture = (timetable: TimetableEntry, directionIndex: number): boolean => {
    const scheduleKeys = [
        'weekday',
        'saturday',
        'sunday',
        'weekdayReduced',
        'saturdayReduced',
        'sundayReduced',
    ] as const;

    return scheduleKeys.some((key) => {
        const values = timetable.stations.flatMap((station) => station.times[key]?.[directionIndex] ?? []);
        return getUniqueSortedDepartures(values).some(({ note }) => note === null);
    });
};

const estimateRoute = (
    index: TransitIndex,
    route: TransitRoute,
    stop: TransitStop,
    timetable: TimetableEntry | null,
    now: Date,
): StopArrivalEstimate => {
    const directionIndex = timetable ? resolveTimetableDirection(timetable, route) : null;
    const travelMinutes = getTravelMinutesToStop(index, route, stop);
    if (!timetable || directionIndex === null || travelMinutes === null) {
        return {
            lineId: route.lineId,
            route,
            timetable,
            directionIndex,
            arrivals: [],
            status: 'unavailable',
        };
    }

    const today = startOfDay(now);
    const maximumRouteMinutes = Math.max(travelMinutes, getMaximumRouteMinutes(route));
    const currentServiceDates = [-1, 0].map((offset) => addDays(today, offset));
    const remainingCurrentService = currentServiceDates
        .flatMap((date) => estimatesForServiceDate(timetable, directionIndex, date, travelMinutes, now))
        .sort((a, b) => a.at.getTime() - b.at.getTime());
    const unmappedCurrentService = currentServiceDates
        .flatMap((date) => unmappedBoundariesForServiceDate(timetable, directionIndex, date, maximumRouteMinutes, now))
        .sort((a, b) => a.at.getTime() - b.at.getTime());
    const reliableCurrentService = beforeFirstUnmappedDeparture(remainingCurrentService, unmappedCurrentService);

    if (reliableCurrentService.length > 0) {
        return {
            lineId: route.lineId,
            route,
            timetable,
            directionIndex,
            arrivals: reliableCurrentService.slice(0, MAX_ARRIVALS),
            status: 'estimated',
        };
    }

    if (unmappedCurrentService.length > 0) {
        return {
            lineId: route.lineId,
            route,
            timetable,
            directionIndex,
            arrivals: [],
            status: 'unavailable',
        };
    }

    // Once today's useful arrivals are exhausted, show only the first one tomorrow.
    const tomorrow = addDays(today, 1);
    const nextDay = estimatesForServiceDate(timetable, directionIndex, tomorrow, travelMinutes, now).sort(
        (a, b) => a.at.getTime() - b.at.getTime(),
    );
    const unmappedNextDay = unmappedBoundariesForServiceDate(
        timetable,
        directionIndex,
        tomorrow,
        maximumRouteMinutes,
        now,
    ).sort((a, b) => a.at.getTime() - b.at.getTime());
    const reliableNextDay = beforeFirstUnmappedDeparture(nextDay, unmappedNextDay);
    if (reliableNextDay[0]) {
        return {
            lineId: route.lineId,
            route,
            timetable,
            directionIndex,
            arrivals: [reliableNextDay[0]],
            status: 'estimated',
        };
    }

    if (unmappedNextDay.length > 0) {
        return {
            lineId: route.lineId,
            route,
            timetable,
            directionIndex,
            arrivals: [],
            status: 'unavailable',
        };
    }

    return {
        lineId: route.lineId,
        route,
        timetable,
        directionIndex,
        arrivals: [],
        status: hasAnyReliableDeparture(timetable, directionIndex) ? 'no-more-today' : 'unavailable',
    };
};

/** One row per serving direction; claimed lines without route data still get an honest row. */
export const getStopArrivalEstimates = (
    index: TransitIndex,
    timetables: TimetableEntry[],
    stop: TransitStop,
    now: Date = new Date(),
): StopArrivalEstimate[] => {
    const timetableByLine = new Map(timetables.map((entry) => [entry.lineId.toUpperCase(), entry]));
    const estimates = [...stop.lines].sort(compareLineIds).flatMap((lineId) => {
        const timetable = timetableByLine.get(lineId.toUpperCase()) ?? null;
        const routes = getRoutesForStop(index, lineId, stop.id);
        if (routes.length === 0) {
            return [
                {
                    lineId,
                    route: null,
                    timetable,
                    directionIndex: null,
                    arrivals: [],
                    status: 'unavailable' as const,
                },
            ];
        }
        return routes.map((route) => estimateRoute(index, route, stop, timetable, now));
    });

    return estimates.sort((a, b) => {
        const aTime = a.arrivals[0]?.at.getTime() ?? Number.POSITIVE_INFINITY;
        const bTime = b.arrivals[0]?.at.getTime() ?? Number.POSITIVE_INFINITY;
        if (aTime !== bTime) {
            return aTime - bTime;
        }
        const lineOrder = compareLineIds(a.lineId, b.lineId);
        return lineOrder !== 0 ? lineOrder : (a.route?.destination ?? '').localeCompare(b.route?.destination ?? '');
    });
};

export const formatEstimatedClock = (date: Date): string =>
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

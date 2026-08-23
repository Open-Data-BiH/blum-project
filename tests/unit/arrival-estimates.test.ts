import { describe, expect, it } from 'vitest';
import productionNetwork from '../../public/data/transport/routes/transit_network.json';
import productionTimetables from '../../public/data/transport/timetables/urban_timetables.json';
import { createTransitIndex } from '../../src/lib/transit';
import {
    formatEstimatedClock,
    getStopArrivalEstimates,
    getTravelMinutesToStop,
    resolveTimetableDirection,
} from '../../src/scripts/features/map/arrival-estimates';
import type { StationTimes, TimetableEntry, TimetableFile, TimetableTime } from '../../src/types/timetable';
import type { TransitNetwork, TransitRoute, TransitStop } from '../../src/types/transit';

const schedule = (outbound: TimetableTime[], inbound: TimetableTime[]): StationTimes => ({
    weekday: [outbound, inbound],
    saturday: [outbound, inbound],
    sunday: [outbound, inbound],
});

const makeTimetable = (
    outbound: TimetableTime[],
    inbound: TimetableTime[],
    times: StationTimes = schedule(outbound, inbound),
): TimetableEntry => ({
    lineId: '1',
    lineName: { bhs: 'Linija 1', en: 'Line 1' },
    directions: { bhs: ['Alpha → Omega', 'Omega → Alpha'], en: ['Alpha → Omega', 'Omega → Alpha'] },
    stations: [{ name: 'Alpha', times }],
});

const displayedStop: TransitStop = {
    id: 'st-mid',
    mergedIds: ['st-mid-b'],
    name: 'Shared stop',
    street: null,
    lat: 44.78,
    lon: 17.19,
    source: 'registry',
    lines: ['1'],
};

const outboundRoute: TransitRoute = {
    id: '1-alpha-omega',
    lineId: '1',
    relation: 'Alpha - Omega',
    origin: 'Alpha',
    via: [],
    destination: 'Omega',
    direction: 'a',
    timing: 'a',
    hasShape: true,
    stops: [
        { stopId: 'st-alpha', seq: 1, role: 'start', time: 0, distance: 0 },
        { stopId: 'st-mid', seq: 2, role: null, time: 720, distance: 1_000 },
        { stopId: 'st-omega', seq: 3, role: 'end', time: 300, distance: 500 },
    ],
};

const inboundRoute: TransitRoute = {
    id: '1-omega-alpha',
    lineId: '1',
    relation: 'Omega - Alpha',
    origin: 'Omega',
    via: [],
    destination: 'Alpha',
    direction: 'b',
    timing: 'b',
    hasShape: true,
    stops: [
        { stopId: 'st-omega', seq: 1, role: 'start', time: 0, distance: 0 },
        { stopId: 'st-mid-b', seq: 2, role: null, time: 600, distance: 900 },
        { stopId: 'st-alpha', seq: 3, role: 'end', time: 300, distance: 500 },
    ],
};

const makeIndex = (routes: TransitRoute[] = [outboundRoute, inboundRoute]) => {
    const stops: TransitStop[] = [
        {
            id: 'st-alpha',
            name: 'Alpha',
            street: null,
            lat: 0,
            lon: 0,
            source: 'registry',
            lines: ['1'],
        },
        displayedStop,
        {
            id: 'st-omega',
            name: 'Omega',
            street: null,
            lat: 1,
            lon: 1,
            source: 'registry',
            lines: ['1'],
        },
        {
            id: 'st-extension',
            name: 'Extension',
            street: null,
            lat: 2,
            lon: 2,
            source: 'registry',
            lines: ['1'],
        },
    ];
    return createTransitIndex({
        meta: {
            generator: 'test',
            generated: 'test',
            extracted: null,
            mergeRadiusMeters: 0,
            nameMergeRadiusMeters: 0,
            counts: {
                lines: 1,
                linesWithRoutes: 1,
                routes: routes.length,
                routesWithShape: routes.length,
                stops: stops.length,
                registryStops: stops.length,
                derivedStops: 0,
            },
            warnings: [],
        },
        lines: [{ id: '1', color: '#123456', routes: routes.map((route) => route.id) }],
        routes,
        stops,
    });
};

describe('stop arrival estimates', () => {
    it('returns an explicit unavailable state when schedule data is missing', () => {
        const estimates = getStopArrivalEstimates(makeIndex(), [], displayedStop, new Date(2026, 1, 2, 10, 0));

        expect(estimates).toHaveLength(2);
        expect(estimates.every(({ status, arrivals }) => status === 'unavailable' && arrivals.length === 0)).toBe(true);
    });

    it('keeps a past origin departure when its estimated stop arrival is still ahead', () => {
        const estimates = getStopArrivalEstimates(
            makeIndex(),
            [makeTimetable(['09:50', '10:10'], ['09:55', '10:15'])],
            displayedStop,
            new Date(2026, 1, 2, 10, 0),
        );

        expect(estimates.map((estimate) => estimate.route?.id)).toEqual(['1-alpha-omega', '1-omega-alpha']);
        expect(estimates[0].arrivals.map(({ at }) => formatEstimatedClock(at))).toEqual(['10:02', '10:22']);
        expect(estimates[1].arrivals.map(({ at }) => formatEstimatedClock(at))).toEqual(['10:05', '10:25']);
    });

    it('anchors timing at the nominal start and ignores composite extensions', () => {
        const composite: TransitRoute = {
            ...outboundRoute,
            stops: [
                { stopId: 'st-extension', seq: 1, role: 'start', time: 0, distance: 0 },
                { stopId: 'st-alpha', seq: 2, role: 'start', time: 600, distance: 1_000 },
                { stopId: 'st-mid', seq: 3, role: null, time: 300, distance: 500 },
                { stopId: 'st-omega', seq: 4, role: 'end', time: null, distance: null },
            ],
        };
        const index = makeIndex([composite]);

        expect(getTravelMinutesToStop(index, composite, displayedStop)).toBe(5);
        expect(getTravelMinutesToStop(index, composite, index.stopById.get('st-extension')!)).toBeNull();
    });

    it('rejects a missing timing or source-sequence gap before the stop, but not after it', () => {
        const missingBefore: TransitRoute = {
            ...outboundRoute,
            stops: outboundRoute.stops.map((stop, position) =>
                position === 1 ? { ...stop, time: null } : { ...stop },
            ),
        };
        const gapBefore: TransitRoute = {
            ...outboundRoute,
            stops: outboundRoute.stops.map((stop, position) => (position === 1 ? { ...stop, seq: 3 } : { ...stop })),
        };
        const missingAfter: TransitRoute = {
            ...outboundRoute,
            stops: outboundRoute.stops.map((stop, position) =>
                position === 2 ? { ...stop, time: null } : { ...stop },
            ),
        };

        expect(getTravelMinutesToStop(makeIndex([missingBefore]), missingBefore, displayedStop)).toBeNull();
        expect(getTravelMinutesToStop(makeIndex([gapBefore]), gapBefore, displayedStop)).toBeNull();
        expect(getTravelMinutesToStop(makeIndex([missingAfter]), missingAfter, displayedStop)).toBe(12);
    });

    it('formats a current service that crosses midnight and labels its calendar-day offset', () => {
        const route = { ...outboundRoute, stops: outboundRoute.stops.map((stop) => ({ ...stop })) };
        route.stops[1].time = 1_020;
        const [estimate] = getStopArrivalEstimates(
            makeIndex([route]),
            [makeTimetable(['23:50'], [])],
            displayedStop,
            new Date(2026, 1, 2, 23, 55),
        );

        expect(formatEstimatedClock(estimate.arrivals[0].at)).toBe('00:07');
        expect(estimate.arrivals[0].dayOffset).toBe(1);
        expect(estimate.arrivals[0].serviceDayOffset).toBe(0);
    });

    it('keeps a previous-day trip that is still approaching just after midnight', () => {
        const [estimate] = getStopArrivalEstimates(
            makeIndex([outboundRoute]),
            [makeTimetable(['23:58'], [])],
            displayedStop,
            new Date(2026, 1, 3, 0, 5),
        );

        expect(formatEstimatedClock(estimate.arrivals[0].at)).toBe('00:10');
        expect(estimate.arrivals[0].dayOffset).toBe(0);
        expect(estimate.arrivals[0].serviceDayOffset).toBe(-1);
    });

    it('shows only the first service tomorrow once today is exhausted', () => {
        const [estimate] = getStopArrivalEstimates(
            makeIndex([outboundRoute]),
            [makeTimetable(['05:00', '05:30'], [])],
            displayedStop,
            new Date(2026, 1, 2, 23, 30),
        );

        expect(estimate.arrivals).toHaveLength(1);
        expect(formatEstimatedClock(estimate.arrivals[0].at)).toBe('05:12');
        expect(estimate.arrivals[0].dayOffset).toBe(1);
    });

    it('reports no more departures when today is exhausted and tomorrow has no service', () => {
        const times: StationTimes = {
            weekday: [['05:00'], []],
            saturday: [[], []],
            sunday: [[], []],
        };
        const [estimate] = getStopArrivalEstimates(
            makeIndex([outboundRoute]),
            [makeTimetable([], [], times)],
            displayedStop,
            new Date(2026, 1, 6, 23, 30),
        );

        expect(estimate.status).toBe('no-more-today');
        expect(estimate.arrivals).toEqual([]);
    });

    it('uses a reduced schedule on school-holiday dates', () => {
        const times: StationTimes = {
            ...schedule(['10:00'], []),
            weekdayReduced: [['12:00'], []],
        };
        const [estimate] = getStopArrivalEstimates(
            makeIndex([outboundRoute]),
            [makeTimetable([], [], times)],
            displayedStop,
            new Date(2026, 6, 1, 11, 50),
        );

        expect(formatEstimatedClock(estimate.arrivals[0].at)).toBe('12:12');
    });

    it('does not guess alternate service patterns described only by timetable notes', () => {
        const annotated = makeTimetable([{ time: '10:10', note: 'x' }], []);
        annotated.stations.push({ name: 'Duplicate source', times: schedule(['10:10'], []) });
        const [estimate] = getStopArrivalEstimates(
            makeIndex([outboundRoute]),
            [annotated],
            displayedStop,
            new Date(2026, 1, 2, 10, 0),
        );

        expect(estimate.status).toBe('unavailable');
        expect(estimate.arrivals).toEqual([]);
    });

    it('does not promote a later plain trip when an earlier annotated trip may serve the stop', () => {
        const [estimate] = getStopArrivalEstimates(
            makeIndex([outboundRoute]),
            [makeTimetable([{ time: '10:05', note: 'x' }, '10:30'], [])],
            displayedStop,
            new Date(2026, 1, 2, 10, 0),
        );

        expect(estimate.status).toBe('unavailable');
        expect(estimate.arrivals).toEqual([]);
    });

    it('maps timetable directions by endpoints even when network route order is reversed', () => {
        const network = productionNetwork as TransitNetwork;
        const timetableFile = productionTimetables as TimetableFile;
        const line12 = timetableFile.urban.find((entry) => entry.lineId === '12')!;
        const rebrovac = network.routes.find((route) => route.id === '12-rebrovac-paprikovac')!;
        const paprikovac = network.routes.find((route) => route.id === '12-paprikovac-rebrovac')!;

        expect(resolveTimetableDirection(line12, rebrovac)).toBe(0);
        expect(resolveTimetableDirection(line12, paprikovac)).toBe(1);
    });

    it('uses geometry-derived timing for both 17A directions at Čajavec', () => {
        const network = productionNetwork as TransitNetwork;
        const timetableFile = productionTimetables as TimetableFile;
        const productionIndex = createTransitIndex(network);
        const cajavec = productionIndex.stopById.get('st-1379')!;
        const towardsStarcevica = productionIndex.routeById.get('17a-nova-bolnica-starcevica')!;
        const towardsHospital = productionIndex.routeById.get('17a-starcevica-nova-bolnica')!;

        expect(towardsStarcevica.timing).toBe('geometry');
        expect(towardsHospital.timing).toBe('geometry');
        expect(getTravelMinutesToStop(productionIndex, towardsStarcevica, cajavec)).toBe(9);
        expect(getTravelMinutesToStop(productionIndex, towardsHospital, cajavec)).toBe(16);

        const estimates = getStopArrivalEstimates(
            productionIndex,
            timetableFile.urban,
            cajavec,
            new Date(2026, 1, 2, 12, 0),
        ).filter(({ lineId }) => lineId === '17A');

        expect(estimates).toHaveLength(2);
        expect(estimates.every(({ status, arrivals }) => status === 'estimated' && arrivals.length > 0)).toBe(true);
    });

    it('uses the unique timed start of composite line 13P at Čajavec', () => {
        const network = productionNetwork as TransitNetwork;
        const timetableFile = productionTimetables as TimetableFile;
        const productionIndex = createTransitIndex(network);
        const cajavec = productionIndex.stopById.get('st-1379')!;
        const route = productionIndex.routeById.get('13p-petricevac-obilicevo')!;

        expect(getTravelMinutesToStop(productionIndex, route, cajavec)).toBe(17);
        const estimate = getStopArrivalEstimates(
            productionIndex,
            timetableFile.urban,
            cajavec,
            new Date(2026, 1, 2, 12, 0),
        ).find(({ route: candidate }) => candidate?.id === route.id);

        expect(estimate?.status).toBe('estimated');
        expect(estimate?.arrivals.length).toBeGreaterThan(0);
    });

    it('resolves a timetable direction for every published network route', () => {
        const network = productionNetwork as TransitNetwork;
        const timetableFile = productionTimetables as TimetableFile;

        network.routes.forEach((route) => {
            const timetable = timetableFile.urban.find((entry) => entry.lineId === route.lineId);
            expect(timetable, route.id).toBeDefined();
            expect(resolveTimetableDirection(timetable!, route), route.id).not.toBeNull();
        });
    });
});

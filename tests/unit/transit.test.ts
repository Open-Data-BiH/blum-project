import { describe, expect, it } from 'vitest';
import network from '../../public/data/transport/routes/transit_network.json';
import {
    compareLineIds,
    createTransitIndex,
    formatRelation,
    getLineColor,
    getLineRoutes,
    getRouteStops,
    getRoutesForStop,
    getTerminusStopIds,
    hasRouteData,
    pickRouteForStop,
} from '../../src/lib/transit';
import type { RouteShape, TransitNetwork } from '../../src/types/transit';
import { readFileSync } from 'node:fs';

const readShape = (routeId: string): RouteShape =>
    JSON.parse(readFileSync(`public/data/transport/routes/shapes/${routeId}.json`, 'utf8')) as RouteShape;

const transit = network as TransitNetwork;
const index = createTransitIndex(transit);

describe('transit network data', () => {
    it('has unique stop, route and line ids', () => {
        const ids = transit.stops.flatMap((stop) => [stop.id, ...(stop.mergedIds ?? [])]);
        expect(new Set(ids).size).toBe(ids.length);
        expect(index.stopById.size).toBe(ids.length);
        expect(index.routeById.size).toBe(transit.routes.length);
        expect(index.lineById.size).toBe(transit.lines.length);
    });

    it('resolves every route stop against the stop table', () => {
        const missing = transit.routes.flatMap((route) =>
            route.stops.filter((stop) => !index.stopById.has(stop.stopId)).map((stop) => stop.stopId),
        );
        expect(missing).toEqual([]);
    });

    it('lists every route under its line and every line reference resolves', () => {
        transit.routes.forEach((route) => {
            expect(index.lineById.get(route.lineId)?.routes).toContain(route.id);
        });
        transit.lines.forEach((line) => {
            line.routes.forEach((routeId) => expect(index.routeById.has(routeId)).toBe(true));
        });
    });

    it('keeps a stop and the routes calling at it in agreement', () => {
        transit.routes.forEach((route) => {
            route.stops.forEach((routeStop) => {
                expect(index.stopById.get(routeStop.stopId)?.lines).toContain(route.lineId);
            });
        });
    });

    it('keeps direction variants of the same line separate', () => {
        const line19 = index.lineById.get('19');
        expect(line19?.routes.length).toBe(2);

        const [first, second] = getLineRoutes(index, '19');
        expect(first.relation).not.toBe(second.relation);
        expect(first.origin).toBe(second.destination);
    });

    it('has real road geometry for every route', () => {
        transit.routes.forEach((route) => expect(route.hasShape).toBe(true));
        expect(transit.meta.counts.routesWithShape).toBe(transit.routes.length);
    });

    it('gives every covered line both directions where the export has them', () => {
        const withOneVariant = transit.lines.filter((line) => line.routes.length === 1).map((line) => line.id);
        expect(withOneVariant).toEqual(['3']);
    });
});

describe('transit lookups', () => {
    it('returns route variants for a covered line and none for an uncovered one', () => {
        expect(hasRouteData(index, '19')).toBe(true);
        expect(getLineRoutes(index, '19')).toHaveLength(2);

        expect(hasRouteData(index, '17')).toBe(false);
        expect(getLineRoutes(index, '17')).toEqual([]);
    });

    it('numbers resolved stops contiguously even when source sequences have gaps', () => {
        const route = transit.routes.find((entry) => entry.stops.some((stop, i) => stop.seq !== i + 1));
        expect(route).toBeDefined();

        const stops = getRouteStops(index, route!);
        expect(stops.map((stop) => stop.position)).toEqual(stops.map((_stop, i) => i + 1));
    });

    it('identifies termini from route endpoints, not every turnaround role', () => {
        const terminusStopIds = getTerminusStopIds(index);

        transit.routes.forEach((route) => {
            const stops = getRouteStops(index, route);
            if (stops.length === 0) {
                return;
            }

            expect(terminusStopIds).toContain(stops[0].stop.id);
            expect(terminusStopIds).toContain(stops[stops.length - 1].stop.id);
        });

        const referenceRoute = transit.routes.find((route) => getRouteStops(index, route).length >= 3)!;
        const [first, turnaround, last] = getRouteStops(index, referenceRoute);
        const endpointOnlyIndex = createTransitIndex({
            ...transit,
            routes: [
                {
                    ...referenceRoute,
                    stops: [
                        { ...referenceRoute.stops[0], stopId: first.stop.id, role: 'start' },
                        // This source role looks like an endpoint, but its position is not one.
                        { ...referenceRoute.stops[1], stopId: turnaround.stop.id, role: 'end' },
                        { ...referenceRoute.stops[2], stopId: last.stop.id, role: 'end' },
                    ],
                },
            ],
        });

        expect(getTerminusStopIds(endpointOnlyIndex)).toEqual(new Set([first.stop.id, last.stop.id]));
        expect(getTerminusStopIds(endpointOnlyIndex)).not.toContain(turnaround.stop.id);
    });

    it('picks the direction variant that actually calls at the stop', () => {
        const [first, second] = getLineRoutes(index, '19');
        const onlyOnSecond = second.stops.find((stop) => !first.stops.some((entry) => entry.stopId === stop.stopId));
        expect(onlyOnSecond).toBeDefined();

        expect(pickRouteForStop(index, '19', onlyOnSecond!.stopId)).toBe(second.id);
        expect(pickRouteForStop(index, '19', first.stops[0].stopId)).toBe(first.id);
    });

    it('returns every direction variant that calls at the same displayed stop', () => {
        const line = transit.lines.find((entry) => entry.routes.length > 1)!;
        const variants = getLineRoutes(index, line.id);
        const sharedStop = transit.stops.find((stop) => {
            const ids = new Set([stop.id, ...(stop.mergedIds ?? [])]);
            return variants.filter((route) => route.stops.some((entry) => ids.has(entry.stopId))).length > 1;
        });

        expect(sharedStop).toBeDefined();
        expect(getRoutesForStop(index, line.id, sharedStop!.id).length).toBeGreaterThan(1);
        expect(pickRouteForStop(index, line.id, sharedStop!.id)).toBe(
            getRoutesForStop(index, line.id, sharedStop!.id)[0].id,
        );
    });

    it('honors stops added to a route by transit overrides', () => {
        const bulevar = index.stopById.get('st-167');
        expect(bulevar?.name).toBe('Bulevar');
        expect(bulevar?.lines).toContain('19');
        expect(pickRouteForStop(index, '19', 'st-167')).toBe('19-sargovac-centar');
    });

    it('offers no route for a stop that no variant of the line lists', () => {
        expect(pickRouteForStop(index, '19', 'st-does-not-exist')).toBeNull();
        expect(pickRouteForStop(index, '17', 'st-605')).toBeNull();
    });

    it('offers a route only where the line actually calls', () => {
        // A badge that opens a route must lead to one containing that stop.
        transit.stops.forEach((stop) => {
            const ids = new Set([stop.id, ...(stop.mergedIds ?? [])]);
            stop.lines.forEach((lineId) => {
                const routeId = pickRouteForStop(index, lineId, stop.id);
                if (routeId === null) {
                    return;
                }
                const route = index.routeById.get(routeId);
                expect(route?.lineId).toBe(lineId);
                expect(route?.stops.some((entry) => ids.has(entry.stopId))).toBe(true);
            });
        });
    });

    it('resolves a route stop that was merged into another marker', () => {
        const merged = transit.stops.find((stop) => (stop.mergedIds?.length ?? 0) > 0);
        expect(merged).toBeDefined();

        const absorbedId = merged!.mergedIds![0];
        expect(index.stopById.get(absorbedId)?.id).toBe(merged!.id);
    });

    it('keeps every route stop within reach of its own drawn line', () => {
        // Guards the merge radius: a distant fold would strand the pin beside the line.
        const earthRadius = 6371000;
        const metres = (a: [number, number], b: [number, number]): number => {
            const rad = (value: number): number => (value * Math.PI) / 180;
            const dLat = rad(b[0] - a[0]);
            const dLon = rad(b[1] - a[1]);
            const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
            return 2 * earthRadius * Math.asin(Math.sqrt(h));
        };

        const route = index.routeById.get('19-sargovac-centar');
        expect(route?.hasShape).toBe(true);

        const shape = readShape('19-sargovac-centar');
        getRouteStops(index, route!).forEach(({ stop }) => {
            const nearest = Math.min(...shape.map((point) => metres([stop.lat, stop.lon], point)));
            expect(nearest).toBeLessThan(60);
        });
    });

    it('formats a relation as origin → destination', () => {
        const [route] = getLineRoutes(index, '19');
        expect(formatRelation(route)).toBe(`${route.origin} → ${route.destination}`);
        expect(formatRelation(route)).toContain('→');
    });

    it('falls back to a default colour for unknown lines', () => {
        expect(getLineColor(index, '19')).toBe(index.lineById.get('19')?.color);
        expect(getLineColor(index, 'nope')).toBe('#72aaff');
    });

    it('sorts line numbers naturally', () => {
        expect(['13A', '9', '10', '1', '9B'].sort(compareLineIds)).toEqual(['1', '9', '9B', '10', '13A']);
    });
});

import { describe, expect, it } from 'vitest';
import { deriveGeometryTimings, GEOMETRY_TIMING_SPEED_KMH } from '../../scripts/route-timing.mjs';

interface TestStop {
    id: string;
    lat: number;
    lon: number;
}

const routeStops = (ids: string[]) =>
    ids.map((stopId, position) => ({
        stopId,
        seq: position + 1,
        role: position === 0 ? 'start' : position === ids.length - 1 ? 'end' : null,
        time: null,
        distance: null,
    }));

const stopMap = (stops: TestStop[]): Map<string, TestStop> => new Map(stops.map((stop) => [stop.id, stop]));

describe('geometry route timing', () => {
    const stops = stopMap([
        { id: 'start', lat: 0, lon: 0 },
        { id: 'middle', lat: 0, lon: 0.005 },
        { id: 'end', lat: 0, lon: 0.01 },
    ]);
    const geometry: [number, number][] = [
        [0, 0],
        [0.01, 0],
    ];

    it('projects intermediate stops and derives deterministic segment values at the calibrated speed', () => {
        const input = routeStops(['start', 'middle', 'end']);
        const snapshot = structuredClone(input);
        const first = deriveGeometryTimings({ routeStops: input, geometry, stopById: stops });
        const second = deriveGeometryTimings({ routeStops: input, geometry, stopById: stops });

        expect(first).toEqual(second);
        expect(input).toEqual(snapshot);
        expect(first.ok).toBe(true);
        if (!first.ok) {
            return;
        }

        expect(GEOMETRY_TIMING_SPEED_KMH).toBe(20);
        expect(first.timings).toEqual([
            { distance: 0, time: 0 },
            { distance: 556, time: 100 },
            { distance: 556, time: 100 },
        ]);
        expect(first.totalDistanceMetres).toBe(1112);
        expect(first.totalSeconds).toBe(200);
    });

    it('is insensitive to extra vertices on the same road geometry', () => {
        const denseGeometry: [number, number][] = [
            [0, 0],
            [0.0025, 0],
            [0.005, 0],
            [0.0075, 0],
            [0.01, 0],
        ];

        expect(
            deriveGeometryTimings({ routeStops: routeStops(['start', 'middle', 'end']), geometry, stopById: stops }),
        ).toEqual(
            deriveGeometryTimings({
                routeStops: routeStops(['start', 'middle', 'end']),
                geometry: denseGeometry,
                stopById: stops,
            }),
        );
    });

    it('rejects incomplete source ordering instead of inventing the missing sequence', () => {
        const input = routeStops(['start', 'middle', 'end']);
        input[1].seq = 3;

        expect(deriveGeometryTimings({ routeStops: input, geometry, stopById: stops })).toMatchObject({
            ok: false,
            reason: 'invalid-sequence',
        });
    });

    it('rejects non-monotonic stop order and stops grossly outside the route shape', () => {
        const orderedStops = stopMap([
            ...stops.values(),
            { id: 'late', lat: 0, lon: 0.008 },
            { id: 'early', lat: 0, lon: 0.004 },
            { id: 'far', lat: 0.01, lon: 0.005 },
        ]);

        expect(
            deriveGeometryTimings({
                routeStops: routeStops(['start', 'late', 'early', 'end']),
                geometry,
                stopById: orderedStops,
            }),
        ).toMatchObject({ ok: false, reason: 'non-monotonic' });
        expect(
            deriveGeometryTimings({
                routeStops: routeStops(['start', 'far', 'end']),
                geometry,
                stopById: orderedStops,
            }),
        ).toMatchObject({ ok: false, reason: 'stop-too-far' });
    });

    it('rejects missing or malformed geometry without partially deriving data', () => {
        const input = routeStops(['start', 'middle', 'end']);

        expect(deriveGeometryTimings({ routeStops: input, geometry: [], stopById: stops })).toMatchObject({
            ok: false,
            reason: 'invalid-geometry',
        });
        expect(input.every(({ time, distance }) => time === null && distance === null)).toBe(true);
    });
});

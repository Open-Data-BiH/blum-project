const EARTH_RADIUS_M = 6_371_000;

/**
 * Effective in-service speed calibrated against routes that have operator timing data.
 * It includes ordinary stops and junction delay, so no extra dwell time is added.
 */
export const GEOMETRY_TIMING_SPEED_KMH = 20;
export const GEOMETRY_TIMING_WARNING_OFFSET_M = 60;

const MAX_SHAPE_OFFSET_M = 200;
const MAX_ENDPOINT_OFFSET_M = 250;
const MIN_SEGMENT_DISTANCE_M = 25;
const MAX_SEGMENT_DISTANCE_M = 3_000;

const distanceMeters = (a, b) => {
    const toRad = (degrees) => (degrees * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

const isFiniteCoordinate = (value) =>
    Array.isArray(value) && value.length === 2 && value.every((coordinate) => Number.isFinite(coordinate));

/** Project a stop onto a GeoJSON [lon, lat] LineString. */
const projectStop = (geometry, stop) => {
    const lonScale = Math.cos((stop.lat * Math.PI) / 180);
    const degreesToMetres = (EARTH_RADIUS_M * Math.PI) / 180;
    let cumulativeMetres = 0;
    let best = null;

    for (let position = 1; position < geometry.length; position += 1) {
        const [aLon, aLat] = geometry[position - 1];
        const [bLon, bLat] = geometry[position];
        const ax = (aLon - stop.lon) * lonScale;
        const ay = aLat - stop.lat;
        const bx = (bLon - stop.lon) * lonScale;
        const by = bLat - stop.lat;
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSquared = dx * dx + dy * dy;
        const fraction = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / lengthSquared));
        const offsetMetres = Math.hypot(ax + fraction * dx, ay + fraction * dy) * degreesToMetres;
        const segmentMetres = distanceMeters({ lat: aLat, lon: aLon }, { lat: bLat, lon: bLon });
        const alongMetres = cumulativeMetres + fraction * segmentMetres;

        if (best === null || offsetMetres < best.offsetMetres) {
            best = { alongMetres, offsetMetres };
        }
        cumulativeMetres += segmentMetres;
    }

    return best === null ? null : { ...best, geometryLengthMetres: cumulativeMetres };
};

const failure = (reason, detail) => ({ ok: /** @type {false} */ (false), reason, detail });

/**
 * Derive deterministic per-stop timings without mutating the route or stop records.
 * Distances are measured along the published route shape; time uses a calibrated effective
 * speed and is rounded cumulatively so individual segment rounding cannot drift.
 */
export const deriveGeometryTimings = ({ routeStops, geometry, stopById, speedKmh = GEOMETRY_TIMING_SPEED_KMH }) => {
    if (!Array.isArray(routeStops) || routeStops.length < 2) {
        return failure('invalid-stops', 'at least two ordered route stops are required');
    }
    if (!Array.isArray(geometry) || geometry.length < 2 || !geometry.every(isFiniteCoordinate)) {
        return failure('invalid-geometry', 'a LineString with at least two finite points is required');
    }
    if (!Number.isFinite(speedKmh) || speedKmh <= 0) {
        return failure('invalid-speed', 'effective speed must be positive');
    }
    if (routeStops.some((stop, position) => stop.seq !== position + 1)) {
        return failure('invalid-sequence', 'geometry timing requires a complete contiguous stop sequence');
    }

    const projections = [];
    for (const routeStop of routeStops) {
        const stop = stopById.get(routeStop.stopId);
        if (!stop || !Number.isFinite(stop.lat) || !Number.isFinite(stop.lon)) {
            return failure('missing-stop', `stop ${routeStop.stopId} has no finite coordinate`);
        }
        const projection = projectStop(geometry, stop);
        if (!projection) {
            return failure('invalid-geometry', `stop ${routeStop.stopId} could not be projected`);
        }
        if (projection.offsetMetres > MAX_SHAPE_OFFSET_M) {
            return failure(
                'stop-too-far',
                `stop ${routeStop.stopId} is ${projection.offsetMetres.toFixed(0)} m from the route shape`,
            );
        }
        projections.push({ ...projection, stopId: routeStop.stopId });
    }

    const first = projections[0];
    const last = projections[projections.length - 1];
    if (first.alongMetres > MAX_ENDPOINT_OFFSET_M) {
        return failure('origin-too-far', `first stop projects ${first.alongMetres.toFixed(0)} m after the shape start`);
    }
    if (last.geometryLengthMetres - last.alongMetres > MAX_ENDPOINT_OFFSET_M) {
        return failure(
            'destination-too-far',
            `last stop projects ${(last.geometryLengthMetres - last.alongMetres).toFixed(0)} m before the shape end`,
        );
    }

    const cumulativeDistances = projections.map(({ alongMetres }) => Math.round(alongMetres - first.alongMetres));
    for (let position = 1; position < cumulativeDistances.length; position += 1) {
        const segmentDistance = cumulativeDistances[position] - cumulativeDistances[position - 1];
        if (segmentDistance <= 0) {
            return failure('non-monotonic', `stop ${routeStops[position].stopId} does not advance along the shape`);
        }
        if (segmentDistance < MIN_SEGMENT_DISTANCE_M || segmentDistance > MAX_SEGMENT_DISTANCE_M) {
            return failure(
                'implausible-segment',
                `segment to ${routeStops[position].stopId} is ${segmentDistance} m along the shape`,
            );
        }
    }

    const speedMetresPerSecond = speedKmh / 3.6;
    const cumulativeSeconds = cumulativeDistances.map((distance) => Math.round(distance / speedMetresPerSecond));
    const timings = routeStops.map((_stop, position) => ({
        distance: position === 0 ? 0 : cumulativeDistances[position] - cumulativeDistances[position - 1],
        time: position === 0 ? 0 : cumulativeSeconds[position] - cumulativeSeconds[position - 1],
    }));

    return {
        ok: /** @type {true} */ (true),
        timings,
        maxOffsetMetres: Math.max(...projections.map(({ offsetMetres }) => offsetMetres)),
        totalDistanceMetres: cumulativeDistances[cumulativeDistances.length - 1],
        totalSeconds: cumulativeSeconds[cumulativeSeconds.length - 1],
    };
};

/**
 * Builds transit_network.json and the per-route geometry from the operator export
 * (paths in transit-source.json) plus the line colours in urban_bus_routes.json.
 * Inputs are read-only; re-run with `npm run data:transit`.
 *
 * Prints a validation report and records surviving anomalies in meta.warnings.
 * See docs/transit-data.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_CONFIG = path.join(ROOT, 'scripts/transit-source.json');
const OVERRIDES = path.join(ROOT, 'scripts/transit-overrides.json');
const LINE_COLORS = path.join(ROOT, 'public/data/transport/routes/urban_bus_routes.json');
const OUTPUT = path.join(ROOT, 'public/data/transport/routes/transit_network.json');
const SHAPES_DIR = path.join(ROOT, 'public/data/transport/routes/shapes');

/** 5 decimals is about one metre. */
const COORDINATE_DECIMALS = 5;

/**
 * Folding a derived stop into a registry stop, in order of confidence. Name + shared line
 * reaches furthest because some legacy coordinates are hundreds of metres off; a bare name
 * match holds to 150 m; a different name only merges at kerb range.
 */
const MERGE_RADIUS_M = 30;
const NAME_MERGE_RADIUS_M = 150;
const LINE_MERGE_RADIUS_M = 600;

/**
 * Same-named stops this close are one kerb exported twice, drawn as a single marker.
 * Deliberately tight: opposite kerbs are 60-120 m apart and each sits on its own
 * direction's geometry, so merging them would strand stop markers beside the line.
 */
const POLE_MERGE_RADIUS_M = 30;
const DEFAULT_LINE_COLOR = '#72aaff';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const warnings = [];
const warn = (message) => {
    warnings.push(message);
    console.warn(`  ! ${message}`);
};

const EARTH_RADIUS_M = 6371000;
const distanceMeters = (a, b) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

/** One source relation is Cyrillic; the site is Latin-script. */
const CYRILLIC_TO_LATIN = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    ђ: 'đ',
    е: 'e',
    ж: 'ž',
    з: 'z',
    и: 'i',
    ј: 'j',
    к: 'k',
    л: 'l',
    љ: 'lj',
    м: 'm',
    н: 'n',
    њ: 'nj',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    ћ: 'ć',
    у: 'u',
    ф: 'f',
    х: 'h',
    ц: 'c',
    ч: 'č',
    џ: 'dž',
    ш: 'š',
};

const transliterate = (value) => {
    let changed = false;
    const text = [...value]
        .map((char) => {
            const lower = char.toLowerCase();
            const mapped = CYRILLIC_TO_LATIN[lower];
            if (!mapped) {
                return char;
            }
            changed = true;
            return char === lower ? mapped : mapped.toUpperCase();
        })
        .join('');
    return { text, changed };
};

/** Some relations use an en dash and doubled spaces. */
const cleanRelation = (value) => (value ?? '').replace(/–/g, '-').replace(/\s+/g, ' ').trim();

const splitRelation = (relation) => {
    const parts = relation
        .split('-')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);

    if (parts.length === 0) {
        return { origin: '', via: [], destination: '' };
    }
    if (parts.length === 1) {
        return { origin: parts[0], via: [], destination: '' };
    }
    return { origin: parts[0], via: parts.slice(1, -1), destination: parts[parts.length - 1] };
};

/** Matches the site search normalisation. */
const normalizeName = (value) =>
    (value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, ' ')
        // "br" is house-number noise: "Majevicka br 29" is "Majevicka 29".
        .replace(/br/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const slugify = (value) =>
    value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const STOP_ROLES = { p: 'start', z: 'end' };

/** Registry stops keep the operator's number; derived stops are keyed by name. */
const stopId = (registryKey) => `st-${registryKey}`;

const derivedStopId = (name, taken) => {
    const base = `st-${slugify(name)}`;
    if (!taken.has(base)) {
        taken.add(base);
        return base;
    }
    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) {
        suffix += 1;
    }
    taken.add(`${base}-${suffix}`);
    return `${base}-${suffix}`;
};

/** Direction-describing ids, e.g. "19-sargovac-centar". Parentheticals are dropped. */
const endpointSlug = (value) => slugify(value.replace(/\([^)]*\)/g, ''));

const makeRouteId = (lineId, origin, destination, direction, taken) => {
    const endpoints = [endpointSlug(origin), endpointSlug(destination)].filter(Boolean).join('-');
    const base = [slugify(lineId), endpoints].filter(Boolean).join('-');
    if (!taken.has(base)) {
        taken.add(base);
        return base;
    }
    // Line 14 runs the same relation both ways; the direction breaks the tie.
    const byDirection = [base, slugify(direction ?? '')].filter(Boolean).join('-');
    if (byDirection !== base && !taken.has(byDirection)) {
        taken.add(byDirection);
        return byDirection;
    }
    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) {
        suffix += 1;
    }
    taken.add(`${base}-${suffix}`);
    return `${base}-${suffix}`;
};

// ---------------------------------------------------------------------------
// Load inputs
// ---------------------------------------------------------------------------

const source = readJson(SOURCE_CONFIG);
const resolveSource = (key) => {
    const relative = source[key];
    if (!relative) {
        throw new Error(`scripts/transit-source.json is missing the "${key}" path`);
    }
    const file = path.join(ROOT, relative);
    if (!fs.existsSync(file)) {
        throw new Error(`Source file not found: ${relative} (configured as "${key}")`);
    }
    return file;
};

console.log('Reading operator export…');
const dataset = readJson(resolveSource('dataset'));
const sourceRoutes = dataset.routes;
const sourceStops = dataset.stops;
const sourceRouteStops = dataset.route_stops;
const shapeCollection = readJson(resolveSource('shapes'));
const flatRows = readJson(resolveSource('flatRows'));
const lineColorData = readJson(LINE_COLORS);

console.log(`  extracted ${dataset.metadata?.extracted_at ?? 'unknown date'}`);
console.log(
    `  routes=${sourceRoutes.length} stops=${sourceStops.length} route-stop groups=${sourceRouteStops.length} shapes=${shapeCollection.features.length} flat rows=${flatRows.length}`,
);

// ---------------------------------------------------------------------------
// Validate the export
// ---------------------------------------------------------------------------

console.log('\nValidating export…');

const sourceStopByKey = new Map();
for (const stop of sourceStops) {
    if (sourceStopByKey.has(stop.stop_id)) {
        warn(`duplicate stop key ${stop.stop_id} in the stop export`);
    }
    if (stop.lat == null || stop.lon == null) {
        warn(`stop ${stop.stop_id} (${stop.name}) has no coordinates`);
    }
    sourceStopByKey.set(stop.stop_id, stop);
}

const routeMetaByKey = new Map(sourceRoutes.map((route) => [route.route_id, route]));
for (const group of sourceRouteStops) {
    if (!routeMetaByKey.has(group.route_id)) {
        warn(`route ${group.route_id} has stops but is missing from the route export`);
    }
}
for (const route of sourceRoutes) {
    if (!sourceRouteStops.some((group) => group.route_id === route.route_id)) {
        warn(`route ${route.route_id} (line ${route.line_number}) has no stops in the export`);
    }
}

// GeoJSON, already normalised to [lon, lat].
const shapeByKey = new Map();
for (const feature of shapeCollection.features) {
    const key = feature.properties?.route_id;
    if (!key) {
        warn('a geometry feature has no route_id and was skipped');
        continue;
    }
    if (feature.geometry?.type !== 'LineString') {
        warn(`geometry for route ${key} is ${feature.geometry?.type}, expected LineString`);
        continue;
    }
    if (shapeByKey.has(key)) {
        warn(`duplicate geometry for route ${key}; using the first one`);
        continue;
    }
    shapeByKey.set(key, feature.geometry.coordinates);
}
for (const route of sourceRoutes) {
    if (!shapeByKey.has(route.route_id)) {
        warn(`route ${route.route_id} (line ${route.line_number}) has no geometry`);
    }
}

// The flat export is the same rows ungrouped; confirm both agree on stop order.
const flatByRoute = new Map();
for (const row of flatRows) {
    if (!flatByRoute.has(row.ID_sc_linije)) {
        flatByRoute.set(row.ID_sc_linije, []);
    }
    flatByRoute.get(row.ID_sc_linije).push(row);
}
for (const group of sourceRouteStops) {
    const rows = (flatByRoute.get(group.route_id) ?? [])
        .slice()
        .sort((a, b) => Number(a.redni_broj) - Number(b.redni_broj));
    // The flat export repeats a few rows.
    const flatKey = [...new Set(rows.map((row) => `${row.ID_sc_stajalista}#${row.redni_broj}`))].join('|');
    const groupKey = group.stops.map((stop) => `${stop.stop_id}#${stop.sequence}`).join('|');
    if (flatKey !== groupKey) {
        warn(`route ${group.route_id}: the flat and grouped exports disagree on stop order`);
    }
}

// ---------------------------------------------------------------------------
// Build routes
// ---------------------------------------------------------------------------

const routes = [];
const coveredLineIds = new Set();
const takenRouteIds = new Set();
const shapesToWrite = new Map();

for (const group of sourceRouteStops) {
    const meta = routeMetaByKey.get(group.route_id);
    const lineId = group.line_number ?? meta?.line_number ?? '';

    const transliterated = transliterate(cleanRelation(group.relation ?? meta?.relation ?? ''));
    if (transliterated.changed) {
        console.log(`  transliterated Cyrillic relation on route ${group.route_id}: ${transliterated.text}`);
    }
    const relation = transliterated.text;
    if (!relation) {
        warn(`route ${group.route_id} (line ${lineId}) has no relation text`);
    }

    // Gaps mean a stop the operator lists is missing; keep the source value.
    const sequences = group.stops.map((stop) => stop.sequence);
    const sorted = [...sequences].sort((a, b) => a - b);
    if (sequences.some((value, index) => value !== sorted[index])) {
        warn(`route ${group.route_id} (line ${lineId}) stops are not in ascending sequence order`);
    }
    const gaps = sorted.filter((value, index) => index > 0 && value !== sorted[index - 1] + 1);
    if (gaps.length > 0 || sorted[0] !== 1) {
        warn(
            `route ${group.route_id} (line ${lineId}) has a sequence gap before ${gaps.join(', ') || sorted[0]} — a source stop is missing`,
        );
    }

    const seenStopKeys = new Set();
    for (const stop of group.stops) {
        if (seenStopKeys.has(stop.stop_id)) {
            warn(`route ${group.route_id} visits stop ${stop.stop_id} (${stop.name}) more than once`);
        }
        seenStopKeys.add(stop.stop_id);

        const canonical = sourceStopByKey.get(stop.stop_id);
        if (!canonical) {
            warn(`route ${group.route_id} references unknown stop ${stop.stop_id} (${stop.name})`);
            continue;
        }
        if (canonical.lat !== stop.lat || canonical.lon !== stop.lon) {
            warn(`stop ${stop.stop_id} has different coordinates on route ${group.route_id} than in the stop export`);
        }
        if (canonical.name !== stop.name) {
            warn(
                `stop ${stop.stop_id} is named "${stop.name}" on route ${group.route_id} but "${canonical.name}" in the stop export`,
            );
        }
    }

    // Two undocumented timing columns; take the better-covered one. Where both exist the
    // second is often a round 60 s placeholder.
    const countA = group.stops.filter((stop) => stop.time_a != null).length;
    const countB = group.stops.filter((stop) => stop.time_b != null).length;
    const timing = countA === 0 && countB === 0 ? null : countA >= countB ? 'a' : 'b';
    if (timing && Math.max(countA, countB) < group.stops.length) {
        warn(
            `route ${group.route_id} (line ${lineId}) has travel times for only ${Math.max(countA, countB)}/${group.stops.length} stops`,
        );
    }

    const starts = group.stops.filter((stop) => stop.stop_type === 'p').length;
    const ends = group.stops.filter((stop) => stop.stop_type === 'z').length;
    if (starts !== 1 || ends !== 1) {
        warn(
            `route ${group.route_id} (line ${lineId}) marks ${starts} start and ${ends} end stops — roles mark turnaround points, not only termini`,
        );
    }

    const endpoints = splitRelation(relation);
    const direction = group.direction ?? meta?.direction ?? null;

    // Written per route and fetched on demand, keeping the map payload small.
    const geometry = shapeByKey.get(group.route_id) ?? null;
    const routeKey = makeRouteId(lineId, endpoints.origin, endpoints.destination, direction, takenRouteIds);
    if (geometry) {
        shapesToWrite.set(routeKey, geometry);
    }

    routes.push({
        id: routeKey,
        lineId,
        relation,
        ...endpoints,
        direction,
        timing,
        hasShape: geometry !== null,
        stops: group.stops
            .filter((stop) => sourceStopByKey.has(stop.stop_id))
            .map((stop) => ({
                stopId: stopId(stop.stop_id),
                seq: stop.sequence,
                role: STOP_ROLES[stop.stop_type] ?? null,
                // From the previous stop on this route.
                time: timing ? toNumber(timing === 'a' ? stop.time_a : stop.time_b) : null,
                distance: timing ? toNumber(timing === 'a' ? stop.distance_a : stop.distance_b) : null,
            })),
    });

    coveredLineIds.add(lineId);
}

// ---------------------------------------------------------------------------
// Build the line table (every public line, whether or not the export covers it)
// ---------------------------------------------------------------------------

const compareLineIds = (a, b) => {
    const numA = Number.parseInt(a.replace(/\D/g, ''), 10);
    const numB = Number.parseInt(b.replace(/\D/g, ''), 10);
    if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
        return numA - numB;
    }
    return a.localeCompare(b, undefined, { numeric: true });
};

const lines = [...new Set([...Object.keys(lineColorData), ...coveredLineIds])].sort(compareLineIds).map((id) => ({
    id,
    color: lineColorData[id]?.color ?? lineColorData[id]?.colour ?? DEFAULT_LINE_COLOR,
    routes: routes
        .filter((route) => route.lineId === id)
        .map((route) => route.id)
        .sort(),
}));

routes.sort((a, b) => compareLineIds(a.lineId, b.lineId) || a.id.localeCompare(b.id));

for (const line of lines) {
    if (!lineColorData[line.id]) {
        warn(`line ${line.id} is in the export but not in urban_bus_routes.json — using the default colour`);
    }
}
const uncovered = lines.filter((line) => line.routes.length === 0).map((line) => line.id);
if (uncovered.length > 0) {
    warn(`lines without route data: ${uncovered.join(', ')}`);
}
for (const line of lines.filter((entry) => entry.routes.length > 1)) {
    console.log(`  line ${line.id} has ${line.routes.length} route variants: ${line.routes.join(', ')}`);
}

// ---------------------------------------------------------------------------
// Build the stop table: registry stops + derived stops with no registry counterpart
// ---------------------------------------------------------------------------

const linesByStopId = new Map();
for (const route of routes) {
    for (const stop of route.stops) {
        if (!linesByStopId.has(stop.stopId)) {
            linesByStopId.set(stop.stopId, new Set());
        }
        linesByStopId.get(stop.stopId).add(route.lineId);
    }
}

// Deduplicated by name as the map has always done: first coordinate wins, lines unioned.
const derivedStops = new Map();
for (const [lineId, line] of Object.entries(lineColorData)) {
    for (const direction of Object.values(line.directions ?? {})) {
        const names = direction.stops ?? [];
        const coordinates = direction.coordinates ?? [];
        if (names.length !== coordinates.length) {
            warn(`urban_bus_routes.json line ${lineId}: ${names.length} stops but ${coordinates.length} coordinates`);
        }
        names.forEach((name, index) => {
            const coordinate = coordinates[index];
            if (!coordinate) {
                return;
            }
            const existing = derivedStops.get(name);
            if (existing) {
                existing.lines.add(lineId);
                return;
            }
            derivedStops.set(name, {
                name,
                street: direction.streets?.[index] ?? direction.ulice?.[index] ?? null,
                lat: coordinate[0],
                lon: coordinate[1],
                lines: new Set([lineId]),
            });
        });
    }
}

const registryStops = sourceStops.map((stop) => ({
    id: stopId(stop.stop_id),
    name: transliterate(stop.name ?? '').text,
    street: stop.street || null,
    lat: stop.lat,
    lon: stop.lon,
    source: 'registry',
    lines: [...(linesByStopId.get(stopId(stop.stop_id)) ?? [])].sort(compareLineIds),
}));

// Display-only: a resolved derived stop is not drawn twice, but its extra lines move to
// the registry stop so popups keep listing every line.
const absorbed = [];
const derivedOnly = [];
const takenStopIds = new Set(registryStops.map((stop) => stop.id));
for (const derived of derivedStops.values()) {
    // A stop of the same name wins over a merely closer one: legacy coordinates are
    // imprecise enough that "Poljoprivredna škola" lands 3 m from a differently named
    // registry stop while its real counterpart sits 68 m away.
    let nearest = null;
    let nearestDistance = Infinity;
    let nearestReason = null;

    for (const stop of registryStops) {
        const distance = distanceMeters(derived, stop);
        if (distance > LINE_MERGE_RADIUS_M) {
            continue;
        }

        const byName = normalizeName(derived.name) === normalizeName(stop.name);
        const sharesLine = byName && [...derived.lines].some((lineId) => stop.lines.includes(lineId));

        let reason = null;
        if (byName && distance <= NAME_MERGE_RADIUS_M) {
            reason = 'name';
        } else if (sharesLine) {
            reason = 'name+line';
        } else if (!byName && distance <= MERGE_RADIUS_M) {
            reason = 'distance';
        }
        if (!reason) {
            continue;
        }

        // A name match outranks a merely closer stop with a different name.
        const outranks = reason !== 'distance' && nearestReason === 'distance';
        const sameRank = (reason === 'distance') === (nearestReason === 'distance');
        if (nearest === null || outranks || (sameRank && distance < nearestDistance)) {
            nearestDistance = distance;
            nearest = stop;
            nearestReason = reason;
        }
    }

    if (nearest) {
        const added = [...derived.lines].filter((lineId) => !nearest.lines.includes(lineId));
        nearest.lines = [...nearest.lines, ...added].sort(compareLineIds);
        absorbed.push(
            `${nearestDistance.toFixed(0)}m by ${nearestReason}  "${derived.name}" -> ${nearest.id} "${nearest.name}"${added.length > 0 ? ` (+lines ${added.join(',')})` : ''}`,
        );
        continue;
    }

    derivedOnly.push({
        id: derivedStopId(derived.name, takenStopIds),
        name: derived.name,
        street: derived.street,
        lat: derived.lat,
        lon: derived.lon,
        source: 'derived',
        lines: [...derived.lines].sort(compareLineIds),
    });
}

// Corrections the matching cannot settle. Renames run first so they can enable a merge.
const overrides = fs.existsSync(OVERRIDES) ? readJson(OVERRIDES) : { rename: {}, mergeInto: {} };
const byId = new Map([...registryStops, ...derivedOnly].map((stop) => [stop.id, stop]));

for (const [id, name] of Object.entries(overrides.rename ?? {})) {
    const stop = byId.get(id);
    if (!stop) {
        warn(`override: cannot rename unknown stop "${id}"`);
        continue;
    }
    console.log(`  renamed ${id}: "${stop.name}" -> "${name}"`);
    stop.name = name;
}

const forcedMerges = new Set();
for (const [id, targetId] of Object.entries(overrides.mergeInto ?? {})) {
    const stop = byId.get(id);
    const target = byId.get(targetId);
    if (!stop || !target) {
        warn(`override: cannot merge "${id}" into "${targetId}" — unknown stop id`);
        continue;
    }
    target.lines = [...new Set([...target.lines, ...stop.lines])].sort(compareLineIds);
    target.mergedIds = [...(target.mergedIds ?? []), stop.id, ...(stop.mergedIds ?? [])];
    forcedMerges.add(stop.id);
    console.log(`  merged ${id} into ${targetId} ("${target.name}")`);
}

// Collapse a stop exported twice into one marker; routes still reference the absorbed
// ids, which mergedIds maps back.
const clustered = [];
const absorbedPoles = [];
const assigned = new Set();
const candidates = [...registryStops, ...derivedOnly].filter((stop) => !forcedMerges.has(stop.id));

candidates.forEach((stop) => {
    if (assigned.has(stop.id)) {
        return;
    }

    const group = candidates.filter(
        (other) =>
            !assigned.has(other.id) &&
            normalizeName(other.name) === normalizeName(stop.name) &&
            distanceMeters(stop, other) <= POLE_MERGE_RADIUS_M,
    );
    group.forEach((member) => assigned.add(member.id));

    // Prefer a registry stop, then the best-connected one.
    const [primary, ...rest] = group.sort(
        (a, b) =>
            Number(b.source === 'registry') - Number(a.source === 'registry') ||
            b.lines.length - a.lines.length ||
            a.id.localeCompare(b.id),
    );

    if (rest.length === 0) {
        clustered.push(primary);
        return;
    }

    const lines = [...new Set(group.flatMap((member) => member.lines))].sort(compareLineIds);
    clustered.push({
        ...primary,
        lines,
        mergedIds: [...new Set(group.flatMap((member) => [...(member.mergedIds ?? []), member.id]))].filter(
            (id) => id !== primary.id,
        ),
    });
    rest.forEach((member) =>
        absorbedPoles.push(
            `${distanceMeters(primary, member).toFixed(0)}m  ${member.id} -> ${primary.id} "${primary.name}"`,
        ),
    );
});

const stops = clustered.sort((a, b) => a.name.localeCompare(b.name, 'sr'));

// Stops the export omits from a route. The position comes from the geometry: the stop is
// projected onto the line and slotted in so the geometry indices stay ascending.
const stopByAnyId = new Map();
for (const stop of stops) {
    stopByAnyId.set(stop.id, stop);
    (stop.mergedIds ?? []).forEach((id) => stopByAnyId.set(id, stop));
}

const geometryIndex = (geometry, stop) => {
    let best = Infinity;
    let index = -1;
    geometry.forEach(([lon, lat], i) => {
        const distance = distanceMeters(stop, { lat, lon });
        if (distance < best) {
            best = distance;
            index = i;
        }
    });
    return { index, distance: best };
};

for (const [routeKey, stopIds] of Object.entries(overrides.addStops ?? {})) {
    const route = routes.find((entry) => entry.id === routeKey);
    const geometry = shapesToWrite.get(routeKey);
    if (!route || !geometry) {
        warn(`override: cannot add stops to unknown route "${routeKey}"`);
        continue;
    }

    for (const stopId of stopIds) {
        const stop = stopByAnyId.get(stopId);
        if (!stop) {
            warn(`override: cannot add unknown stop "${stopId}" to route ${routeKey}`);
            continue;
        }
        if (route.stops.some((entry) => entry.stopId === stopId)) {
            warn(`override: route ${routeKey} already stops at "${stopId}"`);
            continue;
        }

        const placement = geometryIndex(geometry, stop);
        if (placement.distance > 60) {
            warn(
                `override: "${stopId}" is ${placement.distance.toFixed(0)} m from route ${routeKey} — check it belongs there`,
            );
        }

        const before = route.stops.filter(
            (entry) => geometryIndex(geometry, stopByAnyId.get(entry.stopId)).index <= placement.index,
        ).length;
        route.stops.splice(before, 0, { stopId, seq: null, role: null, time: null, distance: null });

        if (!stop.lines.includes(route.lineId)) {
            stop.lines = [...stop.lines, route.lineId].sort(compareLineIds);
        }
        console.log(`  added ${stopId} ("${stop.name}") to ${routeKey} at position ${before + 1}`);
    }
}

const seenIds = new Set();
for (const stop of stops) {
    if (seenIds.has(stop.id)) {
        warn(`duplicate stop id "${stop.id}" after merging — two stop names collapse to the same slug`);
    }
    seenIds.add(stop.id);
}

console.log(`\nMerging stops (${MERGE_RADIUS_M} m by distance, ${NAME_MERGE_RADIUS_M} m when names match)…`);
console.log(`  derived stop names: ${derivedStops.size}`);
console.log(`  absorbed by a registry stop: ${absorbed.length}`);
console.log(`  kept as derived-only markers: ${derivedOnly.length}`);
absorbed.forEach((entry) => console.log(`    ${entry}`));
console.log('  derived-only stops:');
derivedOnly.forEach((stop) => console.log(`    ${stop.name} (lines ${stop.lines.join(',')})`));

console.log(`\nCollapsing duplicate poles (same name within ${POLE_MERGE_RADIUS_M} m)…`);
console.log(`  markers removed: ${absorbedPoles.length}`);
absorbedPoles.forEach((entry) => console.log(`    ${entry}`));

const byNormalizedName = new Map();
for (const stop of stops) {
    const key = normalizeName(stop.name);
    if (!byNormalizedName.has(key)) {
        byNormalizedName.set(key, []);
    }
    byNormalizedName.get(key).push(stop);
}
// Opposite kerbs legitimately share a name; only flag ones close enough to look identical.
const CONFUSABLE_RADIUS_M = 45;
const confusable = [...byNormalizedName.values()]
    .filter((group) => group.length > 1)
    .filter((group) =>
        group.some((a, i) => group.some((b, j) => j > i && distanceMeters(a, b) <= CONFUSABLE_RADIUS_M)),
    );
if (confusable.length > 0) {
    warn(
        `${confusable.length} stop name(s) shared by markers within ${CONFUSABLE_RADIUS_M} m — rename them in scripts/transit-overrides.json if riders cannot tell them apart: ${confusable
            .map((group) => `${group[0].name} (${group.map((stop) => stop.id).join(', ')})`)
            .join('; ')}`,
    );
}
const sharedNameCount = [...byNormalizedName.values()].filter((group) => group.length > 1).length;
console.log(`
${sharedNameCount} stop name(s) used by more than one marker (mostly opposite kerbs).`);

// The listings and the route export disagree about some stops; those badges fall back to
// the timetable instead of opening a route that omits the stop.
const routesByLine = new Map(lines.map((line) => [line.id, line.routes.map((id) => routes.find((r) => r.id === id))]));
let unservedClaims = 0;
for (const stop of stops) {
    const ids = new Set([stop.id, ...(stop.mergedIds ?? [])]);
    for (const lineId of stop.lines) {
        const variants = routesByLine.get(lineId) ?? [];
        if (variants.length > 0 && !variants.some((route) => route.stops.some((entry) => ids.has(entry.stopId)))) {
            unservedClaims += 1;
        }
    }
}
if (unservedClaims > 0) {
    warn(
        `${unservedClaims} stop/line pairs where the line listings claim a stop the route export does not include — those lines link to the timetable instead of a route`,
    );
}

const orphans = stops.filter((stop) => stop.lines.length === 0);
if (orphans.length > 0) {
    warn(`stops not served by any line: ${orphans.map((stop) => `${stop.id}:${stop.name}`).join(', ')}`);
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Write one geometry file per route
// ---------------------------------------------------------------------------

const round = (value) => Number(value.toFixed(COORDINATE_DECIMALS));

fs.mkdirSync(SHAPES_DIR, { recursive: true });
const expectedShapeFiles = new Set();
let shapePoints = 0;

for (const [routeKey, coordinates] of shapesToWrite) {
    // GeoJSON [lon, lat] -> Leaflet [lat, lon].
    const points = coordinates.map(([lon, lat]) => [round(lat), round(lon)]);
    if (points.length < 2) {
        warn(`route ${routeKey} has geometry with only ${points.length} point(s) and was not written`);
        continue;
    }
    const outside = points.filter(([lat, lon]) => lat < 44.5 || lat > 45.1 || lon < 16.8 || lon > 17.5);
    if (outside.length > 0) {
        warn(`route ${routeKey} has ${outside.length} geometry point(s) outside Banja Luka`);
    }

    const file = `${routeKey}.json`;
    expectedShapeFiles.add(file);
    shapePoints += points.length;
    fs.writeFileSync(path.join(SHAPES_DIR, file), JSON.stringify(points), 'utf8');
}

// Drop geometry for routes that no longer exist.
for (const file of fs.readdirSync(SHAPES_DIR)) {
    if (file.endsWith('.json') && !expectedShapeFiles.has(file)) {
        fs.unlinkSync(path.join(SHAPES_DIR, file));
        console.log(`  removed stale geometry ${file}`);
    }
}

const shapesBytes = [...expectedShapeFiles].reduce(
    (total, file) => total + fs.statSync(path.join(SHAPES_DIR, file)).size,
    0,
);
console.log(
    `
Wrote ${expectedShapeFiles.size} geometry file(s) to ${path.relative(ROOT, SHAPES_DIR)} (${shapePoints} points, ${(shapesBytes / 1024).toFixed(0)} kB total)`,
);

const network = {
    meta: {
        generator: 'scripts/build-transit-network.mjs',
        generated: new Date().toISOString().slice(0, 10),
        mergeRadiusMeters: MERGE_RADIUS_M,
        nameMergeRadiusMeters: NAME_MERGE_RADIUS_M,
        extracted: dataset.metadata?.extracted_at ?? null,
        counts: {
            lines: lines.length,
            linesWithRoutes: lines.filter((line) => line.routes.length > 0).length,
            routes: routes.length,
            routesWithShape: routes.filter((route) => route.hasShape).length,
            stops: stops.length,
            registryStops: registryStops.length,
            derivedStops: derivedOnly.length,
        },
        warnings,
    },
    lines,
    routes,
    stops,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(network, null, 2)}\n`, 'utf8');

const sizeKb = (fs.statSync(OUTPUT).size / 1024).toFixed(1);
console.log(`\nWrote ${path.relative(ROOT, OUTPUT)} (${sizeKb} kB)`);
console.log(
    `  ${lines.length} lines (${network.meta.counts.linesWithRoutes} with routes), ${routes.length} route variants, ${stops.length} stops`,
);
console.log(`  ${warnings.length} warning(s) recorded in meta.warnings`);

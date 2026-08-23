// Lookups over the generated transit network. No DOM or Leaflet, so Astro pages and
// client scripts share them.

import type { TransitLine, TransitNetwork, TransitRoute, TransitRouteStop, TransitStop } from '../types/transit';

export interface TransitIndex {
    network: TransitNetwork;
    stopById: Map<string, TransitStop>;
    routeById: Map<string, TransitRoute>;
    lineById: Map<string, TransitLine>;
}

export interface ResolvedRouteStop {
    stop: TransitStop;
    routeStop: TransitRouteStop;
    /** 1-based and contiguous, unlike the source `seq`. */
    position: number;
}

export const createTransitIndex = (network: TransitNetwork): TransitIndex => {
    // Absorbed poles resolve to the marker that replaced them.
    const stopById = new Map<string, TransitStop>();
    network.stops.forEach((stop) => {
        stopById.set(stop.id, stop);
        stop.mergedIds?.forEach((mergedId) => stopById.set(mergedId, stop));
    });

    return {
        network,
        stopById,
        routeById: new Map(network.routes.map((route) => [route.id, route])),
        lineById: new Map(network.lines.map((line) => [line.id, line])),
    };
};

export const getStopIds = (stop: TransitStop): string[] => [stop.id, ...(stop.mergedIds ?? [])];

export const getLineColor = (index: TransitIndex, lineId: string): string =>
    index.lineById.get(lineId)?.color ?? '#72aaff';

export const getLineRoutes = (index: TransitIndex, lineId: string): TransitRoute[] =>
    (index.lineById.get(lineId)?.routes ?? [])
        .map((routeId) => index.routeById.get(routeId))
        .filter((route): route is TransitRoute => route !== undefined);

export const hasRouteData = (index: TransitIndex, lineId: string): boolean =>
    (index.lineById.get(lineId)?.routes.length ?? 0) > 0;

/** Every direction variant of a line that calls at this displayed stop. */
export const getRoutesForStop = (index: TransitIndex, lineId: string, stopId: string): TransitRoute[] => {
    const stop = index.stopById.get(stopId);
    const ids = new Set(stop ? getStopIds(stop) : [stopId]);

    return getLineRoutes(index, lineId).filter((route) => route.stops.some((entry) => ids.has(entry.stopId)));
};

/**
 * The variant calling at this stop, or null when none does — the sources disagree about
 * some stop lists, and a route omitting the clicked stop would be misleading.
 */
export const pickRouteForStop = (index: TransitIndex, lineId: string, stopId: string): string | null => {
    return getRoutesForStop(index, lineId, stopId)[0]?.id ?? null;
};

/** Skips stops with no record rather than leaving holes in the numbering. */
export const getRouteStops = (index: TransitIndex, route: TransitRoute): ResolvedRouteStop[] => {
    const resolved: ResolvedRouteStop[] = [];

    route.stops.forEach((routeStop) => {
        const stop = index.stopById.get(routeStop.stopId);
        if (stop) {
            resolved.push({ stop, routeStop, position: resolved.length + 1 });
        }
    });

    return resolved;
};

/**
 * Stop ids used as an endpoint by at least one published route. `role` is deliberately
 * not used here: the source also puts start/end roles on turnaround points mid-route.
 */
export const getTerminusStopIds = (index: TransitIndex): Set<string> => {
    const terminusStopIds = new Set<string>();

    index.network.routes.forEach((route) => {
        const stops = getRouteStops(index, route);
        if (stops.length === 0) {
            return;
        }

        terminusStopIds.add(stops[0].stop.id);
        terminusStopIds.add(stops[stops.length - 1].stop.id);
    });

    return terminusStopIds;
};

/** "Šargovac → Centar (Vidovdanska)". */
export const formatRelation = (route: TransitRoute): string => {
    if (route.origin && route.destination) {
        return `${route.origin} → ${route.destination}`;
    }
    return route.relation.replace(/\s*-\s*/g, ' → ');
};

/** Natural order: 1, 3, 9, 9B, 10, 13A, 19. */
export const compareLineIds = (a: string, b: string): number => {
    const numA = Number.parseInt(a.replace(/\D/g, ''), 10);
    const numB = Number.parseInt(b.replace(/\D/g, ''), 10);

    if (!Number.isNaN(numA) && !Number.isNaN(numB) && numA !== numB) {
        return numA - numB;
    }

    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

// Shape of public/data/transport/routes/transit_network.json — see docs/transit-data.md

export type TransitStopSource = 'registry' | 'derived' | 'osm';

export interface TransitStopAmenities {
    shelter?: true;
    bench?: true;
    lit?: true;
    departuresBoard?: true;
}

export interface TransitStop {
    id: string;
    name: string;
    street: string | null;
    lat: number;
    lon: number;
    source: TransitStopSource;
    /** Public line numbers, e.g. ["13A", "19"]. */
    lines: string[];
    /** Duplicate poles drawn as this marker; routes still reference them by these ids. */
    mergedIds?: string[];
    amenities?: TransitStopAmenities;
}

export interface TransitRouteStop {
    stopId: string;
    /** Source sequence; gaps mean a stop is missing. null when added by an override. */
    seq: number | null;
    /** Terminus or turnaround — a route can have several. */
    role: 'start' | 'end' | null;
    /** Seconds from the previous stop. */
    time: number | null;
    /** Metres from the previous stop. */
    distance: number | null;
}

/** One direction of a public line. */
export interface TransitRoute {
    id: string;
    /** Public line number, e.g. "19". */
    lineId: string;
    relation: string;
    origin: string;
    via: string[];
    destination: string;
    /** Usually "a"/"b", occasionally a place name. */
    direction: string | null;
    /** Export timing column, or a calibrated geometry estimate when the export has none. */
    timing: 'a' | 'b' | 'geometry' | null;
    /** Geometry lives in shapes/<id>.json and is fetched on demand; never derived from stops. */
    hasShape: boolean;
    stops: TransitRouteStop[];
}

export interface TransitLine {
    id: string;
    color: string;
    /** Empty when the export has no route data for this line. */
    routes: string[];
}

/** [lat, lon] pairs, Leaflet order. */
export type RouteShape = [number, number][];

export interface TransitNetworkMeta {
    generator: string;
    generated: string;
    extracted: string | null;
    mergeRadiusMeters: number;
    nameMergeRadiusMeters: number;
    counts: {
        lines: number;
        linesWithRoutes: number;
        routes: number;
        routesWithShape: number;
        stops: number;
        registryStops: number;
        derivedStops: number;
    };
    warnings: string[];
}

export interface TransitNetwork {
    meta: TransitNetworkMeta;
    lines: TransitLine[];
    routes: TransitRoute[];
    stops: TransitStop[];
}

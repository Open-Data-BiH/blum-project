// Shared types for homepage map data

export type LanguageKey = 'bhs' | 'en';

export interface LegendLabel {
    bhs: string;
    en: string;
}

export interface BaseMapConfig {
    id: string;
    label: LegendLabel;
    default?: boolean;
}

export type OverlayLayerId =
    | 'busStops'
    | 'trainStations'
    | 'mainBusStations'
    | 'airportShuttles'
    | 'touristBus'
    | 'bikeStations';

export interface OverlayLayerConfig {
    id: OverlayLayerId;
    label: LegendLabel;
    icon: string;
    color: string;
    defaultVisible: boolean;
}

export interface LegendConfig {
    baseMaps: BaseMapConfig[];
    overlayLayers: OverlayLayerConfig[];
}

export interface BusRouteDirection {
    stops: string[];
    coordinates: [number, number][];
    streets?: string[];
    ulice?: string[];
}

export interface BusRoute {
    color?: string;
    colour?: string;
    directions: Record<string, BusRouteDirection>;
}

export type BusRoutesFile = Record<string, BusRoute>;

export interface TransportHub {
    id: string;
    type: 'train-station' | 'bus-station' | 'terminal-bus-station' | 'airport-transfer' | 'bus-terminal';
    name: string;
    lat: number;
    lng: number;
    info: string;
    destinations?: string;
    description?: string;
    price?: string;
    duration?: string;
    website?: string | null;
}

export interface TransportHubsFile {
    hubs: TransportHub[];
}

export interface BikeStation {
    name: string;
    lat: number;
    lon: number;
    capacity: number;
}

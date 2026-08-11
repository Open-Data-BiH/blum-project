// Primitives shared by every interactive map on the site: view constants, the one data
// payload they all need, the failure toast, and the temporary layers a click draws.

import type {
    CircleMarker,
    LatLngBoundsExpression,
    LatLngExpression,
    Map as LeafletMap,
    Marker,
    Polyline,
} from 'leaflet';
import { escapeHtml, withBase } from '../../core/utils';
import type { TransitNetwork } from '../../../types/transit';
import type { BikeStation, Landmark, LandmarksFile, LegendConfig, TransportHub, TransportHubsFile } from './types';

type LeafletNS = typeof import('leaflet');

export const MAP_VIEW = {
    CENTER: [44.7866, 17.1975] as LatLngExpression,
    ZOOM: 13,
    MIN_ZOOM: 12,
    MAX_ZOOM: 17,
    /** Clicking a marker zooms at least this far in. */
    MARKER_FOCUS_MAX_ZOOM: 16,
    /** Below this zoom stops are dots; at or above it they get the bus icon. */
    ZOOM_THRESHOLD: 15,
    WALKING_RADIUS_5MIN: 400,
    BOUNDS: [
        [44.67794605215712, 16.90471973252053],
        [44.996414749446565, 17.620029520676],
    ] as LatLngBoundsExpression,
};

export const fetchJson = async <T>(url: string): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}`);
    }
    return (await response.json()) as T;
};

export interface MapData {
    legendConfig: LegendConfig;
    network: TransitNetwork;
    hubs: TransportHub[];
    bikeStations: BikeStation[];
    landmarks: Landmark[];
}

/** One parallel load, so a map never renders with half of its layers missing. */
export const loadMapData = async (): Promise<MapData> => {
    const [legendConfig, network, hubsFile, bikeStations, landmarksFile] = await Promise.all([
        fetchJson<LegendConfig>(withBase('data/legend-config.json')),
        fetchJson<TransitNetwork>(withBase('data/transport/routes/transit_network.json')),
        fetchJson<TransportHubsFile>(withBase('data/transport/transport_hubs.json')),
        fetchJson<BikeStation[]>(withBase('data/transport/bike_stations.json')),
        fetchJson<LandmarksFile>(withBase('data/transport/landmarks.json')),
    ]);

    return {
        legendConfig,
        network,
        hubs: hubsFile.hubs,
        bikeStations,
        landmarks: landmarksFile.landmarks,
    };
};

export const hexToRgba = (value: string, alpha: number): string | null => {
    const normalized = value.trim().replace(/^#/, '');
    if (![3, 6].includes(normalized.length) || !/^[\da-f]+$/i.test(normalized)) {
        return null;
    }

    const hex = normalized.length === 3 ? normalized.replace(/./g, '$&$&') : normalized;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Custom properties a line badge tints itself with, wherever it is rendered. */
export const lineAccentStyle = (color: string): string =>
    [
        `--line-accent:${escapeHtml(color)}`,
        `--line-accent-soft:${hexToRgba(color, 0.14) ?? 'rgba(114, 170, 255, 0.14)'}`,
        `--line-accent-hover:${hexToRgba(color, 0.2) ?? 'rgba(114, 170, 255, 0.2)'}`,
        `--line-accent-border:${hexToRgba(color, 0.28) ?? 'rgba(114, 170, 255, 0.28)'}`,
    ].join('; ');

const MAP_NOTIFICATION_MESSAGES = {
    busStopsUnavailable: {
        en: 'Bus stops are still loading or could not be loaded. Please wait a moment and try again.',
        bhs: 'Autobuska stajališta se još učitavaju ili nisu mogla biti učitana. Molimo sačekajte trenutak i pokušajte ponovo.',
    },
    permissionDenied: {
        en: 'Please allow location access to use this feature.',
        bhs: 'Molimo dozvolite pristup lokaciji da biste koristili ovu opciju.',
    },
    secureContextRequired: {
        en: 'Geolocation requires a secure connection (HTTPS) or localhost.',
        bhs: 'Geolokacija zahtijeva sigurnu vezu (HTTPS) ili localhost.',
    },
    locationUnavailable: {
        en: 'Could not determine your location. Please check your GPS settings.',
        bhs: 'Nismo mogli odrediti vašu lokaciju. Provjerite GPS postavke.',
    },
} as const;

export { MAP_NOTIFICATION_MESSAGES };

let notificationTimer: number | null = null;

const ensureNotificationRegion = (): HTMLElement => {
    const existing = document.getElementById('map-notification-region');
    if (existing) {
        return existing;
    }

    const region = document.createElement('div');
    region.id = 'map-notification-region';
    region.className = 'map-notification-region';
    document.body.appendChild(region);
    return region;
};

export const showMapNotification = (message: string): void => {
    if (!message) {
        return;
    }

    const region = ensureNotificationRegion();
    if (notificationTimer) {
        window.clearTimeout(notificationTimer);
        notificationTimer = null;
    }

    region.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = 'map-notification-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.textContent = message;
    region.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));

    notificationTimer = window.setTimeout(() => {
        toast.classList.remove('is-visible');
        window.setTimeout(() => toast.remove(), 180);
        notificationTimer = null;
    }, 6000);
};

export const createFontAwesomeIcon = (L: LeafletNS, iconClass: string, color: string) =>
    L.divIcon({
        html: `<i class="fa-solid ${iconClass} fa-icon-marker" style="color:${color};"></i>`,
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });

/** Pixels to move the view centre by, so a panel does not cover what was just selected. */
export interface FocusOffset {
    x: number;
    y: number;
}

let focusOffsetProvider: (() => FocusOffset) | null = null;

/** A page with a docked panel registers the screen space that focusing has to avoid. */
export const setFocusOffsetProvider = (provider: (() => FocusOffset) | null): void => {
    focusOffsetProvider = provider;
};

export const focusMapOnMarker = (map: LeafletMap, coordinates: LatLngExpression): void => {
    const currentZoom = map.getZoom();
    const targetZoom = currentZoom < MAP_VIEW.MARKER_FOCUS_MAX_ZOOM ? MAP_VIEW.MARKER_FOCUS_MAX_ZOOM : currentZoom;
    const offset = focusOffsetProvider?.();

    if (!offset || (offset.x === 0 && offset.y === 0)) {
        map.setView(coordinates, targetZoom, { animate: true });
        return;
    }

    // Centre on a shifted point, so the marker lands in the middle of what stays visible.
    const shifted = map.project(coordinates, targetZoom).add([offset.x, offset.y]);
    map.setView(map.unproject(shifted, targetZoom), targetZoom, { animate: true });
};

type TemporaryMapLayer = CircleMarker | Marker | Polyline;

// Module state, not per-map: only one interactive map is ever mounted per page, and both
// the walking radius and the geolocation result are single-selection by definition.
let walkingLayers: TemporaryMapLayer[] = [];
let geolocationLayers: TemporaryMapLayer[] = [];

const dropLayers = (map: LeafletMap, layers: TemporaryMapLayer[]): TemporaryMapLayer[] => {
    layers.forEach((layer) => map.removeLayer(layer));
    return [];
};

/** The user pin and the lines drawn to the nearest stops. */
export const clearGeolocationLayers = (map: LeafletMap): void => {
    geolocationLayers = dropLayers(map, geolocationLayers);
};

export const clearWalkingRadius = (map: LeafletMap): void => {
    walkingLayers = dropLayers(map, walkingLayers);
};

/** Everything a click or a locate request drew, e.g. when the map is reset. */
export const clearMapHighlights = (map: LeafletMap): void => {
    clearGeolocationLayers(map);
    clearWalkingRadius(map);
};

/** Hands the locate control's layers over so the next selection can clear them. */
export const trackGeolocationLayers = (layers: TemporaryMapLayer[]): void => {
    geolocationLayers = layers;
};

/** The ~5 minute walking circle. The owning layer styles the selected marker itself. */
export const showWalkingRadius = (L: LeafletNS, map: LeafletMap, coordinates: LatLngExpression): void => {
    clearMapHighlights(map);

    const circle5min = L.circle(coordinates, {
        radius: MAP_VIEW.WALKING_RADIUS_5MIN,
        color: '#4CAF50',
        fillColor: '#4CAF50',
        fillOpacity: 0.2,
        weight: 2,
        opacity: 0.7,
    });
    circle5min.addTo(map);

    const [lat, lng] = coordinates as [number, number];
    const radiusInDegrees = MAP_VIEW.WALKING_RADIUS_5MIN / 111320;
    const angleInRadians = -Math.PI / 4;
    const iconLat = lat + radiusInDegrees * Math.sin(angleInRadians);
    const iconLng = lng + radiusInDegrees * Math.cos(angleInRadians);

    const walkingIcon = L.divIcon({
        html: `<div class="walking-circle-icon">
             <i class="fas fa-walking"></i>
             <span>5min</span>
           </div>`,
        className: '',
        iconSize: [60, 28],
        iconAnchor: [30, 14],
    });

    const iconMarker = L.marker([iconLat, iconLng], {
        icon: walkingIcon,
        interactive: false,
    }).addTo(map);

    walkingLayers = [circle5min, iconMarker];
};

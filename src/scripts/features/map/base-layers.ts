// Tile layers shared by the homepage map and the line route maps.

import type { TileLayer } from 'leaflet';

type LeafletNS = typeof import('leaflet');

const OSM_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
    '&copy; <a href="https://carto.com/attribution">CARTO</a>';

/** Keyed by the base map ids in legend-config.json. */
export const buildBaseLayers = (L: LeafletNS): Record<string, TileLayer> => ({
    standard: L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
        attribution: OSM_ATTRIBUTION,
    }),
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: OSM_ATTRIBUTION,
        subdomains: 'abcd',
    }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: OSM_ATTRIBUTION,
        subdomains: 'abcd',
    }),
    satellite: L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye' },
    ),
});

export const isSiteDark = (): boolean => document.documentElement.getAttribute('data-theme') === 'dark';

/** Dark tiles in dark mode, but only for the theme-based styles. */
export const resolveThemedBaseLayer = (preferred: string): string =>
    isSiteDark() && (preferred === 'light' || preferred === 'dark') ? 'dark' : preferred;

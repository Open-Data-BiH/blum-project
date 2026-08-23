// The map embedded in the homepage section. The full-screen map page is transport-map.ts;
// both build on map-core.ts and map-layers.ts.

import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import { MapLegendControl } from '../../components/map-legend-control';
import { createTransitIndex } from '../../../lib/transit';
import { buildBaseLayers, resolveThemedBaseLayer } from './base-layers';
import { loadMapData, MAP_VIEW } from './map-core';
import {
    buildBusStopsLayer,
    createLocateControl,
    loadBikeStations,
    loadLandmarks,
    loadTransportHubs,
} from './map-layers';
import { createRouteOverlay } from './route-overlay';
import { createRoutePanel } from './route-panel';
import type { OverlayLayerId } from './types';

export const initMainMap = async (): Promise<void> => {
    const container = document.getElementById('map-container');
    if (!container) {
        return;
    }

    try {
        const [L, data] = await Promise.all([import('leaflet').then((mod) => mod.default), loadMapData()]);

        const transitIndex = createTransitIndex(data.network);
        const baseLayers = buildBaseLayers(L);
        const configDefault = data.legendConfig.baseMaps.find((base) => base.default)?.id ?? 'light';
        const defaultBase = resolveThemedBaseLayer(configDefault);

        container.replaceChildren();

        const map: LeafletMap = L.map('map-container', {
            center: MAP_VIEW.CENTER,
            zoom: MAP_VIEW.ZOOM,
            maxBounds: MAP_VIEW.BOUNDS,
            maxBoundsViscosity: 1.0,
            zoomControl: false,
            minZoom: MAP_VIEW.MIN_ZOOM,
            maxZoom: MAP_VIEW.MAX_ZOOM,
            layers: [baseLayers[defaultBase]],
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        const overlayGroups: Record<OverlayLayerId, LayerGroup> = {
            busStops: L.layerGroup(),
            trainStations: L.layerGroup(),
            mainBusStations: L.layerGroup(),
            airportShuttles: L.layerGroup(),
            touristBus: L.layerGroup(),
            bikeStations: L.layerGroup(),
            landmarks: L.layerGroup(),
        };

        const routeOverlay = createRouteOverlay(L, map, transitIndex);
        const routePanel = createRoutePanel(L, map, transitIndex, routeOverlay);

        const busStops = buildBusStopsLayer(L, map, transitIndex, {
            onRouteSelect: (routeId) => routePanel.open(routeId),
            timetables: data.timetables,
        });
        overlayGroups.busStops = busStops.layer;
        overlayGroups.busStops.addTo(map);

        loadTransportHubs(L, map, data.hubs, overlayGroups);
        loadBikeStations(L, map, data.bikeStations, overlayGroups.bikeStations);
        loadLandmarks(L, map, data.landmarks, overlayGroups.landmarks);

        const legend = new MapLegendControl(L, map, data.legendConfig, baseLayers, overlayGroups);
        legend.init();

        window.addEventListener('themeChanged', (event) => {
            const isDark = (event as CustomEvent<{ isDark?: boolean }>).detail?.isDark ?? false;
            legend.syncToTheme(isDark);
        });

        createLocateControl(L, map, busStops.getLayersForGeolocation);
    } catch (error) {
        console.error('Error initializing main map:', error);
        container.innerHTML = `
      <div class="map-error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load map. Please refresh the page to try again.</p>
      </div>
    `;
    }
};

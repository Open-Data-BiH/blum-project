// The full-screen map page. Same layers and data as the homepage map; the difference is
// that selections are shown in the page's own panel instead of Leaflet popups.

import type { Control, LayerGroup, Map as LeafletMap } from 'leaflet';
import { MapLegendControl } from '../../components/map-legend-control';
import { langText } from '../../core/i18n';
import { createTransitIndex } from '../../../lib/transit';
import { buildBaseLayers, resolveThemedBaseLayer } from './base-layers';
import { clearMapHighlights, loadMapData, MAP_VIEW, setFocusOffsetProvider } from './map-core';
import {
    buildBusStopsLayer,
    createLocateControl,
    loadBikeStations,
    loadLandmarks,
    loadTransportHubs,
    type BusStopsLayer,
} from './map-layers';
import { createMapPanel, type MapPanel } from './map-panel';
import { createRouteOverlay } from './route-overlay';
import type { OverlayLayerId } from './types';

type LeafletNS = typeof import('leaflet');

const DEFAULT_FIT_PADDING = { topLeft: [28, 28] as [number, number], bottomRight: [28, 28] as [number, number] };

/** Back to the initial view, with every selection dropped. */
const createResetControl = (L: LeafletNS, map: LeafletMap, onReset: () => void): Control => {
    const label = langText('Vrati početni prikaz mape', 'Reset the map view');

    const Reset = L.Control.extend({
        options: { position: 'bottomright' as const },
        onAdd() {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-app__control');
            const button = L.DomUtil.create('button', 'map-app__control-btn', container) as HTMLButtonElement;

            button.type = 'button';
            button.title = label;
            button.setAttribute('aria-label', label);
            button.innerHTML = '<i class="fas fa-arrows-rotate" aria-hidden="true"></i>';

            L.DomEvent.disableClickPropagation(container);
            button.addEventListener('click', onReset);

            return container;
        },
    });

    const control = new Reset();
    control.addTo(map);
    return control;
};

export const initTransportMap = async (): Promise<void> => {
    const root = document.querySelector<HTMLElement>('[data-transport-map]');
    const container = document.getElementById('transport-map');
    if (!root || !container) {
        return;
    }

    try {
        const [L, data] = await Promise.all([import('leaflet').then((mod) => mod.default), loadMapData()]);

        const index = createTransitIndex(data.network);
        const baseLayers = buildBaseLayers(L);
        const configDefault = data.legendConfig.baseMaps.find((base) => base.default)?.id ?? 'light';
        const defaultBase = resolveThemedBaseLayer(configDefault);

        container.replaceChildren();

        const map: LeafletMap = L.map(container, {
            center: MAP_VIEW.CENTER,
            zoom: MAP_VIEW.ZOOM,
            maxBounds: MAP_VIEW.BOUNDS,
            maxBoundsViscosity: 1.0,
            zoomControl: false,
            minZoom: MAP_VIEW.MIN_ZOOM,
            maxZoom: MAP_VIEW.MAX_ZOOM,
            layers: [baseLayers[defaultBase]],
        });

        // The control stack owns the bottom-right corner on this page.
        map.attributionControl.setPosition('bottomleft');

        let panel: MapPanel | null = null;
        let busStops: BusStopsLayer | null = null;
        const routeOverlay = createRouteOverlay(L, map, index, {
            maxZoom: 15,
            getFitPadding: () => panel?.getFitPadding() ?? DEFAULT_FIT_PADDING,
        });

        panel = createMapPanel({
            root,
            index,
            onRouteSelect: (routeId) => routeOverlay.show(routeId),
            onRouteClear: () => routeOverlay.clear(),
            onStopFocus: (stop) => busStops?.selectStop(stop),
        });
        const activePanel = panel;
        setFocusOffsetProvider(() => activePanel.getFocusOffset());

        busStops = buildBusStopsLayer(L, map, index, {
            onStopSelect: (stop) => activePanel.showStop(stop),
        });
        const activeBusStops = busStops;

        const overlayGroups: Record<OverlayLayerId, LayerGroup> = {
            busStops: activeBusStops.layer,
            trainStations: L.layerGroup(),
            mainBusStations: L.layerGroup(),
            airportShuttles: L.layerGroup(),
            touristBus: L.layerGroup(),
            bikeStations: L.layerGroup(),
            landmarks: L.layerGroup(),
        };
        overlayGroups.busStops.addTo(map);

        loadTransportHubs(L, map, data.hubs, overlayGroups);
        loadBikeStations(L, map, data.bikeStations, overlayGroups.bikeStations);
        loadLandmarks(L, map, data.landmarks, overlayGroups.landmarks);

        const legend = new MapLegendControl(L, map, data.legendConfig, baseLayers, overlayGroups);
        legend.init();

        createResetControl(L, map, () => {
            map.closePopup();
            clearMapHighlights(map);
            activeBusStops.clearSelection();
            activePanel.reset();
            map.setView(MAP_VIEW.CENTER, MAP_VIEW.ZOOM);
        });
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        createLocateControl(L, map, activeBusStops.getLayersForGeolocation);

        window.addEventListener('themeChanged', (event) => {
            const isDark = (event as CustomEvent<{ isDark?: boolean }>).detail?.isDark ?? false;
            legend.syncToTheme(isDark);
        });

        // The container is sized by flex, so its final height can land after Leaflet measured it.
        map.invalidateSize();
    } catch (error) {
        console.error('Error initializing the transport map:', error);
        container.innerHTML = `
      <div class="map-error">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <p>${langText('Mapa se nije mogla učitati. Osvježite stranicu i pokušajte ponovo.', 'The map could not be loaded. Refresh the page to try again.')}</p>
      </div>
    `;
    }
};

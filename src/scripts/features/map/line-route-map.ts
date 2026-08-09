// Route map on a line detail page: shared base layers and overlay, plus the direction
// buttons rendered by LineRouteMap.astro.

import { buildBaseLayers, resolveThemedBaseLayer } from './base-layers';
import { createRouteOverlay } from './route-overlay';
import { createTransitIndex } from '../../../lib/transit';
import { withBase } from '../../core/utils';
import type { TransitNetwork } from '../../../types/transit';

const MAP_BOUNDS: [[number, number], [number, number]] = [
    [44.67794605215712, 16.90471973252053],
    [44.996414749446565, 17.620029520676],
];
const MAP_CENTER: [number, number] = [44.7866, 17.1975];

export const initLineRouteMap = async (): Promise<void> => {
    const section = document.querySelector<HTMLElement>('[data-line-route-map]');
    const container = document.getElementById('line-route-map-container');
    if (!section || !container) {
        return;
    }

    const initialRouteId = section.dataset.defaultRoute;
    if (!initialRouteId) {
        return;
    }

    try {
        const [L, network] = await Promise.all([
            import('leaflet').then((mod) => mod.default),
            fetch(withBase('data/transport/routes/transit_network.json')).then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to load the transit network');
                }
                return response.json() as Promise<TransitNetwork>;
            }),
        ]);

        const index = createTransitIndex(network);
        const baseLayers = buildBaseLayers(L);
        const activeBase = resolveThemedBaseLayer('light');

        container.replaceChildren();

        // An initial view matters: without one the map is not "loaded", Leaflet defers
        // every layer's onAdd, and the first fitBounds runs against an unsized container.
        const map = L.map(container, {
            center: MAP_CENTER,
            zoom: 13,
            maxBounds: MAP_BOUNDS,
            maxBoundsViscosity: 1,
            zoomControl: false,
            minZoom: 11,
            maxZoom: 17,
            scrollWheelZoom: false,
            layers: [baseLayers[activeBase]],
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        const overlay = createRouteOverlay(L, map, index, { fitPadding: [30, 30], maxZoom: 15 });
        map.invalidateSize();
        overlay.show(initialRouteId);

        // One switcher drives the map and the stop list.
        const buttons = section.querySelectorAll<HTMLButtonElement>('[data-route-target]');
        const stopLists = section.querySelectorAll<HTMLElement>('[data-route-stops]');

        buttons.forEach((button) => {
            button.addEventListener('click', () => {
                const routeId = button.dataset.routeTarget;
                if (!routeId || routeId === overlay.getRouteId()) {
                    return;
                }

                overlay.show(routeId);

                buttons.forEach((other) => {
                    const isActive = other === button;
                    other.classList.toggle('is-active', isActive);
                    other.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                });

                stopLists.forEach((list) => {
                    const isActive = list.dataset.routeStops === routeId;
                    list.classList.toggle('is-hidden', !isActive);
                    list.hidden = !isActive;
                });
            });
        });

        window.addEventListener('themeChanged', (event) => {
            const isDark = (event as CustomEvent<{ isDark?: boolean }>).detail?.isDark ?? false;
            const next = isDark ? 'dark' : 'light';
            Object.entries(baseLayers).forEach(([id, layer]) => {
                if (id !== next && map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            });
            if (!map.hasLayer(baseLayers[next])) {
                baseLayers[next].addTo(map);
            }
        });
    } catch (error) {
        console.error('Error initializing line route map:', error);
        container.innerHTML = `
      <div class="map-error">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <p>Failed to load map. Please refresh the page to try again.</p>
      </div>
    `;
    }
};

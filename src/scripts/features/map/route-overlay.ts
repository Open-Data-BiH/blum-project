// Draws one route variant — its road geometry and ordered stops. Shared by the homepage
// map and the line detail maps.

import type { LatLngTuple, Layer, Map as LeafletMap } from 'leaflet';
import { getLineColor, getRouteStops, type TransitIndex } from '../../../lib/transit';
import { langText } from '../../core/i18n';
import { escapeHtml } from '../../core/utils';
import { loadRouteShape } from './route-shapes';

type LeafletNS = typeof import('leaflet');

/**
 * Two panes above Leaflet's marker pane (600). They must be separate: a pane's vector
 * container is a sibling of its markers, so a shared pane would draw the line over them.
 */
const LINE_PANE = 'transitRouteLinePane';
const STOP_PANE = 'transitRouteStopPane';
const PANE_Z_INDEX: Record<string, string> = { [LINE_PANE]: '640', [STOP_PANE]: '660' };

export interface RouteOverlay {
    /** Unknown ids clear the overlay. */
    show: (routeId: string) => void;
    clear: () => void;
    getRouteId: () => string | null;
}

export interface RouteOverlayOptions {
    fitPadding?: [number, number];
    maxZoom?: number;
}

// The colour rides in the markup: getElement() is null until the map has a view, so
// setting it afterwards left the first render on the fallback colour.
const createStopIcon = (L: LeafletNS, position: number, isTerminus: boolean, color: string) =>
    L.divIcon({
        html:
            `<span class="route-stop-marker__pin${isTerminus ? ' route-stop-marker__pin--terminus' : ''}"` +
            ` style="--route-color:${escapeHtml(color)}">${position}</span>`,
        className: 'route-stop-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });

const createStopPopup = (name: string, street: string | null, position: number, total: number): string => {
    const positionLabel = langText(`${position}. stajalište od ${total}`, `Stop ${position} of ${total}`);

    return `
        <div class="hub-popup hub-popup--route-stop">
            <span class="hub-popup__type-label">${escapeHtml(positionLabel)}</span>
            <h3>${escapeHtml(name)}</h3>
            ${street ? `<p>${escapeHtml(street)}</p>` : ''}
        </div>
    `;
};

export const createRouteOverlay = (
    L: LeafletNS,
    map: LeafletMap,
    index: TransitIndex,
    options: RouteOverlayOptions = {},
): RouteOverlay => {
    const { fitPadding = [40, 40], maxZoom = 16 } = options;

    [LINE_PANE, STOP_PANE].forEach((name) => {
        if (!map.getPane(name)) {
            map.createPane(name).style.zIndex = PANE_Z_INDEX[name];
        }
    });

    const layers: Layer[] = [];
    let activeRouteId: string | null = null;
    // Discards a geometry response that lands after another route was picked.
    let renderToken = 0;

    const removeLayers = (): void => {
        layers.forEach((layer) => map.removeLayer(layer));
        layers.length = 0;
    };

    const clear = (): void => {
        renderToken += 1;
        removeLayers();
        activeRouteId = null;
        map.getContainer().classList.remove('is-route-active');
    };

    const drawStops = (routeId: string, color: string): LatLngTuple[] => {
        const route = index.routeById.get(routeId);
        const stops = route ? getRouteStops(index, route) : [];

        stops.forEach(({ stop, position }) => {
            const isTerminus = position === 1 || position === stops.length;
            const marker = L.marker([stop.lat, stop.lon], {
                pane: STOP_PANE,
                icon: createStopIcon(L, position, isTerminus, color),
                keyboard: false,
                title: stop.name,
            })
                .bindPopup(() => createStopPopup(stop.name, stop.street, position, stops.length))
                .addTo(map);

            layers.push(marker);
        });

        return stops.map(({ stop }) => [stop.lat, stop.lon] as LatLngTuple);
    };

    const show = (routeId: string): void => {
        const route = index.routeById.get(routeId);
        if (!route) {
            clear();
            return;
        }

        renderToken += 1;
        const token = renderToken;
        removeLayers();

        activeRouteId = routeId;
        map.getContainer().classList.add('is-route-active');

        const color = getLineColor(index, route.lineId);
        const stopPoints = drawStops(routeId, color);

        if (stopPoints.length > 0) {
            map.fitBounds(L.latLngBounds(stopPoints), { padding: fitPadding, maxZoom });
        }

        if (!route.hasShape) {
            return;
        }

        loadRouteShape(routeId).then((shape) => {
            if (!shape || token !== renderToken) {
                return;
            }

            const casing = L.polyline(shape, {
                pane: LINE_PANE,
                color: '#ffffff',
                weight: 9,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                interactive: false,
            }).addTo(map);

            const line = L.polyline(shape, {
                pane: LINE_PANE,
                color,
                weight: 5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
                interactive: false,
            }).addTo(map);

            layers.push(casing, line);

            // Stops were already framed; refit silently so the late geometry does not jerk the view.
            map.fitBounds(L.latLngBounds(shape), { padding: fitPadding, maxZoom, animate: false });
        });
    };

    return { show, clear, getRouteId: () => activeRouteId };
};

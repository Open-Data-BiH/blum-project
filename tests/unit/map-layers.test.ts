import { describe, expect, it } from 'vitest';
import network from '../../public/data/transport/routes/transit_network.json';
import timetableFile from '../../public/data/transport/timetables/urban_timetables.json';
import { createTransitIndex, getTerminusStopIds } from '../../src/lib/transit';
import { MAP_VIEW } from '../../src/scripts/features/map/map-core';
import { buildBusStopsLayer, createStopPopupContent } from '../../src/scripts/features/map/map-layers';
import type { TimetableFile } from '../../src/types/timetable';
import type { TransitNetwork } from '../../src/types/transit';

interface FakeLayerRecord {
    latlng: [number, number];
    options: Record<string, unknown>;
}

const transit = network as TransitNetwork;
const index = createTransitIndex(transit);
const timetables = (timetableFile as TimetableFile).urban;

const createFakeMap = (zoom: number) => {
    const activeLayers = new Set<unknown>();
    const markers: FakeLayerRecord[] = [];
    const circles: FakeLayerRecord[] = [];
    const layerGroup = {
        hasLayer: (layer: unknown) => activeLayers.has(layer),
        removeLayer: (layer: unknown) => activeLayers.delete(layer),
    };

    const L = {
        layerGroup: () => layerGroup,
        divIcon: (options: Record<string, unknown>) => options,
        circle: () => {
            const circle = { addTo: () => circle };
            return circle;
        },
        marker(latlng: [number, number], options: Record<string, unknown>) {
            const marker = {
                addTo: () => {
                    activeLayers.add(marker);
                    markers.push({ latlng, options });
                    return marker;
                },
                bindPopup: () => marker,
                on: () => marker,
                setIcon: (icon: unknown) => {
                    options.icon = icon;
                },
            };
            return marker;
        },
        circleMarker(latlng: [number, number], options: Record<string, unknown>) {
            const circle = {
                addTo: () => {
                    activeLayers.add(circle);
                    circles.push({ latlng, options });
                    return circle;
                },
                bindPopup: () => circle,
                on: () => circle,
                setRadius: (radius: number) => {
                    options.radius = radius;
                },
                setStyle: (style: Record<string, unknown>) => {
                    Object.assign(options, style);
                },
            };
            return circle;
        },
    };

    const map = {
        getZoom: () => zoom,
        on: () => undefined,
        removeLayer: () => undefined,
        setView: () => undefined,
    };

    return { L, map, markers, circles };
};

const layerAt = (layers: FakeLayerRecord[], stopId: string): FakeLayerRecord => {
    const stop = index.stopById.get(stopId)!;
    return layers.find((layer) => layer.latlng[0] === stop.lat && layer.latlng[1] === stop.lon)!;
};

describe('terminus stop markers', () => {
    const terminusStopId = [...getTerminusStopIds(index)][0];

    it('keeps the bus pictogram and adds a distinct endpoint frame', () => {
        const fake = createFakeMap(MAP_VIEW.ZOOM_THRESHOLD);
        buildBusStopsLayer(fake.L as never, fake.map as never, index, { onStopSelect: () => undefined });

        const icon = layerAt(fake.markers, terminusStopId).options.icon as { html: string };
        expect(icon.html).toContain('fa-bus-simple');
        expect(icon.html).toContain('fa-icon-marker--terminus');
        expect(icon.html).not.toContain('fa-flag-checkered');
    });

    it('uses a larger dark-blue filled dot when the map is zoomed out', () => {
        const fake = createFakeMap(MAP_VIEW.ZOOM_THRESHOLD - 1);
        buildBusStopsLayer(fake.L as never, fake.map as never, index, { onStopSelect: () => undefined });

        const circle = layerAt(fake.circles, terminusStopId).options;
        expect(circle.color).toBe('#0e5287');
        expect(circle.weight).toBe(2);
        expect(circle.fillOpacity).toBe(0.82);
    });
});

describe('selected stop marker', () => {
    const regularStop = transit.stops.find((stop) => !getTerminusStopIds(index).has(stop.id))!;

    it('styles the actual bus marker instead of adding a separate centre ring', () => {
        const fake = createFakeMap(MAP_VIEW.ZOOM_THRESHOLD);
        const busStops = buildBusStopsLayer(fake.L as never, fake.map as never, index, {
            onStopSelect: () => undefined,
        });

        busStops.selectStop(regularStop);

        const icon = layerAt(fake.markers, regularStop.id).options.icon as { html: string };
        expect(icon.html).toContain('fa-icon-marker--selected');
        expect(icon.html).toContain('style="color:#fff;"');
        expect(
            fake.markers.filter(
                (marker) => marker.latlng[0] === regularStop.lat && marker.latlng[1] === regularStop.lon,
            ),
        ).toHaveLength(1);

        busStops.clearSelection();
        expect((layerAt(fake.markers, regularStop.id).options.icon as { html: string }).html).not.toContain(
            'fa-icon-marker--selected',
        );
    });

    it('uses a filled green circle for a selected stop below icon zoom', () => {
        const fake = createFakeMap(MAP_VIEW.ZOOM_THRESHOLD - 1);
        const busStops = buildBusStopsLayer(fake.L as never, fake.map as never, index, {
            onStopSelect: () => undefined,
        });

        busStops.selectStop(regularStop);

        const circle = layerAt(fake.circles, regularStop.id).options;
        expect(circle.fillColor).toBe('#16803c');
        expect(circle.fillOpacity).toBe(0.92);
    });
});

describe('bus stop popup', () => {
    it('renders automatic estimated arrivals with one stop-wide disclaimer', () => {
        const route = index.routeById.get('10-autobuska-stanica-obilicevo')!;
        const stop = index.stopById.get(route.stops[0].stopId)!;
        document.body.innerHTML = createStopPopupContent(index, stop, timetables, true, new Date(2026, 1, 2, 12, 0));

        expect(document.querySelector('.stop-arrivals__heading')?.textContent).toContain('Sljedeći dolasci');
        expect(document.querySelectorAll('.stop-arrivals__disclaimer')).toHaveLength(1);
        const routeRow = document.querySelector<HTMLElement>(`.stop-arrival[data-route-id="${route.id}"]`);
        expect(routeRow?.textContent).toMatch(/~\d{2}:\d{2}/);
        expect(routeRow?.textContent).toContain('Obilićevo');
        expect(routeRow?.textContent).not.toContain('→');
        const times = routeRow?.querySelectorAll('.stop-arrival__time') ?? [];
        expect(times).toHaveLength(2);
        expect(times[0].querySelector('.stop-arrival__time-label')?.textContent).toBe('Sljedeći');
        expect(times[1].classList.contains('stop-arrival__time--secondary')).toBe(true);
        expect(times[1].querySelector('.stop-arrival__time-label')?.textContent).toBe('Nakon toga');
    });

    it('links rows to line pages when route selection is unavailable', () => {
        const stop = transit.stops.find((entry) => entry.lines.includes('17'))!;
        document.body.innerHTML = createStopPopupContent(index, stop, timetables, false, new Date(2026, 1, 2, 12, 0));

        expect(document.querySelector('.stop-arrival[data-route-id]')).toBeNull();
        expect(document.querySelector<HTMLAnchorElement>('.stop-arrival')?.href).toContain('/linija/');
        expect(document.body.textContent).not.toMatch(/undefined|NaN|--:--/);
    });
});

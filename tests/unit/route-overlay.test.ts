import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import network from '../../public/data/transport/routes/transit_network.json';
import { createTransitIndex, getLineColor } from '../../src/lib/transit';
import { createRouteOverlay } from '../../src/scripts/features/map/route-overlay';
import type { RouteShape, TransitNetwork } from '../../src/types/transit';

const ROUTE_ID = '19-sargovac-centar';

const transit = network as TransitNetwork;
const index = createTransitIndex(transit);
const shape = JSON.parse(readFileSync(`public/data/transport/routes/shapes/${ROUTE_ID}.json`, 'utf8')) as RouteShape;

interface FakePolyline {
    points: RouteShape;
    options: Record<string, unknown>;
}

const createFakeLeaflet = () => {
    const polylines: FakePolyline[] = [];
    const markers: Array<{ latlng: [number, number]; options: Record<string, unknown> }> = [];
    const fitted: unknown[] = [];
    const panes = new Map<string, { style: Record<string, string> }>();
    const container = document.createElement('div');

    const L = {
        divIcon: (options: Record<string, unknown>) => options,
        marker(latlng: [number, number], options: Record<string, unknown>) {
            const marker = {
                latlng,
                options,
                bindPopup: () => marker,
                addTo: () => {
                    markers.push({ latlng, options });
                    return marker;
                },
                getElement: () => ({ style: { setProperty: () => undefined } }),
            };
            return marker;
        },
        polyline(points: RouteShape, options: Record<string, unknown>) {
            const line = {
                addTo: () => {
                    polylines.push({ points, options });
                    return line;
                },
            };
            return line;
        },
        latLngBounds: (points: unknown) => points,
    };

    const map = {
        getPane: (name: string) => panes.get(name),
        createPane: (name: string) => {
            const pane = { style: {} as Record<string, string> };
            panes.set(name, pane);
            return pane;
        },
        getContainer: () => container,
        fitBounds: (bounds: unknown) => fitted.push(bounds),
        removeLayer: () => undefined,
    };

    return { L, map, polylines, markers, fitted, panes, container };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const overlayFor = (fake: ReturnType<typeof createFakeLeaflet>) =>
    createRouteOverlay(fake.L as any, fake.map as any, index);

describe('route overlay', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string) => ({
                ok: url.includes(ROUTE_ID),
                status: url.includes(ROUTE_ID) ? 200 : 404,
                json: async () => shape,
            })),
        );
    });

    it('draws the published geometry, not a line through the stops', async () => {
        const fake = createFakeLeaflet();
        overlayFor(fake).show(ROUTE_ID);
        await vi.waitFor(() => expect(fake.polylines.length).toBe(2));

        const route = index.routeById.get(ROUTE_ID)!;
        const [casing, line] = fake.polylines;

        expect(line.points).toEqual(shape);
        expect(line.points.length).toBeGreaterThan(route.stops.length * 10);
        expect(line.options.color).toBe(getLineColor(index, route.lineId));
        expect(casing.options.weight).toBeGreaterThan(Number(line.options.weight));
    });

    it('renders one numbered marker per stop, above the line', async () => {
        const fake = createFakeLeaflet();
        overlayFor(fake).show(ROUTE_ID);
        await vi.waitFor(() => expect(fake.polylines.length).toBe(2));

        const route = index.routeById.get(ROUTE_ID)!;
        expect(fake.markers).toHaveLength(route.stops.length);

        const linePane = String(fake.polylines[0].options.pane);
        const stopPane = String(fake.markers[0].options.pane);
        expect(Number(fake.panes.get(stopPane)!.style.zIndex)).toBeGreaterThan(
            Number(fake.panes.get(linePane)!.style.zIndex),
        );
    });

    it('carries the line colour in the icon markup', async () => {
        // getElement() is null until the map has a view; setting it later rendered blue.
        const fake = createFakeLeaflet();
        overlayFor(fake).show(ROUTE_ID);

        const color = getLineColor(index, index.routeById.get(ROUTE_ID)!.lineId);
        const icon = fake.markers[0].options.icon as { html: string };
        expect(icon.html).toContain(`--route-color:${color}`);
    });

    it('uses the terminus marker treatment for route endpoints only', () => {
        const fake = createFakeLeaflet();
        overlayFor(fake).show(ROUTE_ID);

        const route = index.routeById.get(ROUTE_ID)!;
        const firstIcon = fake.markers[0].options.icon as { html: string };
        const middleIcon = fake.markers[1].options.icon as { html: string };
        const lastIcon = fake.markers[route.stops.length - 1].options.icon as { html: string };

        expect(firstIcon.html).toContain('route-stop-marker__pin--terminus');
        expect(middleIcon.html).not.toContain('route-stop-marker__pin--terminus');
        expect(lastIcon.html).toContain('route-stop-marker__pin--terminus');
    });

    it('marks the map while a route is shown and cleans up on clear', async () => {
        const fake = createFakeLeaflet();
        const overlay = overlayFor(fake);

        overlay.show(ROUTE_ID);
        expect(fake.container.classList.contains('is-route-active')).toBe(true);
        expect(overlay.getRouteId()).toBe(ROUTE_ID);

        overlay.clear();
        expect(fake.container.classList.contains('is-route-active')).toBe(false);
        expect(overlay.getRouteId()).toBeNull();
    });

    it('ignores geometry that arrives after another route was selected', async () => {
        const fake = createFakeLeaflet();
        const overlay = overlayFor(fake);

        overlay.show(ROUTE_ID);
        overlay.clear();
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(fake.polylines).toHaveLength(0);
    });
});

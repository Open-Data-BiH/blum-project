import { beforeEach, describe, expect, it, vi } from 'vitest';
import network from '../../public/data/transport/routes/transit_network.json';
import timetableFile from '../../public/data/transport/timetables/urban_timetables.json';
import { createTransitIndex, getLineColor, getRoutesForStop } from '../../src/lib/transit';
import { createMapPanel } from '../../src/scripts/features/map/map-panel';
import type { TimetableFile } from '../../src/types/timetable';
import type { TransitNetwork } from '../../src/types/transit';

const transit = network as TransitNetwork;
const index = createTransitIndex(transit);
const timetables = (timetableFile as TimetableFile).urban;
const fixedNow = (): Date => new Date(2026, 1, 2, 12, 0);
const linesWithRoutes = transit.lines.filter((line) => line.routes.length > 0);
const [firstLine] = linesWithRoutes;
const sampleStop = transit.stops.find((stop) => stop.name.length > 4)!;

/** Mirrors the markup TransportMap.astro renders. */
const mountPanel = (): HTMLElement => {
    document.body.innerHTML = `
        <div class="map-app" data-transport-map>
            <button type="button" data-panel-open aria-expanded="false"></button>
            <aside class="map-panel" data-map-panel>
                <div class="map-panel__head">
                    <input type="search" data-map-search />
                    <button type="button" data-panel-close></button>
                </div>
                <div class="map-panel__body" data-panel-body>
                    <section class="map-panel__view" data-view="browse">
                        <p data-search-empty hidden></p>
                        <div data-stop-group hidden><div data-stop-list></div></div>
                        <div data-line-group>
                            <div class="map-panel__list">
                                ${linesWithRoutes
                                    .map(
                                        (line) =>
                                            `<button type="button" class="map-line" data-line-id="${line.id}" data-route-id="${line.routes[0]}" data-search="${line.id.toLowerCase()} line ${line.id.toLowerCase()}"></button>`,
                                    )
                                    .join('')}
                            </div>
                        </div>
                    </section>
                    <section class="map-panel__view" data-view="detail" hidden></section>
                </div>
            </aside>
        </div>
    `;

    return document.querySelector<HTMLElement>('[data-transport-map]')!;
};

const settleSearch = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 200));

const type = async (root: HTMLElement, value: string): Promise<void> => {
    const input = root.querySelector<HTMLInputElement>('[data-map-search]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settleSearch();
};

describe('map panel', () => {
    let root: HTMLElement;
    let onRouteSelect: ReturnType<typeof vi.fn>;
    let onRouteClear: ReturnType<typeof vi.fn>;
    let onStopFocus: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        root = mountPanel();
        onRouteSelect = vi.fn();
        onRouteClear = vi.fn();
        onStopFocus = vi.fn();
        createMapPanel({ root, index, onRouteSelect, onRouteClear, onStopFocus, timetables, now: fixedNow });
    });

    it('filters the line list and finds stops by name', async () => {
        await type(root, firstLine.id);

        const visible = Array.from(root.querySelectorAll<HTMLElement>('[data-line-id]')).filter(
            (button) => !button.hidden,
        );
        expect(visible.map((button) => button.dataset.lineId)).toContain(firstLine.id);

        await type(root, sampleStop.name);
        const results = Array.from(root.querySelectorAll<HTMLElement>('[data-stop-list] [data-stop-id]'));
        expect(results.length).toBeGreaterThan(0);
        expect(results.some((button) => button.textContent?.includes(sampleStop.name))).toBe(true);
        expect(root.querySelector<HTMLElement>('[data-stop-group]')!.hidden).toBe(false);
    });

    it('reports that nothing matched', async () => {
        await type(root, 'zzzzz-nothing-here');

        expect(root.querySelector<HTMLElement>('[data-search-empty]')!.hidden).toBe(false);
        expect(root.querySelector<HTMLElement>('[data-line-group]')!.hidden).toBe(true);
    });

    it('draws the route of the picked line and returns to the list', () => {
        const browse = root.querySelector<HTMLElement>('[data-view="browse"]')!;
        const detail = root.querySelector<HTMLElement>('[data-view="detail"]')!;

        root.querySelector<HTMLButtonElement>(`[data-line-id="${firstLine.id}"]`)!.click();

        expect(onRouteSelect).toHaveBeenCalledWith(firstLine.routes[0]);
        expect(detail.hidden).toBe(false);
        expect(browse.hidden).toBe(true);
        expect(detail.querySelectorAll('[data-stop-id]').length).toBe(
            index.routeById.get(firstLine.routes[0])!.stops.length,
        );

        // The heading names the direction on screen, so only the other ones get a button.
        const directions = Array.from(detail.querySelectorAll<HTMLButtonElement>('.map-direction'));
        expect(directions).toHaveLength(firstLine.routes.length - 1);
        expect(directions.map((direction) => direction.dataset.routeId)).not.toContain(firstLine.routes[0]);
        directions.forEach((direction) => {
            const variant = index.routeById.get(direction.dataset.routeId!)!;
            expect(direction.querySelector('.route-relation__endpoint--origin')?.textContent).toContain(variant.origin);
            expect(direction.querySelector('.route-relation__endpoint--destination')?.textContent).toBe(
                variant.destination,
            );
            expect(direction.querySelector('.route-relation__arrow-icon')?.getAttribute('aria-hidden')).toBe('true');
            expect(direction.getAttribute('aria-label')).toContain(variant.origin);
            expect(direction.getAttribute('aria-label')).toContain(variant.destination);
        });

        detail.querySelector<HTMLButtonElement>('[data-panel-back]')!.click();
        expect(browse.hidden).toBe(false);
        expect(detail.hidden).toBe(true);
    });

    it('automatically opens a compact arrival row for every serving direction', () => {
        const stop = transit.stops.find((entry) => entry.lines.length > 1)!;
        const detail = root.querySelector<HTMLElement>('[data-view="detail"]')!;

        createMapPanel({
            root,
            index,
            onRouteSelect,
            onRouteClear,
            onStopFocus,
            timetables,
            now: fixedNow,
        }).showStop(stop);

        expect(onRouteClear).toHaveBeenCalled();
        expect(detail.querySelector('[data-detail-title]')?.textContent).toContain(stop.name);
        expect(detail.querySelector('.stop-arrivals__heading')?.textContent).toContain('Sljedeći dolasci');
        expect(detail.querySelectorAll('.stop-arrivals__disclaimer')).toHaveLength(1);

        const expectedRows = stop.lines.reduce(
            (total, lineId) => total + Math.max(1, getRoutesForStop(index, lineId, stop.id).length),
            0,
        );
        const rows = Array.from(detail.querySelectorAll<HTMLElement>('.stop-arrival'));
        expect(rows).toHaveLength(expectedRows);
        const badges = Array.from(detail.querySelectorAll<HTMLElement>('.stop-arrival__badge'));
        badges.forEach((badge) => {
            const lineId = badge.textContent?.trim() ?? '';
            expect(badge.closest<HTMLElement>('.stop-arrival')?.style.getPropertyValue('--line-accent')).toBe(
                getLineColor(index, lineId),
            );
        });
    });

    it('shows estimated clock times immediately and keeps route selection on the row', () => {
        const route = index.routeById.get('10-autobuska-stanica-obilicevo')!;
        const stop = index.stopById.get(route.stops[0].stopId)!;
        const panel = createMapPanel({
            root,
            index,
            onRouteSelect,
            onRouteClear,
            onStopFocus,
            timetables,
            now: fixedNow,
        });

        panel.showStop(stop);
        const row = root.querySelector<HTMLButtonElement>(`.stop-arrival[data-route-id="${route.id}"]`)!;
        expect(row).not.toBeNull();
        expect(row.textContent).toMatch(/~\d{2}:\d{2}/);

        row.click();
        expect(onRouteSelect).toHaveBeenCalledWith(route.id);
    });

    it('uses a meaningful fallback for a line without route data', () => {
        const stop = transit.stops.find((entry) =>
            entry.lines.some((lineId) => getRoutesForStop(index, lineId, entry.id).length === 0),
        )!;
        const panel = createMapPanel({
            root,
            index,
            onRouteSelect,
            onRouteClear,
            onStopFocus,
            timetables,
            now: fixedNow,
        });

        panel.showStop(stop);
        const fallback = Array.from(root.querySelectorAll<HTMLElement>('.stop-arrival')).find(
            (row) => !row.dataset.routeId,
        );
        expect(fallback?.textContent).toContain('Procjena trenutno nije dostupna');
        expect(fallback?.textContent).not.toMatch(/undefined|NaN|--:--/);
    });

    it('returns to search results when the query changes from a selected stop', async () => {
        const browse = root.querySelector<HTMLElement>('[data-view="browse"]')!;
        const detail = root.querySelector<HTMLElement>('[data-view="detail"]')!;

        await type(root, sampleStop.name);
        root.querySelector<HTMLButtonElement>(`[data-stop-id="${sampleStop.id}"]`)!.click();
        expect(detail.hidden).toBe(false);
        expect(onRouteClear).toHaveBeenCalledOnce();
        expect(onStopFocus).toHaveBeenCalledWith(sampleStop);
        expect(onRouteClear.mock.invocationCallOrder[0]).toBeLessThan(onStopFocus.mock.invocationCallOrder[0]);

        await type(root, '');
        await type(root, 'zzzzz-nothing-here');

        expect(browse.hidden).toBe(false);
        expect(detail.hidden).toBe(true);
        expect(root.querySelector<HTMLElement>('[data-search-empty]')!.hidden).toBe(false);
    });

    it('clears the selection on reset', () => {
        const panel = createMapPanel({
            root,
            index,
            onRouteSelect,
            onRouteClear,
            onStopFocus,
            timetables,
            now: fixedNow,
        });
        panel.showStop(sampleStop);
        panel.reset();

        expect(onRouteClear).toHaveBeenCalled();
        expect(root.querySelector<HTMLElement>('[data-view="browse"]')!.hidden).toBe(false);
        expect(root.querySelector<HTMLInputElement>('[data-map-search]')!.value).toBe('');
    });
});

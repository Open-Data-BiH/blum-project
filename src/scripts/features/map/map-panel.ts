// The one overlay of the map page. It browses lines, searches stops, and shows whatever is
// selected — a docked panel on desktop, a bottom sheet on phones. It renders and emits;
// transport-map.ts decides what the map does with the selection.

import { getCurrentLanguage, langText } from '../../core/i18n';
import { renderRouteRelation } from '../../core/route-relation';
import { debounce, escapeHtml, normalizeForSearch, withBase } from '../../core/utils';
import { formatSpokenRouteRelation } from '../../../lib/route-relation';
import { getLineDetailPath } from '../../../lib/site-config';
import {
    compareLineIds,
    formatRelation,
    getLineColor,
    getLineRoutes,
    getRouteStops,
    type TransitIndex,
} from '../../../lib/transit';
import type { TimetableEntry } from '../../../types/timetable';
import type { TransitRoute, TransitStop } from '../../../types/transit';
import { lineAccentStyle, type FocusOffset } from './map-core';
import { renderStopArrivals } from './stop-arrivals-view';

const DESKTOP_QUERY = '(min-width: 900px)';
const MAX_STOP_RESULTS = 8;
/** Keeps the fitted route clear of the panel and the floating controls. */
const FIT_MARGIN = 28;

export interface MapPanelOptions {
    root: HTMLElement;
    index: TransitIndex;
    onRouteSelect: (routeId: string) => void;
    onRouteClear: () => void;
    onStopFocus: (stop: TransitStop) => void;
    timetables: TimetableEntry[];
    now?: () => Date;
}

export interface MapPanel {
    showStop: (stop: TransitStop) => void;
    showBrowse: () => void;
    reset: () => void;
    getFitPadding: () => { topLeft: [number, number]; bottomRight: [number, number] };
    /** How far to move a focused marker so the panel does not cover it. */
    getFocusOffset: () => FocusOffset;
}

export const createMapPanel = ({
    root,
    index,
    onRouteSelect,
    onRouteClear,
    onStopFocus,
    timetables,
    now = () => new Date(),
}: MapPanelOptions): MapPanel => {
    const panel = root.querySelector<HTMLElement>('[data-map-panel]');
    const trigger = root.querySelector<HTMLButtonElement>('[data-panel-open]');
    const body = root.querySelector<HTMLElement>('[data-panel-body]');
    const browseView = root.querySelector<HTMLElement>('[data-view="browse"]');
    const detailView = root.querySelector<HTMLElement>('[data-view="detail"]');
    const searchInput = root.querySelector<HTMLInputElement>('[data-map-search]');
    const lineGroup = root.querySelector<HTMLElement>('[data-line-group]');
    const stopGroup = root.querySelector<HTMLElement>('[data-stop-group]');
    const stopList = root.querySelector<HTMLElement>('[data-stop-list]');
    const emptyMessage = root.querySelector<HTMLElement>('[data-search-empty]');

    if (!panel || !body || !browseView || !detailView) {
        throw new Error('The map panel markup is incomplete');
    }

    const lineButtons = Array.from(lineGroup?.querySelectorAll<HTMLElement>('[data-search]') ?? []);
    const lineFactsById = new Map(
        lineButtons.map((button) => [
            button.dataset.lineId ?? '',
            { operator: button.dataset.operator ?? '', accessible: button.dataset.accessible === 'true' },
        ]),
    );
    // Normalised once: the same 392 stops are searched on every keystroke.
    const searchableStops = index.network.stops.map((stop) => ({
        stop,
        text: normalizeForSearch(`${stop.name} ${stop.street ?? ''}`),
    }));

    const desktopQuery = window.matchMedia(DESKTOP_QUERY);
    let isOpen = desktopQuery.matches;

    const lineDetailHref = (lineId: string): string =>
        withBase(getLineDetailPath(getCurrentLanguage() === 'en' ? 'en' : 'bhs', lineId));

    // Both classes, because the resting state differs per breakpoint: the sheet is closed
    // until asked for, the docked panel is open until dismissed.
    const setOpen = (next: boolean): void => {
        isOpen = next;
        root.classList.toggle('is-panel-open', next);
        root.classList.toggle('is-panel-closed', !next);
        trigger?.setAttribute('aria-expanded', String(next));
    };

    // The floating map controls sit above the sheet, whose height follows its content.
    const trackSheetHeight = (): void =>
        root.style.setProperty('--map-sheet-height', `${Math.round(panel.getBoundingClientRect().height)}px`);

    const focusDetailTitle = (): void => {
        detailView.querySelector<HTMLElement>('[data-detail-title]')?.focus({ preventScroll: true });
    };

    const setView = (view: 'browse' | 'detail'): void => {
        browseView.hidden = view !== 'browse';
        detailView.hidden = view !== 'detail';
        body.scrollTop = 0;
    };

    const showBrowse = (): void => {
        detailView.replaceChildren();
        delete panel.dataset.detailType;
        setView('browse');
    };

    const renderStopResults = (stops: TransitStop[]): void => {
        if (!stopList) {
            return;
        }

        stopList.replaceChildren(
            ...stops.map((stop) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'map-stop';
                button.dataset.stopId = stop.id;

                const icon = document.createElement('i');
                icon.className = 'fas fa-bus-simple map-stop__icon';
                icon.setAttribute('aria-hidden', 'true');

                const text = document.createElement('span');
                text.className = 'map-stop__text';

                const name = document.createElement('span');
                name.className = 'map-stop__name';
                name.textContent = stop.name;
                text.appendChild(name);

                const details = [stop.street, [...stop.lines].sort(compareLineIds).join(', ')].filter(Boolean);
                if (details.length > 0) {
                    const meta = document.createElement('span');
                    meta.className = 'map-stop__meta';
                    meta.textContent = details.join(' · ');
                    text.appendChild(meta);
                }

                button.append(icon, text);
                return button;
            }),
        );
    };

    const applySearch = (rawQuery: string): void => {
        const query = normalizeForSearch(rawQuery);

        let visibleLines = 0;
        lineButtons.forEach((button) => {
            const matches = query === '' || (button.dataset.search ?? '').includes(query);
            button.hidden = !matches;
            if (matches) {
                visibleLines += 1;
            }
        });
        if (lineGroup) {
            lineGroup.hidden = visibleLines === 0;
        }

        const matchedStops =
            query === ''
                ? []
                : searchableStops
                      .filter((entry) => entry.text.includes(query))
                      .slice(0, MAX_STOP_RESULTS)
                      .map((entry) => entry.stop);

        renderStopResults(matchedStops);
        if (stopGroup) {
            stopGroup.hidden = matchedStops.length === 0;
        }
        if (emptyMessage) {
            emptyMessage.hidden = visibleLines > 0 || matchedStops.length > 0;
        }
    };

    const renderLineFacts = (lineId: string, stopCount: number): string => {
        const facts = lineFactsById.get(lineId);
        const stopsLabel = langText(`${stopCount} stajališta`, `${stopCount} stops`);
        // Short enough for the panel; the full wording stays in the tooltip.
        const accessLabel = facts?.accessible
            ? langText('Pristupačno', 'Accessible')
            : langText('Nije pristupačno', 'Not accessible');
        const accessTitle = facts?.accessible
            ? langText('Pristupačno za invalidska kolica', 'Wheelchair accessible')
            : langText('Nije pristupačno za invalidska kolica', 'Not wheelchair accessible');

        return `<ul class="map-detail__facts">
            ${
                facts?.operator
                    ? `<li class="map-fact">
                        <i class="fas fa-bus-simple" aria-hidden="true"></i>
                        <span class="map-fact__label">${escapeHtml(langText('Prevoznik', 'Operator'))}:</span>
                        ${escapeHtml(facts.operator)}
                       </li>`
                    : ''
            }
            <li class="map-fact">
                <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
                ${escapeHtml(stopsLabel)}
            </li>
            <li class="map-fact map-fact--${facts?.accessible ? 'accessible' : 'not-accessible'}" title="${escapeHtml(accessTitle)}">
                <i class="fas fa-wheelchair" aria-hidden="true"></i>
                ${escapeHtml(accessLabel)}
            </li>
        </ul>`;
    };

    const backButton = (): string =>
        `<div class="map-detail__topbar">
            <button type="button" class="map-panel__back" data-panel-back>
                <i class="fas fa-arrow-left" aria-hidden="true"></i>
                ${escapeHtml(langText('Sve linije', 'All lines'))}
            </button>
        </div>`;

    const showStop = (stop: TransitStop): void => {
        // A selected network stop belongs to the base stop layer. Drop any route overlay
        // first so its dimming rule cannot hide the selected marker state.
        onRouteClear();

        detailView.innerHTML = `
            ${backButton()}
            <p class="map-detail__eyebrow">${escapeHtml(langText('Autobusko stajalište', 'Bus stop'))}</p>
            <h2 class="map-detail__title" tabindex="-1" data-detail-title>${escapeHtml(stop.name)}</h2>
            ${stop.street ? `<p class="map-detail__meta">${escapeHtml(stop.street)}</p>` : ''}
            ${renderStopArrivals({
                index,
                timetables,
                stop,
                language: getCurrentLanguage(),
                getLineHref: lineDetailHref,
                now: now(),
            })}
        `;

        panel.dataset.detailType = 'stop';
        setOpen(true);
        setView('detail');
        focusDetailTitle();
    };

    const showRoute = (routeId: string): void => {
        const route = index.routeById.get(routeId);
        if (!route) {
            return;
        }

        const variants = getLineRoutes(index, route.lineId);
        const stops = getRouteStops(index, route);
        const color = getLineColor(index, route.lineId);
        const relationLabels = {
            toLabel: langText('prema', 'to'),
            viaLabel: langText('preko', 'via'),
        };

        // Line 14 runs the same relation both ways, so the relation alone cannot say which
        // direction is on screen — number them instead.
        const directionPrefix = (candidate: TransitRoute, position: number): string =>
            variants.some((other) => other.id !== candidate.id && formatRelation(other) === formatRelation(candidate))
                ? `${langText('Smjer', 'Direction')} ${position + 1}: `
                : '';

        // The title already names the direction on screen, so only the others are offered.
        const otherVariants = variants
            .map((variant, position) => ({ variant, position }))
            .filter(({ variant }) => variant.id !== route.id);

        const titlePrefix = directionPrefix(
            route,
            variants.findIndex((variant) => variant.id === route.id),
        );
        const switchLabel = langText('Prikaži suprotan smjer', 'Show the opposite direction');
        const directions =
            otherVariants.length > 0
                ? `<div class="map-detail__directions" style="${lineAccentStyle(color)}">
                    ${otherVariants
                        .map(({ variant, position }) => {
                            const prefix = directionPrefix(variant, position);
                            const label = `${prefix}${formatRelation(variant)}`;
                            const parts = {
                                origin: `${prefix}${variant.origin}`,
                                destination: variant.destination,
                                via: [],
                            };
                            const spokenLabel = formatSpokenRouteRelation(label, relationLabels, parts);
                            return `<button type="button" class="map-direction map-direction--switch" data-route-id="${escapeHtml(variant.id)}" title="${escapeHtml(switchLabel)}" aria-label="${escapeHtml(`${switchLabel}: ${spokenLabel}`)}">
                                <i class="fas fa-right-left map-direction__icon" aria-hidden="true"></i>
                                <span>${renderRouteRelation(label, {
                                    ...relationLabels,
                                    parts,
                                })}</span>
                            </button>`;
                        })
                        .join('')}
                   </div>`
                : '';

        // Explain why stops are listed without a road path.
        const pathNote = route.hasShape
            ? ''
            : `<p class="map-detail__note">${escapeHtml(
                  langText(
                      'Trasa puta nije dostupna — prikazana su stajališta u redoslijedu vožnje.',
                      'The road path is unavailable — stops are shown in travel order.',
                  ),
              )}</p>`;

        detailView.innerHTML = `
            ${backButton()}
            <div class="map-detail__head" style="${lineAccentStyle(color)}">
                <span class="map-badge map-badge--static">${escapeHtml(route.lineId)}</span>
                <h2 class="map-detail__title" tabindex="-1" data-detail-title>${renderRouteRelation(
                    `${titlePrefix}${formatRelation(route)}`,
                    {
                        ...relationLabels,
                        parts: { origin: `${titlePrefix}${route.origin}`, destination: route.destination, via: [] },
                    },
                )}</h2>
            </div>
            ${renderLineFacts(route.lineId, stops.length)}
            ${pathNote}
            ${directions}
            <ol class="map-route-stops" style="${lineAccentStyle(color)}">
                ${stops
                    .map(
                        ({ stop }) =>
                            `<li><button type="button" class="map-route-stops__item" data-stop-id="${escapeHtml(stop.id)}">${escapeHtml(stop.name)}</button></li>`,
                    )
                    .join('')}
            </ol>
            <a class="map-detail__link" href="${escapeHtml(lineDetailHref(route.lineId))}">
                <i class="fas fa-clock" aria-hidden="true"></i>
                ${escapeHtml(langText(`Red vožnje linije ${route.lineId}`, `Timetable for line ${route.lineId}`))}
            </a>
        `;

        panel.dataset.detailType = 'route';
        setOpen(true);
        setView('detail');
        focusDetailTitle();
        onRouteSelect(route.id);
    };

    const reset = (): void => {
        if (searchInput) {
            searchInput.value = '';
        }
        applySearch('');
        showBrowse();
        onRouteClear();
        if (!desktopQuery.matches) {
            setOpen(false);
        }
    };

    root.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target) {
            return;
        }

        if (target.closest('[data-panel-open]')) {
            setOpen(true);
            searchInput?.focus();
            return;
        }

        if (target.closest('[data-panel-close]')) {
            setOpen(false);
            trigger?.focus();
            return;
        }

        if (target.closest('[data-panel-back]')) {
            showBrowse();
            searchInput?.focus();
            return;
        }

        const routeTarget = target.closest<HTMLElement>('[data-route-id]');
        if (routeTarget?.dataset.routeId) {
            event.preventDefault();
            showRoute(routeTarget.dataset.routeId);
            return;
        }

        const stopTarget = target.closest<HTMLElement>('[data-stop-id]');
        if (stopTarget?.dataset.stopId) {
            const stop = index.stopById.get(stopTarget.dataset.stopId);
            if (stop) {
                showStop(stop);
                onStopFocus(stop);
            }
        }
    });

    const search = debounce(() => applySearch(searchInput?.value ?? ''), 120);
    const resumeSearch = (): void => {
        // The input stays visible while a stop detail is open. Returning to the browse view
        // here makes a new query useful immediately instead of filtering a hidden list.
        if (!detailView.hidden) {
            showBrowse();
        }
        search();
    };

    searchInput?.addEventListener('input', resumeSearch);
    // Browser-provided clear controls on search inputs can emit `search` without `input`.
    searchInput?.addEventListener('search', resumeSearch);

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        if (!detailView.hidden) {
            showBrowse();
            searchInput?.focus();
        } else if (isOpen && !desktopQuery.matches) {
            setOpen(false);
            trigger?.focus();
        }
    });

    // The panel is part of the layout on desktop and an overlay on phones, so the default
    // state follows the breakpoint rather than whatever the reader last did.
    desktopQuery.addEventListener('change', (event) => setOpen(event.matches));

    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(trackSheetHeight).observe(panel);
    }

    setOpen(isOpen);
    trackSheetHeight();

    return {
        showStop,
        showBrowse,
        reset,
        getFitPadding: () => {
            if (!isOpen) {
                return { topLeft: [FIT_MARGIN, FIT_MARGIN], bottomRight: [FIT_MARGIN, FIT_MARGIN] };
            }

            const rect = panel.getBoundingClientRect();
            return desktopQuery.matches
                ? {
                      topLeft: [Math.round(rect.width) + FIT_MARGIN, FIT_MARGIN],
                      bottomRight: [FIT_MARGIN, FIT_MARGIN],
                  }
                : {
                      topLeft: [FIT_MARGIN, FIT_MARGIN],
                      bottomRight: [FIT_MARGIN, Math.round(rect.height) + FIT_MARGIN],
                  };
        },
        getFocusOffset: () => {
            if (!isOpen) {
                return { x: 0, y: 0 };
            }

            const rect = panel.getBoundingClientRect();
            // Docked on the left: move the centre left, so the marker clears the panel.
            // A bottom sheet: move it down, so the marker rises above the sheet.
            return desktopQuery.matches
                ? { x: -Math.round((rect.right - root.getBoundingClientRect().left) / 2), y: 0 }
                : { x: 0, y: Math.round(rect.height / 2) };
        },
    };
};

import type { Map as LeafletMap } from 'leaflet';
import { formatSpokenRouteRelation } from '../../../lib/route-relation';
import { formatRelation, getLineColor, getLineRoutes, type TransitIndex } from '../../../lib/transit';
import { getLineDetailPath } from '../../../lib/site-config';
import { getCurrentLanguage, langText } from '../../core/i18n';
import { renderRouteRelation } from '../../core/route-relation';
import { escapeHtml, withBase } from '../../core/utils';
import type { RouteOverlay } from './route-overlay';

type LeafletNS = typeof import('leaflet');

export interface RoutePanel {
    open: (routeId: string) => void;
    close: () => void;
}

export const createRoutePanel = (
    L: LeafletNS,
    map: LeafletMap,
    index: TransitIndex,
    overlay: RouteOverlay,
): RoutePanel => {
    let container: HTMLElement | null = null;
    let activeRouteId: string | null = null;

    const render = (): void => {
        if (!container) {
            return;
        }

        const route = activeRouteId ? index.routeById.get(activeRouteId) : null;
        if (!route) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        container.hidden = false;

        const variants = getLineRoutes(index, route.lineId);
        const color = getLineColor(index, route.lineId);
        const stopCount = route.stops.length;
        const stopsLabel = langText(`${stopCount} stajališta`, `${stopCount} stops`);
        const relationLabels = {
            toLabel: langText('prema', 'to'),
            viaLabel: langText('preko', 'via'),
        };
        // Explain why stops are shown without a road path.
        const pathNote = route.hasShape
            ? ''
            : `<p class="map-route-panel__note">${escapeHtml(
                  langText(
                      'Trasa puta nije dostupna — prikazana su stajališta u redoslijedu vožnje.',
                      'The road path is unavailable — stops are shown in travel order.',
                  ),
              )}</p>`;

        const variantButtons =
            variants.length > 1
                ? `<div class="map-route-panel__variants" role="group" aria-label="${escapeHtml(
                      langText('Smjerovi linije', 'Line directions'),
                  )}">
                    ${variants
                        .map((variant, variantIndex) => {
                            const isActive = variant.id === route.id;
                            // Line 14 runs the same relation both ways.
                            const ambiguous = variants.some(
                                (other) => other.id !== variant.id && formatRelation(other) === formatRelation(variant),
                            );
                            const prefix = ambiguous ? `${langText('Smjer', 'Direction')} ${variantIndex + 1}: ` : '';
                            const label = `${prefix}${formatRelation(variant)}`;
                            const parts = {
                                origin: `${prefix}${variant.origin}`,
                                destination: variant.destination,
                                via: [],
                            };
                            return [
                                `<button type="button" class="map-route-panel__variant${isActive ? ' is-active' : ''}"`,
                                ` data-route-target="${escapeHtml(variant.id)}"`,
                                ` aria-pressed="${isActive}" aria-label="${escapeHtml(formatSpokenRouteRelation(label, relationLabels, parts))}">`,
                                renderRouteRelation(label, {
                                    ...relationLabels,
                                    parts,
                                }),
                                '</button>',
                            ].join('');
                        })
                        .join('')}
                   </div>`
                : '';

        const timetableHref = withBase(getLineDetailPath(getCurrentLanguage() === 'en' ? 'en' : 'bhs', route.lineId));
        const closeLabel = langText('Zatvori prikaz trase', 'Close route view');

        container.innerHTML = `
            <div class="map-route-panel" style="--line-accent:${escapeHtml(color)}">
                <div class="map-route-panel__head">
                    <span class="map-route-panel__line">${escapeHtml(route.lineId)}</span>
                    ${renderRouteRelation(formatRelation(route), {
                        ...relationLabels,
                        className: 'map-route-panel__relation',
                        parts: { origin: route.origin, destination: route.destination, via: [] },
                    })}
                    <button type="button" class="map-route-panel__close" data-route-close
                            title="${escapeHtml(closeLabel)}" aria-label="${escapeHtml(closeLabel)}">
                        <i class="fas fa-xmark" aria-hidden="true"></i>
                    </button>
                </div>
                <p class="map-route-panel__meta">${escapeHtml(stopsLabel)}</p>
                ${pathNote}
                ${variantButtons}
                <a class="map-route-panel__link" href="${escapeHtml(timetableHref)}">
                    <i class="fas fa-clock" aria-hidden="true"></i>
                    ${escapeHtml(langText(`Red vožnje linije ${route.lineId}`, `Timetable for line ${route.lineId}`))}
                </a>
            </div>
        `;
    };

    const open = (routeId: string): void => {
        activeRouteId = routeId;
        overlay.show(routeId);
        render();
    };

    const close = (): void => {
        activeRouteId = null;
        overlay.clear();
        render();
    };

    const Panel = L.Control.extend({
        options: { position: 'topleft' as const },
        onAdd() {
            container = L.DomUtil.create('div', 'map-route-panel-control');
            container.hidden = true;
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            container.addEventListener('click', (event) => {
                const target = event.target instanceof Element ? event.target : null;

                if (target?.closest('[data-route-close]')) {
                    event.preventDefault();
                    close();
                    return;
                }

                const variant = target?.closest<HTMLElement>('[data-route-target]');
                if (variant?.dataset.routeTarget) {
                    event.preventDefault();
                    open(variant.dataset.routeTarget);
                }
            });

            return container;
        },
    });

    new Panel().addTo(map);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && activeRouteId) {
            close();
        }
    });

    document.addEventListener('languageChanged', () => render());

    return { open, close };
};

// The layers and the locate control both the homepage map and the map page put on Leaflet.

import type {
    CircleMarker,
    Control,
    ControlPosition,
    LatLngExpression,
    LayerGroup,
    Map as LeafletMap,
    Marker,
    Polyline,
} from 'leaflet';
import { getCurrentLanguage, langText } from '../../core/i18n';
import { debounce, escapeHtml, withBase } from '../../core/utils';
import { getLineDetailPath } from '../../../lib/site-config';
import { getTerminusStopIds, type TransitIndex } from '../../../lib/transit';
import type { TimetableEntry } from '../../../types/timetable';
import type { TransitStop } from '../../../types/transit';
import {
    clearMapHighlights,
    createFontAwesomeIcon,
    focusMapOnMarker,
    MAP_NOTIFICATION_MESSAGES,
    MAP_VIEW,
    showMapNotification,
    showWalkingRadius,
    trackGeolocationLayers,
} from './map-core';
import { renderStopArrivals } from './stop-arrivals-view';
import { GeolocationService } from './geolocation';
import {
    createBikeStationPopup,
    createLandmarkPopup,
    createMainBusStationPopup,
    createNearestStopsPopup,
    createShuttlePopup,
    createTerminalBusStationPopup,
    createTouristBusPopup,
    createTrainStationPopup,
} from './popups';
import type { BikeStation, Landmark, OverlayLayerId, TransportHub } from './types';

type LeafletNS = typeof import('leaflet');

const geoService = new GeolocationService();
const TERMINUS_ACCENT_COLOR = '#0e5287';
const SELECTED_STOP_COLOR = '#16803c';

const createBusStopIcon = (L: LeafletNS, isTerminus: boolean, isSelected: boolean) =>
    L.divIcon({
        html: `<i class="fa-solid fa-bus-simple fa-icon-marker${isTerminus ? ' fa-icon-marker--terminus' : ''}${isSelected ? ' fa-icon-marker--selected' : ''}" style="color:${isSelected ? '#fff' : isTerminus ? TERMINUS_ACCENT_COLOR : '#72aaff'};" aria-hidden="true"></i>`,
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });

export interface BusStopsLayer {
    layer: LayerGroup;
    /** Only what is currently drawn — the nearest-stop search needs real positions. */
    getLayersForGeolocation: () => Array<Marker | CircleMarker>;
    /** Selects the real stop marker, then focuses it and draws its walking radius. */
    selectStop: (stop: TransitStop) => void;
    clearSelection: () => void;
}

export interface BusStopsLayerOptions {
    /** A line badge in the built-in popup opens this route. */
    onRouteSelect?: (routeId: string) => void;
    /** Replaces the built-in popup: the map page shows the stop in its own panel. */
    onStopSelect?: (stop: TransitStop) => void;
    /** Static schedules used to calculate stop-level estimates in the built-in popup. */
    timetables?: TimetableEntry[];
    now?: () => Date;
}

const renderStopAmenities = (stop: TransitStop): string => {
    const amenities: [keyof NonNullable<TransitStop['amenities']>, string, string][] = [
        ['shelter', 'Nadstrešnica', 'Shelter'],
        ['bench', 'Klupa', 'Bench'],
        ['lit', 'Osvijetljeno', 'Lit'],
        ['departuresBoard', 'Red vožnje', 'Timetable'],
    ];

    const present = amenities.filter(([key]) => stop.amenities?.[key]);
    if (present.length === 0) {
        return '';
    }

    const items = present
        .map(([, bhs, en]) => `<li class="hub-popup__amenity">${escapeHtml(langText(bhs, en))}</li>`)
        .join('');

    return `<ul class="hub-popup__amenities">${items}</ul>`;
};

export const createStopPopupContent = (
    index: TransitIndex,
    stop: TransitStop,
    timetables: TimetableEntry[],
    canSelectRoute: boolean,
    now: Date = new Date(),
): string => {
    const language = getCurrentLanguage();
    const stopTypeLabel = escapeHtml(langText('Autobusko stajalište', 'Bus stop'));
    const lineDetailHref = (lineId: string): string => withBase(getLineDetailPath(language, lineId));

    return `
        <div class="hub-popup hub-popup--bus-stop">
            <span class="hub-popup__type-label">${stopTypeLabel}</span>
            <h3>${escapeHtml(stop.name)}</h3>
            ${stop.street ? `<p class="hub-popup__street">${escapeHtml(stop.street)}</p>` : ''}
            ${renderStopAmenities(stop)}
            ${renderStopArrivals({
                index,
                timetables,
                stop,
                language,
                getLineHref: lineDetailHref,
                now,
                canSelectRoute,
            })}
        </div>
    `;
};

/**
 * Every stop in the network, drawn as a dot when zoomed out and as a bus icon when zoomed
 * in. Both representations are built once per stop and reused across zoom changes.
 */
export const buildBusStopsLayer = (
    L: LeafletNS,
    map: LeafletMap,
    index: TransitIndex,
    options: BusStopsLayerOptions = {},
): BusStopsLayer => {
    const { onRouteSelect, onStopSelect, timetables = [], now = () => new Date() } = options;
    const layer = L.layerGroup();
    const stops = index.network.stops;
    const terminusStopIds = getTerminusStopIds(index);
    let selectedStopId: string | null = null;

    const busStopMarkers = new Map<string, Marker>();
    const busStopCircles = new Map<string, CircleMarker>();
    // These four immutable icons cover the two independent marker states.
    const busStopIcons = {
        regular: createBusStopIcon(L, false, false),
        terminus: createBusStopIcon(L, true, false),
        selected: createBusStopIcon(L, false, true),
        selectedTerminus: createBusStopIcon(L, true, true),
    };

    const getBusStopIcon = (isTerminus: boolean, isSelected: boolean) => {
        if (isSelected) {
            return isTerminus ? busStopIcons.selectedTerminus : busStopIcons.selected;
        }
        return isTerminus ? busStopIcons.terminus : busStopIcons.regular;
    };

    const getLayersForGeolocation = (): Array<Marker | CircleMarker> => {
        const layers: Array<Marker | CircleMarker> = [];
        stops.forEach((stop) => {
            const marker = busStopMarkers.get(stop.id);
            const circle = busStopCircles.get(stop.id);
            if (marker && layer.hasLayer(marker)) {
                layers.push(marker);
            } else if (circle && layer.hasLayer(circle)) {
                layers.push(circle);
            }
        });
        return layers;
    };

    const bindPopupRouteLinks = (e: { popup: { getElement: () => HTMLElement | null } }): void => {
        const container = e.popup.getElement();
        if (!container) {
            return;
        }
        container.querySelectorAll<HTMLButtonElement>('.stop-arrival[data-route-id]').forEach((button) => {
            button.addEventListener('click', () => {
                const routeId = button.dataset.routeId;
                if (routeId && onRouteSelect) {
                    map.closePopup();
                    onRouteSelect(routeId);
                }
            });
        });
    };

    const prepare = <T extends Marker | CircleMarker>(instance: T, stop: TransitStop): T => {
        (instance as T & { stopName?: string }).stopName = stop.name;

        if (!onStopSelect) {
            instance.bindPopup(() => createStopPopupContent(index, stop, timetables, Boolean(onRouteSelect), now()));
            instance.on('popupopen', bindPopupRouteLinks);
        }

        instance.on('click', () => {
            // The panel opens first, so focusing already knows how much room it takes.
            onStopSelect?.(stop);
            selectStop(stop);
        });

        return instance;
    };

    const circleRadius = (): number => Math.min(3 + Math.max(1, map.getZoom() - 11) * 0.5, 6);

    const updateBusStopDisplay = (): void => {
        const useIcons = map.getZoom() >= MAP_VIEW.ZOOM_THRESHOLD;
        const radius = circleRadius();

        stops.forEach((stop) => {
            const coordinates: LatLngExpression = [stop.lat, stop.lon];
            const marker = busStopMarkers.get(stop.id);
            const circle = busStopCircles.get(stop.id);
            const isTerminus = terminusStopIds.has(stop.id);
            const isSelected = selectedStopId === stop.id;
            const stopRadius = isSelected ? radius + 2 : isTerminus ? radius + 1.5 : radius;

            if (useIcons) {
                if (circle && layer.hasLayer(circle)) {
                    layer.removeLayer(circle);
                }

                const icon = getBusStopIcon(isTerminus, isSelected);
                const nextMarker = marker ?? prepare(L.marker(coordinates, { icon }), stop);
                nextMarker.setIcon(icon);
                busStopMarkers.set(stop.id, nextMarker);
                if (!layer.hasLayer(nextMarker)) {
                    nextMarker.addTo(layer);
                }
                return;
            }

            if (marker && layer.hasLayer(marker)) {
                layer.removeLayer(marker);
            }

            const circleStyle = isSelected
                ? {
                      fillColor: SELECTED_STOP_COLOR,
                      color: isTerminus ? TERMINUS_ACCENT_COLOR : '#0e682f',
                      weight: 3,
                      opacity: 1,
                      fillOpacity: 0.92,
                  }
                : {
                      fillColor: isTerminus ? TERMINUS_ACCENT_COLOR : '#72aaff',
                      color: isTerminus ? TERMINUS_ACCENT_COLOR : '#72aaff',
                      weight: 2,
                      opacity: isTerminus ? 0.95 : 0.8,
                      // Endpoint stops stay in the same filled-dot family as regular stops;
                      // their darker colour and slightly larger radius provide distinction.
                      fillOpacity: isTerminus ? 0.82 : 0.6,
                  };
            const nextCircle =
                circle ??
                prepare(
                    L.circleMarker(coordinates, {
                        radius: stopRadius,
                        ...circleStyle,
                    }),
                    stop,
                );
            nextCircle.setRadius(stopRadius);
            nextCircle.setStyle(circleStyle);
            busStopCircles.set(stop.id, nextCircle);
            if (!layer.hasLayer(nextCircle)) {
                nextCircle.addTo(layer);
            }
        });
    };

    const selectStop = (stop: TransitStop): void => {
        selectedStopId = stop.id;
        updateBusStopDisplay();

        const coordinates: LatLngExpression = [stop.lat, stop.lon];
        focusMapOnMarker(map, coordinates);
        showWalkingRadius(L, map, coordinates);
    };

    const clearSelection = (): void => {
        if (selectedStopId === null) {
            return;
        }
        selectedStopId = null;
        updateBusStopDisplay();
    };

    updateBusStopDisplay();
    map.on('zoomend', debounce(updateBusStopDisplay, 120));

    return { layer, getLayersForGeolocation, selectStop, clearSelection };
};

export const loadTransportHubs = (
    L: LeafletNS,
    map: LeafletMap,
    hubs: TransportHub[],
    groups: Record<OverlayLayerId, LayerGroup>,
): void => {
    hubs.forEach((hub) => {
        let marker: Marker | null = null;
        switch (hub.type) {
            case 'train-station':
                marker = L.marker([hub.lat, hub.lng], {
                    icon: createFontAwesomeIcon(L, 'fa-train', '#ff8369'),
                }).bindPopup(() => createTrainStationPopup(hub));
                marker.addTo(groups.trainStations);
                break;
            case 'bus-station':
                marker = L.marker([hub.lat, hub.lng], {
                    icon: createFontAwesomeIcon(L, 'fa-bus', '#0e5287'),
                }).bindPopup(() => createMainBusStationPopup(hub));
                marker.addTo(groups.mainBusStations);
                break;
            case 'terminal-bus-station':
                marker = L.marker([hub.lat, hub.lng], {
                    icon: createFontAwesomeIcon(L, 'fa-bus', '#0e5287'),
                }).bindPopup(() => createTerminalBusStationPopup(hub));
                marker.addTo(groups.mainBusStations);
                break;
            case 'airport-transfer':
                marker = L.marker([hub.lat, hub.lng], {
                    icon: createFontAwesomeIcon(L, 'fa-shuttle-van', '#4d4d99'),
                }).bindPopup(() => createShuttlePopup(hub));
                marker.addTo(groups.airportShuttles);
                break;
            case 'bus-terminal':
                marker = L.marker([hub.lat, hub.lng], {
                    icon: createFontAwesomeIcon(L, 'fa-route', '#57bd6d'),
                }).bindPopup(() => createTouristBusPopup(hub));
                marker.addTo(groups.touristBus);
                break;
            default:
                break;
        }

        if (marker) {
            marker.on('click', () => {
                const coordinates: [number, number] = [hub.lat, hub.lng];
                focusMapOnMarker(map, coordinates);
                window.setTimeout(() => showWalkingRadius(L, map, coordinates), 100);
            });
        }
    });
};

export const loadBikeStations = (L: LeafletNS, map: LeafletMap, stations: BikeStation[], group: LayerGroup): void => {
    stations.forEach((station) => {
        const marker = L.marker([station.lat, station.lon], {
            icon: createFontAwesomeIcon(L, 'fa-bicycle', '#004899'),
        }).bindPopup(() => createBikeStationPopup(station.name, station.capacity));

        marker.on('click', () => {
            const coordinates: [number, number] = [station.lat, station.lon];
            focusMapOnMarker(map, coordinates);
            window.setTimeout(() => showWalkingRadius(L, map, coordinates), 100);
        });
        marker.addTo(group);
    });
};

export const loadLandmarks = (L: LeafletNS, map: LeafletMap, landmarks: Landmark[], group: LayerGroup): void => {
    landmarks.forEach((landmark) => {
        const marker = L.marker([landmark.lat, landmark.lng], {
            icon: createFontAwesomeIcon(L, landmark.icon, '#e74c3c'),
        }).bindPopup(() => createLandmarkPopup(landmark));

        marker.on('click', () => {
            const coordinates: [number, number] = [landmark.lat, landmark.lng];
            focusMapOnMarker(map, coordinates);
            window.setTimeout(() => showWalkingRadius(L, map, coordinates), 100);
        });
        marker.addTo(group);
    });
};

const LOCATION_CONTROL_MESSAGES = {
    buttonLabel: {
        en: 'Show my location',
        bhs: 'Prikaži moju lokaciju',
    },
    privacyTooltip: {
        en: 'Location is used only locally in your browser and is not sent to the server.',
        bhs: 'Lokacija se koristi samo lokalno u vašem pregledaču i ne šalje se serveru.',
    },
} as const;

const showNearestStops = async (
    L: LeafletNS,
    map: LeafletMap,
    busStopLayers: Array<Marker | CircleMarker>,
): Promise<void> => {
    if (busStopLayers.length === 0) {
        showMapNotification(MAP_NOTIFICATION_MESSAGES.busStopsUnavailable[getCurrentLanguage()]);
        return;
    }

    const position = await geoService.getCurrentPosition();
    const nearestStops = geoService.findNearestStops(busStopLayers, 3);
    if (nearestStops.length === 0) {
        return;
    }

    clearMapHighlights(map);

    const userMarker = L.marker([position.lat, position.lng], {
        icon: L.divIcon({
            className: 'user-location-marker',
            html: '<i class="fas fa-street-view" style="color: #007bff; font-size: 28px;"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
        }),
        zIndexOffset: 1000,
    }).addTo(map);

    const userCoords: [number, number] = [position.lat, position.lng];
    const bounds = L.latLngBounds(userCoords, userCoords);
    nearestStops.forEach((stop) => bounds.extend([stop.lat, stop.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

    const geoLines: Polyline[] = nearestStops.map((stop, position_) => {
        const isClosest = position_ === 0;
        return L.polyline(
            [
                [position.lat, position.lng],
                [stop.lat, stop.lng],
            ],
            {
                color: isClosest ? '#28a745' : '#17a2b8',
                weight: isClosest ? 4 : 2,
                opacity: isClosest ? 0.8 : 0.5,
                dashArray: '10, 10',
            },
        ).addTo(map);
    });

    trackGeolocationLayers([userMarker, ...geoLines]);

    userMarker.bindPopup(
        createNearestStopsPopup(
            nearestStops.map((stop) => ({
                name: stop.name,
                distanceKm: stop.distance,
            })),
        ),
    );
    userMarker.openPopup();
};

/** Locates the reader and links them to the three closest stops. */
export const createLocateControl = (
    L: LeafletNS,
    map: LeafletMap,
    getBusStopLayers: () => Array<Marker | CircleMarker>,
    position: ControlPosition = 'bottomright',
): Control => {
    const Locate = L.Control.extend({
        options: { position },
        onAdd(_map: LeafletMap) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-location');
            const button = L.DomUtil.create('button', 'leaflet-control-locate', container) as HTMLButtonElement;
            const tooltip = L.DomUtil.create('div', 'map-location-tooltip', container);
            const buttonLabel = LOCATION_CONTROL_MESSAGES.buttonLabel[getCurrentLanguage()];
            const tooltipText = LOCATION_CONTROL_MESSAGES.privacyTooltip[getCurrentLanguage()];
            const tooltipId = `map-location-tooltip-${Math.random().toString(36).slice(2, 10)}`;

            button.type = 'button';
            button.title = buttonLabel;
            button.setAttribute('aria-label', buttonLabel);
            button.setAttribute('aria-describedby', tooltipId);
            button.innerHTML = '<i class="fas fa-crosshairs" aria-hidden="true"></i>';

            tooltip.id = tooltipId;
            tooltip.setAttribute('role', 'tooltip');
            tooltip.textContent = tooltipText;

            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);

            let tooltipTimer: number | null = null;
            let locateDelayTimer: number | null = null;

            const clearTooltipTimer = (): void => {
                if (tooltipTimer !== null) {
                    window.clearTimeout(tooltipTimer);
                    tooltipTimer = null;
                }
            };

            const clearLocateDelayTimer = (): void => {
                if (locateDelayTimer !== null) {
                    window.clearTimeout(locateDelayTimer);
                    locateDelayTimer = null;
                }
            };

            const showTooltip = (autoHide = false): void => {
                clearTooltipTimer();
                tooltip.classList.add('is-visible');
                if (autoHide) {
                    tooltipTimer = window.setTimeout(() => {
                        tooltip.classList.remove('is-visible');
                        tooltipTimer = null;
                    }, 2400);
                }
            };

            const hideTooltip = (): void => {
                clearTooltipTimer();
                tooltip.classList.remove('is-visible');
            };

            const isTouchInteraction = (): boolean =>
                window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches;

            const runLocate = (): void => {
                button.classList.add('loading');

                const layers = getBusStopLayers();
                if (layers.length === 0) {
                    showMapNotification(MAP_NOTIFICATION_MESSAGES.busStopsUnavailable[getCurrentLanguage()]);
                    button.classList.remove('loading');
                    return;
                }

                showNearestStops(L, map, layers)
                    .catch((error: Error & { code?: number }) => {
                        if (error.code === 1) {
                            showMapNotification(MAP_NOTIFICATION_MESSAGES.permissionDenied[getCurrentLanguage()]);
                        } else if (error.message?.includes('secure context')) {
                            showMapNotification(MAP_NOTIFICATION_MESSAGES.secureContextRequired[getCurrentLanguage()]);
                        } else {
                            showMapNotification(MAP_NOTIFICATION_MESSAGES.locationUnavailable[getCurrentLanguage()]);
                        }
                    })
                    .finally(() => button.classList.remove('loading'));
            };

            button.addEventListener('mouseenter', () => {
                if (!isTouchInteraction()) {
                    showTooltip();
                }
            });
            button.addEventListener('mouseleave', hideTooltip);
            button.addEventListener('focus', () => showTooltip());
            button.addEventListener('blur', hideTooltip);
            button.addEventListener('pointerdown', (event) => {
                if (event.pointerType !== 'mouse') {
                    showTooltip(true);
                }
            });
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (button.classList.contains('loading')) {
                    return;
                }

                clearLocateDelayTimer();

                if (isTouchInteraction()) {
                    showTooltip(true);
                    locateDelayTimer = window.setTimeout(() => {
                        locateDelayTimer = null;
                        runLocate();
                    }, 220);
                    return;
                }

                runLocate();
            });

            return container;
        },
    });

    const control = new Locate();
    control.addTo(map);
    return control;
};

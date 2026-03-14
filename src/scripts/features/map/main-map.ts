import type {
    CircleMarker,
    Control,
    LatLngBoundsExpression,
    LatLngExpression,
    LayerGroup,
    Map as LeafletMap,
    Marker,
    Polyline,
    TileLayer,
} from 'leaflet';
import { getCurrentLanguage, langText } from '../../core/i18n';
import { debounce, escapeHtml, withBase } from '../../core/utils';
import { MapLegendControl } from '../../components/map-legend-control';
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
import type {
    BikeStation,
    BusRoutesFile,
    Landmark,
    LandmarksFile,
    LegendConfig,
    OverlayLayerId,
    TransportHub,
    TransportHubsFile,
} from './types';

type LeafletNS = typeof import('leaflet');

const MAP_CONFIG = {
    CENTER: [44.7866, 17.1975] as LatLngExpression,
    ZOOM: 13,
    MIN_ZOOM: 12,
    MAX_ZOOM: 17,
    ZOOM_THRESHOLD: 15,
    WALKING_RADIUS_5MIN: 400,
    BUS_ROUTES_URL: withBase('data/transport/routes/urban_bus_routes.json'),
};

const MAP_NOTIFICATION_MESSAGES = {
    busStopsUnavailable: {
        en: 'Bus stops are still loading or could not be loaded. Please wait a moment and try again.',
        bhs: 'Autobuska stajališta se još učitavaju ili nisu mogla biti učitana. Molimo sačekajte trenutak i pokušajte ponovo.',
    },
    permissionDenied: {
        en: 'Please allow location access to use this feature.',
        bhs: 'Molimo dozvolite pristup lokaciji da biste koristili ovu opciju.',
    },
    secureContextRequired: {
        en: 'Geolocation requires a secure connection (HTTPS) or localhost.',
        bhs: 'Geolokacija zahtijeva sigurnu vezu (HTTPS) ili localhost.',
    },
    locationUnavailable: {
        en: 'Could not determine your location. Please check your GPS settings.',
        bhs: 'Nismo mogli odrediti vašu lokaciju. Provjerite GPS postavke.',
    },
} as const;

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

const geoService = new GeolocationService();
type TemporaryMapLayer = CircleMarker | Marker | Polyline;

let walkingLayers: TemporaryMapLayer[] = [];
let geolocationRouteLayers: Polyline[] = [];
let userLocationMarker: Marker | null = null;

const fetchJson = async <T>(url: string): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}`);
    }
    return (await response.json()) as T;
};

const ensureNotificationRegion = (): HTMLElement => {
    const existing = document.getElementById('map-notification-region');
    if (existing) {
        return existing;
    }

    const region = document.createElement('div');
    region.id = 'map-notification-region';
    region.className = 'map-notification-region';
    document.body.appendChild(region);
    return region;
};

let notificationTimer: number | null = null;

const compareLineIds = (a: string, b: string): number => {
    const aNum = parseInt(a.replace(/[^\d]/g, ''), 10);
    const bNum = parseInt(b.replace(/[^\d]/g, ''), 10);

    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) {
        return aNum - bNum;
    }

    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

const hexToRgba = (value: string, alpha: number): string | null => {
    const normalized = value.trim().replace(/^#/, '');
    if (![3, 6].includes(normalized.length) || !/^[\da-f]+$/i.test(normalized)) {
        return null;
    }

    const hex = normalized.length === 3 ? normalized.replace(/./g, '$&$&') : normalized;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const showMapNotification = (message: string): void => {
    if (!message) {
        return;
    }

    const region = ensureNotificationRegion();
    if (notificationTimer) {
        window.clearTimeout(notificationTimer);
        notificationTimer = null;
    }

    region.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = 'map-notification-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.textContent = message;
    region.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('is-visible'));

    notificationTimer = window.setTimeout(() => {
        toast.classList.remove('is-visible');
        window.setTimeout(() => toast.remove(), 180);
        notificationTimer = null;
    }, 6000);
};

const clearTemporaryLayers = (map: LeafletMap, layers: TemporaryMapLayer[]): TemporaryMapLayer[] => {
    layers.forEach((layer) => map.removeLayer(layer));
    return [];
};

const clearGeolocationState = (map: LeafletMap): void => {
    geolocationRouteLayers = clearTemporaryLayers(map, geolocationRouteLayers) as Polyline[];
    if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
        userLocationMarker = null;
    }
};

const createWalkingCircles = (L: LeafletNS, map: LeafletMap, coordinates: LatLngExpression): void => {
    clearGeolocationState(map);
    walkingLayers = clearTemporaryLayers(map, walkingLayers);

    const circle5min = L.circle(coordinates, {
        radius: MAP_CONFIG.WALKING_RADIUS_5MIN,
        color: '#4CAF50',
        fillColor: '#4CAF50',
        fillOpacity: 0.2,
        weight: 2,
        opacity: 0.7,
    });
    circle5min.addTo(map);

    const [lat, lng] = coordinates as [number, number];
    const radiusInDegrees = MAP_CONFIG.WALKING_RADIUS_5MIN / 111320;
    const angleInRadians = -Math.PI / 4;
    const iconLat = lat + radiusInDegrees * Math.sin(angleInRadians);
    const iconLng = lng + radiusInDegrees * Math.cos(angleInRadians);

    const walkingIcon = L.divIcon({
        html: `<div class="walking-circle-icon">
             <i class="fas fa-walking"></i>
             <span>5min</span>
           </div>`,
        className: '',
        iconSize: [60, 28],
        iconAnchor: [30, 14],
    });

    const iconMarker = L.marker([iconLat, iconLng], {
        icon: walkingIcon,
        interactive: false,
    }).addTo(map);

    walkingLayers = [circle5min, iconMarker];
};

const autoSelectNearestStop = async (
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

    clearGeolocationState(map);
    walkingLayers = clearTemporaryLayers(map, walkingLayers);

    const activeUserMarker = L.marker([position.lat, position.lng], {
        icon: L.divIcon({
            className: 'user-location-marker',
            html: '<i class="fas fa-street-view" style="color: #007bff; font-size: 28px;"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
        }),
        zIndexOffset: 1000,
    }).addTo(map);
    userLocationMarker = activeUserMarker;

    const userCoords: [number, number] = [position.lat, position.lng];
    const bounds = L.latLngBounds(userCoords, userCoords);
    nearestStops.forEach((stop) => bounds.extend([stop.lat, stop.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

    const geoLines: Polyline[] = [];
    nearestStops.forEach((stop, index) => {
        const isClosest = index === 0;
        const line = L.polyline(
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
        geoLines.push(line);
    });
    geolocationRouteLayers = geoLines;

    activeUserMarker.bindPopup(
        createNearestStopsPopup(
            nearestStops.map((stop) => ({
                name: stop.name,
                distanceKm: stop.distance,
            })),
        ),
    );
    activeUserMarker.openPopup();
};

const createLocateControl = (
    L: LeafletNS,
    map: LeafletMap,
    getBusStopLayers: () => Array<Marker | CircleMarker>,
): Control => {
    const Locate = L.Control.extend({
        options: { position: 'bottomright' as const },
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

                autoSelectNearestStop(L, map, layers)
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

const createFontAwesomeIcon = (L: LeafletNS, iconClass: string, color: string) =>
    L.divIcon({
        html: `<i class="fa-solid ${iconClass} fa-icon-marker" style="color:${color};"></i>`,
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
    });

const buildBusStopsLayer = (
    L: LeafletNS,
    map: LeafletMap,
    busRoutes: BusRoutesFile,
): { layer: LayerGroup; getLayersForGeolocation: () => Array<Marker | CircleMarker> } => {
    const layer = L.layerGroup();
    const uniqueStops = new Map<
        string,
        { name: string; coordinates: LatLngExpression; street?: string; lines: Set<string> }
    >();

    Object.entries(busRoutes).forEach(([lineId, line]) => {
        Object.values(line.directions).forEach((direction) => {
            direction.stops.forEach((stopName, index) => {
                const coordinates = direction.coordinates[index];
                const street = direction.streets ? direction.streets[index] : direction.ulice?.[index];

                if (!uniqueStops.has(stopName)) {
                    uniqueStops.set(stopName, {
                        name: stopName,
                        coordinates,
                        street,
                        lines: new Set([lineId]),
                    });
                } else {
                    uniqueStops.get(stopName)?.lines.add(lineId);
                }
            });
        });
    });

    const busStopMarkers = new Map<string, Marker>();
    const busStopCircles = new Map<string, CircleMarker>();

    const getLayersForGeolocation = (): Array<Marker | CircleMarker> => {
        const layers: Array<Marker | CircleMarker> = [];
        uniqueStops.forEach((_stop, stopName) => {
            const marker = busStopMarkers.get(stopName);
            const circle = busStopCircles.get(stopName);
            if (marker && layer.hasLayer(marker)) {
                layers.push(marker);
            } else if (circle && layer.hasLayer(circle)) {
                layers.push(circle);
            }
        });
        return layers;
    };

    const createPopupContent = (stopName: string, sortedLines: string[]): string => {
        const linesMarkup = sortedLines
            .map((lineId) => {
                const line = busRoutes[lineId];
                const lineColor = line?.color || line?.colour || '#72aaff';
                const accentSoft = hexToRgba(lineColor, 0.14) ?? 'rgba(114, 170, 255, 0.14)';
                const accentHover = hexToRgba(lineColor, 0.2) ?? 'rgba(114, 170, 255, 0.2)';
                const accentBorder = hexToRgba(lineColor, 0.28) ?? 'rgba(114, 170, 255, 0.28)';
                const timetableLabel = langText(
                    `Kliknite za red vožnje linije ${lineId}`,
                    `Click to view the timetable for line ${lineId}`,
                );
                const badgeStyle = [
                    `--line-accent:${escapeHtml(lineColor)}`,
                    `--line-accent-soft:${accentSoft}`,
                    `--line-accent-hover:${accentHover}`,
                    `--line-accent-border:${accentBorder}`,
                ].join('; ');
                const lineIdLabel = escapeHtml(lineId);
                const safeTimetableLabel = escapeHtml(timetableLabel);

                return [
                    `<a href="${withBase('lines/#timetable')}"`,
                    ` class="line-number-link"`,
                    ` style="${badgeStyle}"`,
                    ` data-line-id="${lineIdLabel}"`,
                    ` title="${safeTimetableLabel}"`,
                    ` aria-label="${safeTimetableLabel}">`,
                    `${lineIdLabel}</a>`,
                ].join('');
            })
            .join('');

        const stopTypeLabel = escapeHtml(langText('Autobusko stajalište', 'Bus stop'));
        const linesLabel = escapeHtml(langText('Linije na ovom stajalištu', 'Lines at this stop'));
        const helperHint = escapeHtml(
            langText('Kliknite na liniju za red vožnje', 'Click a line to view its timetable'),
        );

        return `
            <div class="hub-popup hub-popup--bus-stop">
                <span class="hub-popup__type-label">${stopTypeLabel}</span>
                <h3>${escapeHtml(stopName)}</h3>
                <div class="hub-popup__lines" aria-label="${linesLabel}">
                    ${linesMarkup}
                </div>
                <p class="hub-popup__hint">${helperHint}</p>
            </div>
        `;
    };

    const createBusStopCircle = (coordinates: LatLngExpression): CircleMarker => {
        const currentZoom = map.getZoom();
        const baseRadius = 3;
        const scaleFactor = Math.max(1, currentZoom - 11) * 0.5;
        const radius = Math.min(baseRadius + scaleFactor, 6);

        return L.circleMarker(coordinates, {
            radius,
            fillColor: '#72aaff',
            color: '#72aaff',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.6,
        });
    };

    const createBusStopIcon = (coordinates: LatLngExpression): Marker =>
        L.marker(coordinates, {
            icon: createFontAwesomeIcon(L, 'fa-bus-simple', '#72aaff'),
        });

    const attachStopName = <T extends Marker | CircleMarker>(layerInstance: T, stopName: string): T => {
        (layerInstance as T & { stopName?: string }).stopName = stopName;
        return layerInstance;
    };

    const updateBusStopDisplay = (): void => {
        const currentZoom = map.getZoom();

        uniqueStops.forEach((stop, stopName) => {
            const sortedLines = Array.from(stop.lines).sort(compareLineIds);

            const bindPopupLineLinks = (e: { popup: { getElement: () => HTMLElement | null } }): void => {
                const container = e.popup.getElement();
                if (!container) {
                    return;
                }
                container.querySelectorAll<HTMLAnchorElement>('.line-number-link[data-line-id]').forEach((link) => {
                    link.addEventListener('click', () => {
                        const lineId = link.dataset.lineId;
                        if (lineId) {
                            sessionStorage.setItem('selectedLine', lineId);
                        }
                    });
                });
            };

            if (currentZoom >= MAP_CONFIG.ZOOM_THRESHOLD) {
                if (busStopCircles.has(stopName) && layer.hasLayer(busStopCircles.get(stopName)!)) {
                    layer.removeLayer(busStopCircles.get(stopName)!);
                }

                if (!busStopMarkers.has(stopName)) {
                    const marker = attachStopName(createBusStopIcon(stop.coordinates), stop.name);
                    marker.bindPopup(() => createPopupContent(stop.name, sortedLines));
                    marker.on('popupopen', bindPopupLineLinks);
                    marker.on('click', () => {
                        window.setTimeout(() => createWalkingCircles(L, map, stop.coordinates), 100);
                    });
                    busStopMarkers.set(stopName, marker);
                    marker.addTo(layer);
                } else if (!layer.hasLayer(busStopMarkers.get(stopName)!)) {
                    busStopMarkers.get(stopName)!.addTo(layer);
                }
            } else {
                if (busStopMarkers.has(stopName) && layer.hasLayer(busStopMarkers.get(stopName)!)) {
                    layer.removeLayer(busStopMarkers.get(stopName)!);
                }

                if (busStopCircles.has(stopName) && layer.hasLayer(busStopCircles.get(stopName)!)) {
                    layer.removeLayer(busStopCircles.get(stopName)!);
                }

                const circle = attachStopName(createBusStopCircle(stop.coordinates), stop.name);
                circle.bindPopup(() => createPopupContent(stop.name, sortedLines));
                circle.on('popupopen', bindPopupLineLinks);
                circle.on('click', () => {
                    window.setTimeout(() => createWalkingCircles(L, map, stop.coordinates), 100);
                });

                busStopCircles.set(stopName, circle);
                circle.addTo(layer);
            }
        });
    };

    updateBusStopDisplay();
    map.on('zoomend', debounce(updateBusStopDisplay, 120));

    return { layer, getLayersForGeolocation };
};

const loadTransportHubs = (
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
            marker.on('click', () => window.setTimeout(() => createWalkingCircles(L, map, [hub.lat, hub.lng]), 100));
        }
    });
};

const loadBikeStations = (L: LeafletNS, map: LeafletMap, stations: BikeStation[], group: LayerGroup): void => {
    stations.forEach((station) => {
        const marker = L.marker([station.lat, station.lon], {
            icon: createFontAwesomeIcon(L, 'fa-bicycle', '#004899'),
        }).bindPopup(() => createBikeStationPopup(station.name, station.capacity));

        marker.on('click', () =>
            window.setTimeout(() => createWalkingCircles(L, map, [station.lat, station.lon]), 100),
        );
        marker.addTo(group);
    });
};

const loadLandmarks = (L: LeafletNS, map: LeafletMap, landmarks: Landmark[], group: LayerGroup): void => {
    landmarks.forEach((landmark) => {
        const marker = L.marker([landmark.lat, landmark.lng], {
            icon: createFontAwesomeIcon(L, landmark.icon, '#e74c3c'),
        }).bindPopup(() => createLandmarkPopup(landmark));

        marker.on('click', () =>
            window.setTimeout(() => createWalkingCircles(L, map, [landmark.lat, landmark.lng]), 100),
        );
        marker.addTo(group);
    });
};

const buildBaseLayers = (L: LeafletNS): Record<string, TileLayer> => {
    const standard = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution">CARTO</a>',
    });

    const light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
            '&copy; <a href="https://carto.com/attribution">CARTO</a>',
        subdomains: 'abcd',
    });

    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
            '&copy; <a href="https://carto.com/attribution">CARTO</a>',
        subdomains: 'abcd',
    });

    const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye',
        },
    );

    return { standard, light, dark, satellite };
};

export const initMainMap = async (): Promise<void> => {
    const container = document.getElementById('map-container');
    if (!container) {
        return;
    }

    try {
        const [L, legendConfig, busRoutes, hubsFile, bikeStations, landmarksFile] = await Promise.all([
            import('leaflet').then((mod) => mod.default),
            fetchJson<LegendConfig>(withBase('data/legend-config.json')),
            fetchJson<BusRoutesFile>(MAP_CONFIG.BUS_ROUTES_URL),
            fetchJson<TransportHubsFile>(withBase('data/transport/transport_hubs.json')),
            fetchJson<BikeStation[]>(withBase('data/transport/bike_stations.json')),
            fetchJson<LandmarksFile>(withBase('data/transport/landmarks.json')),
        ]);

        const baseLayers = buildBaseLayers(L);
        const defaultBase = legendConfig.baseMaps.find((base) => base.default)?.id ?? 'light';

        const bounds: LatLngBoundsExpression = [
            [44.67794605215712, 16.90471973252053],
            [44.996414749446565, 17.620029520676],
        ];

        const map: LeafletMap = L.map('map-container', {
            center: MAP_CONFIG.CENTER,
            zoom: MAP_CONFIG.ZOOM,
            maxBounds: bounds,
            maxBoundsViscosity: 1.0,
            zoomControl: false,
            minZoom: MAP_CONFIG.MIN_ZOOM,
            maxZoom: MAP_CONFIG.MAX_ZOOM,
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

        const busStops = buildBusStopsLayer(L, map, busRoutes);
        overlayGroups.busStops = busStops.layer;
        overlayGroups.busStops.addTo(map);

        loadTransportHubs(L, map, hubsFile.hubs, overlayGroups);
        loadBikeStations(L, map, bikeStations, overlayGroups.bikeStations);
        loadLandmarks(L, map, landmarksFile.landmarks, overlayGroups.landmarks);

        const legend = new MapLegendControl(L, map, legendConfig, baseLayers, overlayGroups);
        legend.init();

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

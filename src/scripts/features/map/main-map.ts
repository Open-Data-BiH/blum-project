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
import { getCurrentLanguage } from '../../core/i18n';
import { debounce } from '../../core/utils';
import { MapLegendControl } from '../../components/map-legend-control';
import { GeolocationService } from './geolocation';
import {
    createBikeStationPopup,
    createMainBusStationPopup,
    createShuttlePopup,
    createTerminalBusStationPopup,
    createTouristBusPopup,
    createTrainStationPopup,
} from './popups';
import type {
    BikeStation,
    BusRoutesFile,
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
    BUS_ROUTES_URL: '/data/transport/routes/urban_bus_routes.json',
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

const geoService = new GeolocationService();
let walkingLayers: Array<CircleMarker | Marker | Polyline> = [];

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

const langText = (bhs: string, en: string): string => (getCurrentLanguage() === 'en' ? en : bhs);

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

const createWalkingCircles = (L: LeafletNS, map: LeafletMap, coordinates: LatLngExpression): void => {
    walkingLayers.forEach((layer) => map.removeLayer(layer));
    walkingLayers = [];

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
    const userMarker = L.marker([position.lat, position.lng], {
        icon: L.divIcon({
            className: 'user-location-marker',
            html: '<i class="fas fa-street-view" style="color: #007bff; font-size: 28px;"></i>',
            iconSize: [30, 30],
            iconAnchor: [15, 30],
        }),
        zIndexOffset: 1000,
    }).addTo(map);

    userMarker.bindPopup(`<strong>📍 ${langText('Vaša lokacija', 'Your location')}</strong>`).openPopup();

    const nearestStops = geoService.findNearestStops(busStopLayers, 3);
    if (nearestStops.length === 0) {
        return;
    }

    const userCoords: [number, number] = [position.lat, position.lng];
    const bounds = L.latLngBounds(userCoords, userCoords);
    nearestStops.forEach((stop) => bounds.extend([stop.lat, stop.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

    walkingLayers.forEach((layer) => map.removeLayer(layer));
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
    walkingLayers = geoLines;

    window.setTimeout(() => {
        nearestStops[0].marker.openPopup();
    }, 800);

    let stopsHtml = '<ul style="margin: 5px 0; padding-left: 20px;">';
    nearestStops.forEach((stop) => {
        stopsHtml += `<li><strong>${stop.distance.toFixed(2)} km</strong></li>`;
    });
    stopsHtml += '</ul>';

    userMarker.setPopupContent(`
    <div style="min-width: 200px;">
      <strong>📍 ${langText('Vaša lokacija', 'Your location')}</strong><br>
      <hr style="margin: 5px 0;">
      ${langText('Najbliža stajališta', 'Nearest stops')}:<br>
      ${stopsHtml}
    </div>
  `);
    userMarker.openPopup();
};

const createLocateControl = (
    L: LeafletNS,
    map: LeafletMap,
    getBusStopLayers: () => Array<Marker | CircleMarker>,
): Control => {
    const Locate = L.Control.extend({
        options: { position: 'bottomright' as const },
        onAdd(_map: LeafletMap) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            const button = L.DomUtil.create('a', 'leaflet-control-locate', container);
            button.href = '#';
            button.title = langText('Pronađi moju lokaciju', 'Find my location');
            button.innerHTML = '<i class="fas fa-crosshairs"></i>';

            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', (e) => {
                L.DomEvent.stop(e);
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

    const orderedKeys = Object.keys(busRoutes).sort((a, b) => {
        const aNum = parseInt(a.replace(/[^\d]/g, ''), 10);
        const bNum = parseInt(b.replace(/[^\d]/g, ''), 10);
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
            return aNum - bNum;
        }
        return a.localeCompare(b);
    });

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
                return `<a href="/lines/#timetable" class="line-number-link" style="color:${lineColor}" data-line-id="${lineId}">${lineId}</a>`;
            })
            .join(', ');

        return `
            <div class="hub-popup">
                <h3>${stopName}</h3>
                <p>${langText('Linije', 'Lines')}: ${linesMarkup}</p>
                <a href="/lines/#timetable" class="popup-link">${langText('Pogledaj red vožnje', 'View timetables')}</a>
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

    const updateBusStopDisplay = (): void => {
        const currentZoom = map.getZoom();

        uniqueStops.forEach((stop, stopName) => {
            const sortedLines = Array.from(stop.lines).sort((a, b) => orderedKeys.indexOf(a) - orderedKeys.indexOf(b));

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
                    const marker = createBusStopIcon(stop.coordinates);
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

                const circle = createBusStopCircle(stop.coordinates);
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
        const [L, legendConfig, busRoutes, hubsFile, bikeStations] = await Promise.all([
            import('leaflet').then((mod) => mod.default),
            fetchJson<LegendConfig>('/data/legend-config.json'),
            fetchJson<BusRoutesFile>(MAP_CONFIG.BUS_ROUTES_URL),
            fetchJson<TransportHubsFile>('/data/transport/transport_hubs.json'),
            fetchJson<BikeStation[]>('/data/transport/bike_stations.json'),
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
        };

        const busStops = buildBusStopsLayer(L, map, busRoutes);
        overlayGroups.busStops = busStops.layer;
        overlayGroups.busStops.addTo(map);

        loadTransportHubs(L, map, hubsFile.hubs, overlayGroups);
        loadBikeStations(L, map, bikeStations, overlayGroups.bikeStations);

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

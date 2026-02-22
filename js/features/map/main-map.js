import { FetchHelper } from '../../core/fetch-helper.js';
import { escapeHTML } from '../../core/sanitize.js';
import MapLegendControl from '../../components/map-legend-control.js';
import { AppI18n } from '../../core/i18n.js';
import { GeolocationService } from './geolocation.js';
import {
    createTrainStationPopup,
    createShuttlePopup,
    createTouristBusPopup,
    createMainBusStationPopup,
    createTerminalBusStationPopup,
    createBikeStationPopup,
} from './popups.js';

const geoService = new GeolocationService();

const MAP_NOTIFICATION_MESSAGES = {
    busStopsUnavailable: {
        en: 'Bus stops are still loading or could not be loaded. Please wait a moment and try again.',
        bhs: 'Autobuska stajalista se jos ucitavaju ili nisu mogla biti ucitana. Molimo sacekajte trenutak i pokusajte ponovo.',
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
        bhs: 'Nismo mogli odrediti vasu lokaciju. Provjerite GPS postavke.',
    },
};

const MAP_NOTIFICATION_TIMEOUT_MS = 6000;
const MAP_NOTIFICATION_FADE_MS = 180;
let mapNotificationRegion = null;
let mapNotificationTimerId = null;

const getMapNotificationText = (messageKey) => {
    const lang = AppI18n.currentLang || 'en';
    const normalizedLang = lang === 'bhs' ? 'bhs' : 'en';
    return MAP_NOTIFICATION_MESSAGES[messageKey]?.[normalizedLang] || MAP_NOTIFICATION_MESSAGES[messageKey]?.en || '';
};

const ensureMapNotificationRegion = () => {
    if (mapNotificationRegion && document.body.contains(mapNotificationRegion)) {
        return mapNotificationRegion;
    }

    const existingRegion = document.getElementById('map-notification-region');
    if (existingRegion) {
        mapNotificationRegion = existingRegion;
        return mapNotificationRegion;
    }

    mapNotificationRegion = document.createElement('div');
    mapNotificationRegion.id = 'map-notification-region';
    mapNotificationRegion.className = 'map-notification-region';
    document.body.appendChild(mapNotificationRegion);
    return mapNotificationRegion;
};

const showMapNotification = (message) => {
    if (!message) {
        return;
    }

    const region = ensureMapNotificationRegion();
    if (mapNotificationTimerId) {
        clearTimeout(mapNotificationTimerId);
        mapNotificationTimerId = null;
    }

    while (region.firstChild) {
        region.removeChild(region.firstChild);
    }

    const toast = document.createElement('div');
    toast.className = 'map-notification-toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.textContent = message;
    region.appendChild(toast);

    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => toast.classList.add('is-visible'));
    } else {
        toast.classList.add('is-visible');
    }

    mapNotificationTimerId = setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, MAP_NOTIFICATION_FADE_MS);
        mapNotificationTimerId = null;
    }, MAP_NOTIFICATION_TIMEOUT_MS);
};

async function autoSelectNearestStop(map, busStopMarkers) {
    if (!map || !busStopMarkers || busStopMarkers.length === 0) {
        return;
    }

    try {
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

        userMarker.bindPopup('<strong>📍 Vaša lokacija / Your location</strong>').openPopup();

        const nearestStops = geoService.findNearestStops(busStopMarkers, 3);

        if (nearestStops.length > 0) {
            const closest = nearestStops[0];

            const bounds = L.latLngBounds([position.lat, position.lng]);
            nearestStops.forEach((stop) => bounds.extend([stop.lat, stop.lng]));

            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

            if (currentGeoLines) {
                currentGeoLines.forEach((line) => map.removeLayer(line));
            }
            currentGeoLines = [];

            nearestStops.forEach((stop, index) => {
                const isClosest = index === 0;
                const color = isClosest ? '#28a745' : '#17a2b8';
                const weight = isClosest ? 4 : 2;
                const opacity = isClosest ? 0.8 : 0.5;

                const line = L.polyline(
                    [
                        [position.lat, position.lng],
                        [stop.lat, stop.lng],
                    ],
                    {
                        color: color,
                        weight: weight,
                        opacity: opacity,
                        dashArray: '10, 10',
                    },
                ).addTo(map);

                currentGeoLines.push(line);
            });

            setTimeout(() => {
                closest.marker.openPopup();
            }, 1000);

            let stopsHtml = '<ul style="margin: 5px 0; padding-left: 20px;">';
            nearestStops.forEach((stop) => {
                stopsHtml += `<li><strong>${stop.distance.toFixed(2)} km</strong></li>`;
            });
            stopsHtml += '</ul>';

            userMarker.setPopupContent(
                `<div style="min-width: 200px;">
                    <strong>📍 Vaša lokacija / Your location</strong><br>
                    <hr style="margin: 5px 0;">
                    Najbliža stajališta / Nearest stops:<br>
                    ${stopsHtml}
                </div>`,
            );
            userMarker.openPopup();
        }
    } catch (error) {
        console.error('Geolocation error:', error.message);
        throw error;
    }
}

const MAP_CONFIG = {
    CENTER: [44.7866, 17.1975],
    ZOOM: 13,
    MIN_ZOOM: 12,
    MAX_ZOOM: 17,
    ZOOM_THRESHOLD: 15,
    WALKING_RADIUS_5MIN: 400,
    BUS_ROUTES_URL: 'data/transport/routes/urban_bus_routes.json',
    BUS_STOP_COLOR: '#72aaff',
};

const ZOOM_THRESHOLD = MAP_CONFIG.ZOOM_THRESHOLD;

let currentWalkingCircles = [];
let globalMap = null;
let busRoutes = null;
let currentGeoLines = [];
let busStopMarkersMap = null;
let busStopCirclesMap = null;
let getBusStopLayersForGeolocationFn = null;

const loadBusRoutes = async () => {
    try {
        busRoutes = await FetchHelper.fetchJSON(MAP_CONFIG.BUS_ROUTES_URL);
    } catch (error) {
        console.error('Bus routes data failed to load:', error);
        busRoutes = null;
    }
};

const clearWalkingCircles = () => {
    if (globalMap && currentWalkingCircles.length > 0) {
        currentWalkingCircles.forEach((circle) => globalMap.removeLayer(circle));
        currentWalkingCircles = [];
    }
};

const createWalkingCircles = (coordinates, _stationName) => {
    if (!globalMap) {
        console.error('Global map not available for walking circles');
        return;
    }

    clearWalkingCircles();

    const circle5min = L.circle(coordinates, {
        radius: MAP_CONFIG.WALKING_RADIUS_5MIN,
        color: '#4CAF50',
        fillColor: '#4CAF50',
        fillOpacity: 0.2,
        weight: 2,
        opacity: 0.7,
    });

    circle5min.addTo(globalMap);

    const radiusInDegrees = MAP_CONFIG.WALKING_RADIUS_5MIN / 111320;
    const angleInRadians = -Math.PI / 4;
    const iconLat = coordinates[0] + radiusInDegrees * Math.sin(angleInRadians);
    const iconLng = coordinates[1] + radiusInDegrees * Math.cos(angleInRadians);

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
    });

    iconMarker.addTo(globalMap);

    currentWalkingCircles = [circle5min, iconMarker];
};

export const initializeMainMap = async () => {
    await loadBusRoutes();

    try {
        const mapContainer = document.getElementById('map-container');
        if (!mapContainer) {
            console.error('Map container element not found');
            return;
        }

        const mapBounds = L.latLngBounds([
            [44.67794605215712, 16.90471973252053],
            [44.996414749446565, 17.620029520676],
        ]);

        const map = L.map('map-container', {
            center: MAP_CONFIG.CENTER,
            zoom: MAP_CONFIG.ZOOM,
            maxBounds: mapBounds,
            maxBoundsViscosity: 1.0,
            zoomControl: false,
            minZoom: MAP_CONFIG.MIN_ZOOM,
            maxZoom: MAP_CONFIG.MAX_ZOOM,
        });

        L.control
            .zoom({
                position: 'bottomright',
            })
            .addTo(map);

        const locateControl = L.Control.extend({
            options: {
                position: 'bottomright',
            },
            onAdd: function (map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                const button = L.DomUtil.create('a', 'leaflet-control-locate', container);
                button.href = '#';
                button.title = 'Pronađi moju lokaciju | Find my location';
                button.innerHTML = '<i class="fas fa-crosshairs"></i>';

                L.DomEvent.disableClickPropagation(button);
                L.DomEvent.on(button, 'click', function (e) {
                    L.DomEvent.stop(e);

                    button.classList.add('loading');

                    let markers = [];
                    if (typeof getBusStopLayersForGeolocationFn === 'function') {
                        markers = getBusStopLayersForGeolocationFn();
                    } else if (busStopMarkersMap) {
                        markers = Array.from(busStopMarkersMap.values());
                    } else if (busStopCirclesMap) {
                        markers = Array.from(busStopCirclesMap.values());
                    } else {
                        console.warn('Bus stop markers not populated yet.');
                    }

                    if (markers.length === 0) {
                        showMapNotification(getMapNotificationText('busStopsUnavailable'));
                        button.classList.remove('loading');
                        return;
                    }

                    autoSelectNearestStop(map, markers)
                        .then(() => {
                            button.classList.remove('loading');
                        })
                        .catch((error) => {
                            console.error('Geolocation failed:', error);
                            button.classList.remove('loading');
                            if (error.code === 1) {
                                showMapNotification(getMapNotificationText('permissionDenied'));
                            } else if (error.message && error.message.includes('secure context')) {
                                showMapNotification(getMapNotificationText('secureContextRequired'));
                            } else {
                                showMapNotification(getMapNotificationText('locationUnavailable'));
                            }
                        });
                });

                return container;
            },
        });
        map.addControl(new locateControl());

        const standard = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution">CARTO</a>',
        });

        const light = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
            attribution:
                '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, ' +
                '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, ' +
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        }).addTo(map);

        const dark = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
            attribution:
                '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, ' +
                '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, ' +
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        });

        const satellite = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye',
            },
        );

        const createFontAwesomeIcon = (iconClass, color) =>
            L.divIcon({
                html: `<i class="fa-solid ${iconClass} fa-icon-marker" style="color:${color};"></i>`,
                className: '',
                iconSize: [30, 30],
                iconAnchor: [15, 15],
            });

        const displayBusStops = (map, layerGroup) => {
            if (!busRoutes) {
                console.warn('Bus routes data not available, skipping bus stops display');
                return;
            }

            const uniqueStops = new Map();

            const orderedKeys = Object.keys(busRoutes).sort((a, b) => {
                const aNum = parseInt(a.replace(/[^\d]/g, ''));
                const bNum = parseInt(b.replace(/[^\d]/g, ''));
                return aNum - bNum;
            });

            for (const lineId in busRoutes) {
                const line = busRoutes[lineId];
                for (const directionId in line.directions) {
                    const direction = line.directions[directionId];

                    direction.stops.forEach((stopName, index) => {
                        const coordinates = direction.coordinates[index];
                        const street = direction.streets ? direction.streets[index] : direction.ulice[index];

                        if (!uniqueStops.has(stopName)) {
                            uniqueStops.set(stopName, {
                                name: stopName,
                                coordinates: coordinates,
                                street: street,
                                lines: new Set([lineId]),
                            });
                        } else {
                            uniqueStops.get(stopName).lines.add(lineId);
                        }
                    });
                }
            }

            const busStopMarkers = new Map();
            const busStopCircles = new Map();

            const getBusStopLayersForGeolocation = () => {
                const layers = [];
                uniqueStops.forEach((_, stopName) => {
                    const marker = busStopMarkers.get(stopName);
                    const circle = busStopCircles.get(stopName);

                    if (marker && layerGroup.hasLayer(marker)) {
                        layers.push(marker);
                        return;
                    }
                    if (circle && layerGroup.hasLayer(circle)) {
                        layers.push(circle);
                        return;
                    }
                });
                return layers;
            };

            busStopMarkersMap = busStopMarkers;
            busStopCirclesMap = busStopCircles;
            getBusStopLayersForGeolocationFn = getBusStopLayersForGeolocation;

            const createBusStopCircle = (coordinates) => {
                const currentZoom = map.getZoom();
                const baseRadius = 3;
                const scaleFactor = Math.max(1, currentZoom - 11) * 0.5;
                const radius = Math.min(baseRadius + scaleFactor, 6);

                return L.circleMarker(coordinates, {
                    radius,
                    fillColor: MAP_CONFIG.BUS_STOP_COLOR,
                    color: MAP_CONFIG.BUS_STOP_COLOR,
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.6,
                });
            };

            const createBusStopIcon = (coordinates) =>
                L.marker(coordinates, {
                    icon: createFontAwesomeIcon('fa-bus-simple', MAP_CONFIG.BUS_STOP_COLOR),
                });

            const updateBusStopDisplay = () => {
                const currentZoom = map.getZoom();

                uniqueStops.forEach((stop, stopName) => {
                    const sortedLines = Array.from(stop.lines);
                    sortedLines.sort((a, b) => {
                        return orderedKeys.indexOf(a) - orderedKeys.indexOf(b);
                    });

                    const popupContent = `
                    <div class="hub-popup">
                        <h3>${escapeHTML(stop.name)}</h3>
                        <p>Linije | Lines: ${sortedLines
                            .map((lineId) => {
                                const lineColor =
                                    busRoutes[lineId].color || busRoutes[lineId].colour || '#72aaff';
                                return `<a href="lines.html#timetable" class="line-number-link"
                                    style="color:${escapeHTML(lineColor)}"
                                    data-line-id="${escapeHTML(lineId)}">${escapeHTML(lineId)}</a>`;
                            })
                            .join(', ')}</p>
                        <a href="lines.html#timetable" class="popup-link">Pogledaj red vožnje | View timetables</a>
                    </div>
                `;

                    const bindPopupLineLinks = (e) => {
                        const container = e.popup.getElement();
                        if (!container) {
                            return;
                        }
                        container.querySelectorAll('.line-number-link[data-line-id]').forEach((link) => {
                            link.addEventListener('click', () => {
                                sessionStorage.setItem('selectedLine', link.dataset.lineId);
                            });
                        });
                    };

                    if (currentZoom >= ZOOM_THRESHOLD) {
                        if (busStopCircles.has(stopName) && layerGroup.hasLayer(busStopCircles.get(stopName))) {
                            layerGroup.removeLayer(busStopCircles.get(stopName));
                        }

                        if (!busStopMarkers.has(stopName)) {
                            const marker = createBusStopIcon(stop.coordinates);
                            marker.bindPopup(popupContent);
                            marker.on('popupopen', bindPopupLineLinks);

                            marker.on('click', function (_e) {
                                setTimeout(() => {
                                    createWalkingCircles(stop.coordinates, stop.name);
                                }, 100);
                            });

                            busStopMarkers.set(stopName, marker);
                            marker.addTo(layerGroup);
                        } else if (!layerGroup.hasLayer(busStopMarkers.get(stopName))) {
                            busStopMarkers.get(stopName).addTo(layerGroup);
                        }
                    } else {
                        if (busStopMarkers.has(stopName) && layerGroup.hasLayer(busStopMarkers.get(stopName))) {
                            layerGroup.removeLayer(busStopMarkers.get(stopName));
                        }

                        if (busStopCircles.has(stopName) && layerGroup.hasLayer(busStopCircles.get(stopName))) {
                            layerGroup.removeLayer(busStopCircles.get(stopName));
                        }

                        const circle = createBusStopCircle(stop.coordinates);
                        circle.bindPopup(popupContent);
                        circle.on('popupopen', bindPopupLineLinks);

                        circle.on('click', function (_e) {
                            setTimeout(() => {
                                createWalkingCircles(stop.coordinates, stop.name);
                            }, 100);
                        });

                        busStopCircles.set(stopName, circle);
                        circle.addTo(layerGroup);
                    }
                });
            };

            updateBusStopDisplay();
            map.on('zoomend', updateBusStopDisplay);
        };

        const busStops = L.layerGroup();
        const trainStations = L.layerGroup();
        const mainBusStations = L.layerGroup();
        const airportShuttles = L.layerGroup();
        const touristBus = L.layerGroup();
        const bikeStations = L.layerGroup();

        displayBusStops(map, busStops);

        FetchHelper.fetchJSON('data/transport/transport_hubs.json')
            .then((data) => {
                data.hubs.forEach((hub) => {
                    let marker;
                    switch (hub.type) {
                        case 'train-station':
                            marker = L.marker([hub.lat, hub.lng], {
                                icon: createFontAwesomeIcon('fa-train', '#ff8369'),
                            }).bindPopup(createTrainStationPopup(hub.name, hub.info, hub.destinations));
                            marker.addTo(trainStations);
                            break;
                        case 'bus-station':
                            marker = L.marker([hub.lat, hub.lng], {
                                icon: createFontAwesomeIcon('fa-bus', '#0e5287'),
                            }).bindPopup(createMainBusStationPopup(hub.name, hub.info));
                            marker.addTo(mainBusStations);
                            break;
                        case 'terminal-bus-station':
                            marker = L.marker([hub.lat, hub.lng], {
                                icon: createFontAwesomeIcon('fa-bus', '#0e5287'),
                            }).bindPopup(createTerminalBusStationPopup(hub.name, hub.info, hub.description));
                            marker.addTo(mainBusStations);
                            break;
                        case 'airport-transfer':
                            marker = L.marker([hub.lat, hub.lng], {
                                icon: createFontAwesomeIcon('fa-shuttle-van', '#4d4d99'),
                            }).bindPopup(createShuttlePopup(hub.name, hub.info));
                            marker.addTo(airportShuttles);
                            break;
                        case 'bus-terminal':
                            marker = L.marker([hub.lat, hub.lng], {
                                icon: createFontAwesomeIcon('fa-route', '#57bd6d'),
                            }).bindPopup(createTouristBusPopup(hub.name, hub.info, hub.price, hub.duration));
                            marker.addTo(touristBus);
                            break;
                    }

                    if (marker) {
                        marker.on('click', function (_e) {
                            setTimeout(() => {
                                createWalkingCircles([hub.lat, hub.lng], hub.name);
                            }, 100);
                        });
                    }
                });
            })
            .catch((error) => {
                console.error('Error loading transport_hubs.json:', error);
            });

        FetchHelper.fetchJSON('data/transport/bike_stations.json')
            .then((data) => {
                data.forEach((station) => {
                    const marker = L.marker([station.lat, station.lon], {
                        icon: createFontAwesomeIcon('fa-bicycle', '#004899'),
                    }).bindPopup(createBikeStationPopup(station.name, station.capacity));
                    marker.addTo(bikeStations);

                    marker.on('click', function (_e) {
                        setTimeout(() => {
                            createWalkingCircles([station.lat, station.lon], station.name);
                        }, 100);
                    });
                });
            })
            .catch((error) => {
                console.error('Error loading bike_stations.json:', error);
            });

        const legendLayerGroups = {
            busStops,
            trainStations,
            mainBusStations,
            airportShuttles,
            touristBus,
            bikeStations,
        };

        const legendBaseMaps = {
            standard,
            light,
            dark,
            satellite,
        };

        const mapLegend = new MapLegendControl(map, legendLayerGroups, legendBaseMaps);
        mapLegend.init();

        globalMap = map;
    } catch (error) {
        console.error('Error initializing main map:', error);
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div class="map-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load map. Please refresh the page to try again.</p>
                </div>
            `;
        }
    }
};

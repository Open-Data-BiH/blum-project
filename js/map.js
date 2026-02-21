// ==========================================
// Geolocation Service - Auto-select nearest bus stop
// ==========================================
class GeolocationService {
    constructor() {
        this.userLocation = null;
    }

    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    resolve(this.userLocation);
                },
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    findNearestStops(markers, limit = 3) {
        if (!this.userLocation || !markers || markers.length === 0) {
            return [];
        }

        const calculated = [];

        markers.forEach(marker => {
            const latlng = marker.getLatLng();
            const distance = this.calculateDistance(
                this.userLocation.lat,
                this.userLocation.lng,
                latlng.lat,
                latlng.lng
            );

            // Get stop name from popup or properties if available
            // Using a hacky way to get name if not directly available, 
            // but markers passed here are from busStopMarkers Map where value is marker
            // The popup content usually has the name.

            calculated.push({
                marker,
                distance,
                lat: latlng.lat,
                lng: latlng.lng
            });
        });

        // Sort by distance ascending
        calculated.sort((a, b) => a.distance - b.distance);

        // Return top N
        return calculated.slice(0, limit);
    }
}

// Initialize geolocation service
const geoService = new GeolocationService();

// Auto-select nearest bus stop function
async function autoSelectNearestStop(map, busStopMarkers) {
    if (!map || !busStopMarkers || busStopMarkers.length === 0) {
        return;
    }

    try {
        const position = await geoService.getCurrentPosition();

        // Add user location marker
        const userMarker = L.marker([position.lat, position.lng], {
            icon: L.divIcon({
                className: 'user-location-marker',
                html: '<i class="fas fa-street-view" style="color: #007bff; font-size: 28px;"></i>',
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            }),
            zIndexOffset: 1000
        }).addTo(map);

        userMarker.bindPopup('<strong>📍 Vaša lokacija / Your location</strong>').openPopup();

        // Find nearest stops (top 3)
        const nearestStops = geoService.findNearestStops(busStopMarkers, 3);

        if (nearestStops.length > 0) {

            // Use closest stop for main calculations/view
            const closest = nearestStops[0];

            // Pan to bounds containing user and the 3 stops
            const bounds = L.latLngBounds([position.lat, position.lng]);
            nearestStops.forEach(stop => bounds.extend([stop.lat, stop.lng]));

            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

            // Clear any existing lines if we were storing them (we aren't currently, so they pile up - improving this)
            if (window.currentGeoLines) {
                window.currentGeoLines.forEach(line => map.removeLayer(line));
            }
            window.currentGeoLines = [];

            // Draw lines to all nearest stops
            nearestStops.forEach((stop, index) => {
                const isClosest = index === 0;
                const color = isClosest ? '#28a745' : '#17a2b8'; // Green for #1, Blue for others
                const weight = isClosest ? 4 : 2;
                const opacity = isClosest ? 0.8 : 0.5;

                const line = L.polyline([
                    [position.lat, position.lng],
                    [stop.lat, stop.lng]
                ], {
                    color: color,
                    weight: weight,
                    opacity: opacity,
                    dashArray: '10, 10'
                }).addTo(map);

                window.currentGeoLines.push(line);
            });

            // Open nearest stop popup after a delay
            setTimeout(() => {
                closest.marker.openPopup();
            }, 1000);

            // Create list for user popup
            let stopsHtml = '<ul style="margin: 5px 0; padding-left: 20px;">';
            nearestStops.forEach(stop => {
                // Try to extract name from marker popup content if possible, or just show distance
                // Note: Getting content from L.marker is tricky if it's not open.
                // Assuming marker instance has some metadata or we extract from popup content string

                // Let's rely on distance for now as name extraction is fragile without refactoring marker creation
                stopsHtml += `<li><strong>${stop.distance.toFixed(2)} km</strong></li>`;
            });
            stopsHtml += '</ul>';

            // Add distance info to user marker popup
            userMarker.setPopupContent(
                `<div style="min-width: 200px;">
                    <strong>📍 Vaša lokacija / Your location</strong><br>
                    <hr style="margin: 5px 0;">
                    Najbliža stajališta / Nearest stops:<br>
                    ${stopsHtml}
                </div>`
            );
            userMarker.openPopup();
        }
    } catch (error) {
        console.error('Geolocation error:', error.message);
        throw error; // Re-throw to be handled by caller
    }
}

// Map configuration constants
const MAP_CONFIG = {
    CENTER: [44.7866, 17.1975],
    ZOOM: 13,
    MIN_ZOOM: 12,
    MAX_ZOOM: 17,
    ZOOM_THRESHOLD: 15,
    WALKING_RADIUS_5MIN: 400,
    CHECK_INTERVAL: 100,
    TIMEOUT_DURATION: 10000,
    BUS_STOP_COLOR: '#72aaff'
};

// Extract ZOOM_THRESHOLD for easier reference
const ZOOM_THRESHOLD = MAP_CONFIG.ZOOM_THRESHOLD;

// Global variables for walking distance circles
let currentWalkingCircles = [];
let globalMap = null;

// Modern Promise-based bus routes loader
const waitForBusRoutes = () => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Bus routes data timeout')), MAP_CONFIG.TIMEOUT_DURATION);
    const interval = setInterval(() => {
        if (window.bus_routes !== undefined) {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve();
        }
    }, MAP_CONFIG.CHECK_INTERVAL);
});

// Map initialization and functionality (Modern ES6+)
document.addEventListener('DOMContentLoaded', () => {
    const hasMainMap = Boolean(document.getElementById('map-container'));
    const hasAirportMap = Boolean(document.getElementById('airport-map'));

    // Wait for bus_routes data to be available before initializing maps
    if (window.bus_routes !== undefined) {
        if (hasMainMap) {
            initializeMainMap();
        }
        if (hasAirportMap) {
            initializeAirportMap();
        }
    } else {
        waitForBusRoutes()
            .then(() => {
                if (hasMainMap) {
                    initializeMainMap();
                }
                if (hasAirportMap) {
                    initializeAirportMap();
                }
            })
            .catch(error => {
                console.error('Bus routes data failed to load:', error);
                // Initialize maps without bus stops if data fails to load
                if (hasMainMap) {
                    initializeMainMap();
                }
                if (hasAirportMap) {
                    initializeAirportMap();
                }
            });
    }
});

// Function to clear existing walking circles (Modern ES6+)
const clearWalkingCircles = () => {
    if (globalMap && currentWalkingCircles.length > 0) {
        currentWalkingCircles.forEach(circle => globalMap.removeLayer(circle));
        currentWalkingCircles = [];
    }
};

// Function to create walking distance circles around a station (Modern ES6+)
const createWalkingCircles = (coordinates, _stationName) => {
    if (!globalMap) {
        console.error('Global map not available for walking circles');
        return;
    }

    clearWalkingCircles();

    // Create only 5-minute walking circle (~400m radius)
    const circle5min = L.circle(coordinates, {
        radius: MAP_CONFIG.WALKING_RADIUS_5MIN,
        color: '#4CAF50',
        fillColor: '#4CAF50',
        fillOpacity: 0.2,
        weight: 2,
        opacity: 0.7
    });

    circle5min.addTo(globalMap);

    // Calculate position for icon on circle boundary (bottom-right, -45 degrees)
    const radiusInDegrees = MAP_CONFIG.WALKING_RADIUS_5MIN / 111320; // Convert to degrees
    const angleInRadians = -Math.PI / 4; // -45 degrees in radians
    const iconLat = coordinates[0] + (radiusInDegrees * Math.sin(angleInRadians));
    const iconLng = coordinates[1] + (radiusInDegrees * Math.cos(angleInRadians));

    // Create walking icon marker on circle boundary
    const walkingIcon = L.divIcon({
        html: `<div class="walking-circle-icon">
                 <i class="fas fa-walking"></i>
                 <span>5min</span>
               </div>`,
        className: '',
        iconSize: [60, 28],
        iconAnchor: [30, 14]
    });

    const iconMarker = L.marker([iconLat, iconLng], {
        icon: walkingIcon,
        interactive: false
    });

    iconMarker.addTo(globalMap);

    // Store both circle and icon for later removal
    currentWalkingCircles = [circle5min, iconMarker];
};

// Initialize the main map (Modern ES6+)
const initializeMainMap = () => {
    try {
        // Check if map container exists
        const mapContainer = document.getElementById("map-container");
        if (!mapContainer) {
            console.error('Map container element not found');
            return;
        }

        // Extended bounds for Banja Luka area with more north-south coverage
        const mapBounds = L.latLngBounds([
            [44.67794605215712, 16.90471973252053], // Southwest corner
            [44.996414749446565, 17.620029520676]  // Northeast corner
        ]);

        const map = L.map("map-container", {
            center: MAP_CONFIG.CENTER,
            zoom: MAP_CONFIG.ZOOM,
            maxBounds: mapBounds,
            maxBoundsViscosity: 1.0,
            zoomControl: false,
            minZoom: MAP_CONFIG.MIN_ZOOM,
            maxZoom: MAP_CONFIG.MAX_ZOOM,
        });

        // Add zoom control to bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);

        // Add custom "Locate Me" control
        const locateControl = L.Control.extend({
            options: {
                position: 'bottomright'
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

                    // Add loading class
                    button.classList.add('loading');

                    // Access bus stops safely
                    let markers = [];
                    if (window.busStopMarkersMap) {
                        markers = Array.from(window.busStopMarkersMap.values());
                    } else {
                        console.warn('Bus stop markers not populated yet.');
                    }

                    if (markers.length === 0) {
                        alert("Bus stops are still loading or could not be loaded. Please wait a moment and try again.");
                        button.classList.remove('loading');
                        return;
                    }

                    // Call geolocation
                    autoSelectNearestStop(map, markers)
                        .then(() => {
                            button.classList.remove('loading');
                        })
                        .catch((error) => {
                            console.error("Geolocation failed:", error);
                            button.classList.remove('loading');
                            // Show friendly error
                            if (error.code === 1) { // PERMISSION_DENIED
                                alert("Please allow location access to use this feature.");
                            } else if (error.message && error.message.includes("secure context")) {
                                alert("Geolocation requires a secure connection (HTTPS) or localhost.");
                            } else {
                                alert("Could not determine your location. Please check your GPS settings.");
                            }
                        });
                });

                return container;
            }
        });
        map.addControl(new locateControl());

        const standard = L.tileLayer('https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution">CARTO</a>'
        });

        const light = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, ' +
                '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, ' +
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        }).addTo(map);


        const dark = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, ' +
                '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, ' +
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        });

        const satellite = L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
                attribution:
                    "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye",
            }
        );

        // Create enhanced markers with detailed information (Modern ES6+)
        const createFontAwesomeIcon = (iconClass, color) => L.divIcon({
            html: `<i class="fa-solid ${iconClass} fa-icon-marker" style="color:${color};"></i>`,
            className: "",
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });

        // Function to display unique bus stops from the bus_routes data (Modern ES6+)
        const displayBusStops = (map, layerGroup) => {
            // Check if bus_routes data is available
            if (window.bus_routes === undefined) {
                console.warn('Bus routes data not available, skipping bus stops display');
                return;
            }

            // Create a collection of unique stops using Map
            const uniqueStops = new Map();

            // Define ordered keys for sorting line numbers
            const orderedKeys = Object.keys(window.bus_routes).sort((a, b) => {
                const aNum = parseInt(a.replace(/[^\d]/g, ''));
                const bNum = parseInt(b.replace(/[^\d]/g, ''));
                return aNum - bNum;
            });

            // Process each route and collect unique stops
            for (const lineId in window.bus_routes) {
                const line = window.bus_routes[lineId];
                // Process both directions
                for (const directionId in line.directions) {
                    const direction = line.directions[directionId];

                    // Process each stop in this direction
                    direction.stops.forEach((stopName, index) => {
                        const coordinates = direction.coordinates[index];
                        const street = direction.streets ? direction.streets[index] : direction.ulice[index]; // Support both field names

                        if (!uniqueStops.has(stopName)) {
                            // First time seeing this stop - add it to our collection
                            uniqueStops.set(stopName, {
                                name: stopName,
                                coordinates: coordinates,
                                street: street,
                                lines: new Set([lineId])
                            });
                        } else {
                            // We've seen this stop before - just add the line to its list
                            uniqueStops.get(stopName).lines.add(lineId);
                        }
                    });
                }
            }

            // Store markers for zoom-based display
            const busStopMarkers = new Map();
            window.busStopMarkersMap = busStopMarkers; // Expose globally for geolocation
            const busStopCircles = new Map();

            // Function to create a simple circle marker for low zoom levels
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
                    fillOpacity: 0.6
                });
            };

            // Function to create full icon marker for high zoom levels
            const createBusStopIcon = (coordinates) => L.marker(coordinates, {
                icon: createFontAwesomeIcon("fa-bus-simple", MAP_CONFIG.BUS_STOP_COLOR),
            });

            // Function to update bus stop display based on zoom level
            const updateBusStopDisplay = () => {
                const currentZoom = map.getZoom();

                uniqueStops.forEach((stop, stopName) => {
                    // Convert the Set of lines to an Array and sort them
                    const sortedLines = Array.from(stop.lines);
                    sortedLines.sort((a, b) => {
                        return orderedKeys.indexOf(a) - orderedKeys.indexOf(b);
                    });

                    // Create the popup content with the stop name, street, and lines
                    const popupContent = `
                    <div class="hub-popup">
                        <h3>${escapeHTML(stop.name)}</h3>
                        <p>Linije | Lines: ${sortedLines.map(lineId => {
                        const lineColor = window.bus_routes[lineId].color || window.bus_routes[lineId].colour || '#72aaff';
                        return `<a href="#" class="line-number-link"
                                    style="color:${escapeHTML(lineColor)}"
                                    data-line-id="${escapeHTML(lineId)}">${escapeHTML(lineId)}</a>`;
                    }).join(', ')}</p>
                        <a href="#timetable" class="popup-link">Pogledaj red vožnje | View timetables</a>
                    </div>
                `;

                    const bindPopupLineLinks = (e) => {
                        const container = e.popup.getElement();
                        if (!container) { return; }
                        container.querySelectorAll('.line-number-link[data-line-id]').forEach(link => {
                            link.addEventListener('click', (evt) => {
                                evt.preventDefault();
                                window.showBusLine(link.dataset.lineId);
                            });
                        });
                    };

                    if (currentZoom >= ZOOM_THRESHOLD) {
                        // High zoom - show full icons

                        // Remove circle if it exists
                        if (busStopCircles.has(stopName) && layerGroup.hasLayer(busStopCircles.get(stopName))) {
                            layerGroup.removeLayer(busStopCircles.get(stopName));
                        }

                        // Add or update icon marker
                        if (!busStopMarkers.has(stopName)) {
                            const marker = createBusStopIcon(stop.coordinates);
                            marker.bindPopup(popupContent);
                            marker.on('popupopen', bindPopupLineLinks);

                            // Add click event to show walking distance circles
                            marker.on('click', function (_e) {
                                // Show walking circles after a small delay to allow popup to open first
                                setTimeout(() => {
                                    createWalkingCircles(stop.coordinates, stop.name);
                                }, 100);
                            });

                            busStopMarkers.set(stopName, marker);
                            marker.addTo(layerGroup);
                        } else if (!layerGroup.hasLayer(busStopMarkers.get(stopName))) {
                            // Re-add existing marker if it's not on the map
                            busStopMarkers.get(stopName).addTo(layerGroup);
                        }
                    } else {
                        // Low zoom - show simple circles

                        // Remove icon marker if it exists
                        if (busStopMarkers.has(stopName) && layerGroup.hasLayer(busStopMarkers.get(stopName))) {
                            layerGroup.removeLayer(busStopMarkers.get(stopName));
                        }

                        // Always recreate circle to ensure proper scaling based on zoom level
                        if (busStopCircles.has(stopName) && layerGroup.hasLayer(busStopCircles.get(stopName))) {
                            layerGroup.removeLayer(busStopCircles.get(stopName));
                        }

                        // Create new circle with updated size
                        const circle = createBusStopCircle(stop.coordinates);
                        circle.bindPopup(popupContent);
                        circle.on('popupopen', bindPopupLineLinks);

                        // Add click event to show walking distance circles
                        circle.on('click', function (_e) {
                            // Show walking circles after a small delay to allow popup to open first
                            setTimeout(() => {
                                createWalkingCircles(stop.coordinates, stop.name);
                            }, 100);
                        });

                        busStopCircles.set(stopName, circle);
                        circle.addTo(layerGroup);
                    }
                });
            }

            // Initial display
            updateBusStopDisplay();

            // Add zoom event listener to update display when zoom changes
            map.on('zoomend', updateBusStopDisplay);

        };

        // Initialize Layer Groups
        const busStops = L.layerGroup();
        const trainStations = L.layerGroup();
        const mainBusStations = L.layerGroup();
        const airportShuttles = L.layerGroup();
        const touristBus = L.layerGroup();
        const bikeStations = L.layerGroup(); // New layer for bike stations

        // Display unique bus stops on the map
        displayBusStops(map, busStops);

        // Fetch and process transport hubs
        FetchHelper.fetchJSON('data/transport/transport_hubs.json')
            .then(data => {
                data.hubs.forEach(hub => {
                    let marker;
                    switch (hub.type) {
                        case 'train-station':
                            marker = L.marker([hub.lat, hub.lng], {
                                icon: createFontAwesomeIcon("fa-train", "#ff8369"),
                            }).bindPopup(createTrainStationPopup(hub.name, hub.info, hub.destinations));
                            marker.addTo(trainStations);
                            break;
                        case 'bus-station':
                            marker = L.marker([hub.lat, hub.lng], {
                                icon: createFontAwesomeIcon("fa-bus", "#0e5287"),
                            }).bindPopup(createMainBusStationPopup(hub.name, hub.info));
                            marker.addTo(mainBusStations);
                            break;
                        case 'terminal-bus-station':
                            marker = L.marker([hub.lat, hub.lng], {
                                icon: createFontAwesomeIcon("fa-bus", "#0e5287"),
                            }).bindPopup(createTerminalBusStationPopup(hub.name, hub.info, hub.description));
                            marker.addTo(mainBusStations);
                            break;
                        case 'airport-transfer':
                            marker = L.marker([hub.lat, hub.lng], {
                                icon: createFontAwesomeIcon("fa-shuttle-van", "#4d4d99"),
                            }).bindPopup(createShuttlePopup(hub.name, hub.info));
                            marker.addTo(airportShuttles);
                            break;
                        case 'bus-terminal':
                            marker = L.marker([hub.lat, hub.lng], {
                                icon: createFontAwesomeIcon("fa-route", "#57bd6d"),
                            }).bindPopup(createTouristBusPopup(hub.name, hub.info, hub.price, hub.duration));
                            marker.addTo(touristBus);
                            break;
                    }

                    // Add walking distance circles functionality to all transport hub markers
                    if (marker) {
                        marker.on('click', function (_e) {
                            // Show walking circles after a small delay to allow popup to open first
                            setTimeout(() => {
                                createWalkingCircles([hub.lat, hub.lng], hub.name);
                            }, 100);
                        });
                    }
                });
            })
            .catch(error => {
                console.error('Error loading transport_hubs.json:', error);
                // Create error message for transport hubs
                const errorMessage = document.createElement('div');
                errorMessage.className = 'map-error';
                errorMessage.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <p>Failed to load transport hub data. Please refresh the page to try again.</p>
            `;
                // You could append this to a specific container if needed
            });

        // Fetch and process bike stations
        FetchHelper.fetchJSON('data/transport/bike_stations.json')
            .then(data => {
                data.forEach(station => {
                    const marker = L.marker([station.lat, station.lon], {
                        icon: createFontAwesomeIcon("fa-bicycle", "#004899"), // Example icon and color
                    }).bindPopup(createBikeStationPopup(station.name, station.capacity));
                    marker.addTo(bikeStations);

                    // Add walking distance circles functionality to bike station markers
                    marker.on('click', function (_e) {
                        // Show walking circles after a small delay to allow popup to open first
                        setTimeout(() => {
                            createWalkingCircles([station.lat, station.lon], station.name);
                        }, 100);
                    });
                });
            })
            .catch(error => {
                console.error('Error loading bike_stations.json:', error);
            });

        // Initialize custom map legend control
        const legendLayerGroups = {
            busStops,
            trainStations,
            mainBusStations,
            airportShuttles,
            touristBus,
            bikeStations
        };

        const legendBaseMaps = {
            standard,
            light,
            dark,
            satellite
        };

        // Create and initialize legend control
        // Note: Legend will manage layer visibility based on config defaults
        const mapLegend = new MapLegendControl(map, legendLayerGroups, legendBaseMaps);
        mapLegend.init();

        // Store reference for external access
        window.mapLegendControl = mapLegend;

        globalMap = map;

    } catch (error) {
        console.error('Error initializing main map:', error);
        // Show error message in map container
        const mapContainer = document.getElementById("map-container");
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div class="map-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load map. Please refresh the page to try again.</p>
                </div>
            `;
        }
    }
}

// Initialize the airport map (Modern ES6+)
const initializeAirportMap = () => {
    try {
        // Check if airport map container exists
        const airportMapContainer = document.getElementById("airport-map");
        if (!airportMapContainer) {
            return;
        }
        // Bounds for the airport area
        const airportMapBounds = L.latLngBounds([
            [44.76, 17.18], // Southwest corner
            [44.79, 17.21]  // Northeast corner
        ]);

        const airportMap = L.map("airport-map", {
            center: [44.7722, 17.191],
            zoom: 14,
            scrollWheelZoom: false,
            zoomControl: false, // Remove default zoom control to reposition it
            maxBounds: airportMapBounds,
            maxBoundsViscosity: 1.0, // Prevents panning outside bounds
            minZoom: 13 // Prevent zooming out too far
        });

        // Add zoom control to bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(airportMap);

        L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, ' +
                '&copy; <a href="https://openmaptiles.org/">OpenMapTiles</a>, ' +
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        }).addTo(airportMap);

        // Add airport shuttle marker with enhanced popup
        const airportIcon = L.divIcon({
            html: `<i class="fa-solid fa-shuttle-van fa-icon-marker" style="color:#4d4d99;"></i>`,
            className: "",
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });

        L.marker([44.7722, 17.191], {
            icon: airportIcon,
        })
            .bindPopup(createShuttlePopup(
                "Airport Shuttle Stop - Stara autobuska stanica", "Plaćeni parking | Paid parking"
            ))
            .addTo(airportMap);
    } catch (error) {
        console.error('Error initializing airport map:', error);
        // Show error message in airport map container
        const airportMapContainer = document.getElementById("airport-map");
        if (airportMapContainer) {
            airportMapContainer.innerHTML = `
                <div class="map-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load airport map. Please refresh the page to try again.</p>
                </div>
            `;
        }
    }
}

// Functions to create enhanced popups (Modern ES6+)
const createTrainStationPopup = (name, info, destinations) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>${escapeHTML(info)}</p>
      <p>Destinacije | Destinations: <br> <strong>${escapeHTML(destinations)}</strong></p>
      <a href="https://www.zrs-rs.com" target="_blank" rel="noopener noreferrer" class="popup-link">Official Railway Website</a>
    </div>
`;

const createShuttlePopup = (name, info) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>${escapeHTML(info)}</p>
      <p>Karte se kupuju u autobusu | Tickets are available on the bus</p>
      <a href="#airport" class="popup-link">Airport Transfer Info</a>
    </div>
`;

const createTouristBusPopup = (name, info, price, duration) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>${escapeHTML(info)}</p>
      <p>Trajanje vožnje | Trip duration: ${escapeHTML(duration)}</p>
      <p>Cijena | Price: ${escapeHTML(price)}</p>
      <a href="https://www.banjaluka.rs.ba/banj-bus-na-raspolaganju-od-1-maja/" target="_blank" rel="noopener noreferrer" class="popup-link">Banj Bus Info</a>
    </div>
`;

const createMainBusStationPopup = (name, info) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>${escapeHTML(info)}</p>
      <a href="https://www.as-banjaluka.com/" target="_blank" rel="noopener noreferrer" class="popup-link">Official Website</a>
    </div>
`;

const createTerminalBusStationPopup = (name, info, description) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>${escapeHTML(info)}</p>
      <p>${escapeHTML(description)}</p>
    </div>
`;

// Function to create popup for bike stations (Modern ES6+)
const createBikeStationPopup = (name, capacity) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>Kapacitet | Capacity: ${escapeHTML(String(capacity))}</p>
      <a href="https://www.nextbike.ba/bs/banjaluka/" target="_blank" rel="noopener noreferrer" class="popup-link">Nextbike BL Info</a>
    </div>
`;

// Global function to show bus line details when clicked in popup (Modern ES6+)
window.showBusLine = (lineId) => {
    // First, scroll to the timetable section
    const timetableElement = document.getElementById('timetable');
    if (timetableElement) {
        timetableElement.scrollIntoView({ behavior: 'smooth' });
    }

    // Wait a moment for the scroll to complete, then select the line
    setTimeout(() => {
        const lineSelect = document.getElementById('line-select');
        if (lineSelect) {
            lineSelect.value = lineId.toUpperCase();
            lineSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, 500);

    // Fire an event that other scripts can listen for
    document.dispatchEvent(new CustomEvent('busLineSelected', { detail: { lineId } }));
};

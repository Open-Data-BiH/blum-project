// Map initialization and functionality
document.addEventListener('DOMContentLoaded', function () {
    // Wait for bus_routes data to be available before initializing maps
    if (typeof window.bus_routes !== 'undefined') {
        initializeMainMap();
        initializeAirportMap();
    } else {
        // Wait for bus_routes to load
        const checkBusRoutes = setInterval(() => {
            if (typeof window.bus_routes !== 'undefined') {
                clearInterval(checkBusRoutes);
                initializeMainMap();
                initializeAirportMap();
            }
        }, 100); // Check every 100ms

        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(checkBusRoutes);
            if (typeof window.bus_routes === 'undefined') {
                console.error('Bus routes data failed to load within timeout period');
                // Initialize maps without bus stops if data fails to load
                initializeMainMap();
                initializeAirportMap();
            }
        }, 10000);
    }
});

// Global variables for walking distance circles
let currentWalkingCircles = [];
let globalMap = null;

// Function to clear existing walking circles
function clearWalkingCircles() {
    if (globalMap && currentWalkingCircles.length > 0) {
        currentWalkingCircles.forEach(circle => {
            globalMap.removeLayer(circle);
        });
        currentWalkingCircles = [];
        console.log('Cleared existing walking circles');
    }
}

// Function to create walking distance circles around a station
function createWalkingCircles(coordinates, stationName) {
    if (!globalMap) {
        console.error('Global map not available for walking circles');
        return;
    }

    console.log('Creating walking circles for:', stationName, 'at coordinates:', coordinates);
    clearWalkingCircles();

    // Create only 5-minute walking circle (~400m radius)
    const circle5min = L.circle(coordinates, {
        radius: 400,
        color: '#4CAF50',
        fillColor: '#4CAF50',
        fillOpacity: 0.2,
        weight: 2,
        opacity: 0.7
    });

    // Add circle to map (no popup)
    circle5min.addTo(globalMap);

    // Calculate position for icon on circle boundary (bottom-right, -45 degrees)
    const radiusInDegrees = 400 / 111320; // Convert 400m to degrees (approximate)
    const angleInRadians = -Math.PI / 4; // -45 degrees in radians (bottom-right)
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
        interactive: false // Make it non-interactive so it doesn't interfere with clicks
    });

    iconMarker.addTo(globalMap);

    // Store both circle and icon for later removal
    currentWalkingCircles = [circle5min, iconMarker];
    console.log('Added 5-minute walking circle with icon to map');
}

// Initialize the main map
function initializeMainMap() {
    try {
        // Check if map container exists
        const mapContainer = document.getElementById("map-container");
        if (!mapContainer) {
            console.error('Map container element not found');
            return;
        }

        // Extended bounds for Banja Luka area with more north-south coverage
        const mapBounds = L.latLngBounds([
            [44.67794605215712, 16.90471973252053], // Southwest corner (extended more south)
            [44.996414749446565, 17.620029520676]  // Northeast corner
        ]);

        const map = L.map("map-container", {
            center: [44.7866, 17.1975], // Centered on Banja Luka city center
            zoom: 13,
            maxBounds: mapBounds,
            maxBoundsViscosity: 1.0, // Prevents panning outside bounds
            zoomControl: false, // Remove default zoom control to reposition it
            minZoom: 12, // Prevent zooming out too far
            maxZoom: 17, // Limit maximum zoom to prevent going too deep
        });


        // Add zoom control to bottom right
        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);

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

        // Create enhanced markers with detailed information
        function createFontAwesomeIcon(iconClass, color) {
            return L.divIcon({
                html: `<i class="fa-solid ${iconClass} fa-icon-marker" style="color:${color};"></i>`,
                className: "",
                iconSize: [30, 30],
                iconAnchor: [15, 15],
            });
        }

        // Function to display unique bus stops from the bus_routes data
        function displayBusStops(map, layerGroup) {
            // Check if bus_routes data is available
            if (typeof window.bus_routes === 'undefined') {
                console.warn('Bus routes data not available, skipping bus stops display');
                return;
            }

            // Create a collection of unique stops
            const uniqueStops = new Map(); // Using Map to store unique stops by name

            // Define ordered keys for sorting line numbers
            const orderedKeys = Object.keys(window.bus_routes).sort((a, b) => {
                const aNum = parseInt(a.replace(/[^\d]/g, ''));
                const bNum = parseInt(b.replace(/[^\d]/g, ''));
                return aNum - bNum;
            });

            // Process each route and collect unique stops
            for (const lineId in window.bus_routes) {
                const line = window.bus_routes[lineId];
                const lineColor = line.color || line.colour; // Support both spellings

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
            const busStopCircles = new Map();
            const BUS_STOP_COLOR = "#72aaff"; // Bus stop icon color

            // Function to create a simple circle marker for low zoom levels
            function createBusStopCircle(coordinates) {
                const currentZoom = map.getZoom();
                // Scale radius based on zoom level - larger at higher zoom levels
                const baseRadius = 3;
                const scaleFactor = Math.max(1, currentZoom - 11) * 0.5;
                const radius = Math.min(baseRadius + scaleFactor, 6); // Cap at 6px radius

                return L.circleMarker(coordinates, {
                    radius: radius,
                    fillColor: BUS_STOP_COLOR,
                    color: BUS_STOP_COLOR,
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.6
                });
            }

            // Function to create full icon marker for high zoom levels
            function createBusStopIcon(coordinates) {
                return L.marker(coordinates, {
                    icon: createFontAwesomeIcon("fa-bus-simple", BUS_STOP_COLOR),
                });
            }

            // Function to update bus stop display based on zoom level
            function updateBusStopDisplay() {
                const currentZoom = map.getZoom();
                const ZOOM_THRESHOLD = 15; // Switch to icons at zoom level 14 and above

                uniqueStops.forEach((stop, stopName) => {
                    // Convert the Set of lines to an Array and sort them
                    let sortedLines = Array.from(stop.lines);
                    sortedLines.sort((a, b) => {
                        return orderedKeys.indexOf(a) - orderedKeys.indexOf(b);
                    });

                    // Create the popup content with the stop name, street, and lines
                    const popupContent = `
                    <div class="hub-popup">
                        <h3>${stop.name}</h3>
                        <p>Linije | Lines: ${sortedLines.map(lineId => {
                        const lineColor = window.bus_routes[lineId].color || window.bus_routes[lineId].colour || '#72aaff';
                        return `<a href="#" class="line-number-link" 
                                    style="color:${lineColor}" 
                                    onclick="window.showBusLine('${lineId}'); return false;">${lineId}</a>`;
                    }).join(', ')}</p>
                        <a href="#timetable" class="popup-link">Pogledaj red vožnje | View timetables</a>
                    </div>
                `;

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

                            // Add click event to show walking distance circles
                            marker.on('click', function (e) {
                                console.log('Bus stop clicked:', stop.name);
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

                        // Add click event to show walking distance circles
                        circle.on('click', function (e) {
                            console.log('Bus stop clicked:', stop.name);
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

            console.log(`Added ${uniqueStops.size} unique bus stops to the map with zoom-based display`);
        }

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
        fetch('data/transport/transport_hubs.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
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
                        marker.on('click', function (e) {
                            console.log('Bus stop clicked:', hub.name);
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
        fetch('data/transport/bike_stations.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                data.forEach(station => {
                    const marker = L.marker([station.lat, station.lon], {
                        icon: createFontAwesomeIcon("fa-bicycle", "#004899"), // Example icon and color
                    }).bindPopup(createBikeStationPopup(station.name, station.capacity));
                    marker.addTo(bikeStations);

                    // Add walking distance circles functionality to bike station markers
                    marker.on('click', function (e) {
                        console.log('Bike station clicked:', station.name);
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

        const baseMaps = {
            "Standardni | Standard": standard,
            "Svijetli | Light": light,
            "Tamni | Dark": dark,
            "Satelitski | Satellite": satellite,
        };

        const overlayMaps = {
            "Autobuska stajališta | Bus Stops": busStops,
            "Željezničke stanice | Train Stations": trainStations,
            "Glavna autobuska stanica | Main Bus Station": mainBusStations,
            "Aerodromski transfer | Airport Shuttle": airportShuttles,
            "Turistički autobus | Tourist Bus": touristBus,
            "Nextbike stanice | Nextbike Stations": bikeStations,
        };

        // Add layer control to bottom right
        L.control.layers(baseMaps, overlayMaps, {
            position: 'bottomright'
        }).addTo(map);

        // Load default overlays
        busStops.addTo(map);
        trainStations.addTo(map);
        airportShuttles.addTo(map);
        touristBus.addTo(map);
        mainBusStations.addTo(map);
        bikeStations.addTo(map); // Add bike stations to map by default

        globalMap = map;

        console.log('Main map initialized successfully');
        console.log('Walking circles functions available:', typeof createWalkingCircles === 'function');
        console.log('Global map reference set:', globalMap !== null);
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

// Initialize the airport map
function initializeAirportMap() {
    try {
        // Check if airport map container exists
        const airportMapContainer = document.getElementById("airport-map");
        if (!airportMapContainer) {
            console.error('Airport map container element not found');
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

// Functions to create enhanced popups
function createTrainStationPopup(name, info, destinations) {
    return `
    <div class="hub-popup">
      <h3>${name}</h3>
      <p>${info}</p>
      <p>Destinacije | Destinations: <br> <strong>${destinations}</strong></p>
      <a href="https://www.zrs-rs.com" target="_blank" class="popup-link">Official Railway Website</a>
    </div>
  `;
}

function createShuttlePopup(name, info) {
    return `
    <div class="hub-popup">
      <h3>${name}</h3>
      <p>${info}</p>
      <p>Karte se kupuju u autobusu | Tickets are available on the bus</p>
      <a href="#airport" class="popup-link">Airport Transfer Info</a>
    </div>
  `;
}

function createTouristBusPopup(name, info, price, duration) {
    return `
    <div class="hub-popup">
      <h3>${name}</h3>
      <p>${info}</p>
      <p>Trajanje vožnje | Trip duration: ${duration}</p>
      <p>Cijena | Price: ${price}</p>
      <a href="https://www.banjaluka.rs.ba/banj-bus-na-raspolaganju-od-1-maja/" target="_blank" class="popup-link">Banj Bus Info</a>
    </div>
  `;
}

function createMainBusStationPopup(name, info) {
    return `
    <div class="hub-popup">
      <h3>${name}</h3>
      <p>${info}</p>
      <a href="https://www.as-banjaluka.com/" target="_blank" class="popup-link">Official Website</a>
    </div>
  `;
}

function createTerminalBusStationPopup(name, info, description) {
    return `
    <div class="hub-popup">
      <h3>${name}</h3>
      <p>${info}</p>
      <p>${description}</p>
    </div>
  `;
}

// Function to create popup for bike stations
function createBikeStationPopup(name, capacity) {
    return `
    <div class="hub-popup">
      <h3>${name}</h3>
      <p>Kapacitet | Capacity: ${capacity}</p>
      <a href="https://www.nextbike.ba/bs/banjaluka/" target="_blank" class="popup-link">Nextbike BL Info</a>
    </div>
  `;
}

// Global function to show bus line details when clicked in popup
window.showBusLine = function (lineId) {
    // First, scroll to the timetable section
    const timetableSection = document.getElementById('timetable');
    if (timetableSection) {
        timetableSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Wait a moment for the scroll to complete, then select the line
    setTimeout(() => {
        const lineSelect = document.getElementById('line-select');

        if (lineSelect) {
            // Set the selected value
            lineSelect.value = lineId.toUpperCase();
            // Trigger the change event to load the timetable
            const changeEvent = new Event('change', { bubbles: true });
            lineSelect.dispatchEvent(changeEvent);
        }
    }, 500); // Small delay to ensure smooth scrolling completes

    // Fire an event that other scripts can listen for
    const event = new CustomEvent('busLineSelected', { detail: { lineId } });
    document.dispatchEvent(event);
};


import { createShuttlePopup } from './popups.js';

export const initializeAirportMap = () => {
    try {
        const airportMapContainer = document.getElementById('airport-map');
        if (!airportMapContainer) {
            return;
        }

        const airportMapBounds = L.latLngBounds([
            [44.76, 17.14],
            [44.82, 17.25],
        ]);

        const airportMap = L.map('airport-map', {
            center: [44.7786, 17.1974],
            zoom: 13,
            scrollWheelZoom: false,
            zoomControl: false,
            maxBounds: airportMapBounds,
            maxBoundsViscosity: 1.0,
            minZoom: 12,
        });

        L.control
            .zoom({
                position: 'bottomright',
            })
            .addTo(airportMap);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
                '&copy; <a href="https://carto.com/attribution">CARTO</a>',
            subdomains: 'abcd',
        }).addTo(airportMap);

        const airportIcon = L.divIcon({
            html: `<i class="fa-solid fa-shuttle-van fa-icon-marker" style="color:#4d4d99;"></i>`,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });

        L.marker([44.7722, 17.191], {
            icon: airportIcon,
        })
            .bindPopup(
                createShuttlePopup('Airport Shuttle Stop - Stara autobuska stanica', 'Plaćeni parking | Paid parking'),
            )
            .addTo(airportMap);

        L.marker([44.788, 17.210], {
            icon: airportIcon,
        })
            .bindPopup(
                createShuttlePopup('Airport Shuttle Stop - Glavna autobuska stanica', 'Plaćeni parking | Paid parking'),
            )
            .addTo(airportMap);

    } catch (error) {
        console.error('Error initializing airport map:', error);
        const airportMapContainer = document.getElementById('airport-map');
        if (airportMapContainer) {
            airportMapContainer.innerHTML = `
                <div class="map-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load airport map. Please refresh the page to try again.</p>
                </div>
            `;
        }
    }
};

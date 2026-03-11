// Airport map — ported from js/features/map/airport-map.js
// Uses Leaflet to show two shuttle stop markers on a CARTO basemap.

import type { Map, LatLngBoundsExpression } from 'leaflet';
import { getCurrentLanguage } from '../../core/i18n';

const langText = (bhs: string, en: string): string => (getCurrentLanguage() === 'en' ? en : bhs);
const BASE_URL = import.meta.env.BASE_URL;
const withBase = (path: string): string => `${BASE_URL}${path.replace(/^\/+/, '')}`;

export async function initAirportMap(): Promise<void> {
    const container = document.getElementById('airport-map');
    if (!container) {
        return;
    }

    try {
        const L = (await import('leaflet')).default;

        // Leaflet CSS is loaded via <link> in AirportMap.astro
        const bounds: LatLngBoundsExpression = [
            [44.72, 17.1],
            [44.97, 17.38],
        ];

        const map: Map = L.map('airport-map', {
            center: [44.85, 17.25],
            zoom: 11,
            scrollWheelZoom: false,
            zoomControl: false,
            maxBounds: bounds,
            maxBoundsViscosity: 1.0,
            minZoom: 10,
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
                '&copy; <a href="https://carto.com/attribution">CARTO</a>',
            subdomains: 'abcd',
        }).addTo(map);

        const shuttleIcon = L.divIcon({
            html: `<i class="fa-solid fa-shuttle-van fa-icon-marker" style="color:#4d4d99;"></i>`,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });

        const createOldStationPopup = (): string => `
            <div class="hub-popup">
                <h3>${langText('Stajalište aerodromskog shuttle-a - Stara autobuska stanica', 'Airport Shuttle Stop - Old Bus Station')}</h3>
                <p>${langText('Dostupan parking uz naplatu', 'Paid parking available')}</p>
                <p>${langText('Karte se kupuju u autobusu', 'Tickets are available on the bus')}</p>
                <a href="${withBase('airport/#airport')}" class="popup-link">${langText('Informacije o aerodromskom prevozu', 'Airport Transfer Info')}</a>
            </div>`;

        const createMainStationPopup = (): string => `
            <div class="hub-popup">
                <h3>${langText('Stajalište aerodromskog shuttle-a - Glavna autobuska stanica', 'Airport Shuttle Stop - Main Bus Station')}</h3>
                <p>${langText('Dostupan parking uz naplatu', 'Paid parking available')}</p>
                <p>${langText('Karte se kupuju u autobusu', 'Tickets are available on the bus')}</p>
                <a href="${withBase('airport/#airport')}" class="popup-link">${langText('Informacije o aerodromskom prevozu', 'Airport Transfer Info')}</a>
            </div>`;

        const airportIcon = L.divIcon({
            html: `<i class="fa-solid fa-plane fa-icon-marker" style="color:#c41e1e;"></i>`,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });

        const createAirportPopup = (): string => `
            <div class="hub-popup">
                <h3>${langText('Međunarodni aerodrom Banja Luka (BNX)', 'Banja Luka International Airport (BNX)')}</h3>
                <p>${langText('Mahovljani, ~25 km od centra grada', 'Mahovljani, ~25 km from city center')}</p>
                <a href="https://bnx.aero/" target="_blank" rel="noopener noreferrer" class="popup-link">${langText('Internet stranica aerodroma', 'Airport website')}</a>
            </div>`;

        const oldStationMarker = L.marker([44.7722, 17.191], { icon: shuttleIcon })
            .bindPopup(createOldStationPopup)
            .addTo(map);
        const mainStationMarker = L.marker([44.788, 17.21], { icon: shuttleIcon })
            .bindPopup(createMainStationPopup)
            .addTo(map);
        const airportMarker = L.marker([44.9338, 17.304], { icon: airportIcon })
            .bindPopup(createAirportPopup)
            .addTo(map);

        const group = L.featureGroup([oldStationMarker, mainStationMarker, airportMarker]);
        map.fitBounds(group.getBounds().pad(0.15));
    } catch (error) {
        console.error('Error initializing airport map:', error);
        const el = document.getElementById('airport-map');
        if (el) {
            el.innerHTML = `
        <div class="map-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load airport map. Please refresh the page to try again.</p>
        </div>`;
        }
    }
}

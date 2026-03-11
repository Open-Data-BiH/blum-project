// Location context map — shows airport, city center, and E661/M-16 route.
// Provides visual orientation for tourists arriving at BNX.

import type { Map, LatLngBoundsExpression } from 'leaflet';
import { getCurrentLanguage } from '../../core/i18n';

const langText = (bhs: string, en: string): string => (getCurrentLanguage() === 'en' ? en : bhs);

export async function initAirportLocationMap(): Promise<void> {
    const container = document.getElementById('airport-location-map');
    if (!container) {
        return;
    }

    try {
        const L = (await import('leaflet')).default;

        const bounds: LatLngBoundsExpression = [
            [44.72, 17.1],
            [44.97, 17.38],
        ];

        const map: Map = L.map('airport-location-map', {
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

        const airportIcon = L.divIcon({
            html: `<i class="fa-solid fa-plane fa-icon-marker" style="color:#c41e1e;"></i>`,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });

        const cityIcon = L.divIcon({
            html: `<i class="fa-solid fa-city fa-icon-marker" style="color:#1a4d73;"></i>`,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });

        const airportMarker = L.marker([44.9338, 17.304], { icon: airportIcon })
            .bindPopup(
                `<div class="hub-popup"><h3>${langText('Aerodrom BNX', 'BNX Airport')}</h3><p>Mahovljani</p></div>`,
            )
            .addTo(map);

        const cityMarker = L.marker([44.7722, 17.191], { icon: cityIcon })
            .bindPopup(
                `<div class="hub-popup"><h3>${langText('Centar Banje Luke', 'Banja Luka City Center')}</h3></div>`,
            )
            .addTo(map);

        // E661 motorway (primary route) approximation
        L.polyline(
            [
                [44.7722, 17.191],
                [44.79, 17.21],
                [44.81, 17.24],
                [44.83, 17.27],
                [44.86, 17.3],
                [44.89, 17.31],
                [44.92, 17.31],
                [44.9338, 17.304],
            ],
            {
                color: '#1a4d73',
                weight: 3,
                opacity: 0.7,
            },
        ).addTo(map);

        // M-16 alternative route approximation
        L.polyline(
            [
                [44.7722, 17.191],
                [44.795, 17.205],
                [44.82, 17.22],
                [44.85, 17.24],
                [44.88, 17.26],
                [44.91, 17.28],
                [44.9338, 17.304],
            ],
            {
                color: '#6c757d',
                weight: 2,
                opacity: 0.5,
                dashArray: '6, 6',
            },
        ).addTo(map);

        L.marker([44.865, 17.285], {
            icon: L.divIcon({
                html: `<span class="map-distance-label">~25 km · E661</span>`,
                className: '',
                iconSize: [90, 20],
                iconAnchor: [45, 10],
            }),
        }).addTo(map);

        const group = L.featureGroup([airportMarker, cityMarker]);
        map.fitBounds(group.getBounds().pad(0.2));
    } catch (error) {
        console.error('Error initializing airport location map:', error);
        const el = document.getElementById('airport-location-map');
        if (el) {
            el.innerHTML = `
        <div class="map-error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load map. Please refresh the page to try again.</p>
        </div>`;
        }
    }
}

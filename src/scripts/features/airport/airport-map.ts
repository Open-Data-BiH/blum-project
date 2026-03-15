// Airport map — ported from js/features/map/airport-map.js
// Uses Leaflet to show two shuttle stop markers on a CARTO basemap.

import type { Map, LatLngBoundsExpression, FitBoundsOptions, PointExpression, PopupOptions } from 'leaflet';
import { langText } from '../../core/i18n';

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
            maxZoom: 12,
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

        const createAirportMapPopup = (
            label: { bhs: string; en: string },
            title: { bhs: string; en: string },
            details: Array<{ icon: string; bhs: string; en: string }>,
            action?: { href: string; bhs: string; en: string; external?: boolean },
        ): string => {
            const detailRows = details
                .map(
                    ({ icon, bhs, en }) => `
                        <li class="hub-popup__item">
                            <i class="${icon} hub-popup__item-icon" aria-hidden="true"></i>
                            <span class="hub-popup__item-text">${langText(bhs, en)}</span>
                        </li>`,
                )
                .join('');

            const actionMarkup = action
                ? `
                    <a href="${action.href}" ${action.external ? 'target="_blank" rel="noopener noreferrer"' : ''} class="popup-link popup-link--airport">
                        <span>${langText(action.bhs, action.en)}</span>
                        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                    </a>`
                : '';

            return `
                <div class="hub-popup hub-popup--airport">
                    <p class="hub-popup__eyebrow">${langText(label.bhs, label.en)}</p>
                    <h3 class="hub-popup__title">${langText(title.bhs, title.en)}</h3>
                    <ul class="hub-popup__details">${detailRows}</ul>
                    ${actionMarkup}
                </div>`;
        };

        const createOldStationPopup = (): string => `
            ${createAirportMapPopup(
                { bhs: 'Aerodromski shuttle', en: 'Airport shuttle' },
                {
                    bhs: 'Stajalište aerodromskog shuttle-a - Stara autobuska stanica',
                    en: 'Airport Shuttle Stop - Old Bus Station',
                },
                [
                    {
                        icon: 'fa-solid fa-square-parking',
                        bhs: 'Dostupan parking uz naplatu',
                        en: 'Paid parking available',
                    },
                    {
                        icon: 'fa-solid fa-ticket',
                        bhs: 'Karte se kupuju u autobusu',
                        en: 'Tickets are available on the bus',
                    },
                ],
            )}`;

        const createMainStationPopup = (): string => `
            ${createAirportMapPopup(
                { bhs: 'Aerodromski shuttle', en: 'Airport shuttle' },
                {
                    bhs: 'Stajalište aerodromskog shuttle-a - Glavna autobuska stanica',
                    en: 'Airport Shuttle Stop - Main Bus Station',
                },
                [
                    {
                        icon: 'fa-solid fa-square-parking',
                        bhs: 'Dostupan parking uz naplatu',
                        en: 'Paid parking available',
                    },
                    {
                        icon: 'fa-solid fa-ticket',
                        bhs: 'Karte se kupuju u autobusu',
                        en: 'Tickets are available on the bus',
                    },
                ],
            )}`;

        const airportIcon = L.divIcon({
            html: `<i class="fa-solid fa-plane fa-icon-marker" style="color:#c41e1e;"></i>`,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });

        const createAirportPopup = (): string => `
            ${createAirportMapPopup(
                { bhs: 'Aerodrom', en: 'Airport' },
                {
                    bhs: 'Međunarodni aerodrom Banja Luka (BNX)',
                    en: 'Banja Luka International Airport (BNX)',
                },
                [
                    {
                        icon: 'fa-solid fa-location-dot',
                        bhs: 'Mahovljani, ~25 km od centra grada',
                        en: 'Mahovljani, ~25 km from city center',
                    },
                ],
                {
                    href: 'https://bnx.aero/',
                    bhs: 'Internet stranica aerodroma',
                    en: 'Airport website',
                    external: true,
                },
            )}`;

        const airportPopupOptions: PopupOptions = {
            className: 'airport-map-popup',
        };

        const popupTopPadding: PointExpression = [24, 120];
        const popupSidePadding: PointExpression = [24, 24];

        const oldStationMarker = L.marker([44.7722, 17.191], { icon: shuttleIcon })
            .bindPopup(createOldStationPopup, airportPopupOptions)
            .addTo(map);

        const mainStationMarker = L.marker([44.788, 17.21], { icon: shuttleIcon })
            .bindPopup(createMainStationPopup, airportPopupOptions)
            .addTo(map);

        const airportMarker = L.marker([44.9338, 17.304], { icon: airportIcon })
            .bindPopup(createAirportPopup, {
                ...airportPopupOptions,
                autoPan: true,
                keepInView: true,
                autoPanPaddingTopLeft: popupTopPadding,
                autoPanPaddingBottomRight: popupSidePadding,
            })
            .addTo(map);

        const group = L.featureGroup([oldStationMarker, mainStationMarker, airportMarker]);
        const fitOptions: FitBoundsOptions = {
            paddingTopLeft: [24, 150],
            paddingBottomRight: [24, 36],
        };
        map.fitBounds(group.getBounds().pad(0.12), fitOptions);
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

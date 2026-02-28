// Airport map — ported from js/features/map/airport-map.js
// Uses Leaflet to show two shuttle stop markers on a CARTO basemap.

import type { Map, LatLngBoundsExpression } from 'leaflet';

export async function initAirportMap(): Promise<void> {
  const container = document.getElementById('airport-map');
  if (!container) return;

  try {
    const L = (await import('leaflet')).default;

    // Leaflet CSS is loaded via <link> in AirportMap.astro
    const bounds: LatLngBoundsExpression = [
      [44.76, 17.14],
      [44.82, 17.25],
    ];

    const map: Map = L.map('airport-map', {
      center: [44.7786, 17.1974],
      zoom: 13,
      scrollWheelZoom: false,
      zoomControl: false,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
      minZoom: 12,
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

    const popupOld = `
      <div class="hub-popup">
        <h3>Airport Shuttle Stop - Stara autobuska stanica</h3>
        <p>Plaćeni parking | Paid parking</p>
        <p>Karte se kupuju u autobusu | Tickets are available on the bus</p>
        <a href="#airport" class="popup-link">Airport Transfer Info</a>
      </div>`;

    const popupMain = `
      <div class="hub-popup">
        <h3>Airport Shuttle Stop - Glavna autobuska stanica</h3>
        <p>Plaćeni parking | Paid parking</p>
        <p>Karte se kupuju u autobusu | Tickets are available on the bus</p>
        <a href="#airport" class="popup-link">Airport Transfer Info</a>
      </div>`;

    L.marker([44.7722, 17.191], { icon: shuttleIcon }).bindPopup(popupOld).addTo(map);
    L.marker([44.788, 17.21], { icon: shuttleIcon }).bindPopup(popupMain).addTo(map);
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

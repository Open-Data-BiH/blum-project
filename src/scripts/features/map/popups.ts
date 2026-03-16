// Popup template helpers for map overlays

import { getCurrentLanguage, langText } from '../../core/i18n';
import { escapeHtml, withBase } from '../../core/utils';
import { addHashToPath, getPagePath } from '../../../lib/site-config';
import type { Landmark, LocalizedText, TransportHub } from './types';

export interface NearbyStopSummary {
    name: string;
    distanceKm: number;
}

const localizedField = (value: string | LocalizedText | undefined): string => {
    if (!value) {
        return '';
    }

    if (typeof value === 'object') {
        return getCurrentLanguage() === 'en' ? value.en : value.bhs;
    }

    const parts = value
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean);
    if (parts.length < 2) {
        return value;
    }

    return getCurrentLanguage() === 'en' ? parts[1] : parts[0];
};

export const createTrainStationPopup = (hub: TransportHub): string => `
  <div class="hub-popup">
    <h3>${escapeHtml(localizedField(hub.name))}</h3>
    <p>${escapeHtml(localizedField(hub.info))}</p>
    <p>${langText('Destinacije', 'Destinations')}: <br> <strong>${escapeHtml(localizedField(hub.destinations ?? ''))}</strong></p>
    <a href="https://www.zrs-rs.com" target="_blank" rel="noopener noreferrer" class="popup-link">${langText('Zvanična stranica ŽRS', 'Official Railway Website')}</a>
  </div>
`;

export const createShuttlePopup = (hub: TransportHub): string => `
  <div class="hub-popup">
    <h3>${escapeHtml(localizedField(hub.name))}</h3>
    <p>${escapeHtml(localizedField(hub.info))}</p>
    <p>${langText('Karte se kupuju u autobusu', 'Tickets are available on the bus')}</p>
    <a href="${withBase(addHashToPath(getPagePath('airport', getCurrentLanguage()), 'airport'))}" class="popup-link">${langText('Informacije o aerodromskom prevozu', 'Airport Transfer Info')}</a>
  </div>
`;

export const createTouristBusPopup = (hub: TransportHub): string => `
  <div class="hub-popup">
    <h3>${escapeHtml(localizedField(hub.name))}</h3>
    <p>${escapeHtml(localizedField(hub.info))}</p>
    <p>${langText('Trajanje vožnje', 'Trip duration')}: ${escapeHtml(localizedField(hub.duration ?? ''))}</p>
    <p>${langText('Cijena', 'Price')}: ${escapeHtml(localizedField(hub.price ?? ''))}</p>
    <a href="https://www.banjaluka.rs.ba/banj-bus-na-raspolaganju-od-1-maja/" target="_blank" rel="noopener noreferrer" class="popup-link">${langText('Informacije o Banj Bus-u', 'Banj Bus Info')}</a>
  </div>
`;

export const createMainBusStationPopup = (hub: TransportHub): string => `
  <div class="hub-popup">
    <h3>${escapeHtml(localizedField(hub.name))}</h3>
    <p>${escapeHtml(localizedField(hub.info))}</p>
    <a href="${escapeHtml(hub.website ?? 'https://www.as-banjaluka.com/')}" target="_blank" rel="noopener noreferrer" class="popup-link">${langText('Zvanična stranica', 'Official Website')}</a>
  </div>
`;

export const createTerminalBusStationPopup = (hub: TransportHub): string => `
  <div class="hub-popup">
    <h3>${escapeHtml(localizedField(hub.name))}</h3>
    <p>${escapeHtml(localizedField(hub.info))}</p>
    <p>${escapeHtml(localizedField(hub.description ?? ''))}</p>
  </div>
`;

export const createBikeStationPopup = (name: string, capacity: number): string => `
  <div class="hub-popup">
    <h3>${escapeHtml(name)}</h3>
    <p>${langText('Kapacitet', 'Capacity')}: ${escapeHtml(String(capacity))}</p>
    <a href="https://www.nextbike.ba/bs/banjaluka/" target="_blank" rel="noopener noreferrer" class="popup-link">${langText('Nextbike BL informacije', 'Nextbike BL Info')}</a>
  </div>
`;

export const createLandmarkPopup = (landmark: Landmark): string => `
  <div class="hub-popup">
    <h3>${escapeHtml(localizedField(landmark.name))}</h3>
    <p>${escapeHtml(localizedField(landmark.description))}</p>
  </div>
`;

export const createNearestStopsPopup = (stops: NearbyStopSummary[]): string => `
  <div class="hub-popup hub-popup--nearby-stops">
    <h3>${langText('Najbliža autobuska stajališta', 'Nearest Bus Stops')}</h3>
    <div class="nearby-stop-list">
      ${stops
          .map(
              (stop) => `
        <div class="nearby-stop-row">
          <span class="nearby-stop-row__main">
            <i class="fas fa-bus-simple nearby-stop-row__icon" aria-hidden="true"></i>
            <span class="nearby-stop-row__name">${escapeHtml(stop.name)}</span>
          </span>
          <span class="nearby-stop-row__distance">${escapeHtml(stop.distanceKm.toFixed(2))} km</span>
        </div>
      `,
          )
          .join('')}
    </div>
  </div>
`;

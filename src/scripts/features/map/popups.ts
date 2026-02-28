// Popup template helpers for map overlays

import { getCurrentLanguage } from '../../core/i18n';
import type { TransportHub } from './types';

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const langText = (bhs: string, en: string): string => (getCurrentLanguage() === 'en' ? en : bhs);

const localizedField = (value: string | undefined): string => {
    if (!value) {
        return '';
    }

    const parts = value.split('|').map((part) => part.trim()).filter(Boolean);
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
    <a href="/airport/#airport" class="popup-link">${langText('Informacije o aerodromskom prevozu', 'Airport Transfer Info')}</a>
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

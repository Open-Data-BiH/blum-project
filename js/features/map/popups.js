import { escapeHTML } from '../../core/sanitize.js';

export const createTrainStationPopup = (name, info, destinations) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>${escapeHTML(info)}</p>
      <p>Destinacije | Destinations: <br> <strong>${escapeHTML(destinations)}</strong></p>
      <a href="https://www.zrs-rs.com" target="_blank" rel="noopener noreferrer" class="popup-link">Official Railway Website</a>
    </div>
`;

export const createShuttlePopup = (name, info) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>${escapeHTML(info)}</p>
      <p>Karte se kupuju u autobusu | Tickets are available on the bus</p>
      <a href="#airport" class="popup-link">Airport Transfer Info</a>
    </div>
`;

export const createTouristBusPopup = (name, info, price, duration) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>${escapeHTML(info)}</p>
      <p>Trajanje vožnje | Trip duration: ${escapeHTML(duration)}</p>
      <p>Cijena | Price: ${escapeHTML(price)}</p>
      <a href="https://www.banjaluka.rs.ba/banj-bus-na-raspolaganju-od-1-maja/" target="_blank" rel="noopener noreferrer" class="popup-link">Banj Bus Info</a>
    </div>
`;

export const createMainBusStationPopup = (name, info) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>${escapeHTML(info)}</p>
      <a href="https://www.as-banjaluka.com/" target="_blank" rel="noopener noreferrer" class="popup-link">Official Website</a>
    </div>
`;

export const createTerminalBusStationPopup = (name, info, description) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>${escapeHTML(info)}</p>
      <p>${escapeHTML(description)}</p>
    </div>
`;

export const createBikeStationPopup = (name, capacity) => `
    <div class="hub-popup">
      <h3>${escapeHTML(name)}</h3>
      <p>Kapacitet | Capacity: ${escapeHTML(String(capacity))}</p>
      <a href="https://www.nextbike.ba/bs/banjaluka/" target="_blank" rel="noopener noreferrer" class="popup-link">Nextbike BL Info</a>
    </div>
`;

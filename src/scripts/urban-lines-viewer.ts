// Urban Lines Viewer — ported from js/urban-lines-viewer.js
// Key change: window.L replaced with import L from 'leaflet'

import L from 'leaflet';

const VIEWER_CONFIG = {
    IMAGE_URL: '/assets/images/gradski-prevoz-mapa-banja-luka.webp',
    IMAGE_ASPECT_RATIO: 8000 / 5000,
    RESIZE_DEBOUNCE_DELAY: 250,
    MAP_OPTIONS: {
        crs: L.CRS.Simple,
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.1,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 100,
        minZoom: -2,
        maxZoom: 2,
        maxBoundsViscosity: 1.0,
        bounceAtZoomLimits: false,
        keyboard: false,
        dragging: true,
    },
} as const;

export const initUrbanLinesViewer = (): void => {
    const viewer = document.getElementById('urban-lines-viewer');
    if (!viewer) {
        return;
    }

    const map = L.map('urban-lines-viewer', VIEWER_CONFIG.MAP_OPTIONS);

    const calculateImageBounds = (): L.LatLngBounds => {
        const { clientWidth: containerWidth, clientHeight: containerHeight } = viewer;
        const containerAspect = containerWidth / containerHeight;

        const [width, height] =
            containerAspect > VIEWER_CONFIG.IMAGE_ASPECT_RATIO
                ? [1000 * VIEWER_CONFIG.IMAGE_ASPECT_RATIO, 1000]
                : [
                      1000 * VIEWER_CONFIG.IMAGE_ASPECT_RATIO,
                      (1000 * VIEWER_CONFIG.IMAGE_ASPECT_RATIO) / containerAspect,
                  ];

        return L.latLngBounds([
            [0, 0],
            [height, width],
        ]);
    };

    const bounds = calculateImageBounds();
    const image = L.imageOverlay(VIEWER_CONFIG.IMAGE_URL, bounds);
    image.addTo(map);

    map.fitBounds(bounds);
    map.setMaxBounds(bounds);

    const resetView = (): void => {
        const b = calculateImageBounds();
        map.fitBounds(b);
    };

    const MapControls = L.Control.extend({
        options: { position: 'bottomright' as const },

        onAdd(): HTMLElement {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-controls-container');

            const buttons = [
                { class: 'zoom-in', icon: 'fa-plus', title: 'Zoom in', action: () => map.zoomIn() },
                { class: 'zoom-out', icon: 'fa-minus', title: 'Zoom out', action: () => map.zoomOut() },
                { class: 'reset-view', icon: 'fa-home', title: 'Reset view', action: resetView },
            ];

            buttons.forEach(({ class: btnClass, icon, title, action }) => {
                const btn = L.DomUtil.create('a', `map-control-button ${btnClass}`, container) as HTMLAnchorElement;
                btn.innerHTML = `<i class="fas ${icon}"></i>`;
                btn.href = '#';
                btn.title = title;
                L.DomEvent.on(btn, 'click', (e) => {
                    L.DomEvent.preventDefault(e);
                    action();
                });
            });

            return container;
        },
    });

    map.addControl(new MapControls());

    const img = new Image();
    img.onload = () => {
        const b = calculateImageBounds();
        image.setBounds(b);
        map.fitBounds(b);
        map.setMaxBounds(b);
    };
    img.src = VIEWER_CONFIG.IMAGE_URL;

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = (): void => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (img.complete) {
                const b = calculateImageBounds();
                image.setBounds(b);
                map.invalidateSize();
                map.fitBounds(b);
                map.setMaxBounds(b);
            }
        }, VIEWER_CONFIG.RESIZE_DEBOUNCE_DELAY);
    };

    window.addEventListener('resize', handleResize);
};

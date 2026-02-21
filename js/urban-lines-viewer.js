// Urban Lines Viewer Configuration
const VIEWER_CONFIG = {
    IMAGE_URL: 'assets/images/gradski-prevoz-mapa-banja-luka.png',
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
        dragging: true
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const viewer = document.getElementById('urban-lines-viewer');
    if (!viewer) { return; }

    // Create the Leaflet map with configuration
    const map = L.map('urban-lines-viewer', VIEWER_CONFIG.MAP_OPTIONS);

    // Calculate image bounds based on container size (Modern ES6+)
    const calculateImageBounds = () => {
        const { clientWidth: containerWidth, clientHeight: containerHeight } = viewer;
        const containerAspect = containerWidth / containerHeight;

        const [width, height] = containerAspect > VIEWER_CONFIG.IMAGE_ASPECT_RATIO
            ? [1000 * VIEWER_CONFIG.IMAGE_ASPECT_RATIO, 1000]
            : [1000 * VIEWER_CONFIG.IMAGE_ASPECT_RATIO, 1000 * VIEWER_CONFIG.IMAGE_ASPECT_RATIO / containerAspect];

        return [[0, 0], [height, width]];
    };

    // Add the image overlay with calculated bounds
    const bounds = calculateImageBounds();
    const image = L.imageOverlay(VIEWER_CONFIG.IMAGE_URL, bounds);
    image.addTo(map);

    // Set initial view to show the entire image
    map.fitBounds(bounds);

    // Set max bounds to match image bounds
    map.setMaxBounds(bounds);

    // Function to reset view to initial state (Modern ES6+)
    const resetView = () => {
        const bounds = calculateImageBounds();
        map.fitBounds(bounds);
    };

    // Create custom controls container (Modern ES6+)
    const MapControls = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-controls-container');

            // Control buttons configuration
            const buttons = [
                { class: 'zoom-in', icon: 'fa-plus', title: 'Zoom in', action: () => map.zoomIn() },
                { class: 'zoom-out', icon: 'fa-minus', title: 'Zoom out', action: () => map.zoomOut() },
                { class: 'reset-view', icon: 'fa-home', title: 'Reset view', action: resetView }
            ];

            // Create buttons dynamically
            buttons.forEach(({ class: btnClass, icon, title, action }) => {
                const btn = L.DomUtil.create('a', `map-control-button ${btnClass}`, container);
                btn.innerHTML = `<i class="fas ${icon}"></i>`;
                btn.href = '#';
                btn.title = title;

                L.DomEvent.on(btn, 'click', (e) => {
                    L.DomEvent.preventDefault(e);
                    action();
                });
            });

            return container;
        }
    });

    // Add the controls to the map
    map.addControl(new MapControls());

    // Handle image load for precise sizing (Modern ES6+)
    const img = new Image();
    img.onload = () => {
        const bounds = calculateImageBounds();
        image.setBounds(bounds);
        map.fitBounds(bounds);
        map.setMaxBounds(bounds);
    };
    img.src = VIEWER_CONFIG.IMAGE_URL;

    // Handle window resize with debounce (Modern ES6+)
    let resizeTimeout;
    const handleResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (img.complete) {
                const bounds = calculateImageBounds();
                image.setBounds(bounds);
                map.invalidateSize();
                map.fitBounds(bounds);
                map.setMaxBounds(bounds);
            }
        }, VIEWER_CONFIG.RESIZE_DEBOUNCE_DELAY);
    };

    window.addEventListener('resize', handleResize);
}); 
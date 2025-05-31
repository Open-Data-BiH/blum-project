document.addEventListener('DOMContentLoaded', function () {
    const viewer = document.getElementById('urban-lines-viewer');
    if (!viewer) return;

    // Create the Leaflet map
    const map = L.map('urban-lines-viewer', {
        crs: L.CRS.Simple,
        zoomControl: false,
        attributionControl: false,
        zoomSnap: 0.1,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 100,
        minZoom: -2,
        maxZoom: 2,
        maxBoundsViscosity: 1.0, // Make bounds "solid"
        bounceAtZoomLimits: false, // Prevent bouncing at zoom limits
        keyboard: false, // Disable keyboard navigation to prevent moving with arrows
        dragging: true
    });

    // Load the urban lines image
    const imageUrl = 'gradski-prevoz-mapa-banja-luka.png';

    // Set initial bounds based on known aspect ratio (8000×5000)
    const IMAGE_ASPECT_RATIO = 8000 / 5000;

    function calculateImageBounds() {
        const containerWidth = viewer.clientWidth;
        const containerHeight = viewer.clientHeight;
        const containerAspect = containerWidth / containerHeight;

        let width, height;
        if (containerAspect > IMAGE_ASPECT_RATIO) {
            height = 1000;
            width = height * IMAGE_ASPECT_RATIO;
        } else {
            width = 1000 * IMAGE_ASPECT_RATIO;
            height = width / IMAGE_ASPECT_RATIO;
        }

        return [[0, 0], [height, width]]; // Remove padding completely
    }

    // Add the image overlay with calculated bounds
    const bounds = calculateImageBounds();
    const image = L.imageOverlay(imageUrl, bounds);
    image.addTo(map);

    // Set initial view to show the entire image
    map.fitBounds(bounds);

    // Set max bounds to match image bounds
    map.setMaxBounds(bounds);

    // Create custom controls container
    const MapControls = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function () {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-controls-container');

            // Add zoom in button
            const zoomInBtn = L.DomUtil.create('a', 'map-control-button zoom-in', container);
            zoomInBtn.innerHTML = '<i class="fas fa-plus"></i>';
            zoomInBtn.href = '#';
            zoomInBtn.title = 'Zoom in';

            // Add zoom out button
            const zoomOutBtn = L.DomUtil.create('a', 'map-control-button zoom-out', container);
            zoomOutBtn.innerHTML = '<i class="fas fa-minus"></i>';
            zoomOutBtn.href = '#';
            zoomOutBtn.title = 'Zoom out';

            // Add reset view button
            const resetBtn = L.DomUtil.create('a', 'map-control-button reset-view', container);
            resetBtn.innerHTML = '<i class="fas fa-home"></i>';
            resetBtn.href = '#';
            resetBtn.title = 'Reset view';

            // Add event listeners
            L.DomEvent.on(zoomInBtn, 'click', function (e) {
                L.DomEvent.preventDefault(e);
                map.zoomIn();
            });

            L.DomEvent.on(zoomOutBtn, 'click', function (e) {
                L.DomEvent.preventDefault(e);
                map.zoomOut();
            });

            L.DomEvent.on(resetBtn, 'click', function (e) {
                L.DomEvent.preventDefault(e);
                resetView();
            });

            return container;
        }
    });

    // Function to reset view to initial state
    function resetView() {
        const bounds = calculateImageBounds();
        map.fitBounds(bounds);
    }

    // Add the controls to the map
    map.addControl(new MapControls());

    // Handle image load for precise sizing
    const img = new Image();
    img.onload = function () {
        const bounds = calculateImageBounds();
        image.setBounds(bounds);
        map.fitBounds(bounds);
        map.setMaxBounds(bounds); // Update max bounds after image loads
    };
    img.src = imageUrl;

    // Handle window resize
    let resizeTimeout;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function () {
            if (img.complete) {
                const bounds = calculateImageBounds();
                image.setBounds(bounds);
                map.invalidateSize();
                map.fitBounds(bounds);
                map.setMaxBounds(bounds); // Update max bounds after resize
            }
        }, 250);
    });
}); 
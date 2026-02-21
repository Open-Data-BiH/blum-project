/**
 * MapLegendControl Component
 * Custom Leaflet layer control with improved UX and bilingual support
 * Extends BaseComponent for common utilities
 */

class MapLegendControl extends BaseComponent {
    constructor(map, layerGroups, baseMaps) {
        super(null); // No container ID - we create Leaflet control
        this.map = map;
        this.layerGroups = layerGroups; // { busStops, trainStations, ... }
        this.baseMaps = baseMaps; // { standard, light, dark, satellite }
        this.selectedBaseMap = null;
        this.selectedLayers = new Set();
        this.config = null;
        this.controlContainer = null;
        this.leafletControl = null;
        this.isCollapsed = false;
        this.listenersBound = false;

        // Bind event handlers to maintain 'this' context
        this.handleClick = this.handleClick.bind(this);
        this.handleKeydown = this.handleKeydown.bind(this);
    }

    /**
     * Initialize the map legend control
     */
    async init() {
        try {
            await this.loadConfig();
            this.setDefaultState();
            this.createLeafletControl();
            this.render();
            this.setupEventListeners();
            this.setupLanguageListener();
            this.applyInitialState();
        } catch (error) {
            console.error('MapLegendControl initialization error:', error);
        }
    }

    /**
     * Load configuration from JSON file
     */
    async loadConfig() {
        try {
            this.config = await FetchHelper.fetchJSON('data/map/legend-config.json');
        } catch (error) {
            console.error('Failed to load legend config:', error);
            throw error;
        }
    }

    /**
     * Set default state from configuration
     */
    setDefaultState() {
        if (!this.config) { return; }

        // Set default base map
        const defaultBase = this.config.baseMaps.find(b => b.default);
        this.selectedBaseMap = defaultBase ? defaultBase.id : 'light';

        // Set default visible layers
        this.selectedLayers = new Set(
            this.config.overlayLayers
                .filter(l => l.defaultVisible)
                .map(l => l.id)
        );
    }

    /**
     * Create Leaflet custom control
     */
    createLeafletControl() {
        const self = this;

        const MapLegend = L.Control.extend({
            options: {
                position: 'topright'
            },
            onAdd: function (_map) {
                self.controlContainer = L.DomUtil.create('div', 'map-legend-control');

                // Prevent map interactions when interacting with control
                L.DomEvent.disableClickPropagation(self.controlContainer);
                L.DomEvent.disableScrollPropagation(self.controlContainer);

                return self.controlContainer;
            }
        });

        this.leafletControl = new MapLegend();
        this.leafletControl.addTo(this.map);
    }

    /**
     * Render the legend
     */
    render() {
        if (!this.controlContainer || !this.config) { return; }

        const collapsedClass = this.isCollapsed ? ' map-legend--collapsed' : '';
        const collapseIcon = this.isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up';

        const html = `
            <div class="map-legend${collapsedClass}">
                <div class="map-legend__header">
                    <span class="map-legend__title">${this.getTitle()}</span>
                    <button class="map-legend__collapse"
                            aria-label="${this.getCollapseLabel()}"
                            aria-expanded="${!this.isCollapsed}">
                        <i class="fas ${collapseIcon}"></i>
                    </button>
                </div>
                <div class="map-legend__body">
                    ${this.renderBaseMapSection()}
                    ${this.renderOverlaySection()}
                </div>
            </div>
        `;

        this.controlContainer.innerHTML = html;
    }

    /**
     * Get legend title based on current language
     */
    getTitle() {
        return this.currentLang === 'en' ? 'Map Layers' : 'Slojevi mape';
    }

    /**
     * Get collapse button label
     */
    getCollapseLabel() {
        if (this.currentLang === 'en') {
            return this.isCollapsed ? 'Expand legend' : 'Collapse legend';
        }
        return this.isCollapsed ? 'Proširi legendu' : 'Sakrij legendu';
    }

    /**
     * Render base map section (radio buttons)
     */
    renderBaseMapSection() {
        const title = this.currentLang === 'en' ? 'Map Style' : 'Stil mape';

        return `
            <div class="map-legend__section">
                <h3 class="map-legend__section-title">${title}</h3>
                <div class="map-legend__options" role="radiogroup" aria-label="${title}">
                    ${this.config.baseMaps.map(baseMap => this.renderBaseMapOption(baseMap)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render single base map option (radio button)
     */
    renderBaseMapOption(baseMap) {
        const label = baseMap.label[this.currentLang] || baseMap.label.bhs;
        const isSelected = this.selectedBaseMap === baseMap.id;

        return `
            <label class="map-legend__option ${isSelected ? 'map-legend__option--selected' : ''}"
                   data-type="basemap"
                   data-id="${baseMap.id}"
                   tabindex="0">
                <input type="radio"
                       name="basemap"
                       value="${baseMap.id}"
                       ${isSelected ? 'checked' : ''}
                       class="map-legend__radio"
                       aria-checked="${isSelected}">
                <span class="map-legend__radio-visual"></span>
                <span class="map-legend__label">
                    <span class="map-legend__label-primary">${this.escapeHtml(label)}</span>
                </span>
            </label>
        `;
    }

    /**
     * Render overlay section (checkboxes)
     */
    renderOverlaySection() {
        const title = this.currentLang === 'en' ? 'Layers' : 'Slojevi';
        const selectAllLabel = this.currentLang === 'en' ? 'Select all' : 'Izaberi sve';
        const clearLabel = this.currentLang === 'en' ? 'Clear' : 'Očisti';

        return `
            <div class="map-legend__section">
                <div class="map-legend__section-header">
                    <h3 class="map-legend__section-title">${title}</h3>
                    <div class="map-legend__actions">
                        <button class="map-legend__action-btn"
                                data-action="select-all"
                                aria-label="${selectAllLabel}">${selectAllLabel}</button>
                        <button class="map-legend__action-btn"
                                data-action="clear"
                                aria-label="${clearLabel}">${clearLabel}</button>
                    </div>
                </div>
                <div class="map-legend__options">
                    ${this.config.overlayLayers.map(layer => this.renderOverlayOption(layer)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render single overlay option (checkbox)
     */
    renderOverlayOption(layer) {
        const labelBhs = layer.label.bhs;
        const labelEn = layer.label.en;
        const isChecked = this.selectedLayers.has(layer.id);

        return `
            <label class="map-legend__option ${isChecked ? 'map-legend__option--checked' : ''}"
                   data-type="overlay"
                   data-id="${layer.id}"
                   tabindex="0">
                <input type="checkbox"
                       value="${layer.id}"
                       ${isChecked ? 'checked' : ''}
                       class="map-legend__checkbox"
                       aria-checked="${isChecked}">
                <span class="map-legend__checkbox-visual">
                    <i class="fas fa-check"></i>
                </span>
                <i class="map-legend__icon fas ${layer.icon}"
                   style="color: ${layer.color};"
                   aria-hidden="true"></i>
                <span class="map-legend__label">
                    <span class="map-legend__label-primary">${this.escapeHtml(labelBhs)}</span>
                    <span class="map-legend__label-secondary">${this.escapeHtml(labelEn)}</span>
                </span>
            </label>
        `;
    }

    /**
     * Setup event listeners (only once)
     */
    setupEventListeners() {
        if (!this.controlContainer) {
            console.warn('MapLegendControl: No control container, cannot set up listeners'); // Debug log
            return;
        }
        if (this.listenersBound) {
            return;
        }

        // Event delegation for all interactions
        this.controlContainer.addEventListener('click', this.handleClick);
        this.controlContainer.addEventListener('keydown', this.handleKeydown);

        this.listenersBound = true;
    }

    /**
     * Handle click events (bound in constructor)
     */
    handleClick(e) {
        const option = e.target.closest('.map-legend__option');
        const actionBtn = e.target.closest('.map-legend__action-btn');
        const collapseBtn = e.target.closest('.map-legend__collapse');

        if (option) {
            e.preventDefault();
            this.handleOptionClick(option);
        } else if (actionBtn) {
            e.preventDefault();
            this.handleActionClick(actionBtn);
        } else if (collapseBtn) {
            e.preventDefault();
            this.toggleCollapse();
        }
    }

    /**
     * Handle keydown events (bound in constructor)
     */
    handleKeydown(e) {
        this.handleKeyboardNavigation(e);
    }

    /**
     * Handle option click
     */
    handleOptionClick(option) {
        const type = option.dataset.type;
        const id = option.dataset.id;

        if (type === 'basemap') {
            this.selectBaseMap(id);
        } else if (type === 'overlay') {
            this.toggleOverlay(id);
        }
    }

    /**
     * Handle action button click
     */
    handleActionClick(button) {
        const action = button.dataset.action;

        if (action === 'select-all') {
            this.selectAllLayers();
        } else if (action === 'clear') {
            this.clearAllLayers();
        }
    }

    /**
     * Toggle collapse state
     */
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        this.render();
    }

    /**
     * Select base map
     */
    selectBaseMap(id) {
        if (this.selectedBaseMap === id) { return; }

        // Remove all base maps
        Object.values(this.baseMaps).forEach(layer => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });

        // Add selected base map
        if (this.baseMaps[id]) {
            this.baseMaps[id].addTo(this.map);
            this.selectedBaseMap = id;
            this.render();
        }
    }

    /**
     * Toggle overlay layer
     */
    toggleOverlay(id) {
        if (this.selectedLayers.has(id)) {
            // Remove layer
            this.selectedLayers.delete(id);
            if (this.layerGroups[id]) {
                this.map.removeLayer(this.layerGroups[id]);
            }
        } else {
            // Add layer
            this.selectedLayers.add(id);
            if (this.layerGroups[id]) {
                this.layerGroups[id].addTo(this.map);
            }
        }

        this.render();
    }

    /**
     * Select all overlay layers
     */
    selectAllLayers() {
        this.config.overlayLayers.forEach(layer => {
            if (!this.selectedLayers.has(layer.id)) {
                this.selectedLayers.add(layer.id);
                if (this.layerGroups[layer.id]) {
                    this.layerGroups[layer.id].addTo(this.map);
                }
            }
        });

        this.render();
    }

    /**
     * Clear all overlay layers
     */
    clearAllLayers() {
        this.selectedLayers.forEach(id => {
            if (this.layerGroups[id]) {
                this.map.removeLayer(this.layerGroups[id]);
            }
        });

        this.selectedLayers.clear();
        this.render();
    }

    /**
     * Apply initial state to map
     */
    applyInitialState() {
        // Apply selected base map
        if (this.baseMaps[this.selectedBaseMap]) {
            // Remove default layer first if it exists
            Object.values(this.baseMaps).forEach(layer => {
                if (this.map.hasLayer(layer)) {
                    this.map.removeLayer(layer);
                }
            });
            this.baseMaps[this.selectedBaseMap].addTo(this.map);
        }

        // Apply selected overlay layers
        this.selectedLayers.forEach(id => {
            if (this.layerGroups[id]) {
                // Remove first to prevent duplicates
                if (this.map.hasLayer(this.layerGroups[id])) {
                    this.map.removeLayer(this.layerGroups[id]);
                }
                this.layerGroups[id].addTo(this.map);
            }
        });

        // Remove layers that shouldn't be visible
        Object.keys(this.layerGroups).forEach(id => {
            if (!this.selectedLayers.has(id) && this.layerGroups[id]) {
                if (this.map.hasLayer(this.layerGroups[id])) {
                    this.map.removeLayer(this.layerGroups[id]);
                }
            }
        });
    }

    /**
     * Setup language change listener
     */
    setupLanguageListener() {
        document.addEventListener('languageChanged', (e) => {
            if (e.detail && e.detail.language) {
                this.updateLanguage(e.detail.language);
            }
        });
    }

    /**
     * Update language and re-render
     */
    updateLanguage(newLang) {
        this.currentLang = newLang;
        if (this.config) {
            this.render();
        }
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyboardNavigation(e) {
        const focusableElements = this.controlContainer.querySelectorAll(
            '.map-legend__option, .map-legend__action-btn, .map-legend__collapse'
        );

        if (focusableElements.length === 0) { return; }

        const focusedElement = document.activeElement;
        const focusedIndex = Array.from(focusableElements).indexOf(focusedElement);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.focusNext(focusableElements, focusedIndex);
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.focusPrevious(focusableElements, focusedIndex);
                break;

            case 'Enter':
            case ' ':
                if (focusedElement.classList.contains('map-legend__option')) {
                    e.preventDefault();
                    this.handleOptionClick(focusedElement);
                } else if (focusedElement.classList.contains('map-legend__action-btn')) {
                    e.preventDefault();
                    this.handleActionClick(focusedElement);
                } else if (focusedElement.classList.contains('map-legend__collapse')) {
                    e.preventDefault();
                    this.toggleCollapse();
                }
                break;

            case 'Escape':
                if (!this.isCollapsed) {
                    e.preventDefault();
                    this.toggleCollapse();
                }
                break;

            default:
                break;
        }
    }

    /**
     * Focus next element
     */
    focusNext(elements, currentIndex) {
        if (currentIndex === -1) {
            elements[0].focus();
        } else {
            const nextIndex = (currentIndex + 1) % elements.length;
            elements[nextIndex].focus();
        }
    }

    /**
     * Focus previous element
     */
    focusPrevious(elements, currentIndex) {
        if (currentIndex === -1) {
            elements[elements.length - 1].focus();
        } else {
            const prevIndex = currentIndex <= 0 ? elements.length - 1 : currentIndex - 1;
            elements[prevIndex].focus();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MapLegendControl;
}

// Make available globally
window.MapLegendControl = MapLegendControl;

import type { Control, LayerGroup, Map, TileLayer } from 'leaflet';
import { getCurrentLanguage } from '../core/i18n';
import type { BaseMapConfig, LegendConfig, OverlayLayerConfig, OverlayLayerId } from '../features/map/types';

type LeafletNS = typeof import('leaflet');
type BaseLayers = Record<string, TileLayer>;
type OverlayLayers = Record<OverlayLayerId, LayerGroup>;

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export class MapLegendControl {
    private controlContainer: HTMLElement | null = null;
    private leafletControl: Control | null = null;
    private selectedBaseMap: string;
    private selectedLayers: Set<OverlayLayerId>;
    private isCollapsed = false;
    private listenersBound = false;
    private currentLang = getCurrentLanguage();

    constructor(
        private L: LeafletNS,
        private map: Map,
        private config: LegendConfig,
        private baseMaps: BaseLayers,
        private overlayLayers: OverlayLayers,
    ) {
        const defaultBase = config.baseMaps.find((base) => base.default) ?? config.baseMaps[0];
        this.selectedBaseMap = defaultBase?.id ?? 'light';

        const defaultLayers = config.overlayLayers.filter((layer) => layer.defaultVisible).map((layer) => layer.id);
        this.selectedLayers = new Set(defaultLayers);
    }

    init(): void {
        this.createLeafletControl();
        this.render();
        this.setupEventListeners();
        this.applyInitialState();
        document.addEventListener('languageChanged', (event) => {
            const lang = (event as CustomEvent<{ language: string }>).detail?.language;
            if (lang === 'bhs' || lang === 'en') {
                this.updateLanguage(lang);
            }
        });
    }

    private createLeafletControl(): void {
        const self = this;
        const Legend = this.L.Control.extend({
            options: { position: 'topright' as const },
            onAdd() {
                self.controlContainer = self.L.DomUtil.create('div', 'map-legend-control');
                self.L.DomEvent.disableClickPropagation(self.controlContainer);
                self.L.DomEvent.disableScrollPropagation(self.controlContainer);
                return self.controlContainer;
            },
        });

        this.leafletControl = new Legend();
        this.leafletControl.addTo(this.map);
    }

    private render(): void {
        if (!this.controlContainer) {
            return;
        }

        const collapsedClass = this.isCollapsed ? ' map-legend--collapsed' : '';
        const collapseIcon = this.isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up';

        const html = `
      <div class="map-legend${collapsedClass}">
        <div class="map-legend__header">
          <span class="map-legend__title">${this.getTitle()}</span>
          <button class="map-legend__collapse" aria-label="${this.getCollapseLabel()}" aria-expanded="${!this.isCollapsed}">
            <i class="fas ${collapseIcon}"></i>
          </button>
        </div>
        <div class="map-legend__body">
          ${this.renderBaseMapsSection(this.config.baseMaps)}
          ${this.renderOverlaySection(this.config.overlayLayers)}
        </div>
      </div>
    `;

        this.controlContainer.innerHTML = html;
    }

    private getTitle(): string {
        return this.currentLang === 'en' ? 'Map Layers' : 'Slojevi mape';
    }

    private getCollapseLabel(): string {
        if (this.currentLang === 'en') {
            return this.isCollapsed ? 'Expand legend' : 'Collapse legend';
        }
        return this.isCollapsed ? 'Proširi legendu' : 'Sakrij legendu';
    }

    private renderBaseMapsSection(baseMaps: BaseMapConfig[]): string {
        const title = this.currentLang === 'en' ? 'Map Style' : 'Stil mape';

        const options = baseMaps
            .map((base) => {
                const label = base.label[this.currentLang] || base.label.bhs;
                const isSelected = this.selectedBaseMap === base.id;

                return `
          <label class="map-legend__option ${isSelected ? 'map-legend__option--selected' : ''}"
                 data-type="basemap"
                 data-id="${escapeHtml(base.id)}"
                 tabindex="0">
            <input type="radio"
                   name="basemap"
                   value="${escapeHtml(base.id)}"
                   ${isSelected ? 'checked' : ''}
                   class="map-legend__radio"
                   aria-checked="${isSelected}">
            <span class="map-legend__radio-visual"></span>
            <span class="map-legend__label">
              <span class="map-legend__label-primary">${escapeHtml(label)}</span>
            </span>
          </label>
        `;
            })
            .join('');

        return `
      <div class="map-legend__section">
        <h3 class="map-legend__section-title">${title}</h3>
        <div class="map-legend__options" role="radiogroup" aria-label="${title}">
          ${options}
        </div>
      </div>
    `;
    }

    private renderOverlaySection(layers: OverlayLayerConfig[]): string {
        const title = this.currentLang === 'en' ? 'Layers' : 'Slojevi';
        const selectAllLabel = this.currentLang === 'en' ? 'Select all' : 'Izaberi sve';
        const clearLabel = this.currentLang === 'en' ? 'Clear' : 'Očisti';

        const options = layers
            .map((layer) => {
                const labelPrimary = layer.label.bhs;
                const labelSecondary = layer.label.en;
                const isChecked = this.selectedLayers.has(layer.id);

                return `
          <label class="map-legend__option ${isChecked ? 'map-legend__option--checked' : ''}"
                 data-type="overlay"
                 data-id="${escapeHtml(layer.id)}"
                 tabindex="0">
            <input type="checkbox"
                   value="${escapeHtml(layer.id)}"
                   ${isChecked ? 'checked' : ''}
                   class="map-legend__checkbox"
                   aria-checked="${isChecked}">
            <span class="map-legend__checkbox-visual">
              <i class="fas fa-check"></i>
            </span>
            <i class="map-legend__icon fas ${escapeHtml(layer.icon)}" style="color:${escapeHtml(layer.color)};" aria-hidden="true"></i>
            <span class="map-legend__label">
              <span class="map-legend__label-primary">${escapeHtml(labelPrimary)}</span>
              <span class="map-legend__label-secondary">${escapeHtml(labelSecondary)}</span>
            </span>
          </label>
        `;
            })
            .join('');

        return `
      <div class="map-legend__section">
        <div class="map-legend__section-header">
          <h3 class="map-legend__section-title">${title}</h3>
          <div class="map-legend__actions">
            <button class="map-legend__action-btn" data-action="select-all" aria-label="${selectAllLabel}">${selectAllLabel}</button>
            <button class="map-legend__action-btn" data-action="clear" aria-label="${clearLabel}">${clearLabel}</button>
          </div>
        </div>
        <div class="map-legend__options">
          ${options}
        </div>
      </div>
    `;
    }

    private setupEventListeners(): void {
        if (!this.controlContainer || this.listenersBound) {
            return;
        }

        this.controlContainer.addEventListener('click', (event) => this.handleClick(event));
        this.controlContainer.addEventListener('keydown', (event) => this.handleKeydown(event));
        this.listenersBound = true;
    }

    private handleClick(event: Event): void {
        const target = event.target instanceof Element ? event.target : null;
        const option = target?.closest<HTMLElement>('.map-legend__option');
        const actionBtn = target?.closest<HTMLElement>('.map-legend__action-btn');
        const collapseBtn = target?.closest<HTMLElement>('.map-legend__collapse');

        if (option) {
            event.preventDefault();
            this.handleOption(option);
        } else if (actionBtn) {
            event.preventDefault();
            this.handleAction(actionBtn);
        } else if (collapseBtn) {
            event.preventDefault();
            this.toggleCollapse();
        }
    }

    private handleKeydown(event: KeyboardEvent): void {
        const focusable = this.controlContainer?.querySelectorAll<HTMLElement>(
            '.map-legend__option, .map-legend__action-btn, .map-legend__collapse',
        );
        if (!focusable || focusable.length === 0) {
            return;
        }

        const active = document.activeElement as HTMLElement | null;
        const index = active ? Array.from(focusable).indexOf(active) : -1;

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                focusable[(index + 1) % focusable.length].focus();
                break;
            case 'ArrowUp':
                event.preventDefault();
                focusable[index <= 0 ? focusable.length - 1 : index - 1].focus();
                break;
            case 'Enter':
            case ' ':
                if (active?.classList.contains('map-legend__option')) {
                    event.preventDefault();
                    this.handleOption(active);
                } else if (active?.classList.contains('map-legend__action-btn')) {
                    event.preventDefault();
                    this.handleAction(active);
                } else if (active?.classList.contains('map-legend__collapse')) {
                    event.preventDefault();
                    this.toggleCollapse();
                }
                break;
            case 'Escape':
                if (!this.isCollapsed) {
                    event.preventDefault();
                    this.toggleCollapse();
                }
                break;
            default:
                break;
        }
    }

    private handleOption(option: HTMLElement): void {
        const type = option.dataset.type;
        const id = option.dataset.id as OverlayLayerId | string | undefined;
        if (!id) {
            return;
        }

        if (type === 'basemap') {
            this.selectBaseMap(id);
        } else if (type === 'overlay') {
            this.toggleOverlay(id as OverlayLayerId);
        }
    }

    private handleAction(button: HTMLElement): void {
        const action = button.dataset.action;
        if (action === 'select-all') {
            this.selectAllLayers();
        } else if (action === 'clear') {
            this.clearAllLayers();
        }
    }

    private toggleCollapse(): void {
        this.isCollapsed = !this.isCollapsed;
        this.render();
    }

    private selectBaseMap(id: string): void {
        if (this.selectedBaseMap === id) {
            return;
        }

        Object.values(this.baseMaps).forEach((layer) => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });

        const next = this.baseMaps[id];
        if (next) {
            next.addTo(this.map);
            this.selectedBaseMap = id;
            this.render();
        }
    }

    private toggleOverlay(id: OverlayLayerId): void {
        if (this.selectedLayers.has(id)) {
            this.selectedLayers.delete(id);
            const layer = this.overlayLayers[id];
            if (layer && this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        } else {
            this.selectedLayers.add(id);
            const layer = this.overlayLayers[id];
            if (layer) {
                layer.addTo(this.map);
            }
        }
        this.render();
    }

    private selectAllLayers(): void {
        this.config.overlayLayers.forEach((layer) => {
            this.selectedLayers.add(layer.id);
            const overlay = this.overlayLayers[layer.id];
            if (overlay && !this.map.hasLayer(overlay)) {
                overlay.addTo(this.map);
            }
        });
        this.render();
    }

    private clearAllLayers(): void {
        this.selectedLayers.forEach((id) => {
            const layer = this.overlayLayers[id];
            if (layer && this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
        this.selectedLayers.clear();
        this.render();
    }

    private applyInitialState(): void {
        if (this.baseMaps[this.selectedBaseMap]) {
            Object.values(this.baseMaps).forEach((layer) => {
                if (this.map.hasLayer(layer) && layer !== this.baseMaps[this.selectedBaseMap]) {
                    this.map.removeLayer(layer);
                }
            });
            if (!this.map.hasLayer(this.baseMaps[this.selectedBaseMap])) {
                this.baseMaps[this.selectedBaseMap].addTo(this.map);
            }
        }

        Object.entries(this.overlayLayers).forEach(([id, layer]) => {
            if (this.selectedLayers.has(id as OverlayLayerId)) {
                if (!this.map.hasLayer(layer)) {
                    layer.addTo(this.map);
                }
            } else if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
    }

    private updateLanguage(lang: 'bhs' | 'en'): void {
        this.currentLang = lang;
        this.render();
    }
}

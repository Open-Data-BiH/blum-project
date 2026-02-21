/**
 * Updates Component
 * Handles loading and displaying transport updates and alerts
 */

class UpdatesManager extends BaseComponent {
    constructor() {
        super('updates-content');
        this.updatesData = null;
        this.currentFilter = 'all';
        this.filtersContainer = null;
    }

    /**
     * Initialize the Updates component
     */
    async init() {
        try {
            this.renderLoading();
            await this.loadUpdatesData();
            this.render();
            this.setupEventListeners();
            this.setupLanguageListener();
        } catch (error) {
            console.error('Error initializing Updates component:', error);
            this.renderError();
        }
    }

    /**
     * Load updates data from JSON file
     */
    async loadUpdatesData() {
        try {
            this.updatesData = await FetchHelper.fetchJSON('data/transport/updates.json');
        } catch (error) {
            console.error('Error loading updates data:', error);
            throw error;
        }
    }

    /**
     * Get active updates filtered by current filter and expiry
     */
    getActiveUpdates() {
        if (!this.updatesData || !this.updatesData.updates) {
            return [];
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return this.updatesData.updates
            .filter(update => {
                // Check if active
                if (!update.isActive) { return false; }

                // Check expiry date
                if (update.dateExpiry) {
                    const expiryDate = new Date(update.dateExpiry);
                    expiryDate.setHours(23, 59, 59, 999);
                    if (expiryDate < now) { return false; }
                }

                // Apply current filter
                if (this.currentFilter !== 'all' && update.type !== this.currentFilter) {
                    return false;
                }

                return true;
            })
            .sort((a, b) => {
                // Sort by severity first (urgent > warning > info)
                const severityOrder = { urgent: 0, warning: 1, info: 2 };
                const severityDiff = (severityOrder[a.severity] || 2) - (severityOrder[b.severity] || 2);
                if (severityDiff !== 0) { return severityDiff; }

                // Then sort by date (newest first)
                return new Date(b.datePublished) - new Date(a.datePublished);
            });
    }

    /**
     * Render the updates component
     */
    render() {
        this.filtersContainer = document.getElementById('updates-filters');

        if (!this.container) {
            console.error('Updates container not found');
            return;
        }

        this.renderFilters();
        this.renderUpdates();
    }

    /**
     * Render filter buttons
     */
    renderFilters() {
        if (!this.filtersContainer || !this.updatesData) { return; }

        const allLabel = this.currentLang === 'en' ? 'All' : 'Sve';

        const filtersHTML = `
            <button class="updates-filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
                <i class="fas fa-list" aria-hidden="true"></i>
                <span>${allLabel}</span>
            </button>
            ${this.updatesData.categories.map(cat => `
                <button class="updates-filter-btn ${this.currentFilter === cat.id ? 'active' : ''}" data-filter="${cat.id}">
                    <i class="fas ${cat.icon}" aria-hidden="true"></i>
                    <span>${cat.label[this.currentLang] || cat.label.bhs}</span>
                </button>
            `).join('')}
        `;

        this.filtersContainer.innerHTML = filtersHTML;
    }

    /**
     * Render update cards
     */
    renderUpdates() {
        if (!this.container) { return; }

        const activeUpdates = this.getActiveUpdates();

        if (activeUpdates.length === 0) {
            this.renderEmpty();
            return;
        }

        const updatesHTML = `
            <div class="updates-list">
                ${activeUpdates.map(update => this.renderUpdate(update)).join('')}
            </div>
        `;

        this.container.innerHTML = updatesHTML;
    }

    /**
     * Render a single update card
     */
    renderUpdate(update) {
        const title = update.title[this.currentLang] || update.title.bhs;
        const description = update.description[this.currentLang] || update.description.bhs;
        const category = this.getCategoryById(update.type);
        const categoryLabel = category ? (category.label[this.currentLang] || category.label.bhs) : update.type;
        const categoryIcon = category ? category.icon : 'fa-info-circle';

        const publishedLabel = this.currentLang === 'en' ? 'Published' : 'Objavljeno';
        const validUntilLabel = this.currentLang === 'en' ? 'Valid until' : 'Važi do';
        const affectedLinesLabel = this.currentLang === 'en' ? 'Affected lines:' : 'Zahvaćene linije:';
        const sourceLabel = this.currentLang === 'en' ? 'Source:' : 'Izvor:';

        const severityLabels = {
            info: this.currentLang === 'en' ? 'Info' : 'Info',
            warning: this.currentLang === 'en' ? 'Warning' : 'Upozorenje',
            urgent: this.currentLang === 'en' ? 'Urgent' : 'Hitno'
        };

        const formattedPublishDate = this.formatDate(update.datePublished);
        const formattedExpiryDate = update.dateExpiry ? this.formatDate(update.dateExpiry) : null;

        return `
            <article class="update-card update-card--${update.severity}" data-update-id="${update.id}">
                <div class="update-card__header">
                    <div class="update-card__badges">
                        <span class="update-badge update-badge--${update.type}">
                            <i class="fas ${categoryIcon}" aria-hidden="true"></i>
                            ${this.escapeHtml(categoryLabel)}
                        </span>
                        <span class="update-badge update-badge--severity-${update.severity}">
                            ${this.escapeHtml(severityLabels[update.severity] || update.severity)}
                        </span>
                    </div>
                    <div class="update-card__date">
                        <i class="fas fa-calendar" aria-hidden="true"></i>
                        <span>${publishedLabel}: ${formattedPublishDate}</span>
                    </div>
                </div>

                <h3 class="update-card__title">${this.escapeHtml(title)}</h3>
                <p class="update-card__description">${this.escapeHtml(description)}</p>

                ${update.affectedLines && update.affectedLines.length > 0 ? `
                    <div class="update-card__lines">
                        <span class="update-card__lines-label">${affectedLinesLabel}</span>
                        ${update.affectedLines.map(line => `
                            <a href="lines.html?line=${line}" class="line-badge">${this.escapeHtml(line)}</a>
                        `).join('')}
                    </div>
                ` : ''}

                <div class="update-card__footer">
                    <div class="update-card__source">
                        ${sourceLabel}
                        ${update.sourceUrl ? `
                            <a href="${this.escapeHtml(update.sourceUrl)}" target="_blank" rel="noopener noreferrer">
                                ${this.escapeHtml(update.source)}
                                <i class="fas fa-external-link-alt" aria-hidden="true"></i>
                            </a>
                        ` : this.escapeHtml(update.source)}
                    </div>
                    ${formattedExpiryDate ? `
                        <div class="update-card__expiry">
                            <i class="fas fa-clock" aria-hidden="true"></i>
                            <span>${validUntilLabel}: ${formattedExpiryDate}</span>
                        </div>
                    ` : ''}
                </div>
            </article>
        `;
    }

    /**
     * Render empty state
     */
    renderEmpty() {
        if (!this.container) { return; }

        const title = this.currentLang === 'en'
            ? 'No Active Updates'
            : 'Nema aktivnih obavještenja';
        const text = this.currentLang === 'en'
            ? 'There are currently no active transport updates or announcements.'
            : 'Trenutno nema aktivnih obavještenja o prevozu.';

        this.container.innerHTML = `
            <div class="updates-empty">
                <i class="updates-empty__icon fas fa-check-circle" aria-hidden="true"></i>
                <h3 class="updates-empty__title">${title}</h3>
                <p class="updates-empty__text">${text}</p>
            </div>
        `;
    }

    /**
     * Render loading state - override to customize message
     */
    renderLoading() {
        const loadingText = this.currentLang === 'en'
            ? 'Loading updates...'
            : 'Učitavanje obavještenja...';
        super.renderLoading(loadingText);
    }

    /**
     * Render error state - override to customize message
     */
    renderError() {
        const errorMessage = this.currentLang === 'en'
            ? 'Sorry, we could not load the updates at this time. Please try again later.'
            : 'Nažalost, nismo mogli učitati obavještenja. Molimo pokušajte kasnije.';
        super.renderError(errorMessage);
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Filter button clicks
        if (this.filtersContainer) {
            this.filtersContainer.addEventListener('click', (event) => {
                const filterBtn = event.target.closest('.updates-filter-btn');
                if (filterBtn) {
                    const filter = filterBtn.dataset.filter;
                    this.setFilter(filter);
                }
            });
        }
    }

    /**
     * Set up language change listener
     */
    setupLanguageListener() {
        document.addEventListener('languageChanged', (e) => {
            if (e.detail && e.detail.language) {
                this.updateLanguage(e.detail.language);
            }
        });
    }

    /**
     * Set the current filter
     */
    setFilter(filter) {
        this.currentFilter = filter;
        this.render();
    }

    /**
     * Update language and re-render
     */
    updateLanguage(newLang) {
        super.updateLanguage(newLang);
        if (this.updatesData) {
            this.render();
        }
    }

    /**
     * Get category object by ID
     */
    getCategoryById(categoryId) {
        if (!this.updatesData || !this.updatesData.categories) { return null; }
        return this.updatesData.categories.find(cat => cat.id === categoryId);
    }

    /**
     * Format date for display
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        const options = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        };
        return date.toLocaleDateString(this.currentLang === 'en' ? 'en-GB' : 'bs-BA', options);
    }

    /**
     * Refresh updates data
     */
    async refresh() {
        try {
            await this.loadUpdatesData();
            this.render();
        } catch (error) {
            console.error('Error refreshing updates:', error);
            this.renderError();
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpdatesManager;
}

// Make available globally
window.UpdatesManager = UpdatesManager;

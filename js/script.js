// DarkModeManager moved to separate file js/darkMode.js

// ==========================================
// Existing code below
// ==========================================

// translations, currentLang, safeGet are owned by js/i18n/i18n.js (AppI18n)

// Configuration for line types to display
const LINE_CONFIG = {
    urban: {
        enabled: true,
        dataFile: 'data/transport/routes/urban_company_ownership.json',
        timetableFile: 'data/transport/timetables/urban_timetables.json',
        useCompanyData: true,
        title: {
            en: 'Urban Lines',
            bhs: 'Gradske linije'
        }
    },
    suburban: {
        enabled: false,
        dataFile: 'data/transport/routes/suburban_company_ownership.json',
        timetableFile: 'data/transport/timetables/suburban_timetables.json',
        useCompanyData: true,
        title: {
            en: 'Suburban Lines',
            bhs: 'Prigradske linije'
        }
    }
};

// debounce, sortLinesByID, normalizeForSearch moved to js/utils.js (AppUtils)

// Initialize application when ready
const initializeApp = () => {
    // Prevent double initialization
    if (window._appInitialized) {
        return;
    }
    window._appInitialized = true;

    // Restore scroll position if coming from a language change
    const savedScrollPosition = sessionStorage.getItem('scrollPosition');
    if (savedScrollPosition) {
        window.scrollTo(0, parseInt(savedScrollPosition));
        sessionStorage.removeItem('scrollPosition'); // Clear after use
    }

    // Load translations, then initialize all components
    // Use .finally() to ensure components initialize even if translations fail
    AppI18n.loadTranslations()
        .then(() => {
        })
        .catch((error) => {
            console.error('Translations failed to load:', error);
        })
        .finally(() => {

            // Setup language switcher (always, after translations are loaded)
            AppI18n.setupLanguageSwitcher();

            // Load bus lines data
            loadLines();

            // Load prices data when pricing feature script is present
            if (window.PricingService && typeof window.PricingService.loadPrices === 'function') {
                window.PricingService.loadPrices();
            }

            // Load contacts data when contacts feature script is present
            if (window.ContactsFeature && typeof window.ContactsFeature.loadContacts === 'function') {
                window.ContactsFeature.loadContacts();
            }

            // Setup timetable selection
            setupTimetableSelection();

            // Setup smooth scrolling for navigation
            setupSmoothScrolling();

            // Note: Mobile menu is handled by layout.js after header loads

            // Setup map credits dropdown
            setupMapCreditsDropdown();

            // Setup lines info accordion
            setupLinesInfoAccordion();
        });
};

// Make initializeApp available globally so layout.js can call it
window.initializeApp = initializeApp;

// Register layoutLoaded listener IMMEDIATELY (before DOMContentLoaded)
// This ensures we catch the event even if layout.js finishes before our DOMContentLoaded handler
document.addEventListener('layoutLoaded', function () {
    initializeApp();
}, { once: true });

// Check if layout.js is being used (pages with dynamic header/footer)
document.addEventListener('DOMContentLoaded', function () {
    const hasHeaderPlaceholder = document.getElementById('header');
    const hasFooterPlaceholder = document.getElementById('footer');

    // If page doesn't use layout.js, initialize immediately
    if (!hasHeaderPlaceholder && !hasFooterPlaceholder) {
        initializeApp();
    } else if (window._layoutJsLoaded) {
        // Layout already loaded (rare case), initialize now
        initializeApp();
    }
    // Otherwise, the early layoutLoaded listener will handle it
});

// loadTranslations, setupLanguageSwitcher, applyTranslation moved to js/i18n/i18n.js (AppI18n)

/**
 * Modular line loading system
 */
class LineManager {
    constructor(config = LINE_CONFIG) {
        this.config = config;
        this.loadedData = {};
        this.enabledTypes = Object.keys(config).filter(type => config[type].enabled);
    }

    /**
     * Get all enabled line types
     */
    getEnabledTypes() {
        return this.enabledTypes;
    }

    /**
     * Load data for a specific line type
     */
    async loadLineTypeData(lineType) {
        const typeConfig = this.config[lineType];
        if (!typeConfig || !typeConfig.enabled) {
            throw new Error(`Line type '${lineType}' is not enabled or configured`);
        }

        try {
            const data = await FetchHelper.fetchJSON(typeConfig.dataFile);

            // Process data based on whether it's company data or simple line data
            const processedLines = this.processLineData(data, lineType, typeConfig.useCompanyData);
            this.loadedData[lineType] = processedLines;
            return processedLines;
        } catch (error) {
            console.error(`Error loading ${lineType} lines:`, error);
            throw error;
        }
    }

    /**
     * Process line data to standardize format
     */
    processLineData(data, lineType, useCompanyData) {
        const lines = [];

        if (useCompanyData) {
            // Process company ownership data
            const typeData = data[lineType] || [];
            typeData.forEach(company => {
                company.lines.forEach(line => {
                    lines.push({
                        lineId: line.lineId,
                        lineName: line.lineName, // This is an object with {en, bhs}
                        companyName: company.companyName,
                        cooperatingCompanyName: line.cooperatingCompanyName,
                        group: line.group,
                        no_stops: line.no_stops,
                        min_duration: line.min_duration,
                        bus_type: line.bus_type,
                        wheelchair_accessible: line.wheelchair_accessible,
                        pdf_url: line.pdf_url,
                        hasMultilingualName: true
                    });
                });
            });
        } else {
            // Process simple line data
            const typeData = data[lineType] || [];
            typeData.forEach(line => {
                lines.push({
                    lineId: line.lineId,
                    lineName: line.lineName, // This is a string
                    companyName: null,
                    cooperatingCompanyName: null,
                    group: line.group,
                    no_stops: line.no_stops,
                    min_duration: line.min_duration,
                    bus_type: line.bus_type,
                    wheelchair_accessible: line.wheelchair_accessible,
                    pdf_url: line.pdf_url,
                    hasMultilingualName: false
                });
            });
        }

        // Sort lines by ID
        return lines.sort(AppUtils.sortLinesByID);
    }

    /**
     * Get line name in current language
     */
    getLineName(line, lang) {
        if (line.hasMultilingualName && typeof line.lineName === 'object') {
            return line.lineName[lang] || line.lineName.en || line.lineName.bhs;
        }
        return line.lineName;
    }

    /**
     * Load all enabled line types
     */
    async loadAllLines() {
        const loadPromises = this.enabledTypes.map(type => this.loadLineTypeData(type));
        await Promise.all(loadPromises);
        return this.loadedData;
    }

    /**
     * Get lines for a specific type
     */
    getLines(lineType) {
        return this.loadedData[lineType] || [];
    }

    /**
     * Get title for a line type in current language
     */
    getTypeTitle(lineType, lang) {
        const typeConfig = this.config[lineType];
        return typeConfig ? typeConfig.title[lang] || typeConfig.title.en : lineType;
    }
}

// Create global instance
const lineManager = new LineManager();

function loadLines() {
    // Create simplified lines view in the lines section
    const linesSection = document.getElementById('lines-info');
    if (!linesSection) {
        return; // Exit if element doesn't exist (e.g. on other pages)
    }

    linesSection.innerHTML = ''; // Clear existing content

    // Create container for the simplified view
    const simplifiedContainer = document.createElement('div');
    simplifiedContainer.id = 'simplified-lines';
    simplifiedContainer.className = 'simplified-lines-container';
    linesSection.appendChild(simplifiedContainer);

    // Get enabled line types
    const enabledTypes = lineManager.getEnabledTypes();

    if (enabledTypes.length === 0) {
        simplifiedContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>No line types are configured to be displayed.</p>
            </div>
        `;
        return;
    }

    // Show loading message
    const loadingText = safeGet(translations, currentLang, 'ui', 'loading') || 'Loading lines...';
    simplifiedContainer.innerHTML = `
        <div class="loading-message">
            <i class="fas fa-spinner fa-spin"></i>
            <p>${loadingText}</p>
        </div>
    `;

    // Load all enabled line data
    lineManager.loadAllLines()
        .then(() => {
            renderLinesInterface(simplifiedContainer, enabledTypes);
        })
        .catch(error => {
            console.error('Error loading line data:', error);
            const errorMessage = safeGet(translations, currentLang, 'ui', 'error') || 'Failed to load line data. Please try again later.';
            const retryText = safeGet(translations, currentLang, 'ui', 'retry') || 'Retry';
            simplifiedContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" type="button">
                        ${retryText}
                    </button>
                </div>
            `;
            simplifiedContainer.querySelector('.retry-btn').addEventListener('click', loadLines);
        });
}

// normalizeForSearch moved to js/utils.js (AppUtils)

/**
 * Get short operator name from full company name
 */
const getShortOperatorName = (companyName) => {
    if (!companyName) { return ''; }
    const nameMap = {
        'AUTOPREVOZ': 'Autoprevoz',
        'PAVLOVIĆ': 'Pavlović',
        'BOČAC': 'Bočac',
        'ALDEMO': 'Aldemo',
        'RALE': 'Rale'
    };
    const found = Object.entries(nameMap).find(([key]) => companyName.toUpperCase().includes(key));
    return found ? found[1] : companyName.split('"')[1] || companyName;
};

/**
 * Render the lines interface based on enabled types
 * Redesigned with search, compact cards, and better UX
 */
function renderLinesInterface(container, enabledTypes) {
    const lang = currentLang;

    // Translation labels
    const labels = {
        search: lang === 'bhs' ? 'Pretraži liniju, odredište, naselje...' : 'Search line, destination, neighborhood...',
        clearSearch: lang === 'bhs' ? 'Obriši pretragu' : 'Clear search',
        filterAll: lang === 'bhs' ? 'Sve' : 'All',
        filterGroup: lang === 'bhs' ? 'Grupa' : 'Group',
        viewTimetable: lang === 'bhs' ? 'Red vožnje' : 'Timetable',
        details: lang === 'bhs' ? 'Detalji' : 'Details',
        pdf: 'PDF',
        showing: lang === 'bhs' ? 'Prikazano' : 'Showing',
        lines: lang === 'bhs' ? 'linija' : 'lines',
        noResults: lang === 'bhs' ? 'Nema rezultata za vašu pretragu' : 'No lines match your search',
        clearFilters: lang === 'bhs' ? 'Obriši filtere' : 'Clear filters',
        stops: lang === 'bhs' ? 'stajališta' : 'stops',
        min: 'min',
        wheelchairAccessible: lang === 'bhs' ? 'Pristupačno za invalidska kolica' : 'Wheelchair accessible',
        notAccessible: lang === 'bhs' ? 'Nije pristupačno' : 'Not accessible',
        operator: lang === 'bhs' ? 'Prevoznik' : 'Operator',
        group: lang === 'bhs' ? 'Grupa' : 'Group',
        numberOfStops: lang === 'bhs' ? 'Broj stajališta' : 'Number of stops',
        duration: lang === 'bhs' ? 'Trajanje vožnje' : 'Duration',
        busType: lang === 'bhs' ? 'Tip autobusa' : 'Bus type',
        accessibility: lang === 'bhs' ? 'Pristupačnost' : 'Accessibility',
        minutes: lang === 'bhs' ? 'minuta' : 'minutes',
        yes: lang === 'bhs' ? 'Da' : 'Yes',
        no: lang === 'bhs' ? 'Ne' : 'No'
    };

    // Collect all lines and groups
    const allLines = [];
    const allGroups = new Set();

    enabledTypes.forEach(type => {
        const lines = lineManager.getLines(type);
        lines.forEach(line => {
            allLines.push({ ...line, lineType: type });
            if (line.group) { allGroups.add(line.group); }
        });
    });

    const sortedGroups = Array.from(allGroups).sort();
    const totalLines = allLines.length;

    // Build HTML
    let html = '';

    // Controls Row (Search + Filters) - Sticky
    html += `
        <div class="lines-controls">
            <div class="lines-search">
                <i class="fas fa-search lines-search__icon" aria-hidden="true"></i>
                <input
                    type="search"
                    class="lines-search__input"
                    id="lines-search-input"
                    placeholder="${labels.search}"
                    aria-label="${labels.search}"
                    autocomplete="off"
                >
                <button
                    class="lines-search__clear"
                    id="lines-search-clear"
                    type="button"
                    aria-label="${labels.clearSearch}"
                >
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="lines-filter-row">
                <div class="filter-buttons" role="group" aria-label="${lang === 'bhs' ? 'Filtriraj po grupi' : 'Filter by group'}">
                    <button class="filter-btn active" data-filter="all" aria-pressed="true">${labels.filterAll}</button>
    `;

    sortedGroups.forEach(group => {
        html += `<button class="filter-btn" data-filter="${group}" aria-pressed="false">${labels.filterGroup} ${group}</button>`;
    });

    html += `
                </div>
                <div class="lines-results-count" id="lines-results-count">
                    ${labels.showing} <strong>${totalLines}</strong> ${labels.lines}
                </div>
            </div>
        </div>
    `;

    // Lines List
    html += '<div class="lines-list" id="lines-list">';

    // Empty state (hidden by default)
    html += `
        <div class="lines-empty-state" id="lines-empty-state" hidden>
            <i class="fas fa-search"></i>
            <p>${labels.noResults}</p>
            <button class="btn btn--secondary" id="clear-all-filters">${labels.clearFilters}</button>
        </div>
    `;

    // Tab content wrapper for compatibility
    html += `<div class="tab-content active" id="${enabledTypes[0]}-lines">`;

    // Render each line card
    allLines.forEach(line => {
        const companyClass = getCompanyClass(line.companyName);
        const lineName = escapeHTML(lineManager.getLineName(line, lang));
        const shortOperator = escapeHTML(getShortOperatorName(line.companyName));
        const busTypeText = escapeHTML(getBusTypeTranslation(line.bus_type));
        const accessibleText = line.wheelchair_accessible ? labels.yes : labels.no;
        const hasTimetable = LINE_CONFIG[line.lineType] && LINE_CONFIG[line.lineType].timetableFile;
        const safeLineId = escapeHTML(line.lineId);
        const safeGroup = escapeHTML(line.group || '');
        const safeCompanyName = escapeHTML(line.companyName || 'N/A');
        const safePdfUrl = line.pdf_url ? sanitizeURL(line.pdf_url) : '';

        html += `
            <div class="line-card ${companyClass}"
                 data-line-id="${safeLineId}"
                 data-group="${safeGroup}"
                 data-search-text="${AppUtils.normalizeForSearch(line.lineId + ' ' + (line.lineName?.bhs || '') + ' ' + (line.lineName?.en || '') + ' ' + (line.companyName || ''))}">

                <div class="line-card__header">
                    <div class="line-card__identity">
                        <span class="badge badge--line-number">${safeLineId}</span>
                        <span class="line-card__name">${lineName}</span>
                    </div>
                    <div class="line-card__badges">
                        ${line.group ? `<span class="badge badge--group">${labels.filterGroup} ${safeGroup}</span>` : ''}
                        ${line.wheelchair_accessible
                ? `<span class="badge badge--accessible" title="${labels.wheelchairAccessible}" aria-label="${labels.wheelchairAccessible}"><i class="fas fa-wheelchair" aria-hidden="true"></i></span>`
                : `<span class="badge badge--not-accessible" title="${labels.notAccessible}" aria-label="${labels.notAccessible}"><i class="fas fa-wheelchair" aria-hidden="true"></i></span>`
            }
                    </div>
                </div>

                <div class="line-card__meta">
                    <span class="meta-item"><i class="fas fa-building" aria-hidden="true"></i> ${shortOperator}</span>
                    <span class="meta-item"><i class="fas fa-map-marker-alt" aria-hidden="true"></i> ${escapeHTML(String(line.no_stops || '?'))} ${labels.stops}</span>
                    <span class="meta-item"><i class="fas fa-clock" aria-hidden="true"></i> ${escapeHTML(String(line.min_duration || '?'))} ${labels.min}</span>
                </div>

                <div class="line-card__actions">
                    ${hasTimetable ? `
                        <button class="btn--primary timetable-btn" data-line-id="${safeLineId}">
                            <i class="fas fa-clock" aria-hidden="true"></i> ${labels.viewTimetable}
                        </button>
                    ` : ''}
                    <button class="btn--secondary details-btn" data-line-id="${safeLineId}" aria-expanded="false" aria-controls="details-${safeLineId}">
                        <i class="fas fa-info-circle" aria-hidden="true"></i> ${labels.details}
                    </button>
                    ${safePdfUrl ? `
                        <a href="${safePdfUrl}" target="_blank" rel="noopener noreferrer" class="btn--link pdf-btn">
                            <i class="fas fa-file-pdf" aria-hidden="true"></i> ${labels.pdf}
                        </a>
                    ` : ''}
                </div>

                <div class="line-card__details" id="details-${safeLineId}" hidden>
                    <div class="detail-item">
                        <span class="detail-item__label">${labels.operator}</span>
                        <span class="detail-item__value">${safeCompanyName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item__label">${labels.group}</span>
                        <span class="detail-item__value">${safeGroup || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item__label">${labels.numberOfStops}</span>
                        <span class="detail-item__value">${escapeHTML(String(line.no_stops || 'N/A'))}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item__label">${labels.duration}</span>
                        <span class="detail-item__value">${line.min_duration ? `${escapeHTML(String(line.min_duration))} ${labels.minutes}` : 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item__label">${labels.busType}</span>
                        <span class="detail-item__value">${busTypeText || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-item__label">${labels.accessibility}</span>
                        <span class="detail-item__value ${line.wheelchair_accessible ? 'detail-item__value--accessible' : 'detail-item__value--not-accessible'}">
                            <i class="fas fa-${line.wheelchair_accessible ? 'check' : 'times'}" aria-hidden="true"></i> ${accessibleText}
                        </span>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>'; // Close tab-content
    html += '</div>'; // Close lines-list

    // Set the HTML content
    container.innerHTML = html;

    // Initialize event listeners
    initializeLinesEventListeners(container, labels);
}

/**
 * Initialize all event listeners for the lines interface
 */
function initializeLinesEventListeners(container, labels) {
    const searchInput = container.querySelector('#lines-search-input');
    const clearSearchBtn = container.querySelector('#lines-search-clear');
    const filterButtons = container.querySelectorAll('.filter-btn');
    const linesList = container.querySelector('#lines-list');
    const resultsCount = container.querySelector('#lines-results-count');
    const emptyState = container.querySelector('#lines-empty-state');
    const clearAllFiltersBtn = container.querySelector('#clear-all-filters');

    let currentSearchQuery = '';
    let currentGroupFilter = 'all';

    // Debounced search handler
    const handleSearch = AppUtils.debounce((query) => {
        currentSearchQuery = query;
        applyFilters();
    }, 200);

    // Apply both search and group filters
    const applyFilters = () => {
        const lineCards = container.querySelectorAll('.line-card');
        let visibleCount = 0;
        const normalizedQuery = AppUtils.normalizeForSearch(currentSearchQuery);

        lineCards.forEach(card => {
            const matchesSearch = !normalizedQuery || card.dataset.searchText.includes(normalizedQuery);
            const matchesGroup = currentGroupFilter === 'all' || card.dataset.group === currentGroupFilter;
            const shouldShow = matchesSearch && matchesGroup;

            if (shouldShow) {
                card.hidden = false;
                visibleCount++;
            } else {
                card.hidden = true;
            }
        });

        // Update results count
        resultsCount.innerHTML = `${labels.showing} <strong>${visibleCount}</strong> ${labels.lines}`;

        // Show/hide empty state
        emptyState.hidden = visibleCount > 0;
    };

    // Search input event
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearSearchBtn.classList.toggle('visible', query.length > 0);
        handleSearch(query);
    });

    // Clear search button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.remove('visible');
        currentSearchQuery = '';
        applyFilters();
        searchInput.focus();
    });

    // Filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            filterButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            currentGroupFilter = this.dataset.filter;
            applyFilters();
        });
    });

    // Clear all filters button (in empty state)
    clearAllFiltersBtn.addEventListener('click', () => {
        // Reset search
        searchInput.value = '';
        clearSearchBtn.classList.remove('visible');
        currentSearchQuery = '';

        // Reset group filter
        filterButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        const allBtn = container.querySelector('.filter-btn[data-filter="all"]');
        if (allBtn) {
            allBtn.classList.add('active');
            allBtn.setAttribute('aria-pressed', 'true');
        }
        currentGroupFilter = 'all';

        applyFilters();
    });

    // Event delegation for line card interactions
    linesList.addEventListener('click', (e) => {
        // Handle details toggle
        const detailsBtn = e.target.closest('.details-btn');
        if (detailsBtn) {
            const lineId = detailsBtn.dataset.lineId;
            const detailsPanel = container.querySelector(`#details-${lineId}`);
            if (detailsPanel) {
                const isExpanded = !detailsPanel.hidden;
                detailsPanel.hidden = isExpanded;
                detailsBtn.setAttribute('aria-expanded', !isExpanded);
            }
        }

        // Handle timetable button
        const timetableBtn = e.target.closest('.timetable-btn');
        if (timetableBtn) {
            const lineId = timetableBtn.dataset.lineId;
            scrollToTimetable(lineId);
        }
    });

    // Keyboard support for Escape to close details
    container.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close all open details panels
            container.querySelectorAll('.line-card__details:not([hidden])').forEach(panel => {
                panel.hidden = true;
                const lineId = panel.id.replace('details-', '');
                const btn = container.querySelector(`.details-btn[data-line-id="${lineId}"]`);
                if (btn) { btn.setAttribute('aria-expanded', 'false'); }
            });
        }
    });
}

/**
 * Filter lines by group (Modern ES6+ with dataset)
 */
// Function to get company class name for styling (Modern ES6+)
const getCompanyClass = (companyName) => {
    const companyMap = {
        'AUTOPREVOZ': 'autoprevoz-line',
        'PAVLOVIĆ': 'pavlovic-line',
        'BOČAC': 'bocac-line',
        'ALDEMO': 'aldemo-line',
        'RALE': 'rale-line'
    };

    const found = Object.entries(companyMap).find(([key]) => companyName.includes(key));
    return found ? found[1] : '';
};

// Function to scroll to timetable and select a line (Modern ES6+)
const scrollToTimetable = (lineId) => {
    const lineSelect = document.getElementById('line-select');
    if (lineSelect) {
        lineSelect.value = lineId;
        lineSelect.dispatchEvent(new Event('change'));
    }

    // Scroll to the timetable section
    const timetableElement = document.getElementById('timetable');
    if (timetableElement) {
        timetableElement.scrollIntoView({ behavior: 'smooth' });
    }
};

// Setup timetable selection
function setupTimetableSelection() {
    const lineSelect = document.getElementById('line-select');
    const timetableDisplay = document.getElementById('timetable-display');

    // Exit early if elements don't exist (e.g., on other pages)
    if (!lineSelect || !timetableDisplay) { return; }

    // Load timetables from all enabled line types
    const timetablePromises = [];
    let allTimetableData = [];

    // Collect all timetable files from enabled line types
    for (const [lineType, config] of Object.entries(LINE_CONFIG)) {
        if (config.enabled && config.timetableFile) {
            timetablePromises.push(
                FetchHelper.fetchJSON(config.timetableFile)
                    .then(data => {
                        // Extract the array from the nested structure
                        // The data is wrapped in an object with keys like "urban", "suburban"
                        const timetableArray = data[lineType] || data;

                        // Ensure we have an array
                        if (!Array.isArray(timetableArray)) {
                            console.warn(`Timetable data for ${lineType} is not an array:`, timetableArray);
                            return [];
                        }

                        // Add line type info to each timetable entry
                        return timetableArray.map(timetable => ({
                            ...timetable,
                            lineType: lineType
                        }));
                    })
                    .catch(error => {
                        console.warn(`Failed to load timetables for ${lineType}:`, error);
                        return []; // Return empty array on error
                    })
            );
        }
    }

    // Load all timetable files
    Promise.all(timetablePromises)
        .then(timetableArrays => {
            // Flatten all timetable arrays into one
            allTimetableData = timetableArrays.flat();

            // Store timetable data globally for later use
            window._realTimetableData = allTimetableData;

            // Update the dropdown with the timetable data
            updateTimetableSelect(null, lineSelect, allTimetableData);

            // Add change event listener
            lineSelect.addEventListener('change', function () {
                if (this.value) {
                    loadTimetable(this.value);
                } else {
                    const welcomeMessage = safeGet(translations, currentLang, 'sections', 'timetable', 'welcome') ||
                        (currentLang === 'bhs' ? 'Redovi vožnje će biti prikazani nakon izbora linije.' : 'Timetables will be displayed after selecting a line.');
                    timetableDisplay.innerHTML = `<p class="timetable-welcome">${welcomeMessage}</p>`;
                }
            });

            // Add event listener for language changes if not already added
            if (!window._timetableLanguageListenerAdded) {
                document.addEventListener('languageChanged', () => {
                    // Update timetable dropdown with new language
                    if (window._realTimetableData) {
                        updateTimetableSelect(null, lineSelect, window._realTimetableData);
                    }

                    // Also update the timetable if one is selected
                    if (lineSelect.value) {
                        loadTimetable(lineSelect.value);
                    }
                });
                window._timetableLanguageListenerAdded = true;
            }

            // Initialize with first available timetable if available or restore previously selected line
            const savedLine = sessionStorage.getItem('selectedLine');
            if (savedLine) {
                lineSelect.value = savedLine;
                loadTimetable(savedLine);
                sessionStorage.removeItem('selectedLine'); // Clear after use
            } else {
                // Don't auto-select first line - let user choose
                const welcomeMessage = safeGet(translations, currentLang, 'sections', 'timetable', 'welcome') ||
                    (currentLang === 'bhs' ? 'Redovi vožnje će biti prikazani nakon izbora linije.' : 'Timetables will be displayed after selecting a line.');
                timetableDisplay.innerHTML = `<p class="timetable-welcome">${welcomeMessage}</p>`;
            }
        })
        .catch(error => {
            console.error('Error loading timetable data:', error);
            const errorMessage = safeGet(translations, currentLang, 'ui', 'error') || 'Failed to load timetable data. Please try again later.';
            const retryText = safeGet(translations, currentLang, 'ui', 'retry') || 'Retry';
            timetableDisplay.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" type="button">
                        ${retryText}
                    </button>
                </div>
            `;
            timetableDisplay.querySelector('.retry-btn').addEventListener('click', setupTimetableSelection);
        });
}

// Update timetable select dropdown with language support
function updateTimetableSelect(data, lineSelect, realTimetableData) {
    // Add default option
    const selectPrompt = safeGet(translations, currentLang, 'sections', 'timetable', 'select') || 'Select a bus line';
    lineSelect.innerHTML = `<option value="">${selectPrompt}</option>`;

    // Check if we're working with real timetable data
    if (realTimetableData && realTimetableData.length > 0) {
        // Group lines by their lineType property
        const linesByType = {};

        realTimetableData.forEach(line => {
            const lineType = line.lineType || 'urban'; // fallback to urban if no lineType
            if (!linesByType[lineType]) {
                linesByType[lineType] = [];
            }
            linesByType[lineType].push(line);
        });

        // Sort lines within each type by line ID
        Object.keys(linesByType).forEach(lineType => {
            linesByType[lineType].sort(AppUtils.sortLinesByID);
        });

        // Add optgroups for each line type
        Object.keys(linesByType).forEach(lineType => {
            const lines = linesByType[lineType];
            if (lines.length > 0) {
                const optgroup = document.createElement('optgroup');

                // Set the label based on line type and current language
                if (lineType === 'urban') {
                    optgroup.label = currentLang === 'bhs' ? 'Gradske linije' : 'Urban Lines';
                } else if (lineType === 'suburban') {
                    optgroup.label = currentLang === 'bhs' ? 'Prigradske linije' : 'Suburban Lines';
                } else {
                    // For any other potential line types
                    optgroup.label = lineType.charAt(0).toUpperCase() + lineType.slice(1) + ' Lines';
                }

                lines.forEach(line => {
                    const option = document.createElement('option');
                    option.value = line.lineId;
                    option.textContent = `${line.lineName[currentLang] || line.lineName.en}`;
                    optgroup.appendChild(option);
                });

                lineSelect.appendChild(optgroup);
            }
        });
    }
}

// Load timetable for selected line
function loadTimetable(lineId) {
    const timetableDisplay = document.getElementById('timetable-display');
    const loadingText = safeGet(translations, currentLang, 'sections', 'timetable', 'loading') || 'Loading timetable...';
    timetableDisplay.innerHTML = `<p>${loadingText}</p>`;

    // Check if we have real timetable data stored
    if (window._realTimetableData) {
        const timetable = window._realTimetableData.find(t => t.lineId === lineId);

        if (timetable) {
            renderTimetable(timetable, timetableDisplay);
            return;
        }
    }

    // Determine which timetable file to load based on line configuration
    let timetableFile = null;

    // Check which line type this lineId belongs to
    for (const [lineType, config] of Object.entries(LINE_CONFIG)) {
        if (config.enabled && lineManager && lineManager.getLines(lineType)) {
            const lines = lineManager.getLines(lineType);
            const lineExists = lines.some(line => line.lineId === lineId);
            if (lineExists) {
                timetableFile = config.timetableFile;
                break;
            }
        }
    }

    // Fallback to urban timetables if no specific file found
    if (!timetableFile) {
        timetableFile = 'data/transport/timetables/urban_timetables.json';
    }

    // Fetch the appropriate timetable file
    FetchHelper.fetchJSON(timetableFile)
        .then(data => {
            // Store for future use
            window._realTimetableData = data;

            const timetable = data.find(t => t.lineId === lineId);

            if (timetable) {
                renderTimetable(timetable, timetableDisplay);
            } else {
                const notFoundText = safeGet(translations, currentLang, 'sections', 'timetable', 'notFound') || 'Timetable not found for the selected line.';
                timetableDisplay.innerHTML = `<p>${notFoundText}</p>`;
            }
        })
        .catch(error => {
            console.error('Error loading timetable:', error);
            const errorMessage = safeGet(translations, currentLang, 'ui', 'error') || 'Failed to load timetable data. Please try again later.';
            const retryText = safeGet(translations, currentLang, 'ui', 'retry') || 'Retry';
            timetableDisplay.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" type="button">
                        ${retryText}
                    </button>
                </div>
            `;
            timetableDisplay.querySelector('.retry-btn').addEventListener('click', () => loadTimetable(lineId));
        });
}

// Render timetable with language support
function renderTimetable(timetable, container) {
    const t = safeGet(translations, currentLang, 'sections', 'timetable');
    const timetableDays = t ? t.days : null;
    const weekdayLabel = (timetableDays && timetableDays.weekday) || 'Weekdays';
    const saturdayLabel = (timetableDays && timetableDays.saturday) || 'Saturday';
    const sundayHolidayLabelText = (timetableDays && timetableDays.sundayHoliday) || (currentLang === 'bhs' ? 'Nedjelja i praznik' : 'Sunday and Holiday');
    const relationLabelText = (t && t.relationLabel) || (currentLang === 'bhs' ? 'Relacija' : 'Direction');
    const timetableForLabelText = (t && t.timetableForLabel) || (currentLang === 'bhs' ? 'Red vožnje' : 'Schedule');
    const hourLabel = (t && t.hourLabel) || (currentLang === 'bhs' ? 'Sat' : 'Hour');
    const minutesLabel = (t && t.minutesLabel) || (currentLang === 'bhs' ? 'Minute' : 'Minutes');
    const swapDirectionLabel = currentLang === 'bhs' ? 'Zamijeni smjer' : 'Swap direction';

    // Create direction IDs based on lineId
    const directionAId = timetable.lineId + 'a';
    const directionBId = timetable.lineId + 'b';

    // Create timetable HTML - Compact layout with controls on same row
    let html = `
        <div class="timetable-controls">
            <div class="timetable-control-row">
                <div class="direction-toggle">
                    <p id="direction-label" class="timetable-control-label">${relationLabelText}</p>
                    <div class="direction-buttons-wrapper">
                        <div class="direction-buttons" role="group" aria-labelledby="direction-label">
                            <button class="direction-btn active" data-direction="${escapeHTML(directionAId)}" aria-pressed="true" aria-label="${escapeHTML(timetable.directions[currentLang][0])}">${escapeHTML(timetable.directions[currentLang][0])}</button>
                            <button class="direction-btn" data-direction="${escapeHTML(directionBId)}" aria-pressed="false" aria-label="${escapeHTML(timetable.directions[currentLang][1])}">${escapeHTML(timetable.directions[currentLang][1])}</button>
                        </div>
                        <button class="direction-swap-btn" aria-label="${swapDirectionLabel}" title="${swapDirectionLabel}">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                    </div>
                </div>

                <div class="day-toggle">
                    <p id="day-label" class="timetable-control-label">${timetableForLabelText}</p>
                    <div class="day-buttons" role="group" aria-labelledby="day-label">
                        <button class="day-btn active" data-day="weekday" aria-pressed="true" aria-label="${weekdayLabel}">${weekdayLabel}</button>
                        <button class="day-btn" data-day="saturday" aria-pressed="false" aria-label="${saturdayLabel}">${saturdayLabel}</button>
                        <button class="day-btn" data-day="sunday" aria-pressed="false" aria-label="${sundayHolidayLabelText}">${sundayHolidayLabelText}</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Add notes section if notes exist
    if (timetable.notes && timetable.notes[currentLang]) {
        html += `
            <div class="timetable-notes">
                <div class="notes-icon">
                    <i class="fas fa-info-circle"></i>
                </div>
                <div class="notes-content">
                    <strong>${currentLang === 'bhs' ? 'Napomene:' : 'Notes:'}</strong>
                    <p>${escapeHTML(timetable.notes[currentLang])}</p>
                </div>
            </div>
        `;
    }

    html += `<div class="timetable-container">`;

    // Create tables for each day type and direction
    const dayTypes = ['weekday', 'saturday', 'sunday'];
    const directions = [directionAId, directionBId];

    // Generate all possible combinations of day/direction tables, but hide the inactive ones
    dayTypes.forEach((dayType, dayIndex) => {
        directions.forEach((direction, dirIndex) => {
            const isActive = dayIndex === 0 && dirIndex === 0 ? '' : 'style="display: none;"';
            const tableId = `timetable-${dayType}-${direction}`;

            html += `
                <div class="timetable-view" id="${tableId}" ${isActive}>
                    <table class="hours-minutes-table">
                        <thead>
                            <tr>
                                <th>${hourLabel}</th>
                                <th>${minutesLabel}</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            // Process departure times for this day type and direction
            // Collect all departure times from all stations
            let allDepartures = [];

            timetable.stations.forEach(station => {
                const directionIndex = dirIndex; // 0 for directionA, 1 for directionB
                const stationTimes = station.times[dayType][directionIndex];
                stationTimes.forEach(time => {
                    allDepartures.push(time);
                });
            });

            // Remove duplicates and sort
            allDepartures = [...new Set(allDepartures)].sort();

            // Group by hour
            const departuresByHour = {};
            allDepartures.forEach(time => {
                const [hour, minute] = time.split(':');
                if (!departuresByHour[hour]) {
                    departuresByHour[hour] = [];
                }
                departuresByHour[hour].push(minute);
            });

            // Get current time info for highlighting
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            // First pass: Find the very next departure time
            let nextDepartureHour = null;
            let nextDepartureMinute = null;

            // Check each hour in chronological order
            Object.keys(departuresByHour).sort().forEach(hour => {
                const hourValue = parseInt(hour);
                if (nextDepartureHour !== null) { return; } // Already found next departure

                // If this hour is in the future, first minute is next departure
                if (hourValue > currentHour) {
                    nextDepartureHour = hourValue;
                    nextDepartureMinute = Math.min(...departuresByHour[hour].map(m => parseInt(m)));
                    return;
                }

                // If this is the current hour, check each minute
                if (hourValue === currentHour) {
                    // Get minutes in ascending order
                    const sortedMinutes = departuresByHour[hour].map(m => parseInt(m)).sort((a, b) => a - b);

                    // Find first minute that is >= current minute
                    for (const minute of sortedMinutes) {
                        if (minute >= currentMinute) {
                            nextDepartureHour = hourValue;
                            nextDepartureMinute = minute;
                            break;
                        }
                    }
                }
            });

            // Create rows for each hour
            Object.keys(departuresByHour).sort().forEach(hour => {
                const minutes = departuresByHour[hour].sort((a, b) => parseInt(a) - parseInt(b));
                const hourValue = parseInt(hour);

                // Add current-hour class if this is the current hour
                const isCurrentHour = hourValue === currentHour;
                const rowClass = isCurrentHour ? 'current-hour' : '';
                const rowId = isCurrentHour ? `current-hour-row-${dayType}-${direction}` : '';

                html += `
                    <tr class="${rowClass}" ${rowId ? `id="${rowId}"` : ''} data-hour="${hourValue}">
                        <td class="hour-cell">${hour}</td>
                        <td class="minutes-cell">
                            <div class="minutes-wrapper">
                `;

                // Create styled boxes for minutes
                minutes.forEach(minute => {
                    const minuteValue = parseInt(minute);
                    let timeClass;

                    // Determine status of this departure time
                    if (hourValue < currentHour || (hourValue === currentHour && minuteValue < currentMinute)) {
                        // Past departure
                        timeClass = 'past';
                    } else if (hourValue === nextDepartureHour && minuteValue === nextDepartureMinute) {
                        // The very next departure
                        timeClass = 'next';
                    } else {
                        // All other future departures
                        timeClass = 'upcoming';
                    }

                    html += `<span class="minute-box ${timeClass}" data-minute="${minuteValue}">${minute}</span>`;
                });

                html += `
                            </div>
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });
    });

    html += `</div>`; // Close timetable-container

    // Render the timetable
    container.innerHTML = html;

    // Timetable styles are now in css/timetables.css

    // Add event listeners for direction toggle
    document.querySelectorAll('.direction-btn').forEach(button => {
        button.addEventListener('click', function () {
            // Update active direction button
            document.querySelectorAll('.direction-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            // Get current active day
            const activeDay = document.querySelector('.day-btn.active').getAttribute('data-day');
            const direction = this.getAttribute('data-direction');

            // Hide all timetable views
            document.querySelectorAll('.timetable-view').forEach(view => {
                view.style.display = 'none';
            });

            // Show the selected timetable view
            document.getElementById(`timetable-${activeDay}-${direction}`).style.display = 'block';

            // Update time highlighting and scroll to current hour
            updateTimeHighlighting();
            scrollToCurrentHour();
        });
    });

    // Add event listener for swap direction button
    const swapBtn = document.querySelector('.direction-swap-btn');
    if (swapBtn) {
        swapBtn.addEventListener('click', function () {
            const directionBtns = document.querySelectorAll('.direction-btn');
            if (directionBtns.length === 2) {
                // Find the currently inactive button and click it
                const inactiveBtn = Array.from(directionBtns).find(btn => !btn.classList.contains('active'));
                if (inactiveBtn) {
                    inactiveBtn.click();
                }
            }
        });
    }

    // Add event listeners for day toggle
    document.querySelectorAll('.day-btn').forEach(button => {
        button.addEventListener('click', function () {
            // Update active day button
            document.querySelectorAll('.day-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            // Get current active direction
            const activeDirection = document.querySelector('.direction-btn.active').getAttribute('data-direction');
            const day = this.getAttribute('data-day');

            // Hide all timetable views
            document.querySelectorAll('.timetable-view').forEach(view => {
                view.style.display = 'none';
            });

            // Show the selected timetable view
            document.getElementById(`timetable-${day}-${activeDirection}`).style.display = 'block';

            // Update time highlighting and scroll to current hour
            updateTimeHighlighting();
            scrollToCurrentHour();
        });
    });

    // Setup automatic time highlighting
    setupTimeHighlighting();

    // Scroll to current hour on initial load (with slight delay for DOM)
    setTimeout(scrollToCurrentHour, 100);
}

// Setup time highlighting (Modern ES6+ with debounce)
const setupTimeHighlighting = () => {
    // Clear any existing interval
    if (window.timeHighlightInterval) {
        clearInterval(window.timeHighlightInterval);
    }

    // Update immediately
    updateTimeHighlighting();

    // Then update every minute with debounced function
    const debouncedUpdate = AppUtils.debounce(updateTimeHighlighting, 300);
    window.timeHighlightInterval = setInterval(debouncedUpdate, 60000);
};

// Scroll to current hour row in the timetable
const scrollToCurrentHour = () => {
    const now = new Date();
    const currentHour = now.getHours();

    // Find visible timetable view
    let visibleView = document.querySelector('.timetable-view:not([style*="display: none"])');

    if (!visibleView) {
        // Fallback: find any visible timetable view
        const allViews = document.querySelectorAll('.timetable-view');
        visibleView = Array.from(allViews).find(view => {
            const style = window.getComputedStyle(view);
            return style.display !== 'none';
        });
    }

    if (!visibleView) { return; }

    // Find the current hour row or the next closest hour
    let targetRow = visibleView.querySelector(`tr[data-hour="${currentHour}"]`);

    // If current hour doesn't exist, find the next available hour
    if (!targetRow) {
        const allRows = visibleView.querySelectorAll('tbody tr[data-hour]');
        for (const row of allRows) {
            const rowHour = parseInt(row.getAttribute('data-hour'));
            if (rowHour >= currentHour) {
                targetRow = row;
                break;
            }
        }
        // If no future hours, scroll to last row
        if (!targetRow && allRows.length > 0) {
            targetRow = allRows[allRows.length - 1];
        }
    }

    if (targetRow) {
        // Smooth scroll to the target row
        targetRow.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
};

// Global function to update time highlighting (Modern ES6+)
const updateTimeHighlighting = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Get all visible timetable views
    let visibleTimetableViews = document.querySelectorAll('.timetable-view:not([style*="display: none"])');

    // Fallback: if no visible views found, try to find any timetable view that's not explicitly hidden
    if (visibleTimetableViews.length === 0) {
        visibleTimetableViews = document.querySelectorAll('.timetable-view');

        // Filter to find the actually visible one
        visibleTimetableViews = Array.from(visibleTimetableViews).filter(view => {
            const style = window.getComputedStyle(view);
            return style.display !== 'none';
        });
    }

    visibleTimetableViews.forEach(tableView => {
        // Update current hour row highlighting
        tableView.querySelectorAll('tbody tr').forEach(row => {
            const hourAttr = row.getAttribute('data-hour');
            if (hourAttr !== null) {
                const rowHour = parseInt(hourAttr);
                if (rowHour === currentHour) {
                    row.classList.add('current-hour');
                } else {
                    row.classList.remove('current-hour');
                }
            }
        });

        // First pass: collect all times and find the next one
        const allDepartureTimes = [];

        tableView.querySelectorAll('tbody tr').forEach(row => {
            const hourCell = row.querySelector('.hour-cell');
            if (!hourCell) { return; }

            const hourValue = parseInt(hourCell.textContent);
            if (isNaN(hourValue)) { return; }

            row.querySelectorAll('.minute-box').forEach(minuteBox => {
                const minuteValue = parseInt(minuteBox.textContent);
                if (isNaN(minuteValue)) { return; }

                const timeInMinutes = hourValue * 60 + minuteValue;
                allDepartureTimes.push({
                    hour: hourValue,
                    minute: minuteValue,
                    timeInMinutes: timeInMinutes,
                    element: minuteBox
                });
            });
        });

        // Sort by time
        allDepartureTimes.sort((a, b) => a.timeInMinutes - b.timeInMinutes);

        // Find the next departure time (first departure that is current time or later)
        let nextDepartureTime = null;
        for (const time of allDepartureTimes) {
            if (time.timeInMinutes >= currentTimeInMinutes) {
                nextDepartureTime = time;
                break;
            }
        }

        // If no departure found for today, the next departure is the first one tomorrow
        if (!nextDepartureTime && allDepartureTimes.length > 0) {
            nextDepartureTime = allDepartureTimes[0];

        }

        // Second pass: mark all times with appropriate classes
        // Check if next departure is tomorrow (all today's departures are past)
        const isNextDepartureTomorrow = nextDepartureTime &&
            allDepartureTimes.every(time => time.timeInMinutes < currentTimeInMinutes);

        allDepartureTimes.forEach(time => {
            // Remove existing classes
            time.element.classList.remove('past', 'next', 'upcoming');

            // Determine status of this departure time
            if (time.timeInMinutes < currentTimeInMinutes) {
                if (isNextDepartureTomorrow && nextDepartureTime &&
                    time.timeInMinutes === nextDepartureTime.timeInMinutes) {
                    // This is the next departure (tomorrow)
                    time.element.classList.add('next');
                } else if (isNextDepartureTomorrow) {
                    // All other departures when next is tomorrow are upcoming (for tomorrow)
                    time.element.classList.add('upcoming');
                } else {
                    // Past departure (normal case)
                    time.element.classList.add('past');
                }
            } else if (nextDepartureTime && time.timeInMinutes === nextDepartureTime.timeInMinutes) {
                // The very next departure (today)
                time.element.classList.add('next');
            } else {
                // All other future departures (today)
                time.element.classList.add('upcoming');
            }
        });
    });
}

// Update timetable language if it's already displayed
// Setup smooth scrolling for navigation links (Modern ES6+)
const setupSmoothScrolling = () => {
    // Handle navigation links
    document.querySelectorAll('.nav__link').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');

            // Only handle internal anchor links (starting with #)
            if (!targetId.startsWith('#')) { return; }

            e.preventDefault();

            const targetElement = document.querySelector(targetId);
            if (!targetElement) { return; }

            // Get header height to offset scrolling
            const header = document.querySelector('header');
            const headerHeight = header ? header.offsetHeight : 0;

            // For mobile view, add extra offset for the map section
            const extraOffset = (targetId === '#map' && window.innerWidth <= 768) ? 20 : 0;

            window.scrollTo({
                top: targetElement.offsetTop - headerHeight - extraOffset,
                behavior: 'smooth'
            });
        });
    });
};

// Function to get bus type translation (Modern ES6+)
const getBusTypeTranslation = (busType) => {
    if (!busType) { return ''; }

    const busTypeTranslations = {
        solo: {
            en: 'Solo bus',
            bhs: 'Standardni autobus'
        },
        minibus: {
            en: 'Minibus',
            bhs: 'Minibus'
        },
        articulated: {
            en: 'Articulated bus',
            bhs: 'Zglobni autobus'
        }
    };

    const translation = busTypeTranslations[busType];
    if (translation) {
        return translation[currentLang] || translation.en || busType;
    }
    return busType;
};

// Setup lines info accordion functionality
const setupLinesInfoAccordion = () => {
    const toggle = document.getElementById('lines-info-toggle');
    const content = document.getElementById('lines-info-content');

    if (!toggle || !content) { return; }

    // Update content language visibility
    const updateContentLanguage = () => {
        const bhsElements = content.querySelectorAll('[data-lang="bhs"]');
        const enElements = content.querySelectorAll('[data-lang="en"]');

        bhsElements.forEach(el => {
            el.style.display = currentLang === 'bhs' ? '' : 'none';
        });
        enElements.forEach(el => {
            el.style.display = currentLang === 'en' ? '' : 'none';
        });

        // Also update toggle button text
        const bhsToggleText = toggle.querySelector('[data-lang="bhs"]');
        const enToggleText = toggle.querySelector('[data-lang="en"]');
        if (bhsToggleText) { bhsToggleText.style.display = currentLang === 'bhs' ? '' : 'none'; }
        if (enToggleText) { enToggleText.style.display = currentLang === 'en' ? '' : 'none'; }
    };

    // Set initial language
    updateContentLanguage();

    // Toggle accordion
    toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', !isExpanded);
        content.hidden = isExpanded;

        if (!isExpanded) {
            updateContentLanguage();
        }
    });

    // Listen for language changes
    document.addEventListener('languageChanged', updateContentLanguage);
};

// Setup map credits dropdown functionality (Modern ES6+)
const setupMapCreditsDropdown = () => {
    const toggle = document.getElementById('map-credits-toggle');
    const content = document.getElementById('map-credits-content');

    if (toggle && content) {
        // Set initial state
        toggle.setAttribute('aria-expanded', 'false');
        content.classList.remove('open');

        // Update context content language visibility
        function updateContentLanguage() {
            const bhsContent = content.querySelector('.map-context__content[data-lang="bhs"]');
            const enContent = content.querySelector('.map-context__content[data-lang="en"]');

            if (bhsContent && enContent) {
                if (currentLang === 'bhs') {
                    bhsContent.style.display = '';
                    enContent.style.display = 'none';
                } else {
                    bhsContent.style.display = 'none';
                    enContent.style.display = '';
                }
            }
        }

        // Set initial language
        updateContentLanguage();

        toggle.addEventListener('click', function () {
            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

            if (isExpanded) {
                // Close dropdown
                toggle.setAttribute('aria-expanded', 'false');
                content.classList.remove('open');
            } else {
                // Open dropdown
                toggle.setAttribute('aria-expanded', 'true');
                content.classList.add('open');
                // Update language when opening
                updateContentLanguage();
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function (event) {
            if (!toggle.contains(event.target) && !content.contains(event.target)) {
                toggle.setAttribute('aria-expanded', 'false');
                content.classList.remove('open');
            }
        });

        // Close dropdown on Escape key
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
                toggle.setAttribute('aria-expanded', 'false');
                content.classList.remove('open');
                toggle.focus(); // Return focus to toggle button
            }
        });
    }
}








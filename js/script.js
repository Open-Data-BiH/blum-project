// Global variables for translations and current language
let translations = {};
let prices = {};
let currentLang = localStorage.getItem('selectedLanguage') || 'bhs'; // Get language from localStorage or default to 'bhs'

// Make currentLang available globally
window.currentLang = currentLang;

// Configuration for line types to display
const LINE_CONFIG = {
    urban: {
        enabled: true,
        dataFile: 'data/urban_company_ownership.json',
        timetableFile: 'data/urban_timetables.json',
        useCompanyData: true,
        title: {
            en: 'Urban Lines',
            bhs: 'Gradske linije'
        }
    },
    suburban: {
        enabled: false,
        dataFile: 'data/suburban_company_ownership.json',
        timetableFile: 'data/suburban_timetables.json',
        useCompanyData: true,
        title: {
            en: 'Suburban Lines',
            bhs: 'Prigradske linije'
        }
    }
};

// Helper function to sort lines by ID
function sortLinesByID(a, b) {
    const numA = parseInt(a.lineId);
    const numB = parseInt(b.lineId);
    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
    }
    return a.lineId.localeCompare(b.lineId);
}

document.addEventListener('DOMContentLoaded', function () {
    // Restore scroll position if coming from a language change
    const savedScrollPosition = sessionStorage.getItem('scrollPosition');
    if (savedScrollPosition) {
        window.scrollTo(0, parseInt(savedScrollPosition));
        sessionStorage.removeItem('scrollPosition'); // Clear after use
    }

    // Load translations
    loadTranslations().then(() => {
        // Setup language switcher
        setupLanguageSwitcher();

        // Load bus lines data
        loadLines();

        // Load prices data
        loadPrices();

        // Load contacts data
        loadContacts();

        // Setup timetable selection
        setupTimetableSelection();

        // Setup smooth scrolling for navigation
        setupSmoothScrolling();

        // Setup mobile menu toggle
        setupMobileMenu();
    });
});

// Load translations
async function loadTranslations() {
    try {
        const response = await fetch('data/bhs_en_translations.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        translations = await response.json();
        applyTranslation(currentLang);
    } catch (error) {
        console.error('Error loading translations:', error);
        // Fallback to basic functionality without translations
        document.body.classList.add('translations-failed');
    }
}

// Setup language switcher
function setupLanguageSwitcher() {
    // Activate the correct language button based on current language
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.getAttribute('data-lang') === currentLang) {
            btn.classList.add('lang-btn--active');
        } else {
            btn.classList.remove('lang-btn--active');
        }

        btn.addEventListener('click', function () {
            const lang = this.getAttribute('data-lang');
            if (lang !== currentLang) {
                // Save current scroll position
                sessionStorage.setItem('scrollPosition', window.pageYOffset);

                // Save currently selected timetable line if any
                const lineSelect = document.getElementById('line-select');
                if (lineSelect && lineSelect.value) {
                    sessionStorage.setItem('selectedLine', lineSelect.value);
                }

                // Close mobile menu if open
                const nav = document.getElementById('main-nav');
                const menuToggle = document.getElementById('mobile-menu-toggle');
                if (nav && menuToggle) {
                    nav.classList.remove('active');
                    menuToggle.classList.remove('active');
                }

                // Store the selected language in localStorage
                localStorage.setItem('selectedLanguage', lang);

                // Reload the page to apply changes completely
                window.location.reload();
            }
        });
    });
}

// Apply translation to the whole page
function applyTranslation(lang) {
    const t = translations[lang];
    if (!t) return;

    // Update current language
    currentLang = lang;
    window.currentLang = lang; // Update global variable

    // Helper function to safely update element text
    function safelyUpdateText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    // Header
    safelyUpdateText('site-title', t.header.title);

    // Navigation - Mobile
    safelyUpdateText('nav-map', t.header.nav.map);
    safelyUpdateText('nav-lines', t.header.nav.lines);
    safelyUpdateText('nav-timetable', t.header.nav.timetable);
    safelyUpdateText('nav-airport', t.header.nav.airport);
    safelyUpdateText('nav-contact', t.header.nav.contact);
    safelyUpdateText('nav-price-tables', t.header.nav.prices || (lang === 'bhs' ? 'Cjenovnik' : 'Prices'));
    safelyUpdateText('nav-urban-lines', t.header.nav.urban_lines);

    // Navigation - Desktop
    safelyUpdateText('nav-map-desktop', t.header.nav.map);
    safelyUpdateText('nav-lines-desktop', t.header.nav.lines);
    safelyUpdateText('nav-timetable-desktop', t.header.nav.timetable);
    safelyUpdateText('nav-airport-desktop', t.header.nav.airport);
    safelyUpdateText('nav-contact-desktop', t.header.nav.contact);
    safelyUpdateText('nav-price-tables-desktop', t.header.nav.prices || (lang === 'bhs' ? 'Cjenovnik' : 'Prices'));
    safelyUpdateText('nav-urban-lines-desktop', t.header.nav.urban_lines);

    // Update sections
    // Urban Lines section
    safelyUpdateText('urban-lines-title', t.sections.urban_lines.title);
    const mapNote = document.querySelector('#urban-lines .map-note span');
    if (mapNote) {
        mapNote.textContent = t.sections.urban_lines.map_note;
    }

    // Map section
    safelyUpdateText('map-title', t.sections.map.title);

    // Lines section
    safelyUpdateText('lines-title', t.sections.lines.title);
    safelyUpdateText('price-tables-title', t.sections.prices?.title || (lang === 'bhs' ? 'Cjenovnik karata' : 'Ticket Prices'));

    // Lines introduction and ticket note
    const linesIntroText = lang === 'bhs'
        ? 'Javni prevoz u Banjoj Luci organizovan je u tri grupe linija. Za svaku grupu linija potrebno je kupiti odgovarajuću kartu. Karte nisu prenosive između grupa.'
        : 'Public transport in Banja Luka is organized into three groups of lines. For each group of lines, you need to purchase a corresponding ticket. Tickets are not transferable between groups.';
    safelyUpdateText('lines-intro-text', linesIntroText);

    // Operator legend title
    const operatorLegendTitle = lang === 'bhs'
        ? 'Prevoznici'
        : 'Operators';
    safelyUpdateText('operator-legend-title', operatorLegendTitle);

    // Reload lines with new language
    loadLines();

    // Timetable section
    safelyUpdateText('timetable-title', t.sections.timetable.title);

    // Add translations for timetable if not present
    if (t.sections && t.sections.timetable) {
        // From-To label
        if (!t.sections.timetable.fromTo) {
            t.sections.timetable.fromTo = lang === 'bhs' ? 'Relacija:' : 'Route:';
        }

        // Select day label
        if (!t.sections.timetable.selectDay) {
            t.sections.timetable.selectDay = lang === 'bhs' ? 'Izaberite dan' : 'Select day';
        }

        // Hour and Minutes labels
        if (!t.sections.timetable.hourLabel) {
            t.sections.timetable.hourLabel = lang === 'bhs' ? 'Sat' : 'Hour';
        }

        if (!t.sections.timetable.minutesLabel) {
            t.sections.timetable.minutesLabel = lang === 'bhs' ? 'Minute' : 'Minutes';
        }
    }

    // Contact section
    safelyUpdateText('contact-title', t.sections.contact.title);
    safelyUpdateText('email-label', t.sections.contact.email);
    safelyUpdateText('phone-label', t.sections.contact.phone);
    safelyUpdateText('timetable-info-label', t.sections.contact.timetableInfo);

    // Update disclaimer text
    const disclaimerText = lang === 'bhs'
        ? 'Ova internet stranica nije službena stranica Grada Banja Luka niti bilo kojeg prevoznika. Svi podaci su dati samo u informativne svrhe. Za zvanične informacije o redovima vožnje, cijenama i drugim detaljima, molimo vas da kontaktirate nadležne institucije ili prevoznike.'
        : 'This website is not officially affiliated with the City of Banja Luka or any transport operators. All data is provided for informational purposes only. For official information about schedules, prices, and other details, please contact the relevant authorities or transport companies.';
    safelyUpdateText('disclaimer-text', disclaimerText);

    // Update timetable display if it has content
    updateTimetableLanguage();

    // Update pricing tables
    if (prices && Object.keys(prices).length > 0) {
        renderPriceTables();
    }

    // Bus stops note translation
    const busStopsNoteText = lang === 'bhs'
        ? 'Na mapi su prikazana autobuska stajališta, Nextbike stanice, željezničke stanice i drugi oblici urbane mobilnosti. Kontrolu prikaza možete izvršiti pomoću kontrole filtera u donjem desnom uglu mape – uključite ili isključite pojedinačne slojeve prema potrebi.'
        : 'The map shows bus stops, Nextbike stations, railway stations, and other forms of urban mobility. You can manage the visibility of these elements using the filter control in the bottom right corner of the map – toggle individual layers as needed.';
    safelyUpdateText('bus-stops-note-text', busStopsNoteText);

    // Handle elements with data-lang attributes (show/hide based on current language)
    document.querySelectorAll('[data-lang]').forEach(element => {
        // Skip language switcher buttons - they should always be visible
        if (element.classList.contains('lang-btn')) {
            return;
        }

        const elementLang = element.getAttribute('data-lang');
        if (elementLang === lang) {
            element.style.display = '';
        } else {
            element.style.display = 'none';
        }
    });

    // Dispatch a custom event to notify other components that the language has changed
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));

    // Airport shuttle section
    safelyUpdateText('airport-title', t.sections.airport.title);
    safelyUpdateText('airport-description-title', t.sections.airport.descriptionTitle);
    safelyUpdateText('airport-price', t.sections.airport.price);
    safelyUpdateText('airport-departure-location', t.sections.airport.departureLocation);
    safelyUpdateText('airport-more-info', t.sections.airport.moreInfo);
    safelyUpdateText('airport-website-link', t.sections.airport.websiteLink);
}

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
            const response = await fetch(typeConfig.dataFile);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

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
                    hasMultilingualName: false
                });
            });
        }

        // Sort lines by ID
        return lines.sort(sortLinesByID);
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
    simplifiedContainer.innerHTML = `
        <div class="loading-message">
            <i class="fas fa-spinner fa-spin"></i>
            <p>${translations[currentLang]?.ui?.loading || 'Loading lines...'}</p>
        </div>
    `;

    // Load all enabled line data
    lineManager.loadAllLines()
        .then(() => {
            renderLinesInterface(simplifiedContainer, enabledTypes);
        })
        .catch(error => {
            console.error('Error loading line data:', error);
            const errorMessage = translations[currentLang]?.ui?.error || 'Failed to load line data. Please try again later.';
            simplifiedContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="loadLines()">
                        ${translations[currentLang]?.ui?.retry || 'Retry'}
                    </button>
                </div>
            `;
        });
}

/**
 * Render the lines interface based on enabled types
 */
function renderLinesInterface(container, enabledTypes) {
    const lang = currentLang;

    // Get translations for details
    const detailsLabel = lang === 'bhs' ? 'Detalji' : 'Details';
    const operatorLabel = translations[lang]?.sections?.lines?.lineDetails?.operator || (lang === 'bhs' ? 'Prevoznik' : 'Operator');
    const viewTimetableLabel = lang === 'bhs' ? 'Pogledaj red vožnje' : 'View timetable';

    // Get translations for line details
    const lineDetailTranslations = translations[lang]?.sections?.lines?.lineDetails || {};
    const groupLabel = lineDetailTranslations.group || (lang === 'bhs' ? 'Grupa' : 'Group');
    const noStopsLabel = lineDetailTranslations.noStops || (lang === 'bhs' ? 'Broj stajališta' : 'Number of stops');
    const minDurationLabel = lineDetailTranslations.minDuration || (lang === 'bhs' ? 'Minimalno vrijeme vožnje' : 'Minimum duration');
    const busTypeLabel = lineDetailTranslations.busType || (lang === 'bhs' ? 'Tip autobusa' : 'Bus type');
    const wheelchairLabel = lineDetailTranslations.wheelchairAccessible || (lang === 'bhs' ? 'Prilagođeno za invalidska kolica' : 'Wheelchair accessible');
    const minutesLabel = lineDetailTranslations.minutes || (lang === 'bhs' ? 'minuta' : 'minutes');
    const yesLabel = lineDetailTranslations.yes || (lang === 'bhs' ? 'Da' : 'Yes');
    const noLabel = lineDetailTranslations.no || (lang === 'bhs' ? 'Ne' : 'No');

    // Filter labels
    const filterAllLabel = lang === 'bhs' ? 'Sve linije' : 'All lines';
    const filterGroupLabel = lang === 'bhs' ? 'Grupa' : 'Group';

    // Collect all unique groups from all enabled line types
    const allGroups = new Set();
    enabledTypes.forEach(type => {
        const lines = lineManager.getLines(type);
        lines.forEach(line => {
            if (line.group) {
                allGroups.add(line.group);
            }
        });
    });

    // Convert to array and sort groups
    const sortedGroups = Array.from(allGroups).sort();

    let html = '';

    // Create tabs if multiple line types are enabled
    if (enabledTypes.length > 1) {
        html += '<div class="lines-tabs">';
        enabledTypes.forEach((type, index) => {
            const activeClass = index === 0 ? 'active' : '';
            const title = lineManager.getTypeTitle(type, lang);
            html += `<button class="tab-btn ${activeClass}" data-tab="${type}">${title}</button>`;
        });
        html += '</div>';

        // Add group filtering controls only if there are groups and multiple line types
        if (sortedGroups.length > 0) {
            html += '<div class="group-filters">';
            html += `<div class="filter-label">${lang === 'bhs' ? 'Filtriraj linije:' : 'Filter lines:'}</div>`;
            html += '<div class="filter-buttons">';
            html += `<button class="filter-btn active" data-filter="all">${filterAllLabel}</button>`;

            // Add buttons for each unique group
            sortedGroups.forEach(group => {
                let groupDisplayName;
                if (group === 'I') {
                    groupDisplayName = `${filterGroupLabel} I`;
                } else if (group === 'II') {
                    groupDisplayName = `${filterGroupLabel} II`;
                } else if (group === 'III') {
                    groupDisplayName = `${filterGroupLabel} III`;
                } else {
                    // For any other group names (e.g., suburban lines might have different naming)
                    groupDisplayName = group;
                }
                html += `<button class="filter-btn" data-filter="${group}">${groupDisplayName}</button>`;
            });

            html += '</div>';
            html += '</div>';
        }
    }

    html += '<div class="lines-content">';

    // Create content for each enabled line type
    enabledTypes.forEach((type, index) => {
        const lines = lineManager.getLines(type);
        const activeClass = index === 0 ? 'active' : '';
        const title = lineManager.getTypeTitle(type, lang);

        // If only one type is enabled, show title directly
        if (enabledTypes.length === 1) {
            html += `<h3 class="single-type-title">${title}</h3>`;

            // Add group filtering controls below the header for single line type view
            if (sortedGroups.length > 0) {
                html += '<div class="group-filters">';
                html += `<div class="filter-label">${lang === 'bhs' ? 'Filtriraj linije:' : 'Filter lines:'}</div>`;
                html += '<div class="filter-buttons">';
                html += `<button class="filter-btn active" data-filter="all">${filterAllLabel}</button>`;

                // Add buttons for each unique group
                sortedGroups.forEach(group => {
                    let groupDisplayName;
                    if (group === 'I') {
                        groupDisplayName = `${filterGroupLabel} I`;
                    } else if (group === 'II') {
                        groupDisplayName = `${filterGroupLabel} II`;
                    } else if (group === 'III') {
                        groupDisplayName = `${filterGroupLabel} III`;
                    } else {
                        // For any other group names (e.g., suburban lines might have different naming)
                        groupDisplayName = group;
                    }
                    html += `<button class="filter-btn" data-filter="${group}">${groupDisplayName}</button>`;
                });

                html += '</div>';
                html += '</div>';
            }
        }

        html += `<div class="tab-content ${activeClass}" id="${type}-lines">`;

        if (lines.length === 0) {
            html += `<p class="no-lines-message">No ${type} lines available.</p>`;
        } else {
            lines.forEach(line => {
                const lineColor = getCompanyClass(line.companyName);
                const wheelchairText = line.wheelchair_accessible ? yesLabel : noLabel;
                const busTypeText = getBusTypeTranslation(line.bus_type);
                const lineName = lineManager.getLineName(line, lang);

                html += `
                    <div class="line-card ${lineColor}" data-line-id="${line.lineId}" data-group="${line.group || ''}">
                        <div class="line-header">
                            <div class="line-info">
                                <span class="line-id">${line.lineId}</span>
                                <span class="line-name">${lineName}</span>
                            </div>
                            <div class="line-buttons">
                                <button class="details-btn" data-line-id="${line.lineId}">
                                    <i class="fas fa-info-circle"></i> ${detailsLabel}
                                </button>
                `;

                // Show timetable button if timetables are configured for this line type
                if (LINE_CONFIG[type] && LINE_CONFIG[type].timetableFile) {
                    html += `
                        <button class="timetable-btn" data-line-id="${line.lineId}" onclick="scrollToTimetable('${line.lineId}')">
                            <i class="fas fa-clock"></i> ${viewTimetableLabel}
                        </button>
                    `;
                }

                html += `
                            </div>
                        </div>
                        <div class="line-details" id="details-${line.lineId}">
                `;

                // Only show company info if available
                if (line.companyName) {
                    html += `<p><strong>${operatorLabel}:</strong> ${line.companyName}</p>`;
                }

                // Only show group if it exists
                if (line.group) {
                    html += `<p><strong>${groupLabel}:</strong> ${line.group}</p>`;
                }

                html += `
                            <p><strong>${noStopsLabel}:</strong> ${line.no_stops || 'N/A'}</p>
                            <p><strong>${minDurationLabel}:</strong> ${line.min_duration ? `${line.min_duration} ${minutesLabel}` : 'N/A'}</p>
                            <p><strong>${busTypeLabel}:</strong> ${busTypeText || 'N/A'}</p>
                            <p><strong>${wheelchairLabel}:</strong> 
                                <span class="${line.wheelchair_accessible ? 'accessible-yes' : 'accessible-no'}">
                                    <i class="fas fa-${line.wheelchair_accessible ? 'check' : 'times'}"></i> ${wheelchairText}
                                </span>
                            </p>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div>`;
    });

    html += `</div>`; // Close lines-content div

    // Set the HTML content
    container.innerHTML = html;

    // Add event listeners for tabs (if multiple types)
    if (enabledTypes.length > 1) {
        container.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                // Update active tab button
                container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // Show the selected tab content
                const tabId = this.getAttribute('data-tab');
                container.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                container.querySelector(`#${tabId}-lines`).classList.add('active');

                // Reset filter to "all" when switching tabs
                const allFilterBtn = container.querySelector('.filter-btn[data-filter="all"]');
                if (allFilterBtn) {
                    container.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                    allFilterBtn.classList.add('active');
                    filterLinesByGroup(container, 'all');
                }
            });
        });
    }

    // Add event listeners for group filters (only if filter controls exist)
    const filterButtons = container.querySelectorAll('.filter-btn');
    if (filterButtons.length > 0) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', function () {
                // Update active filter button
                container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');

                // Filter lines by group
                const filterValue = this.getAttribute('data-filter');
                filterLinesByGroup(container, filterValue);
            });
        });
    }

    // Add event listeners for detail buttons
    container.querySelectorAll('.details-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const lineId = this.getAttribute('data-line-id');
            const detailsElement = document.getElementById(`details-${lineId}`);

            if (detailsElement.style.display === 'block') {
                detailsElement.style.display = 'none';
            } else {
                detailsElement.style.display = 'block';
            }
        });
    });
}

/**
 * Filter lines by group
 */
function filterLinesByGroup(container, groupFilter) {
    const activeTabContent = container.querySelector('.tab-content.active');
    if (!activeTabContent) return;

    const lineCards = activeTabContent.querySelectorAll('.line-card');

    lineCards.forEach(card => {
        const lineGroup = card.getAttribute('data-group');

        if (groupFilter === 'all' || lineGroup === groupFilter) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// Function to get company class name for styling
function getCompanyClass(companyName) {
    if (companyName.includes('AUTOPREVOZ')) return 'autoprevoz-line';
    if (companyName.includes('PAVLOVIĆ')) return 'pavlovic-line';
    if (companyName.includes('BOČAC')) return 'bocac-line';
    if (companyName.includes('ALDEMO')) return 'aldemo-line';
    if (companyName.includes('RALE')) return 'rale-line';
    return '';
}

// Function to scroll to timetable and select a line
function scrollToTimetable(lineId) {
    const lineSelect = document.getElementById('line-select');
    if (lineSelect) {
        lineSelect.value = lineId;
        // Trigger change event to load the timetable
        const event = new Event('change');
        lineSelect.dispatchEvent(event);
    }

    // Scroll to the timetable section
    const timetableSection = document.getElementById('timetable');
    if (timetableSection) {
        timetableSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Load prices data
function loadPrices() {
    fetch('data/prices.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            prices = data;
            renderPriceTables();

            // Register an event listener for language changes to update price tables
            if (!window._priceTablesLanguageListenerAdded) {
                document.addEventListener('languageChanged', () => {
                    renderPriceTables();
                });
                window._priceTablesLanguageListenerAdded = true;
            }
        })
        .catch(error => {
            console.error('Error loading price data:', error);
            const priceTablesContainer = document.querySelector('#price-tables .price-tables');
            if (priceTablesContainer) {
                const errorMessage = translations[currentLang]?.ui?.error || 'Failed to load price data. Please try again later.';
                priceTablesContainer.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${errorMessage}</p>
                        <button class="retry-btn" onclick="loadPrices()">
                            ${translations[currentLang]?.ui?.retry || 'Retry'}
                        </button>
                    </div>
                `;
            }
        });
}

// Render price tables
function renderPriceTables() {
    if (!prices || !prices[currentLang]) return;

    const priceTablesContainer = document.querySelector('#price-tables .price-tables');
    if (!priceTablesContainer) return;

    priceTablesContainer.innerHTML = '';

    const priceData = prices[currentLang];
    const labels = priceData.labels;

    // Create a single price table container
    const priceTableContainer = document.createElement('div');
    priceTableContainer.className = 'price-table-container';

    // Build a single table with all price information
    let tableHtml = `
        <table class="unified-price-table">
            <thead>
                <tr>
                    <th>${labels.ticketTypes}</th>
                    <th>${labels.price} (${labels.km})</th>
                </tr>
            </thead>
            <tbody>
                <!-- Single and Daily Tickets Section -->
                <tr class="category-header">
                    <td colspan="2">${currentLang === 'bhs' ? 'Pojedinačne i dnevne karte' : 'Single and Daily Tickets'}</td>
                </tr>
                <tr>
                    <td>
                        ${priceData.ticketTypes.single.name}
                        <div class="description">${priceData.ticketTypes.single.description}</div>
                    </td>
                    <td>${priceData.ticketTypes.single.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>
                        ${priceData.ticketTypes.singleInSet.name}
                        <div class="description">${priceData.ticketTypes.singleInSet.description}</div>
                    </td>
                    <td>${priceData.ticketTypes.singleInSet.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>
                        ${priceData.ticketTypes.daily.name}
                        <div class="description">${priceData.ticketTypes.daily.description}</div>
                    </td>
                    <td>${priceData.ticketTypes.daily.price.toFixed(2)}</td>
                </tr>

                <!-- Monthly Group Tickets Section -->
                <tr class="category-header">
                    <td colspan="2">${priceData.ticketTypes.monthlyGroup.name}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyGroup.workers.name}</td>
                    <td>${priceData.ticketTypes.monthlyGroup.workers.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyGroup.students.name}</td>
                    <td>${priceData.ticketTypes.monthlyGroup.students.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyGroup.pensioners.name}</td>
                    <td>${priceData.ticketTypes.monthlyGroup.pensioners.price.toFixed(2)}</td>
                </tr>

                <!-- Unified Monthly Tickets Section -->
                <tr class="category-header">
                    <td colspan="2">${priceData.ticketTypes.monthlyUnified.name}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyUnified.workers.name}</td>
                    <td>${priceData.ticketTypes.monthlyUnified.workers.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyUnified.students.name}</td>
                    <td>${priceData.ticketTypes.monthlyUnified.students.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyUnified.pensioners.name}</td>
                    <td>${priceData.ticketTypes.monthlyUnified.pensioners.price.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>
    `;

    // Add disclaimer
    const disclaimerText = currentLang === 'bhs'
        ? `<p class="price-disclaimer">Prikazane cijene su informativnog karaktera. Za tačne i ažurirane cijene, kao i za cijene prigradskih linija, molimo posjetite <a href="https://www.banjaluka.rs.ba/gradjani/javni-prevoz/" target="_blank">zvaničnu internet stranicu Grada Banja Luka</a> ili se obratite na prodajnim mjestima prevoznika.</p>`
        : `<p class="price-disclaimer">Displayed prices are for informational purposes only. For current and updated prices, as well as suburban line prices, please visit the <a href="https://www.banjaluka.rs.ba/gradjani/javni-prevoz/" target="_blank">official City of Banja Luka website</a> or inquire at operator's sales points.</p>`;

    tableHtml += disclaimerText;

    priceTableContainer.innerHTML = tableHtml;
    priceTablesContainer.appendChild(priceTableContainer);

    // Price table styles are now in css/price-tables.css
}

// Setup timetable selection
function setupTimetableSelection() {
    const lineSelect = document.getElementById('line-select');
    const timetableDisplay = document.getElementById('timetable-display');

    // Load timetables from all enabled line types
    const timetablePromises = [];
    let allTimetableData = [];

    // Collect all timetable files from enabled line types
    for (const [lineType, config] of Object.entries(LINE_CONFIG)) {
        if (config.enabled && config.timetableFile) {
            timetablePromises.push(
                fetch(config.timetableFile)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        // Extract the array from the nested structure
                        // The data is wrapped in an object with keys like "urban", "suburban"
                        let timetableArray = data[lineType] || data;

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
                    timetableDisplay.innerHTML = `<p>${translations[currentLang]?.sections?.timetable?.select || 'Please select a bus line to view its timetable.'}</p>`;
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
            } else if (allTimetableData && allTimetableData.length > 0) {
                lineSelect.value = allTimetableData[0].lineId;
                loadTimetable(allTimetableData[0].lineId);
            }
        })
        .catch(error => {
            console.error('Error loading timetable data:', error);
            const errorMessage = translations[currentLang]?.ui?.error || 'Failed to load timetable data. Please try again later.';
            timetableDisplay.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="setupTimetableSelection()">
                        ${translations[currentLang]?.ui?.retry || 'Retry'}
                    </button>
                </div>
            `;
        });
}

// Update timetable select dropdown with language support
function updateTimetableSelect(data, lineSelect, realTimetableData) {
    // Add default option
    const selectPrompt = translations[currentLang]?.sections?.timetable?.select || 'Select a bus line';
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
            linesByType[lineType].sort(sortLinesByID);
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
    timetableDisplay.innerHTML = `<p>${translations[currentLang]?.sections?.timetable?.loading || 'Loading timetable...'}</p>`;

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
        timetableFile = 'data/urban_timetables.json';
    }

    // Fetch the appropriate timetable file
    fetch(timetableFile)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Store for future use
            window._realTimetableData = data;

            const timetable = data.find(t => t.lineId === lineId);

            if (timetable) {
                renderTimetable(timetable, timetableDisplay);
            } else {
                timetableDisplay.innerHTML = `<p>${translations[currentLang]?.sections?.timetable?.notFound || 'Timetable not found for the selected line.'}</p>`;
            }
        })
        .catch(error => {
            console.error('Error loading timetable:', error);
            const errorMessage = translations[currentLang]?.ui?.error || 'Failed to load timetable data. Please try again later.';
            timetableDisplay.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="loadTimetable('${lineId}')">
                        ${translations[currentLang]?.ui?.retry || 'Retry'}
                    </button>
                </div>
            `;
        });
}

// Render timetable with language support
function renderTimetable(timetable, container) {
    const t = translations[currentLang]?.sections?.timetable;
    const weekdayLabel = t?.days?.weekday || 'Weekdays';
    const saturdayLabel = t?.days?.saturday || 'Saturday';
    const sundayHolidayLabelText = t?.days?.sundayHoliday || (currentLang === 'bhs' ? 'Nedjelja i praznik' : 'Sunday and Holiday');
    const relationLabelText = t?.relationLabel || (currentLang === 'bhs' ? 'Relacija:' : 'Relation:');
    const timetableForLabelText = t?.timetableForLabel || (currentLang === 'bhs' ? 'Red vožnje za:' : 'Timetable for:');
    const hourLabel = t?.hourLabel || (currentLang === 'bhs' ? 'Sat' : 'Hour');
    const minutesLabel = t?.minutesLabel || (currentLang === 'bhs' ? 'Minute' : 'Minutes');

    // Create direction IDs based on lineId
    const directionAId = timetable.lineId + 'a';
    const directionBId = timetable.lineId + 'b';

    // Create timetable HTML
    let html = `
        <h3 class="timetable-line-name">${timetable.lineName[currentLang]}</h3>
        
        <div class="timetable-controls">
            <div class="direction-toggle">
                <p id="direction-label" class="timetable-control-label">${relationLabelText}</p>
                <div class="direction-buttons" role="group" aria-labelledby="direction-label">
                    <button class="direction-btn active" data-direction="${directionAId}" aria-pressed="true" aria-label="${timetable.directions[currentLang][0]}">${timetable.directions[currentLang][0]}</button>
                    <button class="direction-btn" data-direction="${directionBId}" aria-pressed="false" aria-label="${timetable.directions[currentLang][1]}">${timetable.directions[currentLang][1]}</button>
                </div>
            </div>
            
            <div class="day-toggle">
                <p id="day-label" class="timetable-control-label">${timetableForLabelText}</p>
                <div role="group" aria-labelledby="day-label">
                    <button class="day-btn active" data-day="weekday" aria-pressed="true" aria-label="${weekdayLabel}">${weekdayLabel}</button>
                    <button class="day-btn" data-day="saturday" aria-pressed="false" aria-label="${saturdayLabel}">${saturdayLabel}</button>
                    <button class="day-btn" data-day="sunday" aria-pressed="false" aria-label="${sundayHolidayLabelText}">${sundayHolidayLabelText}</button>
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
                    <p>${timetable.notes[currentLang]}</p>
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
                if (nextDepartureHour !== null) return; // Already found next departure

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

                html += `
                    <tr>
                        <td class="hour-cell">${hour}</td>
                        <td class="minutes-cell">
                `;

                // Create styled boxes for minutes
                minutes.forEach(minute => {
                    const minuteValue = parseInt(minute);
                    let timeClass = '';

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

                    html += `<span class="minute-box ${timeClass}">${minute}</span>`;
                });

                html += `
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

            // Update time highlighting for the new view
            updateTimeHighlighting();
        });
    });

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

            // Update time highlighting for the new view
            updateTimeHighlighting();
        });
    });

    // Setup automatic time highlighting
    setupTimeHighlighting();
}

// Setup time highlighting
function setupTimeHighlighting() {
    // Clear any existing interval
    if (window.timeHighlightInterval) {
        clearInterval(window.timeHighlightInterval);
    }

    // Update immediately
    updateTimeHighlighting();

    // Then update every minute
    window.timeHighlightInterval = setInterval(updateTimeHighlighting, 60000);
}

// Global function to update time highlighting
function updateTimeHighlighting() {
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
        // First pass: collect all times and find the next one
        let allDepartureTimes = [];

        tableView.querySelectorAll('tbody tr').forEach(row => {
            const hourCell = row.querySelector('.hour-cell');
            if (!hourCell) return;

            const hourValue = parseInt(hourCell.textContent);
            if (isNaN(hourValue)) return;

            row.querySelectorAll('.minute-box').forEach(minuteBox => {
                const minuteValue = parseInt(minuteBox.textContent);
                if (isNaN(minuteValue)) return;

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
        let pastCount = 0, nextCount = 0, upcomingCount = 0;

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
                    nextCount++;
                } else if (isNextDepartureTomorrow) {
                    // All other departures when next is tomorrow are upcoming (for tomorrow)
                    time.element.classList.add('upcoming');
                    upcomingCount++;
                } else {
                    // Past departure (normal case)
                    time.element.classList.add('past');
                    pastCount++;
                }
            } else if (nextDepartureTime && time.timeInMinutes === nextDepartureTime.timeInMinutes) {
                // The very next departure (today)
                time.element.classList.add('next');
                nextCount++;
            } else {
                // All other future departures (today)
                time.element.classList.add('upcoming');
                upcomingCount++;
            }
        });
    });
}

// Update timetable language if it's already displayed
function updateTimetableLanguage() {
    const timetableDisplay = document.getElementById('timetable-display');
    const lineSelect = document.getElementById('line-select');

    // Check if the timetable is already displayed using any of the possible indicators
    if (timetableDisplay.querySelector('.hours-minutes-table') ||
        timetableDisplay.querySelector('.timetable-table') ||
        timetableDisplay.querySelector('.no-timetable') ||
        timetableDisplay.querySelector('.timetable-view')) {
        if (lineSelect.value) {
            loadTimetable(lineSelect.value);
        }
    }
}

// Setup smooth scrolling for navigation links
function setupSmoothScrolling() {
    // Handle navigation links
    document.querySelectorAll('.nav__link').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Get header height to offset scrolling
                const headerHeight = document.querySelector('header').offsetHeight;

                // For mobile view, add extra offset for the map section
                if (targetId === '#map' && window.innerWidth <= 768) {
                    window.scrollTo({
                        top: targetElement.offsetTop - headerHeight - 20, // Add header height offset
                        behavior: 'smooth'
                    });
                } else {
                    window.scrollTo({
                        top: targetElement.offsetTop - headerHeight, // Add header height offset
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}

// Load and display contacts information
function loadContacts() {
    fetch('data/contacts.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            displayContacts(data);
        })
        .catch(error => {
            console.error('Error loading contacts:', error);
            const contactSection = document.getElementById('contact');
            const errorMessage = translations[currentLang]?.ui?.error || 'Failed to load contact data. Please try again later.';
            contactSection.innerHTML = `
                <h2 id="contact-title">${translations[currentLang]?.sections?.contact?.title || 'Contact Information'}</h2>
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="loadContacts()">
                        ${translations[currentLang]?.ui?.retry || 'Retry'}
                    </button>
                </div>
            `;
        });
}

// Display contacts in contact cards
function displayContacts(data) {
    const contactSection = document.getElementById('contact');
    if (!contactSection) return;

    // Create or get the contact cards container
    let contactCards = contactSection.querySelector('.contact-cards');
    if (!contactCards) {
        // Create container if it doesn't exist
        contactCards = document.createElement('div');
        contactCards.className = 'contact-cards';

        // Get the existing content
        const existingContent = contactSection.innerHTML;

        // Clear the section
        contactSection.innerHTML = '';

        // Add the title back (first h2 element)
        const titleMatch = existingContent.match(/<h2[^>]*>(.*?)<\/h2>/);
        if (titleMatch) {
            const titleElement = document.createElement('h2');
            titleElement.id = 'contact-title';
            titleElement.textContent = translations[currentLang]?.sections?.contact?.title || 'Contact Information';
            contactSection.appendChild(titleElement);
        }

        // Add the contact cards container
        contactSection.appendChild(contactCards);
    } else {
        // Just clear the cards container
        contactCards.innerHTML = '';
    }

    // Generate contact cards
    if (data.contacts && data.contacts.length > 0) {
        data.contacts.forEach(contact => {
            const card = document.createElement('div');
            card.className = 'contact-card';
            card.id = `contact-${contact.id}`;

            // Set card style with organization color
            if (contact.color) {
                card.style.borderLeftColor = contact.color;
            }

            // Get translated content
            const name = contact.name[currentLang] || contact.name.bhs;
            const department = contact.department[currentLang] || contact.department.bhs;
            const type = contact.type[currentLang] || contact.type.bhs;

            // Generate HTML for the card
            let cardContent = `
                <h3>${name}</h3>
                <p class="contact-department">${department}</p>
                <p class="contact-type">${type}</p>
            `;

            // Add phone if available
            if (contact.phoneDisplay) {
                cardContent += `<p class="contact-phone"><strong>${translations[currentLang]?.sections?.contact?.phone || 'Phone:'}</strong> ${contact.phoneDisplay}</p>`;
            }

            // Add website if available
            if (contact.website) {
                cardContent += `<p class="contact-website"><a href="${contact.website}" target="_blank">${translations[currentLang]?.ui?.visit || 'Visit website'}</a></p>`;
            }

            // Set the card content
            card.innerHTML = cardContent;
            contactCards.appendChild(card);
        });
    }
}

// Setup mobile menu
function setupMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const nav = document.getElementById('main-nav');

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', function () {
            const isActive = nav.classList.contains('active');

            if (isActive) {
                nav.classList.remove('active');
                menuToggle.classList.remove('active');
            } else {
                nav.classList.add('active');
                menuToggle.classList.add('active');
            }
        });

        // Close menu when clicking on links
        document.querySelectorAll('.nav__link').forEach(link => {
            link.addEventListener('click', function () {
                nav.classList.remove('active');
                menuToggle.classList.remove('active');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function (event) {
            if (!menuToggle.contains(event.target) && !nav.contains(event.target)) {
                nav.classList.remove('active');
                menuToggle.classList.remove('active');
            }
        });
    }
}

// Function to get bus type translation
function getBusTypeTranslation(busType) {
    if (!busType) return '';

    const translations = {
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

    return translations[busType] ? translations[busType][currentLang] || translations[busType].en : busType;
} 
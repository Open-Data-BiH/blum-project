import { AppI18n } from '../../core/i18n.js';
import { escapeHTML, sanitizeURL } from '../../core/sanitize.js';
import { debounce, normalizeForSearch } from '../../core/utils.js';
import { LINE_CONFIG, lineManager } from './line-manager.js';

const getShortOperatorName = (companyName) => {
    if (!companyName) {
        return '';
    }
    const nameMap = {
        AUTOPREVOZ: 'Autoprevoz',
        PAVLOVIC: 'Pavlovic',
        BOCAC: 'Bocac',
        ALDEMO: 'Aldemo',
        RALE: 'Rale',
    };
    const found = Object.entries(nameMap).find(([key]) => companyName.toUpperCase().includes(key));
    return found ? found[1] : companyName.split('"')[1] || companyName;
};

const getCompanyClass = (companyName) => {
    const companyMap = {
        AUTOPREVOZ: 'autoprevoz-line',
        PAVLOVIC: 'pavlovic-line',
        BOCAC: 'bocac-line',
        ALDEMO: 'aldemo-line',
        RALE: 'rale-line',
    };

    const normalizedName = (companyName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();

    const found = Object.entries(companyMap).find(([key]) => normalizedName.includes(key));
    return found ? found[1] : '';
};

const getBusTypeTranslation = (busType) => {
    if (!busType) {
        return '';
    }

    const busTypeTranslations = {
        solo: { en: 'Solo bus', bhs: 'Standardni autobus' },
        minibus: { en: 'Minibus', bhs: 'Minibus' },
        articulated: { en: 'Articulated bus', bhs: 'Zglobni autobus' },
    };

    const translation = busTypeTranslations[busType];
    if (translation) {
        return translation[AppI18n.currentLang] || translation.en || busType;
    }
    return busType;
};

const scrollToTimetable = (lineId) => {
    const lineSelect = document.getElementById('line-select');
    if (lineSelect) {
        lineSelect.value = lineId;
        lineSelect.dispatchEvent(new Event('change'));
    }

    const timetableElement = document.getElementById('timetable');
    if (timetableElement) {
        timetableElement.scrollIntoView({ behavior: 'smooth' });
    }
};

function loadLines() {
    const linesSection = document.getElementById('lines-info');
    if (!linesSection) {
        return;
    }

    linesSection.innerHTML = '';

    const simplifiedContainer = document.createElement('div');
    simplifiedContainer.id = 'simplified-lines';
    simplifiedContainer.className = 'simplified-lines-container';
    linesSection.appendChild(simplifiedContainer);

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

    const loadingText = AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'ui', 'loading') || 'Loading lines...';
    simplifiedContainer.innerHTML = `
        <div class="loading-message">
            <i class="fas fa-spinner fa-spin"></i>
            <p>${loadingText}</p>
        </div>
    `;

    lineManager
        .loadAllLines()
        .then(() => {
            renderLinesInterface(simplifiedContainer, enabledTypes);
        })
        .catch((error) => {
            console.error('Error loading line data:', error);
            const errorMessage =
                AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'ui', 'error') ||
                'Failed to load line data. Please try again later.';
            const retryText = AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'ui', 'retry') || 'Retry';
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

function renderLinesInterface(container, enabledTypes) {
    const lang = AppI18n.currentLang;

    const labels = {
        search: lang === 'bhs' ? 'Pretrazi liniju, odrediste, naselje...' : 'Search line, destination, neighborhood...',
        clearSearch: lang === 'bhs' ? 'Obrisi pretragu' : 'Clear search',
        filterAll: lang === 'bhs' ? 'Sve' : 'All',
        filterGroup: lang === 'bhs' ? 'Grupa' : 'Group',
        viewTimetable: lang === 'bhs' ? 'Red voznje' : 'Timetable',
        details: lang === 'bhs' ? 'Detalji' : 'Details',
        pdf: 'PDF',
        showing: lang === 'bhs' ? 'Prikazano' : 'Showing',
        lines: lang === 'bhs' ? 'linija' : 'lines',
        noResults: lang === 'bhs' ? 'Nema rezultata za vasu pretragu' : 'No lines match your search',
        clearFilters: lang === 'bhs' ? 'Obrisi filtere' : 'Clear filters',
        stops: lang === 'bhs' ? 'stajalista' : 'stops',
        min: 'min',
        wheelchairAccessible: lang === 'bhs' ? 'Pristupacno za invalidska kolica' : 'Wheelchair accessible',
        notAccessible: lang === 'bhs' ? 'Nije pristupacno' : 'Not accessible',
        operator: lang === 'bhs' ? 'Prevoznik' : 'Operator',
        group: lang === 'bhs' ? 'Grupa' : 'Group',
        numberOfStops: lang === 'bhs' ? 'Broj stajalista' : 'Number of stops',
        duration: lang === 'bhs' ? 'Trajanje voznje' : 'Duration',
        busType: lang === 'bhs' ? 'Tip autobusa' : 'Bus type',
        accessibility: lang === 'bhs' ? 'Pristupacnost' : 'Accessibility',
        minutes: lang === 'bhs' ? 'minuta' : 'minutes',
        yes: lang === 'bhs' ? 'Da' : 'Yes',
        no: lang === 'bhs' ? 'Ne' : 'No',
    };

    const allLines = [];
    const allGroups = new Set();

    enabledTypes.forEach((type) => {
        const lines = lineManager.getLines(type);
        lines.forEach((line) => {
            allLines.push({ ...line, lineType: type });
            if (line.group) {
                allGroups.add(line.group);
            }
        });
    });

    const sortedGroups = Array.from(allGroups).sort();
    const totalLines = allLines.length;

    let html = '';

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

    sortedGroups.forEach((group) => {
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

    html += '<div class="lines-list" id="lines-list">';

    html += `
        <div class="lines-empty-state" id="lines-empty-state" hidden>
            <i class="fas fa-search"></i>
            <p>${labels.noResults}</p>
            <button class="btn btn--secondary" id="clear-all-filters">${labels.clearFilters}</button>
        </div>
    `;

    html += `<div class="tab-content active" id="${enabledTypes[0]}-lines">`;

    allLines.forEach((line) => {
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
                 data-search-text="${normalizeForSearch(line.lineId + ' ' + (line.lineName?.bhs || '') + ' ' + (line.lineName?.en || '') + ' ' + (line.companyName || ''))}">

                <div class="line-card__header">
                    <div class="line-card__identity">
                        <span class="badge badge--line-number">${safeLineId}</span>
                        <span class="line-card__name">${lineName}</span>
                    </div>
                    <div class="line-card__badges">
                        ${line.group ? `<span class="badge badge--group">${labels.filterGroup} ${safeGroup}</span>` : ''}
                        ${
                            line.wheelchair_accessible
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
                    ${
                        hasTimetable
                            ? `
                        <button class="btn--primary timetable-btn" data-line-id="${safeLineId}">
                            <i class="fas fa-clock" aria-hidden="true"></i> ${labels.viewTimetable}
                        </button>
                    `
                            : ''
                    }
                    <button class="btn--secondary details-btn" data-line-id="${safeLineId}" aria-expanded="false" aria-controls="details-${safeLineId}">
                        <i class="fas fa-info-circle" aria-hidden="true"></i> ${labels.details}
                    </button>
                    ${
                        safePdfUrl
                            ? `
                        <a href="${safePdfUrl}" target="_blank" rel="noopener noreferrer" class="btn--link pdf-btn">
                            <i class="fas fa-file-pdf" aria-hidden="true"></i> ${labels.pdf}
                        </a>
                    `
                            : ''
                    }
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

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    initializeLinesEventListeners(container, labels);
}

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

    const handleSearch = debounce((query) => {
        currentSearchQuery = query;
        applyFilters();
    }, 200);

    const applyFilters = () => {
        const lineCards = container.querySelectorAll('.line-card');
        let visibleCount = 0;
        const normalizedQuery = normalizeForSearch(currentSearchQuery);

        lineCards.forEach((card) => {
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

        resultsCount.innerHTML = `${labels.showing} <strong>${visibleCount}</strong> ${labels.lines}`;
        emptyState.hidden = visibleCount > 0;
    };

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearSearchBtn.classList.toggle('visible', query.length > 0);
        handleSearch(query);
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.remove('visible');
        currentSearchQuery = '';
        applyFilters();
        searchInput.focus();
    });

    filterButtons.forEach((btn) => {
        btn.addEventListener('click', function () {
            filterButtons.forEach((b) => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            currentGroupFilter = this.dataset.filter;
            applyFilters();
        });
    });

    clearAllFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.remove('visible');
        currentSearchQuery = '';

        filterButtons.forEach((btn) => {
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

    linesList.addEventListener('click', (e) => {
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

        const timetableBtn = e.target.closest('.timetable-btn');
        if (timetableBtn) {
            const lineId = timetableBtn.dataset.lineId;
            scrollToTimetable(lineId);
        }
    });

    container.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            container.querySelectorAll('.line-card__details:not([hidden])').forEach((panel) => {
                panel.hidden = true;
                const lineId = panel.id.replace('details-', '');
                const btn = container.querySelector(`.details-btn[data-line-id="${lineId}"]`);
                if (btn) {
                    btn.setAttribute('aria-expanded', 'false');
                }
            });
        }
    });
}

export { loadLines, getBusTypeTranslation };


// Cards are server-rendered; this module manages their UI state.

import { debounce, normalizeForSearch } from '../../core/utils';
import { getCurrentLanguage } from '../../core/i18n';

export const openTimetable = (lineId: string): void => {
    // Preserve the selection while the timetable module loads on first open.
    sessionStorage.setItem('selectedLine', lineId);
    document.dispatchEvent(new CustomEvent('timetable:open', { detail: { lineId } }));
};

const getLabels = (lang: string) => ({
    showing: lang === 'bhs' ? 'Prikazano' : 'Showing',
    lines: lang === 'bhs' ? 'linija' : 'lines',
});

let currentSearchQuery = '';
let currentGroupFilter = 'all';

const applyFilters = (): void => {
    const container = document.getElementById('simplified-lines');
    if (!container) {
        return;
    }

    const lineCards = container.querySelectorAll<HTMLElement>('.line-card');
    let visibleCount = 0;
    const normalizedQuery = normalizeForSearch(currentSearchQuery);
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);

    lineCards.forEach((card) => {
        const searchText = card.dataset.searchText ?? '';
        const matchesSearch = queryTokens.length === 0 || queryTokens.every((token) => searchText.includes(token));
        const matchesGroup = currentGroupFilter === 'all' || card.dataset.group === currentGroupFilter;
        const shouldShow = matchesSearch && matchesGroup;

        card.hidden = !shouldShow;
        if (shouldShow) {
            visibleCount++;
        }
    });

    const resultsCount = document.getElementById('lines-results-count');
    if (resultsCount) {
        const lang = getCurrentLanguage();
        const labels = getLabels(lang);
        resultsCount.innerHTML = `${labels.showing} <strong>${visibleCount}</strong> ${labels.lines}`;
    }

    const emptyState = document.getElementById('lines-empty-state');
    if (emptyState) {
        emptyState.hidden = visibleCount > 0;
    }
};

export const initializeLinesEventListeners = (): void => {
    const container = document.getElementById('simplified-lines');
    if (!container) {
        return;
    }

    const searchInput = document.getElementById('lines-search-input') as HTMLInputElement | null;
    const clearSearchBtn = document.getElementById('lines-search-clear');
    const filterButtons = document.querySelectorAll<HTMLElement>('.filter-btn');
    const linesList = document.getElementById('lines-list');
    const clearAllFiltersBtn = document.getElementById('clear-all-filters');

    if (!searchInput) {
        return;
    }

    const handleSearch = debounce((query: string) => {
        currentSearchQuery = query;
        applyFilters();
    }, 200);

    searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value.trim();
        clearSearchBtn?.classList.toggle('visible', query.length > 0);
        handleSearch(query);
    });

    clearSearchBtn?.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.remove('visible');
        currentSearchQuery = '';
        applyFilters();
        searchInput.focus();
    });

    filterButtons.forEach((btn) => {
        btn.addEventListener('click', function (this: HTMLElement) {
            filterButtons.forEach((b) => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');
            currentGroupFilter = this.dataset.filter ?? 'all';
            applyFilters();
        });
    });

    clearAllFiltersBtn?.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn?.classList.remove('visible');
        currentSearchQuery = '';

        filterButtons.forEach((btn) => {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        });
        const allBtn = document.querySelector<HTMLElement>('.filter-btn[data-filter="all"]');
        if (allBtn) {
            allBtn.classList.add('active');
            allBtn.setAttribute('aria-pressed', 'true');
        }
        currentGroupFilter = 'all';
        applyFilters();
    });

    linesList?.addEventListener('click', (e) => {
        const detailsBtn = (e.target as Element).closest<HTMLElement>('.details-btn');
        if (detailsBtn) {
            const lineId = detailsBtn.dataset.lineId;
            const detailsPanel = document.getElementById(`details-${lineId}`);
            if (detailsPanel) {
                const isExpanded = !detailsPanel.hidden;
                detailsPanel.hidden = isExpanded;
                detailsBtn.setAttribute('aria-expanded', String(!isExpanded));
            }
        }

        const timetableBtn = (e.target as Element).closest<HTMLElement>('.timetable-btn');
        if (timetableBtn) {
            const lineId = timetableBtn.dataset.lineId;
            if (lineId) {
                openTimetable(lineId);
            }
        }
    });

    container.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            container.querySelectorAll<HTMLElement>('.line-card__details:not([hidden])').forEach((panel) => {
                panel.hidden = true;
                const lineId = panel.id.replace('details-', '');
                const btn = container.querySelector<HTMLElement>(`.details-btn[data-line-id="${lineId}"]`);
                btn?.setAttribute('aria-expanded', 'false');
            });
        }
    });

    // Re-render the localized result count.
    document.addEventListener('languageChanged', () => {
        applyFilters();
    });
};

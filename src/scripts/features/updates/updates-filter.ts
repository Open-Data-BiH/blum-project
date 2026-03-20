// Updates filter — ported from js/features/updates/updates.js
// Static cards are rendered at build time; this script handles:
//   - filter button activation
//   - hiding/showing cards by type
//   - hiding expired cards at page load (expiry checked client-side)

const TARGETED_CARD_CLASS = 'update-card--targeted';
const TARGETED_CARD_TIMEOUT_MS = 4000;

function hideExpiredCards(): void {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    document.querySelectorAll<HTMLElement>('.update-card').forEach((card) => {
        const expiry = card.dataset.expiry;
        if (expiry) {
            const expiryDate = new Date(expiry);
            expiryDate.setHours(23, 59, 59, 999);
            if (expiryDate < now) {
                card.style.display = 'none';
            }
        }
    });
}

function setFilter(filter: string): void {
    // Update button states
    document.querySelectorAll<HTMLButtonElement>('.updates-filter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    // Show/hide cards
    const cards = document.querySelectorAll<HTMLElement>('.update-card');
    let visibleCount = 0;

    cards.forEach((card) => {
        // Don't un-hide expired cards
        if (card.style.display === 'none' && !card.dataset.type) {
            return;
        }

        if (filter === 'all' || card.dataset.type === filter) {
            // Only show if not expired (already hidden by hideExpiredCards)
            if (!isExpired(card)) {
                card.style.display = '';
                visibleCount++;
            }
        } else {
            card.style.display = 'none';
        }
    });

    toggleEmptyState(visibleCount === 0);
}

function isExpired(card: HTMLElement): boolean {
    const expiry = card.dataset.expiry;
    if (!expiry) {
        return false;
    }
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expiryDate = new Date(expiry);
    expiryDate.setHours(23, 59, 59, 999);
    return expiryDate < now;
}

function toggleEmptyState(empty: boolean): void {
    const content = document.getElementById('updates-content');
    if (!content) {
        return;
    }

    let emptyEl = content.querySelector<HTMLElement>('.updates-empty');

    if (empty) {
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'updates-empty';
            const isEnglish = document.documentElement.lang === 'en';
            emptyEl.innerHTML = `
        <i class="updates-empty__icon fas fa-check-circle" aria-hidden="true"></i>
        <h3 class="updates-empty__title">${isEnglish ? 'No Active Updates' : 'Nema aktivnih obavještenja'}</h3>
        <p class="updates-empty__text">${isEnglish ? 'There are currently no active updates for the selected category.' : 'Trenutno nema aktivnih obavještenja za izabranu kategoriju.'}</p>
      `;
            content.appendChild(emptyEl);
        } else {
            emptyEl.style.display = '';
        }

        const list = content.querySelector<HTMLElement>('.updates-list');
        if (list) {
            list.style.display = 'none';
        }
    } else {
        if (emptyEl) {
            emptyEl.style.display = 'none';
        }
        const list = content.querySelector<HTMLElement>('.updates-list');
        if (list) {
            list.style.display = '';
        }
    }
}

function getRequestedUpdateId(): string | null {
    const params = new URLSearchParams(window.location.search);
    const requestedByQuery = params.get('update')?.trim();
    if (requestedByQuery) {
        return requestedByQuery;
    }

    if (window.location.hash.startsWith('#update-')) {
        const requestedByHash = window.location.hash.slice('#update-'.length);
        try {
            return decodeURIComponent(requestedByHash);
        } catch {
            return requestedByHash;
        }
    }

    return null;
}

function escapeSelectorValue(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
    }

    return value.replace(/["\\]/g, '\\$&');
}

function focusRequestedUpdate(): void {
    const requestedUpdateId = getRequestedUpdateId();
    if (!requestedUpdateId) {
        return;
    }

    const selector = `.update-card[data-update-id="${escapeSelectorValue(requestedUpdateId)}"]`;
    const card = document.querySelector<HTMLElement>(selector);
    if (!card) {
        return;
    }

    if (card.style.display === 'none') {
        setFilter('all');
    }

    if (card.style.display === 'none') {
        return;
    }

    document.querySelectorAll<HTMLElement>(`.update-card.${TARGETED_CARD_CLASS}`).forEach((el) => {
        el.classList.remove(TARGETED_CARD_CLASS);
    });

    card.classList.add(TARGETED_CARD_CLASS);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

    card.setAttribute('tabindex', '-1');
    card.focus({ preventScroll: true });

    window.setTimeout(() => {
        card.classList.remove(TARGETED_CARD_CLASS);
        card.removeAttribute('tabindex');
    }, TARGETED_CARD_TIMEOUT_MS);
}

export function initUpdatesFilter(): void {
    hideExpiredCards();

    // Check if any cards visible after expiry filter
    const totalVisible = Array.from(document.querySelectorAll<HTMLElement>('.update-card')).filter(
        (c) => c.style.display !== 'none',
    ).length;
    toggleEmptyState(totalVisible === 0);
    focusRequestedUpdate();

    const filtersContainer = document.getElementById('updates-filters');
    if (!filtersContainer) {
        return;
    }

    filtersContainer.addEventListener('click', (event) => {
        const btn = (event.target as Element).closest<HTMLButtonElement>('.updates-filter-btn');
        if (btn && btn.dataset.filter) {
            setFilter(btn.dataset.filter);
        }
    });
}

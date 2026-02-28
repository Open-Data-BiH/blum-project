// Updates filter — ported from js/features/updates/updates.js
// Static cards are rendered at build time; this script handles:
//   - filter button activation
//   - hiding/showing cards by type
//   - hiding expired cards at page load (expiry checked client-side)

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
      emptyEl.innerHTML = `
        <i class="updates-empty__icon fas fa-check-circle" aria-hidden="true"></i>
        <h3 class="updates-empty__title">
          <span data-lang="bhs">Nema aktivnih obavještenja</span>
          <span data-lang="en" style="display:none">No Active Updates</span>
        </h3>
        <p class="updates-empty__text">
          <span data-lang="bhs">Trenutno nema aktivnih obavještenja za izabranu kategoriju.</span>
          <span data-lang="en" style="display:none">There are currently no active updates for the selected category.</span>
        </p>
      `;
      // Re-apply current language visibility
      const lang = (localStorage.getItem('selectedLanguage') as 'bhs' | 'en') || 'bhs';
      emptyEl.querySelectorAll<HTMLElement>('[data-lang]').forEach((el) => {
        el.style.display = el.dataset.lang === lang ? '' : 'none';
      });
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

export function initUpdatesFilter(): void {
  hideExpiredCards();

  // Check if any cards visible after expiry filter
  const totalVisible = Array.from(document.querySelectorAll<HTMLElement>('.update-card')).filter(
    (c) => c.style.display !== 'none',
  ).length;
  toggleEmptyState(totalVisible === 0);

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

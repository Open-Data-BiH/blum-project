import './core/sanitize.js';
import './core/fetch-helper.js';
import './core/utils.js';
import './core/dark-mode.js';
import './layout/layout.js';
import './layout/page-init.js';

import { AppI18n } from './core/i18n.js';
import { loadPrices } from './features/pricing/pricing-service.js';
import { loadContacts } from './features/contacts/contacts.js';
import { loadLines } from './features/lines/lines-ui.js';
import { setupTimetableSelection } from './features/lines/timetable.js';
import { setupSmoothScrolling, setupMapCreditsDropdown, setupLinesInfoAccordion } from './components/site-interactions.js';

let appInitialized = false;

const initializeApp = () => {
    if (appInitialized) {
        return;
    }
    appInitialized = true;

    const savedScrollPosition = sessionStorage.getItem('scrollPosition');
    if (savedScrollPosition) {
        window.scrollTo(0, parseInt(savedScrollPosition, 10));
        sessionStorage.removeItem('scrollPosition');
    }

    AppI18n.loadTranslations()
        .catch((error) => {
            console.error('Translations failed to load:', error);
        })
        .finally(() => {
            AppI18n.setupLanguageSwitcher();
            loadLines();
            loadPrices();
            loadContacts();
            setupTimetableSelection();
            setupSmoothScrolling();
            setupMapCreditsDropdown();
            setupLinesInfoAccordion();
        });
};

document.addEventListener(
    'layoutLoaded',
    () => {
        initializeApp();
    },
    { once: true },
);

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('map-container')) {
        import('./features/map/main-map.js').then(({ initializeMainMap }) => initializeMainMap());
    }
    if (document.getElementById('airport-map')) {
        import('./features/map/airport-map.js').then(({ initializeAirportMap }) => initializeAirportMap());
    }
    if (document.getElementById('urban-lines-viewer')) {
        import('./urban-lines-viewer.js');
    }
    if (document.getElementById('faq-content')) {
        import('./features/faq/faq.js').then(({ default: FAQComponent }) => {
            const faq = new FAQComponent();
            faq.init();
            document.addEventListener('languageChanged', (e) => {
                if (e.detail && e.detail.language) faq.updateLanguage(e.detail.language);
            });
        });
    }
    if (document.getElementById('updates-content')) {
        import('./features/updates/updates.js').then(({ default: UpdatesManager }) => {
            const updates = new UpdatesManager();
            updates.init();
        });
    }

    const hasHeaderPlaceholder = document.getElementById('header');
    const hasFooterPlaceholder = document.getElementById('footer');

    if (!hasHeaderPlaceholder && !hasFooterPlaceholder) {
        initializeApp();
    }
});


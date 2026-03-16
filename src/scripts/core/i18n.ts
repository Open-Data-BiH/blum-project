import translationsData from '../../../public/data/config/bhs_en_translations.json';

export type Language = 'bhs' | 'en';
type TranslationCatalog = typeof translationsData;
type UnknownRecord = Record<string, unknown>;

const translations: TranslationCatalog = translationsData;
const getInitialLanguage = (): Language => {
    if (typeof window !== 'undefined') {
        const pathname = window.location.pathname;
        return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'bhs';
    }

    try {
        const stored = localStorage.getItem('selectedLanguage');
        return stored === 'en' || stored === 'bhs' ? stored : 'bhs';
    } catch {
        return 'bhs';
    }
};
let currentLang: Language = getInitialLanguage();

// Helper for safe nested property access
export const safeGet = <T = string>(obj: UnknownRecord | null | undefined, ...keys: string[]): T | null => {
    let cursor: unknown = obj;

    for (const key of keys) {
        if (cursor && typeof cursor === 'object' && key in (cursor as UnknownRecord)) {
            cursor = (cursor as UnknownRecord)[key];
            continue;
        }
        return null;
    }

    return cursor === undefined ? null : (cursor as T);
};

const safelyUpdateText = (id: string, text: string | null | undefined): void => {
    const element = document.getElementById(id);
    if (!element || text === null || text === undefined) {
        return;
    }
    element.textContent = text;
};

const safelyUpdateButtonLabel = (id: string, text: string | null | undefined): void => {
    const element = document.getElementById(id);
    if (!element || text === null || text === undefined) {
        return;
    }
    const label = element.querySelector('.btn__label');
    if (label) {
        label.textContent = text;
    } else {
        element.textContent = text;
    }
};

const updateDetailText = (id: string, text: string | null | undefined): void => {
    const el = document.getElementById(id);
    if (!el || !text) {
        return;
    }
    const span = el.querySelector('span');
    if (span) {
        span.textContent = text;
    } else {
        el.textContent = text;
    }
};

export const applyTranslation = (lang: Language): void => {
    const t = translations[lang];
    if (!t) {
        return;
    }

    currentLang = lang;
    document.documentElement.lang = lang === 'bhs' ? 'bs' : 'en';
    try {
        localStorage.setItem('selectedLanguage', lang);
    } catch {
        // Ignore storage failures in private / restricted contexts.
    }

    // Header
    safelyUpdateText('site-title', 'BL Prevoz');
    safelyUpdateText(
        'site-subtitle',
        lang === 'bhs'
            ? 'Pregled linija javnog prevoza u Banjoj Luci'
            : 'Overview of public transport lines in Banja Luka',
    );

    // Navigation
    safelyUpdateText('nav-map-desktop', t.header.nav.map);
    safelyUpdateText('nav-lines-desktop', t.header.nav.lines);
    safelyUpdateText('nav-prices-desktop', t.header.nav.prices ?? (lang === 'bhs' ? 'Cjenovnik' : 'Prices'));
    safelyUpdateText('nav-airport-desktop', t.header.nav.airport);
    safelyUpdateText('nav-updates-desktop', t.header.nav.updates ?? (lang === 'bhs' ? 'Obavještenja' : 'Updates'));
    safelyUpdateText('nav-faq-desktop', t.header.nav.faq);
    safelyUpdateText('nav-contact-desktop', lang === 'bhs' ? 'Kontakt' : 'Contact');

    // Hero section
    const heroDefaults =
        lang === 'bhs'
            ? {
                  title: 'BL Prevoz',
                  subtitle: 'Informacije za lakše kretanje gradom.',
                  description:
                      'Nezavisna platforma za linije, red vožnje i obavještenja o javnom prevozu u Banjoj Luci.',
                  detail1: 'Linije i red vožnje na jednom mjestu',
                  detail2: 'Ažurne informacije i korisni alati za kretanje gradom',
                  timetables: 'Red vožnje',
                  airport: 'Transfer do aerodroma',
              }
            : {
                  title: 'BL Prevoz',
                  subtitle: 'Information for easier movement through the city.',
                  description:
                      'Independent platform for routes, timetables, and public transport notices in Banja Luka.',
                  detail1: 'Routes and timetables in one place',
                  detail2: 'Up-to-date information and practical tools for getting around the city',
                  timetables: 'Timetables',
                  airport: 'Airport transfer',
              };

    safelyUpdateText('hero-title', heroDefaults.title);
    safelyUpdateText('hero-subtitle', heroDefaults.subtitle);
    safelyUpdateText('hero-description', heroDefaults.description);
    updateDetailText('hero-detail-1', heroDefaults.detail1);
    updateDetailText('hero-detail-2', heroDefaults.detail2);

    safelyUpdateButtonLabel('hero-btn-timetables', heroDefaults.timetables);
    safelyUpdateButtonLabel('hero-btn-airport', heroDefaults.airport);

    const heroDetails = document.getElementById('hero-details');
    if (heroDetails) {
        heroDetails.setAttribute('aria-label', lang === 'bhs' ? 'Ključne informacije' : 'Key information');
    }

    // Map section
    safelyUpdateText('map-title', t.sections?.map?.title);
    safelyUpdateText('map-note-title', safeGet(t, 'sections', 'map', 'note', 'title'));
    safelyUpdateText('map-note-description', safeGet(t, 'sections', 'map', 'note', 'description'));
    safelyUpdateText('map-note-tips-title', safeGet(t, 'sections', 'map', 'note', 'tipsTitle'));
    safelyUpdateText('map-note-tip-item-1', safeGet(t, 'sections', 'map', 'note', 'tips', 'marker'));
    safelyUpdateText('map-note-tip-item-2', safeGet(t, 'sections', 'map', 'note', 'tips', 'layers'));

    // Map credits (data-lang toggle)
    const mapCreditsLabelBhs = document.querySelector<HTMLElement>('.map-credits__label[data-lang="bhs"]');
    const mapCreditsLabelEn = document.querySelector<HTMLElement>('.map-credits__label[data-lang="en"]');
    if (mapCreditsLabelBhs && mapCreditsLabelEn) {
        mapCreditsLabelBhs.style.display = lang === 'bhs' ? '' : 'none';
        mapCreditsLabelEn.style.display = lang === 'en' ? '' : 'none';
    }

    // Urban lines viewer
    safelyUpdateText('urban-lines-title', t.sections?.urban_lines?.title);
    const mapNote = document.querySelector<HTMLElement>('#urban-lines .map-note span');
    if (mapNote) {
        mapNote.textContent = t.sections?.urban_lines?.map_note;
    }

    // Lines section
    safelyUpdateText('lines-title', t.sections?.lines?.title);
    safelyUpdateText('operator-legend-title', lang === 'bhs' ? 'Prevoznici' : 'Operators');
    safelyUpdateText('lines-map-note', safeGet(t, 'sections', 'lines', 'mapNote'));
    safelyUpdateText('lines-map-credits-label', safeGet(t, 'sections', 'lines', 'mapCreditsToggle'));
    safelyUpdateText(
        'lines-info-title-text',
        safeGet(t, 'sections', 'lines', 'infoTitle') ?? safeGet(t, 'sections', 'lines', 'accordionToggle'),
    );
    safelyUpdateText(
        'lines-info-text',
        safeGet(t, 'sections', 'lines', 'infoText') ?? safeGet(t, 'sections', 'lines', 'accordionText'),
    );
    safelyUpdateText('lines-timetable-title', safeGet(t, 'sections', 'lines', 'timetableTitle'));

    // Wheelchair badge title/aria-label (SSR-baked as BHS, update on language switch)
    document.querySelectorAll<HTMLElement>('.badge--accessible').forEach((badge) => {
        const text = lang === 'bhs' ? 'Pristupačno za invalidska kolica' : 'Wheelchair accessible';
        badge.setAttribute('title', text);
        badge.setAttribute('aria-label', text);
    });
    document.querySelectorAll<HTMLElement>('.badge--not-accessible').forEach((badge) => {
        const text = lang === 'bhs' ? 'Nije pristupačno' : 'Not accessible';
        badge.setAttribute('title', text);
        badge.setAttribute('aria-label', text);
    });

    // Lines search input placeholder
    const linesSearchInput = document.getElementById('lines-search-input') as HTMLInputElement | null;
    if (linesSearchInput) {
        linesSearchInput.placeholder =
            lang === 'bhs' ? 'Pretraži liniju, odredište, naselje...' : 'Search line, destination, neighborhood...';
        linesSearchInput.setAttribute('aria-label', linesSearchInput.placeholder);
    }

    // Line card names (switch between BHS/EN stored in data attributes)
    document.querySelectorAll<HTMLElement>('.line-card__name').forEach((el) => {
        const name = el.dataset[lang === 'bhs' ? 'nameBhs' : 'nameEn'];
        if (name) {
            el.textContent = name;
        }
    });

    // Timetable section
    safelyUpdateText('timetable-title', t.sections?.timetable?.title);
    if (t.sections?.timetable) {
        t.sections.timetable.fromTo ??= lang === 'bhs' ? 'Relacija:' : 'Route:';
        t.sections.timetable.selectDay ??= lang === 'bhs' ? 'Izaberite dan' : 'Select day';
        t.sections.timetable.hourLabel ??= lang === 'bhs' ? 'Sat' : 'Hour';
        t.sections.timetable.minutesLabel ??= lang === 'bhs' ? 'Minute' : 'Minutes';
    }

    // Pricing section
    safelyUpdateText(
        'price-tables-title',
        t.sections?.prices?.title ?? (lang === 'bhs' ? 'Cjenovnik karata' : 'Ticket Prices'),
    );

    // Contact section
    safelyUpdateText('contact-title', t.sections?.contact?.title);
    safelyUpdateText('contact-group-authorities-title', safeGet(t, 'sections', 'contact', 'groups', 'authorities'));
    safelyUpdateText('contact-group-operators-title', safeGet(t, 'sections', 'contact', 'groups', 'operators'));
    safelyUpdateText('email-label', t.sections?.contact?.email);
    safelyUpdateText('phone-label', t.sections?.contact?.phone);
    safelyUpdateText('timetable-info-label', t.sections?.contact?.timetableInfo);

    // Airport section
    safelyUpdateText('airport-title', t.sections?.airport?.title);
    safelyUpdateText('airport-description-title', t.sections?.airport?.descriptionTitle);
    safelyUpdateText('airport-price', t.sections?.airport?.price);
    safelyUpdateText('airport-departure-location', t.sections?.airport?.departureLocation);

    // Updates section
    safelyUpdateText('updates-title', safeGet(t, 'sections', 'updates', 'title'));
    safelyUpdateText(
        'updates-subtitle',
        lang === 'bhs'
            ? 'Obavještenja o promjenama u prevozu, zatvaranjima ulica i izmjenama reda vožnje'
            : 'Notices about transport changes, street closures, and timetable updates',
    );

    // FAQ section
    safelyUpdateText('faq-title', safeGet(t, 'sections', 'faq', 'title'));
    safelyUpdateText('faq-subtitle', safeGet(t, 'sections', 'faq', 'subtitle'));

    // Footer
    safelyUpdateText(
        'footer-mission-text',
        lang === 'bhs'
            ? 'BL Prevoz je nezavisna platforma za informacije o javnom prevozu u Banjoj Luci.'
            : 'BL Prevoz is an independent platform for public transport information in Banja Luka.',
    );
    safelyUpdateText('footer-nav-heading', lang === 'bhs' ? 'Informacije' : 'Information');
    safelyUpdateText('footer-link-about', lang === 'bhs' ? 'O projektu' : 'About');
    safelyUpdateText('footer-link-faq', 'FAQ');
    safelyUpdateText('footer-link-contact', lang === 'bhs' ? 'Kontakt' : 'Contact');
    safelyUpdateText('footer-link-privacy', lang === 'bhs' ? 'Politika privatnosti' : 'Privacy Policy');
    safelyUpdateText(
        'footer-brand-tagline',
        t.footer?.brandTagline ?? (lang === 'bhs' ? 'Urbana mobilnost u Banjoj Luci' : 'Urban mobility in Banja Luka'),
    );

    // Ko-fi button
    const kofiBtn = document.querySelector<HTMLElement>('#footer-kofi-container .kofi-button a span.kofitext');
    if (kofiBtn) {
        kofiBtn.textContent = lang === 'bhs' ? 'Podržite ovaj projekat' : 'Support this project';
    }

    // data-lang attribute visibility toggle
    document.querySelectorAll<HTMLElement>('[data-lang]').forEach((element) => {
        if (element.classList.contains('lang-btn')) {
            return;
        }
        element.style.display = element.getAttribute('data-lang') === lang ? '' : 'none';
    });

    // Dispatch languageChanged event for feature modules
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
};

export const setupLanguageSwitcher = (): void => {
    document.querySelectorAll<HTMLElement>('.lang-btn').forEach((btn) => {
        const btnLang = btn.dataset.lang as Language;
        btn.classList.toggle('lang-btn--active', btnLang === currentLang);

        if (btn.tagName.toLowerCase() === 'a') {
            return;
        }

        btn.addEventListener('click', function () {
            const lang = this.dataset.lang as Language;
            if (lang !== currentLang) {
                sessionStorage.setItem('scrollPosition', String(window.pageYOffset));

                const lineSelect = document.getElementById('line-select') as HTMLSelectElement | null;
                if (lineSelect?.value) {
                    sessionStorage.setItem('selectedLine', lineSelect.value);
                }

                const nav = document.getElementById('main-nav');
                const menuToggle = document.getElementById('mobile-menu-toggle');
                if (nav && menuToggle) {
                    nav.classList.remove('active');
                    menuToggle.classList.remove('active');
                }

                localStorage.setItem('selectedLanguage', lang);
                window.location.reload();
            }
        });
    });
};

export const getCurrentLanguage = (): Language => currentLang;
export const getTranslations = (): TranslationCatalog => translations;

export const langText = (bhs: string, en: string): string => (currentLang === 'en' ? en : bhs);

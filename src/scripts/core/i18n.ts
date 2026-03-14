// i18n module — ported from js/core/i18n.js
// Key changes vs original:
//   - translations imported as static JSON (no fetch / FetchHelper)
//   - layoutLoaded event removed (header/footer are Astro SSR, always present)
//   - resolvePageKey uses Astro URL paths (/lines/ not lines.html)

import translationsData from '../../../public/data/config/bhs_en_translations.json';

export type Language = 'bhs' | 'en';

let translations: Record<string, any> = translationsData as Record<string, any>;
let currentLang: Language = (localStorage.getItem('selectedLanguage') as Language) || 'bhs';

// Helper for safe nested property access
export const safeGet = <T = string>(obj: Record<string, any> | null | undefined, ...keys: string[]): T | null => {
    return keys.reduce<any>((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj);
};

const SEO_DEFAULTS = {
    image: 'https://blprevoz.com/assets/images/gradski-prevoz-mapa-banja-luka.webp',
    type: 'website',
    twitterCard: 'summary_large_image',
};

const PAGE_SEO: Record<
    string,
    { url: string; title: Record<Language, string>; description: Record<Language, string> }
> = {
    home: {
        url: 'https://blprevoz.com/',
        title: {
            bhs: 'BL Prevoz - Red vožnje i linije javnog prevoza u Banjoj Luci',
            en: 'Banja Luka Public Transport - Bus Schedules, Routes & Airport Shuttle',
        },
        description: {
            bhs: 'Red vožnje, linije i mapa javnog prevoza u Banjoj Luci. Polasci, stajališta i informacije o gradskom autobusu.',
            en: 'Bus schedules, routes, and map for public transport in Banja Luka. Departures, stops, and airport shuttle information.',
        },
    },
    lines: {
        url: 'https://blprevoz.com/lines/',
        title: {
            bhs: 'Red vožnje i autobuske linije - Javni prevoz Banja Luka',
            en: 'Timetables & Bus Routes - Banja Luka Public Transport',
        },
        description: {
            bhs: 'Sve autobuske linije i red vožnje javnog prevoza u Banjoj Luci. Mape trasa, polasci i stajališta na jednom mjestu.',
            en: 'All bus routes and timetables for public transport in Banja Luka. Route maps, departures, and stops in one place.',
        },
    },
    pricing: {
        url: 'https://blprevoz.com/pricing/',
        title: {
            bhs: 'Cijene karata - Javni prevoz Banja Luka',
            en: 'Ticket Prices - Banja Luka Public Transport',
        },
        description: {
            bhs: 'Aktuelne cijene karata, mjesečnih pretplata i đačkih markica za autobuski prevoz u Banjoj Luci.',
            en: 'Current ticket prices, monthly passes, and student cards for bus transport in Banja Luka.',
        },
    },
    airport: {
        url: 'https://blprevoz.com/airport/',
        title: {
            bhs: 'Prevoz do aerodroma Banja Luka - Shuttle, taksi, cijene | BNX',
            en: 'Banja Luka Airport Bus & Shuttle - Transfer Guide (BNX)',
        },
        description: {
            bhs: 'Kako doći do Aerodroma Banja Luka (BNX). Shuttle autobus ~10 KM (30-45 min), taksi 40-60 KM. Polasci od Glavne stanice, parking i interaktivna mapa rute.',
            en: 'How to get from Banja Luka Airport (BNX) to the city center. Shuttle bus ~10 KM (30-45 min), taxi 40-60 KM. Timetable, route map, and parking info.',
        },
    },
    faq: {
        url: 'https://blprevoz.com/faq/',
        title: {
            bhs: 'Česta pitanja - Javni prevoz Banja Luka',
            en: 'FAQ - Banja Luka Public Transport',
        },
        description: {
            bhs: 'Odgovori na najčešća pitanja o autobuskim linijama, kartama i javnom prevozu u Banjoj Luci.',
            en: 'Answers to frequently asked questions about bus routes, tickets, and public transport in Banja Luka.',
        },
    },
    updates: {
        url: 'https://blprevoz.com/updates/',
        title: {
            bhs: 'Obavještenja - Izmjene linija i reda vožnje Banja Luka',
            en: 'Updates - Route & Timetable Changes in Banja Luka',
        },
        description: {
            bhs: 'Najnovija obavještenja o izmjenama autobuskih linija, reda vožnje i radovima na javnom prevozu u Banjoj Luci.',
            en: 'Latest updates on bus route changes, timetable adjustments, and service notices in Banja Luka.',
        },
    },
    contact: {
        url: 'https://blprevoz.com/contact/',
        title: {
            bhs: 'Kontakt - BL Prevoz',
            en: 'Contact - BL Transport',
        },
        description: {
            bhs: 'Kontaktirajte nas za pitanja o javnom prevozu u Banjoj Luci. Prijavite problem ili predložite poboljšanje.',
            en: 'Contact us about public transport in Banja Luka. Report an issue or suggest an improvement.',
        },
    },
    privacy: {
        url: 'https://blprevoz.com/privacy/',
        title: {
            bhs: 'Politika privatnosti - BL Prevoz',
            en: 'Privacy Policy - BL Prevoz',
        },
        description: {
            bhs: 'Politika privatnosti platforme BL Prevoz. Informacije o analitici, kolačićima, pristanku i zaštiti privatnosti korisnika.',
            en: 'Privacy Policy for BL Prevoz. Information about analytics, cookies, consent, and user privacy protection.',
        },
    },
    about: {
        url: 'https://blprevoz.com/about/',
        title: {
            bhs: 'O projektu - BL Prevoz | Javni prevoz Banja Luka',
            en: 'About - BL Prevoz',
        },
        description: {
            bhs: 'BL Prevoz je nezavisna, volonterski vođena platforma za informacije o javnom prevozu u Banjoj Luci. Saznajte više o projektu.',
            en: 'BL Prevoz is an independent, volunteer-driven platform for public transport information in Banja Luka. Learn more about the project.',
        },
    },
};

const resolvePageKey = (): string => {
    const pageKey = document.body.dataset.page;
    if (pageKey && PAGE_SEO[pageKey]) {
        return pageKey;
    }

    // Astro paths: /lines/ not lines.html
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/lines')) {
        return 'lines';
    }
    if (path.includes('/pricing')) {
        return 'pricing';
    }
    if (path.includes('/airport')) {
        return 'airport';
    }
    if (path.includes('/faq')) {
        return 'faq';
    }
    if (path.includes('/updates')) {
        return 'updates';
    }
    if (path.includes('/contact')) {
        return 'contact';
    }
    if (path.includes('/privacy')) {
        return 'privacy';
    }
    if (path.includes('/about')) {
        return 'about';
    }
    return 'home';
};

const setMetaContent = (attr: string, key: string, content: string | null): void => {
    if (!content) {
        return;
    }
    let metaTag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute(attr, key);
        document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', content);
};

const updateSeoTags = (lang: Language): void => {
    const pageKey = resolvePageKey();
    const pageSeo = PAGE_SEO[pageKey] || PAGE_SEO.home;
    const title = pageSeo.title[lang] || pageSeo.title.bhs;
    const description = pageSeo.description[lang] || pageSeo.description.bhs;

    document.title = title;
    setMetaContent('name', 'description', description);
    setMetaContent('property', 'og:title', title);
    setMetaContent('property', 'og:description', description);
    setMetaContent('property', 'og:image', SEO_DEFAULTS.image);
    setMetaContent('property', 'og:type', SEO_DEFAULTS.type);
    setMetaContent('property', 'og:url', pageSeo.url);
    setMetaContent('name', 'twitter:card', SEO_DEFAULTS.twitterCard);
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
    updateSeoTags(lang);

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
    safelyUpdateText('map-note-item-stops', safeGet(t, 'sections', 'map', 'note', 'stops'));
    safelyUpdateText('map-note-item-bike', safeGet(t, 'sections', 'map', 'note', 'nextbike'));
    safelyUpdateText('map-note-item-rail', safeGet(t, 'sections', 'map', 'note', 'rail'));
    safelyUpdateText('map-note-tip-label', safeGet(t, 'sections', 'map', 'note', 'tipLabel'));
    safelyUpdateText('map-note-tip-text', safeGet(t, 'sections', 'map', 'note', 'tipText'));

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
    safelyUpdateText('lines-accordion-toggle', safeGet(t, 'sections', 'lines', 'accordionToggle'));
    safelyUpdateText('lines-accordion-text', safeGet(t, 'sections', 'lines', 'accordionText'));
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
    document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((btn) => {
        const btnLang = btn.dataset.lang as Language;
        btn.classList.toggle('lang-btn--active', btnLang === currentLang);

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
export const getTranslations = (): Record<string, any> => translations;

// Namespaced export kept for compatibility with feature modules that use AppI18n
export const AppI18n = {
    get currentLang() {
        return currentLang;
    },
    set currentLang(val: Language) {
        currentLang = val;
    },
    get translations() {
        return translations;
    },
    set translations(val: Record<string, any>) {
        translations = val;
    },
    safeGet,
    setupLanguageSwitcher,
    applyTranslation,
    getCurrentLanguage,
    getTranslations,
};

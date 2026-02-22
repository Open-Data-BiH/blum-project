import { FetchHelper } from './fetch-helper.js';

// ==========================================
// Internationalization (i18n) Module
// Language state, translations, and DOM text updates
// ==========================================

let translations = {};
let currentLang = localStorage.getItem('selectedLanguage') || 'bhs';

// Helper function for safe nested property access
const safeGet = (obj, ...keys) => {
    return keys.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj);
};

const SEO_DEFAULTS = {
    image: 'https://blum.ba/assets/images/gradski-prevoz-mapa-banja-luka.webp',
    type: 'website',
    twitterCard: 'summary_large_image',
};

const HTML_LANG_BY_APP_LANG = {
    bhs: 'bs',
    en: 'en',
};

const PAGE_SEO = {
    home: {
        url: 'https://blum.ba/',
        title: {
            bhs: 'Pocetna | BLum',
            en: 'Home | BLum',
        },
        description: {
            bhs: 'BLum je nezavisna platforma za informacije o javnom prevozu, linijama i urbanoj mobilnosti u Banjoj Luci.',
            en: 'BLum is an independent platform for public transport routes, timetables, and urban mobility information in Banja Luka.',
        },
    },
    lines: {
        url: 'https://blum.ba/lines.html',
        title: {
            bhs: 'Red voznje i linije | BLum',
            en: 'Lines & Timetables | BLum',
        },
        description: {
            bhs: 'Pregled gradskih i prigradskih linija, mape trasa i reda voznje javnog prevoza u Banjoj Luci.',
            en: 'Explore urban and suburban routes, map overlays, and timetable information for public transport in Banja Luka.',
        },
    },
    pricing: {
        url: 'https://blum.ba/pricing.html',
        title: {
            bhs: 'Cjenovnik | BLum',
            en: 'Prices | BLum',
        },
        description: {
            bhs: 'Aktuelne cijene karata i pretplatnih opcija za javni prevoz u Banjoj Luci na jednom mjestu.',
            en: 'Check current ticket prices and subscription options for public transport in Banja Luka.',
        },
    },
    airport: {
        url: 'https://blum.ba/airport.html',
        title: {
            bhs: 'Aerodromski prevoz | BLum',
            en: 'Airport Transport | BLum',
        },
        description: {
            bhs: 'Informacije o prevozu do i od Medjunarodnog aerodroma Banja Luka, ukljucujuci cijene, stajalista i polaske.',
            en: 'Find airport transfer details for Banja Luka International Airport, including prices, stops, and departures.',
        },
    },
    faq: {
        url: 'https://blum.ba/faq.html',
        title: {
            bhs: 'FAQ | BLum',
            en: 'FAQ | BLum',
        },
        description: {
            bhs: 'Najcesca pitanja i odgovori o koristenju BLum platforme, linijama, kartama i javnom prevozu u Banjoj Luci.',
            en: 'Read frequently asked questions about BLum, routes, tickets, and public transport in Banja Luka.',
        },
    },
    updates: {
        url: 'https://blum.ba/updates.html',
        title: {
            bhs: 'Obavjestenja | BLum',
            en: 'Updates | BLum',
        },
        description: {
            bhs: 'Najnovija obavjestenja o izmjenama linija, redu voznje i servisnim informacijama javnog prevoza u Banjoj Luci.',
            en: 'Latest updates on route changes, timetable adjustments, and service notices for public transport in Banja Luka.',
        },
    },
};

const resolvePageKey = () => {
    const pageKey = safeGet(document, 'body', 'dataset', 'page');
    if (pageKey && PAGE_SEO[pageKey]) {
        return pageKey;
    }

    const path = window.location.pathname.toLowerCase();
    if (path.endsWith('/lines.html')) {
        return 'lines';
    }
    if (path.endsWith('/pricing.html')) {
        return 'pricing';
    }
    if (path.endsWith('/airport.html')) {
        return 'airport';
    }
    if (path.endsWith('/faq.html')) {
        return 'faq';
    }
    if (path.endsWith('/updates.html')) {
        return 'updates';
    }

    return 'home';
};

const setMetaContent = (attr, key, content) => {
    if (!content) {
        return;
    }

    let metaTag = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute(attr, key);
        document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', content);
};

const updateSeoTags = (lang) => {
    const pageKey = resolvePageKey();
    const pageSeo = PAGE_SEO[pageKey] || PAGE_SEO.home;
    const title = safeGet(pageSeo, 'title', lang) || safeGet(pageSeo, 'title', 'bhs');
    const description = safeGet(pageSeo, 'description', lang) || safeGet(pageSeo, 'description', 'bhs');

    if (title) {
        document.title = title;
    }

    setMetaContent('name', 'description', description);
    setMetaContent('property', 'og:title', title);
    setMetaContent('property', 'og:description', description);
    setMetaContent('property', 'og:image', SEO_DEFAULTS.image);
    setMetaContent('property', 'og:type', SEO_DEFAULTS.type);
    setMetaContent('property', 'og:url', pageSeo.url || PAGE_SEO.home.url);
    setMetaContent('name', 'twitter:card', SEO_DEFAULTS.twitterCard);
};

// Load translations (Modern async/await)
const loadTranslations = async () => {
    try {
        const data = await FetchHelper.fetchJSON('data/config/bhs_en_translations.json');
        // Merge into existing object so external references stay valid
        Object.assign(translations, data);
        applyTranslation(currentLang);
    } catch (error) {
        console.error('Error loading translations:', error);
        document.body.classList.add('translations-failed');
    }
};

// Setup language switcher (Modern ES6+)
const setupLanguageSwitcher = () => {
    document.querySelectorAll('.lang-btn').forEach((btn) => {
        const btnLang = btn.dataset.lang;
        btn.classList.toggle('lang-btn--active', btnLang === currentLang);

        btn.addEventListener('click', function () {
            const lang = this.dataset.lang;
            if (lang !== currentLang) {
                sessionStorage.setItem('scrollPosition', window.pageYOffset);

                const lineSelect = document.getElementById('line-select');
                if (lineSelect && lineSelect.value) {
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

// Apply translation to the whole page (Modern ES6+)
const applyTranslation = (lang) => {
    const t = translations[lang];
    if (!t) {
        return;
    }

    currentLang = lang;
    document.documentElement.lang = HTML_LANG_BY_APP_LANG[lang] || 'bs';
    updateSeoTags(lang);

    const safelyUpdateText = (id, text) => {
        const element = document.getElementById(id);
        if (!element || text === null || text === undefined) {
            return;
        }
        element.textContent = text;
    };

    // Keep icon markup in hero CTA buttons while updating only the label text.
    const safelyUpdateButtonLabel = (id, text) => {
        const element = document.getElementById(id);
        if (!element || text === null || text === undefined) {
            return;
        }
        const label = element.querySelector('.btn__label');
        if (label) {
            label.textContent = text;
            return;
        }
        element.textContent = text;
    };

    // Header
    safelyUpdateText('site-title', 'BLum');
    safelyUpdateText('site-subtitle', 'Urbana mobilnost Banja Luka');

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
    safelyUpdateText('nav-prices-desktop', t.header.nav.prices || (lang === 'bhs' ? 'Cjenovnik' : 'Prices'));
    safelyUpdateText('nav-price-tables-desktop', t.header.nav.prices || (lang === 'bhs' ? 'Cjenovnik' : 'Prices'));
    safelyUpdateText('nav-urban-lines-desktop', t.header.nav.urban_lines);
    safelyUpdateText('nav-updates-desktop', t.header.nav.updates || (lang === 'bhs' ? 'Obavještenja' : 'Updates'));
    safelyUpdateText('nav-faq-desktop', t.header.nav.faq);

    // Urban Lines section
    safelyUpdateText('urban-lines-title', t.sections.urban_lines.title);
    const mapNote = document.querySelector('#urban-lines .map-note span');
    if (mapNote) {
        mapNote.textContent = t.sections.urban_lines.map_note;
    }

    // Map credits labels
    const mapCreditsLabelBhs = document.querySelector('.map-credits__label[data-lang="bhs"]');
    const mapCreditsLabelEn = document.querySelector('.map-credits__label[data-lang="en"]');
    if (mapCreditsLabelBhs && mapCreditsLabelEn) {
        if (lang === 'bhs') {
            mapCreditsLabelBhs.style.display = '';
            mapCreditsLabelEn.style.display = 'none';
        } else {
            mapCreditsLabelBhs.style.display = 'none';
            mapCreditsLabelEn.style.display = '';
        }
    }

    // Hero section
    const heroDefaults =
        lang === 'bhs'
            ? {
                  title: 'BLum',
                  subtitle: 'Informacije za lakše kretanje gradom.',
                  description:
                      'Nezavisna platforma za linije, red vožnje i obavještenja o javnom prevozu u Banjoj Luci.',
                  detail1: 'Linije i red vožnje na jednom mjestu',
                  detail2: 'Otvoren (open-source) i dostupan za dopune',
                  disclaimer: 'BLum nije zvanična stranica javnog prevoza.',
                  timetables: 'Red vožnje',
                  airport: 'Transfer do aerodroma',
              }
            : {
                  title: 'BLum',
                  subtitle: 'Information for easier movement through the city.',
                  description:
                      'Independent platform for routes, timetables, and public transport notices in Banja Luka.',
                  detail1: 'Routes and timetables in one place',
                  detail2: 'Open-source and open to contributions',
                  disclaimer: 'BLum is not an official public transport website.',
                  timetables: 'Timetables',
                  airport: 'Airport transfer',
              };

    safelyUpdateText('hero-title', heroDefaults.title);
    safelyUpdateText('hero-subtitle', heroDefaults.subtitle);
    safelyUpdateText('hero-description', heroDefaults.description);

    // Detail cards contain icons — update only the text span
    const updateDetailText = (id, text) => {
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
    updateDetailText('hero-detail-1', heroDefaults.detail1);
    updateDetailText('hero-detail-2', heroDefaults.detail2);

    // Disclaimer callout — update only the text span
    const disclaimerEl = document.getElementById('hero-disclaimer');
    if (disclaimerEl) {
        const span = disclaimerEl.querySelector('span');
        if (span) {
            span.textContent = heroDefaults.disclaimer;
        }
    }

    safelyUpdateButtonLabel('hero-btn-timetables', heroDefaults.timetables);
    safelyUpdateButtonLabel('hero-btn-airport', heroDefaults.airport);

    // Timetable quick-links section
    safelyUpdateText('timetables-title', safeGet(t, 'sections', 'home', 'timetables', 'title'));

    // Map section
    safelyUpdateText('map-title', t.sections.map.title);

    // Lines section
    safelyUpdateText('lines-title', t.sections.lines.title);
    const pricesTitle =
        t.sections.prices && t.sections.prices.title
            ? t.sections.prices.title
            : lang === 'bhs'
              ? 'Cjenovnik karata'
              : 'Ticket Prices';
    safelyUpdateText('price-tables-title', pricesTitle);

    // Lines introduction and ticket note
    const linesIntroText =
        lang === 'bhs'
            ? 'Javni prevoz u Banjoj Luci organizovan je u tri grupe linija. Za svaku grupu linija potrebno je kupiti odgovarajuću kartu. Karte nisu prenosive između grupa.'
            : 'Public transport in Banja Luka is organized into three groups of lines. For each group of lines, you need to purchase a corresponding ticket. Tickets are not transferable between groups.';
    safelyUpdateText('lines-intro-text', linesIntroText);

    // Operator legend title
    const operatorLegendTitle = lang === 'bhs' ? 'Prevoznici' : 'Operators';
    safelyUpdateText('operator-legend-title', operatorLegendTitle);

    // NOTE: loadLines() removed — lines module listens for languageChanged event

    // Timetable section
    safelyUpdateText('timetable-title', t.sections.timetable.title);

    // Add translations for timetable if not present
    if (t.sections && t.sections.timetable) {
        if (!t.sections.timetable.fromTo) {
            t.sections.timetable.fromTo = lang === 'bhs' ? 'Relacija:' : 'Route:';
        }
        if (!t.sections.timetable.selectDay) {
            t.sections.timetable.selectDay = lang === 'bhs' ? 'Izaberite dan' : 'Select day';
        }
        if (!t.sections.timetable.hourLabel) {
            t.sections.timetable.hourLabel = lang === 'bhs' ? 'Sat' : 'Hour';
        }
        if (!t.sections.timetable.minutesLabel) {
            t.sections.timetable.minutesLabel = lang === 'bhs' ? 'Minute' : 'Minutes';
        }
    }

    // Contact section
    safelyUpdateText('contact-title', t.sections.contact.title);
    safelyUpdateText('contact-group-authorities-title', safeGet(t, 'sections', 'contact', 'groups', 'authorities'));
    safelyUpdateText('contact-group-operators-title', safeGet(t, 'sections', 'contact', 'groups', 'operators'));
    safelyUpdateText('email-label', t.sections.contact.email);
    safelyUpdateText('phone-label', t.sections.contact.phone);
    safelyUpdateText('timetable-info-label', t.sections.contact.timetableInfo);

    // Footer
    const footerMissionText =
        lang === 'bhs'
            ? 'BLum je open-source projekat razvijen radi bolje dostupnosti informacija o javnom prevozu.'
            : 'BLum is an open-source project created to improve access to public transport information.';
    const footerDisclaimerText =
        lang === 'bhs'
            ? 'BLum nije zvanična stranica javnog prevoza. Za zvanične informacije obratite se nadležnim institucijama.'
            : 'BLum is not an official public transport website. For official information, contact the relevant institutions.';
    safelyUpdateText('footer-mission-text', footerMissionText);
    safelyUpdateText('footer-disclaimer-text', footerDisclaimerText);
    safelyUpdateText('footer-link-issues', lang === 'bhs' ? 'Prijavi grešku' : 'Report issue');
    safelyUpdateText('footer-link-faq', 'FAQ');
    safelyUpdateText('footer-link-contact', lang === 'bhs' ? 'Kontakt' : 'Contact');

    // NOTE: updateTimetableLanguage() and renderPriceTables() removed
    // — feature modules listen for languageChanged event instead

    // Map note translation
    safelyUpdateText('map-note-item-stops', safeGet(t, 'sections', 'map', 'note', 'stops'));
    safelyUpdateText('map-note-item-bike', safeGet(t, 'sections', 'map', 'note', 'nextbike'));
    safelyUpdateText('map-note-item-rail', safeGet(t, 'sections', 'map', 'note', 'rail'));
    safelyUpdateText('map-note-tip-label', safeGet(t, 'sections', 'map', 'note', 'tipLabel'));
    safelyUpdateText('map-note-tip-text', safeGet(t, 'sections', 'map', 'note', 'tipText'));

    // Handle elements with data-lang attributes
    document.querySelectorAll('[data-lang]').forEach((element) => {
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

    // Dispatch languageChanged event for feature modules
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));

    // Airport shuttle section
    safelyUpdateText('airport-title', t.sections.airport.title);
    safelyUpdateText('airport-description-title', t.sections.airport.descriptionTitle);
    safelyUpdateText('airport-price', t.sections.airport.price);
    safelyUpdateText('airport-departure-location', t.sections.airport.departureLocation);
    safelyUpdateText('airport-more-info', t.sections.airport.moreInfo);
    safelyUpdateText('airport-website-link', t.sections.airport.websiteLink);

    // Updates page section
    safelyUpdateText('updates-title', safeGet(t, 'sections', 'updates', 'title'));
    safelyUpdateText(
        'updates-subtitle',
        lang === 'bhs'
            ? 'Obavještenja o promjenama u prevozu, zatvaranjima ulica i izmjenama reda vožnje'
            : 'Notices about transport changes, street closures, and timetable updates',
    );

    // Lines page specific elements
    safelyUpdateText('lines-map-note', safeGet(t, 'sections', 'lines', 'mapNote'));
    safelyUpdateText('lines-map-credits-label', safeGet(t, 'sections', 'lines', 'mapCreditsToggle'));
    safelyUpdateText('lines-accordion-toggle', safeGet(t, 'sections', 'lines', 'accordionToggle'));
    safelyUpdateText('lines-accordion-text', safeGet(t, 'sections', 'lines', 'accordionText'));
    safelyUpdateText('lines-timetable-title', safeGet(t, 'sections', 'lines', 'timetableTitle'));

    // FAQ page section
    safelyUpdateText('faq-title', safeGet(t, 'sections', 'faq', 'title'));
    safelyUpdateText('faq-subtitle', safeGet(t, 'sections', 'faq', 'subtitle'));
};

// Expose as namespaced global
const AppI18n = {
    get currentLang() {
        return currentLang;
    },
    set currentLang(val) {
        currentLang = val;
    },
    get translations() {
        return translations;
    },
    set translations(val) {
        translations = val;
    },
    safeGet,
    loadTranslations,
    setupLanguageSwitcher,
    applyTranslation,
};

const getCurrentLanguage = () => currentLang;
const getTranslations = () => translations;

export { AppI18n, safeGet, loadTranslations, setupLanguageSwitcher, applyTranslation, getCurrentLanguage, getTranslations };

// i18n module — ported from js/core/i18n.js
// Key changes vs original:
//   - translations imported as static JSON (no fetch / FetchHelper)
//   - layoutLoaded event removed (header/footer are Astro SSR, always present)
//   - resolvePageKey uses Astro URL paths (/lines/ not lines.html)

import translationsData from '../../../public/data/config/bhs_en_translations.json';

export type Language = 'bhs' | 'en';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let translations: Record<string, any> = translationsData as Record<string, any>;
let currentLang: Language = (localStorage.getItem('selectedLanguage') as Language) || 'bhs';

// Helper for safe nested property access
export const safeGet = <T = string>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any> | null | undefined,
  ...keys: string[]
): T | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return keys.reduce<any>((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), obj);
};

const SEO_DEFAULTS = {
  image: 'https://open-data-bih.github.io/blum-project/assets/images/gradski-prevoz-mapa-banja-luka.webp',
  type: 'website',
  twitterCard: 'summary_large_image',
};

const PAGE_SEO: Record<string, { url: string; title: Record<Language, string>; description: Record<Language, string> }> = {
  home: {
    url: 'https://open-data-bih.github.io/blum-project/',
    title: { bhs: 'Pocetna | BLum', en: 'Home | BLum' },
    description: {
      bhs: 'BLum je nezavisna platforma za informacije o javnom prevozu, linijama i urbanoj mobilnosti u Banjoj Luci.',
      en: 'BLum is an independent platform for public transport routes, timetables, and urban mobility information in Banja Luka.',
    },
  },
  lines: {
    url: 'https://open-data-bih.github.io/blum-project/lines/',
    title: { bhs: 'Red voznje i linije | BLum', en: 'Lines & Timetables | BLum' },
    description: {
      bhs: 'Pregled gradskih i prigradskih linija, mape trasa i reda voznje javnog prevoza u Banjoj Luci.',
      en: 'Explore urban and suburban routes, map overlays, and timetable information for public transport in Banja Luka.',
    },
  },
  pricing: {
    url: 'https://open-data-bih.github.io/blum-project/pricing/',
    title: { bhs: 'Cjenovnik | BLum', en: 'Prices | BLum' },
    description: {
      bhs: 'Aktuelne cijene karata i pretplatnih opcija za javni prevoz u Banjoj Luci na jednom mjestu.',
      en: 'Check current ticket prices and subscription options for public transport in Banja Luka.',
    },
  },
  airport: {
    url: 'https://open-data-bih.github.io/blum-project/airport/',
    title: { bhs: 'Aerodromski prevoz | BLum', en: 'Airport Transport | BLum' },
    description: {
      bhs: 'Informacije o prevozu do i od Medjunarodnog aerodroma Banja Luka, ukljucujuci cijene, stajalista i polaske.',
      en: 'Find airport transfer details for Banja Luka International Airport, including prices, stops, and departures.',
    },
  },
  faq: {
    url: 'https://open-data-bih.github.io/blum-project/faq/',
    title: { bhs: 'FAQ | BLum', en: 'FAQ | BLum' },
    description: {
      bhs: 'Najcesca pitanja i odgovori o koristenju BLum platforme, linijama, kartama i javnom prevozu u Banjoj Luci.',
      en: 'Read frequently asked questions about BLum, routes, tickets, and public transport in Banja Luka.',
    },
  },
  updates: {
    url: 'https://open-data-bih.github.io/blum-project/updates/',
    title: { bhs: 'Obavjestenja | BLum', en: 'Updates | BLum' },
    description: {
      bhs: 'Najnovija obavjestenja o izmjenama linija, redu voznje i servisnim informacijama javnog prevoza u Banjoj Luci.',
      en: 'Latest updates on route changes, timetable adjustments, and service notices for public transport in Banja Luka.',
    },
  },
};

const resolvePageKey = (): string => {
  const pageKey = document.body.dataset.page;
  if (pageKey && PAGE_SEO[pageKey]) return pageKey;

  // Astro paths: /lines/ not lines.html
  const path = window.location.pathname.toLowerCase();
  if (path.includes('/lines')) return 'lines';
  if (path.includes('/pricing')) return 'pricing';
  if (path.includes('/airport')) return 'airport';
  if (path.includes('/faq')) return 'faq';
  if (path.includes('/updates')) return 'updates';
  return 'home';
};

const setMetaContent = (attr: string, key: string, content: string | null): void => {
  if (!content) return;
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
  if (!element || text === null || text === undefined) return;
  element.textContent = text;
};

const safelyUpdateButtonLabel = (id: string, text: string | null | undefined): void => {
  const element = document.getElementById(id);
  if (!element || text === null || text === undefined) return;
  const label = element.querySelector('.btn__label');
  if (label) {
    label.textContent = text;
  } else {
    element.textContent = text;
  }
};

const updateDetailText = (id: string, text: string | null | undefined): void => {
  const el = document.getElementById(id);
  if (!el || !text) return;
  const span = el.querySelector('span');
  if (span) span.textContent = text;
  else el.textContent = text;
};

export const applyTranslation = (lang: Language): void => {
  const t = translations[lang];
  if (!t) return;

  currentLang = lang;
  document.documentElement.lang = lang === 'bhs' ? 'bs' : 'en';
  updateSeoTags(lang);

  // Header
  safelyUpdateText('site-title', 'BLum');
  safelyUpdateText('site-subtitle', 'Urbana mobilnost Banja Luka');

  // Navigation
  safelyUpdateText('nav-map-desktop', t.header.nav.map);
  safelyUpdateText('nav-lines-desktop', t.header.nav.lines);
  safelyUpdateText('nav-prices-desktop', t.header.nav.prices ?? (lang === 'bhs' ? 'Cjenovnik' : 'Prices'));
  safelyUpdateText('nav-airport-desktop', t.header.nav.airport);
  safelyUpdateText('nav-updates-desktop', t.header.nav.updates ?? (lang === 'bhs' ? 'Obavještenja' : 'Updates'));
  safelyUpdateText('nav-faq-desktop', t.header.nav.faq);

  // Hero section
  const heroDefaults =
    lang === 'bhs'
      ? {
        title: 'BLum',
        subtitle: 'Informacije za lakše kretanje gradom.',
        description: 'Nezavisna platforma za linije, red vožnje i obavještenja o javnom prevozu u Banjoj Luci.',
        detail1: 'Linije i red vožnje na jednom mjestu',
        detail2: 'Otvoren (open-source) i dostupan za dopune',
        disclaimer: 'BLum nije zvanična stranica javnog prevoza.',
        timetables: 'Red vožnje',
        airport: 'Transfer do aerodroma',
      }
      : {
        title: 'BLum',
        subtitle: 'Information for easier movement through the city.',
        description: 'Independent platform for routes, timetables, and public transport notices in Banja Luka.',
        detail1: 'Routes and timetables in one place',
        detail2: 'Open-source and open to contributions',
        disclaimer: 'BLum is not an official public transport website.',
        timetables: 'Timetables',
        airport: 'Airport transfer',
      };

  safelyUpdateText('hero-title', heroDefaults.title);
  safelyUpdateText('hero-subtitle', heroDefaults.subtitle);
  safelyUpdateText('hero-description', heroDefaults.description);
  updateDetailText('hero-detail-1', heroDefaults.detail1);
  updateDetailText('hero-detail-2', heroDefaults.detail2);

  const disclaimerEl = document.getElementById('hero-disclaimer');
  if (disclaimerEl) {
    const span = disclaimerEl.querySelector('span');
    if (span) span.textContent = heroDefaults.disclaimer;
  }

  safelyUpdateButtonLabel('hero-btn-timetables', heroDefaults.timetables);
  safelyUpdateButtonLabel('hero-btn-airport', heroDefaults.airport);

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
  if (mapNote) mapNote.textContent = t.sections?.urban_lines?.map_note;

  // Lines section
  safelyUpdateText('lines-title', t.sections?.lines?.title);
  safelyUpdateText('lines-intro-text', lang === 'bhs'
    ? 'Javni prevoz u Banjoj Luci organizovan je u tri grupe linija. Za svaku grupu linija potrebno je kupiti odgovarajuću kartu. Karte nisu prenosive između grupa.'
    : 'Public transport in Banja Luka is organized into three groups of lines. For each group of lines, you need to purchase a corresponding ticket. Tickets are not transferable between groups.');
  safelyUpdateText('operator-legend-title', lang === 'bhs' ? 'Prevoznici' : 'Operators');
  safelyUpdateText('lines-map-note', safeGet(t, 'sections', 'lines', 'mapNote'));
  safelyUpdateText('lines-map-credits-label', safeGet(t, 'sections', 'lines', 'mapCreditsToggle'));
  safelyUpdateText('lines-accordion-toggle', safeGet(t, 'sections', 'lines', 'accordionToggle'));
  safelyUpdateText('lines-accordion-text', safeGet(t, 'sections', 'lines', 'accordionText'));
  safelyUpdateText('lines-timetable-title', safeGet(t, 'sections', 'lines', 'timetableTitle'));

  // Timetable section
  safelyUpdateText('timetable-title', t.sections?.timetable?.title);
  if (t.sections?.timetable) {
    t.sections.timetable.fromTo ??= lang === 'bhs' ? 'Relacija:' : 'Route:';
    t.sections.timetable.selectDay ??= lang === 'bhs' ? 'Izaberite dan' : 'Select day';
    t.sections.timetable.hourLabel ??= lang === 'bhs' ? 'Sat' : 'Hour';
    t.sections.timetable.minutesLabel ??= lang === 'bhs' ? 'Minute' : 'Minutes';
  }

  // Pricing section
  safelyUpdateText('price-tables-title', t.sections?.prices?.title ?? (lang === 'bhs' ? 'Cjenovnik karata' : 'Ticket Prices'));

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
  safelyUpdateText('airport-more-info', t.sections?.airport?.moreInfo);
  safelyUpdateText('airport-website-link', t.sections?.airport?.websiteLink);

  // Updates section
  safelyUpdateText('updates-title', safeGet(t, 'sections', 'updates', 'title'));
  safelyUpdateText('updates-subtitle', lang === 'bhs'
    ? 'Obavještenja o promjenama u prevozu, zatvaranjima ulica i izmjenama reda vožnje'
    : 'Notices about transport changes, street closures, and timetable updates');

  // FAQ section
  safelyUpdateText('faq-title', safeGet(t, 'sections', 'faq', 'title'));
  safelyUpdateText('faq-subtitle', safeGet(t, 'sections', 'faq', 'subtitle'));

  // Footer
  safelyUpdateText('footer-mission-text', lang === 'bhs'
    ? 'BLum je open-source projekat razvijen radi bolje dostupnosti informacija o javnom prevozu.'
    : 'BLum is an open-source project created to improve access to public transport information.');
  safelyUpdateText('footer-disclaimer-text', lang === 'bhs'
    ? 'BLum nije zvanična stranica javnog prevoza. Za zvanične informacije obratite se nadležnim institucijama.'
    : 'BLum is not an official public transport website. For official information, contact the relevant institutions.');
  safelyUpdateText('footer-link-issues', lang === 'bhs' ? 'Prijavi grešku' : 'Report issue');
  safelyUpdateText('footer-link-faq', 'FAQ');
  safelyUpdateText('footer-link-contact', lang === 'bhs' ? 'Kontakt' : 'Contact');

  // data-lang attribute visibility toggle
  document.querySelectorAll<HTMLElement>('[data-lang]').forEach((element) => {
    if (element.classList.contains('lang-btn')) return;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getTranslations = (): Record<string, any> => translations;

// Namespaced export kept for compatibility with feature modules that use AppI18n
export const AppI18n = {
  get currentLang() { return currentLang; },
  set currentLang(val: Language) { currentLang = val; },
  get translations() { return translations; },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set translations(val: Record<string, any>) { translations = val; },
  safeGet,
  setupLanguageSwitcher,
  applyTranslation,
  getCurrentLanguage,
  getTranslations,
};

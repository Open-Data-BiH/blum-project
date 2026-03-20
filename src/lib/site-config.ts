export type Locale = 'bhs' | 'en';
export type HtmlLang = 'bs' | 'en';
export type PageKey = 'home' | 'lines' | 'pricing' | 'airport' | 'faq' | 'updates' | 'contact' | 'privacy' | 'about';

type LocalizedText = Record<Locale, string>;

export const SITE_URL = 'https://blprevoz.com/';
export const DEFAULT_LOCALE: Locale = 'bhs';
export const HTML_LANG_BY_LOCALE: Record<Locale, HtmlLang> = {
    bhs: 'bs',
    en: 'en',
};

export const PAGE_PATHS: Record<PageKey, Record<Locale, string>> = {
    home: {
        bhs: '/',
        en: '/en/',
    },
    lines: {
        bhs: '/linije/',
        en: '/en/lines/',
    },
    pricing: {
        bhs: '/cjenovnik/',
        en: '/en/pricing/',
    },
    airport: {
        bhs: '/aerodrom/',
        en: '/en/airport/',
    },
    faq: {
        bhs: '/cesta-pitanja/',
        en: '/en/faq/',
    },
    updates: {
        bhs: '/obavjestenja/',
        en: '/en/updates/',
    },
    contact: {
        bhs: '/kontakt/',
        en: '/en/contact/',
    },
    privacy: {
        bhs: '/politika-privatnosti/',
        en: '/en/privacy/',
    },
    about: {
        bhs: '/o-projektu/',
        en: '/en/about/',
    },
};

export const PAGE_META: Record<PageKey, { title: LocalizedText; description: LocalizedText }> = {
    home: {
        title: {
            bhs: 'Javni prevoz Banja Luka | BL Prevoz',
            en: 'Banja Luka Public Transport | BL Prevoz',
        },
        description: {
            bhs: 'Red vožnje, linije i mapa javnog prevoza u Banjoj Luci. Polasci, stajališta i informacije o prevozu do aerodroma.',
            en: 'Bus schedules, routes, and map for public transport in Banja Luka. Departures, stops, and airport shuttle information.',
        },
    },
    lines: {
        title: {
            bhs: 'Red vožnje i autobuske linije | BL Prevoz',
            en: 'Timetables & Bus Routes | BL Prevoz',
        },
        description: {
            bhs: 'Sve autobuske linije i red vožnje javnog prevoza u Banjoj Luci. Mape trasa, polasci i stajališta na jednom mjestu.',
            en: 'All bus routes and timetables for public transport in Banja Luka. Route maps, departures, and stops in one place.',
        },
    },
    pricing: {
        title: {
            bhs: 'Cijene karata | BL Prevoz',
            en: 'Ticket Prices | BL Prevoz',
        },
        description: {
            bhs: 'Aktuelne cijene karata, mjesečnih pretplata i đačkih markica za autobuski prevoz u Banjoj Luci.',
            en: 'Current ticket prices, monthly passes, and student cards for bus transport in Banja Luka.',
        },
    },
    airport: {
        title: {
            bhs: 'Prevoz do aerodroma Banja Luka (BNX) | BL Prevoz',
            en: 'Banja Luka Airport Bus & Shuttle (BNX) | BL Prevoz',
        },
        description: {
            bhs: 'Kako doći do Aerodroma Banja Luka (BNX). Shuttle autobus oko 10 KM (30-45 min), taksi 40-60 KM. Polasci od Glavne stanice, parking i interaktivna mapa rute.',
            en: 'How to get from Banja Luka Airport (BNX) to the city center. Shuttle bus around 10 KM (30-45 minutes), taxi 40-60 KM. Timetable, route map, and parking info.',
        },
    },
    faq: {
        title: {
            bhs: 'Česta pitanja | BL Prevoz',
            en: 'FAQ | BL Prevoz',
        },
        description: {
            bhs: 'Odgovori na najčešća pitanja o autobuskim linijama, kartama i javnom prevozu u Banjoj Luci.',
            en: 'Answers to frequently asked questions about bus routes, tickets, and public transport in Banja Luka.',
        },
    },
    updates: {
        title: {
            bhs: 'Obavještenja i izmjene reda vožnje | BL Prevoz',
            en: 'Updates & Timetable Changes | BL Prevoz',
        },
        description: {
            bhs: 'Najnovija obavještenja o izmjenama autobuskih linija, reda vožnje i radovima na javnom prevozu u Banjoj Luci.',
            en: 'Latest updates on bus route changes, timetable adjustments, and service notices in Banja Luka.',
        },
    },
    contact: {
        title: {
            bhs: 'Kontakt | BL Prevoz',
            en: 'Contact | BL Prevoz',
        },
        description: {
            bhs: 'Kontaktirajte nas za pitanja o javnom prevozu u Banjoj Luci. Prijavite problem ili predložite poboljšanje.',
            en: 'Contact us about public transport in Banja Luka. Report an issue or suggest an improvement.',
        },
    },
    privacy: {
        title: {
            bhs: 'Politika privatnosti | BL Prevoz',
            en: 'Privacy Policy | BL Prevoz',
        },
        description: {
            bhs: 'Politika privatnosti platforme BL Prevoz. Informacije o analitici, kolačićima, pristanku i zaštiti privatnosti korisnika.',
            en: 'Privacy Policy for BL Prevoz. Information about analytics, cookies, consent, and user privacy protection.',
        },
    },
    about: {
        title: {
            bhs: 'O projektu | BL Prevoz',
            en: 'About | BL Prevoz',
        },
        description: {
            bhs: 'BL Prevoz je nezavisna, volonterski vođena platforma za informacije o javnom prevozu u Banjoj Luci. Saznajte više o projektu.',
            en: 'BL Prevoz is an independent, volunteer-driven platform for public transport information in Banja Luka. Learn more about the project.',
        },
    },
};

export const LINE_DETAIL_PATH_PREFIX: Record<Locale, string> = {
    bhs: '/linija/',
    en: '/en/line/',
};

export const LEGACY_REDIRECTS = {
    '/lines': PAGE_PATHS.lines.bhs,
    '/lines/[lineId]': '/linija/[lineId]',
    '/pricing': PAGE_PATHS.pricing.bhs,
    '/airport': PAGE_PATHS.airport.bhs,
    '/faq': PAGE_PATHS.faq.bhs,
    '/updates': PAGE_PATHS.updates.bhs,
    '/contact': PAGE_PATHS.contact.bhs,
    '/privacy': PAGE_PATHS.privacy.bhs,
    '/about': PAGE_PATHS.about.bhs,
} as const;

const ensureLeadingSlash = (path: string): string => (path.startsWith('/') ? path : `/${path}`);
const ensureTrailingSlash = (path: string): string => (path.endsWith('/') ? path : `${path}/`);

export const getPagePath = (pageKey: PageKey, locale: Locale): string => PAGE_PATHS[pageKey][locale];

export const getPageUrl = (pageKey: PageKey, locale: Locale): string =>
    new URL(getPagePath(pageKey, locale), SITE_URL).toString();

export const getLocalizedMeta = (pageKey: PageKey, locale: Locale): { title: string; description: string } => ({
    title: PAGE_META[pageKey].title[locale],
    description: PAGE_META[pageKey].description[locale],
});

export const normalizeLineId = (lineId: string): string => lineId.toLowerCase();

export const getLineDetailPath = (locale: Locale, lineId: string): string =>
    `${LINE_DETAIL_PATH_PREFIX[locale]}${normalizeLineId(lineId)}/`;

export const getLineDetailUrl = (locale: Locale, lineId: string): string =>
    new URL(getLineDetailPath(locale, lineId), SITE_URL).toString();

export const getAlternatePaths = (pageKey: PageKey): Record<'bhs' | 'en' | 'default', string> => ({
    bhs: getPagePath(pageKey, 'bhs'),
    en: getPagePath(pageKey, 'en'),
    default: getPagePath(pageKey, DEFAULT_LOCALE),
});

export const getLineAlternatePaths = (lineId: string): Record<'bhs' | 'en' | 'default', string> => ({
    bhs: getLineDetailPath('bhs', lineId),
    en: getLineDetailPath('en', lineId),
    default: getLineDetailPath(DEFAULT_LOCALE, lineId),
});

export const getSwitchLocale = (locale: Locale): Locale => (locale === 'en' ? 'bhs' : 'en');

export const addHashToPath = (path: string, hash: string): string => {
    if (!hash) {
        return path;
    }
    const normalizedHash = hash.startsWith('#') ? hash : `#${hash}`;
    return `${path}${normalizedHash}`;
};

export const withSiteUrl = (path: string): string => new URL(ensureLeadingSlash(path), SITE_URL).toString();

export const getLocaleFromPath = (pathname: string): Locale => {
    const normalizedPath = ensureTrailingSlash(ensureLeadingSlash(pathname));
    return normalizedPath === '/en/' || normalizedPath.startsWith('/en/') ? 'en' : 'bhs';
};

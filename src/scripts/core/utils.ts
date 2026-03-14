// Shared utility functions (pure, stateless)
// Ported from js/core/utils.js

const BASE_URL = import.meta.env.BASE_URL;
export const withBase = (path: string): string => `${BASE_URL}${path.replace(/^\/+/, '')}`;

export const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

/**
 * Debounce expensive operations
 */
export const debounce = <T extends (...args: any[]) => void>(
    func: T,
    wait: number,
): ((...args: Parameters<T>) => void) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

/**
 * Sort lines by ID — numeric first, then alphabetic fallback
 */
export const sortLinesByID = (a: { lineId: string }, b: { lineId: string }): number => {
    const numA = parseInt(a.lineId);
    const numB = parseInt(b.lineId);
    return !isNaN(numA) && !isNaN(numB) ? numA - numB : a.lineId.localeCompare(b.lineId);
};

/**
 * Normalize text for search — removes diacritics and handles special characters
 */
export const normalizeForSearch = (text: string | null | undefined): string => {
    if (!text) {
        return '';
    }
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/ð/g, 'd')
        .replace(/ł/g, 'l')
        .replace(/ß/g, 'ss')
        .replace(/æ/g, 'ae')
        .replace(/œ/g, 'oe')
        .replace(/ø/g, 'o')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

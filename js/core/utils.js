// ==========================================
// Shared utility functions (pure, stateless)
// ==========================================

/**
 * Debounce expensive operations
 */
const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
};

/**
 * Sort lines by ID - numeric first, then alphabetic fallback
 */
const sortLinesByID = (a, b) => {
    const numA = parseInt(a.lineId);
    const numB = parseInt(b.lineId);
    return !isNaN(numA) && !isNaN(numB) ? numA - numB : a.lineId.localeCompare(b.lineId);
};

/**
 * Normalize text for search - removes diacritics and handles special characters
 */
const normalizeForSearch = (text) => {
    if (!text) {
        return '';
    }
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/ð/g, 'd')
        .replace(/ł/g, 'l');
};

export { debounce, sortLinesByID, normalizeForSearch };

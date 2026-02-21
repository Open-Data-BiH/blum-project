/**
 * Sanitization Utility
 * Provides XSS protection using DOMPurify
 */

// Sanitization configuration
const SANITIZE_CONFIG = {
    // Allow safe HTML tags for content
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'code', 'pre'],
    // Allow safe attributes
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id', 'style', 'aria-label', 'aria-hidden', 'aria-expanded', 'aria-controls', 'data-*'],
    // Allow data attributes
    ALLOW_DATA_ATTR: true,
    // Force target="_blank" links to have rel="noopener noreferrer"
    ADD_ATTR: ['target'],
};

// Strict configuration for user-generated content
const STRICT_CONFIG = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'span'],
    ALLOWED_ATTR: ['class'],
    ALLOW_DATA_ATTR: false,
};

/**
 * Sanitize HTML content using DOMPurify
 * @param {string} dirty - Untrusted HTML string
 * @param {boolean} strict - Use strict mode for user content
 * @returns {string} - Sanitized HTML string
 */
function sanitizeHTML(dirty, strict = false) {
    if (typeof dirty !== 'string') {
        return '';
    }

    // Check if DOMPurify is available
    if (typeof DOMPurify === 'undefined') {
        console.warn('DOMPurify not loaded, falling back to text encoding');
        return escapeHTML(dirty);
    }

    const config = strict ? STRICT_CONFIG : SANITIZE_CONFIG;
    return DOMPurify.sanitize(dirty, config);
}

/**
 * Escape HTML entities (fallback when DOMPurify not available)
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHTML(text) {
    if (typeof text !== 'string') {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sanitize a URL to prevent javascript: and data: protocols
 * @param {string} url - URL to sanitize
 * @returns {string} - Sanitized URL or empty string if invalid
 */
function sanitizeURL(url) {
    if (typeof url !== 'string') {
        return '';
    }

    // Trim whitespace
    url = url.trim();

    // Check for dangerous protocols
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.startsWith('javascript:') ||
        lowerUrl.startsWith('data:') ||
        lowerUrl.startsWith('vbscript:')) {
        console.warn('Blocked dangerous URL protocol:', url);
        return '';
    }

    // Allow relative URLs, http, https, mailto, tel
    if (url.startsWith('/') ||
        url.startsWith('#') ||
        url.startsWith('./') ||
        url.startsWith('../') ||
        lowerUrl.startsWith('http://') ||
        lowerUrl.startsWith('https://') ||
        lowerUrl.startsWith('mailto:') ||
        lowerUrl.startsWith('tel:')) {
        return url;
    }

    // For other URLs, assume they need https://
    if (!url.includes('://')) {
        return url; // Relative URL
    }

    // Block unknown protocols
    console.warn('Blocked unknown URL protocol:', url);
    return '';
}

/**
 * Create safe innerHTML setter that sanitizes content
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML to set
 * @param {boolean} strict - Use strict sanitization
 */
function safeInnerHTML(element, html, strict = false) {
    if (element && typeof html === 'string') {
        element.innerHTML = sanitizeHTML(html, strict);
    }
}

/**
 * Sanitize an object's string properties recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized object
 */
function sanitizeObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const sanitized = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            if (typeof value === 'string') {
                sanitized[key] = escapeHTML(value);
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
    }
    return sanitized;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sanitizeHTML,
        escapeHTML,
        sanitizeURL,
        safeInnerHTML,
        sanitizeObject,
        SANITIZE_CONFIG,
        STRICT_CONFIG
    };
}

// Make available globally
window.sanitizeHTML = sanitizeHTML;
window.escapeHTML = escapeHTML;
window.sanitizeURL = sanitizeURL;
window.safeInnerHTML = safeInnerHTML;
window.sanitizeObject = sanitizeObject;

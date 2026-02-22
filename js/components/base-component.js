import { getCurrentLanguage } from '../core/i18n.js';

/**
 * Base Component Class
 * Provides shared utilities for component classes
 */

class BaseComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentLang = getCurrentLanguage();
    }

    /**
     * Utility function to escape HTML
     * Prevents XSS attacks by converting text to safe HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Render loading state
     * @param {string} message - Optional loading message
     */
    renderLoading(message) {
        if (!this.container) {
            return;
        }

        const loadingText = message || (this.currentLang === 'en' ? 'Loading...' : 'Učitavanje...');

        this.container.innerHTML = `
            <div class="component-loading">
                <div class="loading-spinner"></div>
                <span>${loadingText}</span>
            </div>
        `;
    }

    /**
     * Render error state
     * @param {string} message - Optional error message
     */
    renderError(message) {
        if (!this.container) {
            return;
        }

        const errorMessage =
            message ||
            (this.currentLang === 'en'
                ? 'Sorry, we could not load the content at this time. Please try again later.'
                : 'Nažalost, nismo mogli učitati sadržaj. Molimo pokušajte kasnije.');

        this.container.innerHTML = `
            <div class="component-error">
                <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
                <span>${this.escapeHtml(errorMessage)}</span>
            </div>
        `;
    }

    /**
     * Update language and re-render
     * @param {string} newLang - New language code (e.g., 'en', 'bhs')
     */
    updateLanguage(newLang) {
        this.currentLang = newLang;
        // Subclasses should override this method to implement re-rendering
    }
}

export default BaseComponent;

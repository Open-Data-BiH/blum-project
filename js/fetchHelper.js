/**
 * Fetch Helper
 * Standardized fetch wrapper with timeout and retry support
 */

const FetchHelper = {
    // Default configuration
    defaults: {
        timeout: 10000, // 10 seconds
        retries: 2,
        retryDelay: 1000, // 1 second base delay
        retryBackoff: 2 // Exponential backoff multiplier
    },

    /**
     * Fetch with timeout support
     * @param {string} url - URL to fetch
     * @param {RequestInit} options - Fetch options
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Response>}
     */
    fetchWithTimeout(url, options = {}, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        return fetch(url, {
            ...options,
            signal: controller.signal
        }).finally(() => clearTimeout(timeoutId));
    },

    /**
     * Main fetch method with timeout and retry support
     * @param {string} url - URL to fetch
     * @param {Object} config - Configuration options
     * @param {number} [config.timeout] - Timeout in milliseconds (default: 10000)
     * @param {number} [config.retries] - Number of retries (default: 2)
     * @param {number} [config.retryDelay] - Base delay between retries in ms (default: 1000)
     * @param {RequestInit} [config.fetchOptions] - Standard fetch options
     * @returns {Promise<Response>}
     */
    async fetch(url, config = {}) {
        const timeout = config.timeout ?? this.defaults.timeout;
        const retries = config.retries ?? this.defaults.retries;
        const retryDelay = config.retryDelay ?? this.defaults.retryDelay;
        const retryBackoff = config.retryBackoff ?? this.defaults.retryBackoff;
        const fetchOptions = config.fetchOptions || {};

        let lastError;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await this.fetchWithTimeout(url, fetchOptions, timeout);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                return response;
            } catch (error) {
                lastError = error;

                // Don't retry on abort (timeout) for the last attempt
                const isLastAttempt = attempt === retries;

                if (isLastAttempt) {
                    break;
                }

                // Calculate delay with exponential backoff
                const delay = retryDelay * Math.pow(retryBackoff, attempt);

                console.warn(
                    `Fetch attempt ${attempt + 1} failed for ${url}: ${error.message}. ` +
                    `Retrying in ${delay}ms...`
                );

                await this.sleep(delay);
            }
        }

        // Enhance error message for timeout
        if (lastError.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms for ${url}`);
        }

        throw lastError;
    },

    /**
     * Fetch and parse JSON
     * @param {string} url - URL to fetch
     * @param {Object} config - Configuration options (same as fetch)
     * @returns {Promise<any>} Parsed JSON data
     */
    async fetchJSON(url, config = {}) {
        const response = await this.fetch(url, config);
        return response.json();
    },

    /**
     * Fetch and return text
     * @param {string} url - URL to fetch
     * @param {Object} config - Configuration options (same as fetch)
     * @returns {Promise<string>} Response text
     */
    async fetchText(url, config = {}) {
        const response = await this.fetch(url, config);
        return response.text();
    },

    /**
     * Sleep helper for retry delays
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FetchHelper;
}

// Make available globally
window.FetchHelper = FetchHelper;

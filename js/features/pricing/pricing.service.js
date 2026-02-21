// ==========================================
// Pricing Service Module
// Load and store pricing data
// ==========================================

let prices = {};

const loadPrices = async () => {
    const priceTablesContainer = document.querySelector('#price-tables .price-tables');
    if (!priceTablesContainer) {
        return;
    }

    try {
        prices = await FetchHelper.fetchJSON('data/transport/prices.json');
        PricingUI.renderPriceTables();

        if (!window._priceTablesLanguageListenerAdded) {
            document.addEventListener('languageChanged', () => {
                PricingUI.renderPriceTables();
            });
            window._priceTablesLanguageListenerAdded = true;
        }
    } catch (error) {
        console.error('Error loading price data:', error);
        const container = document.querySelector('#price-tables .price-tables');
        if (!container) {
            return;
        }

        const lang = AppI18n.currentLang;
        const errorMessage = AppI18n.safeGet(AppI18n.translations, lang, 'ui', 'error') || 'Failed to load price data. Please try again later.';
        const retryText = AppI18n.safeGet(AppI18n.translations, lang, 'ui', 'retry') || 'Retry';

        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${errorMessage}</p>
                <button class="retry-btn" type="button">
                    ${retryText}
                </button>
            </div>
        `;

        container.querySelector('.retry-btn').addEventListener('click', loadPrices);
    }
};

window.PricingService = {
    get prices() {
        return prices;
    },
    loadPrices
};

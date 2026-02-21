// ==========================================
// Pricing UI Module
// Render pricing tables from pricing state
// ==========================================

function renderPriceTables() {
    const allPrices = PricingService.prices;
    const lang = AppI18n.currentLang;

    if (!allPrices || !allPrices[lang]) {
        return;
    }

    const priceTablesContainer = document.querySelector('#price-tables .price-tables');
    if (!priceTablesContainer) {
        return;
    }

    priceTablesContainer.innerHTML = '';

    const priceData = allPrices[lang];
    const labels = priceData.labels;

    const priceTableContainer = document.createElement('div');
    priceTableContainer.className = 'price-table-container';

    const t = priceData.ticketTypes;
    let tableHtml = `
        <table class="unified-price-table">
            <thead>
                <tr>
                    <th>${escapeHTML(labels.ticketTypes)}</th>
                    <th>${escapeHTML(labels.price)} (${escapeHTML(labels.km)})</th>
                </tr>
            </thead>
            <tbody>
                <tr class="category-header">
                    <td colspan="2">${lang === 'bhs' ? 'Pojedinačne i dnevne karte' : 'Single and Daily Tickets'}</td>
                </tr>
                <tr>
                    <td>
                        ${escapeHTML(t.single.name)}
                        <div class="description">${escapeHTML(t.single.description)}</div>
                    </td>
                    <td>${t.single.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>
                        ${escapeHTML(t.singleInSet.name)}
                        <div class="description">${escapeHTML(t.singleInSet.description)}</div>
                    </td>
                    <td>${t.singleInSet.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>
                        ${escapeHTML(t.daily.name)}
                        <div class="description">${escapeHTML(t.daily.description)}</div>
                    </td>
                    <td>${t.daily.price.toFixed(2)}</td>
                </tr>

                <tr class="category-header">
                    <td colspan="2">${escapeHTML(t.monthlyGroup.name)}</td>
                </tr>
                <tr>
                    <td>${escapeHTML(t.monthlyGroup.workers.name)}</td>
                    <td>${t.monthlyGroup.workers.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${escapeHTML(t.monthlyGroup.students.name)}</td>
                    <td>${t.monthlyGroup.students.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${escapeHTML(t.monthlyGroup.pensioners.name)}</td>
                    <td>${t.monthlyGroup.pensioners.price.toFixed(2)}</td>
                </tr>

                <tr class="category-header">
                    <td colspan="2">${escapeHTML(t.monthlyUnified.name)}</td>
                </tr>
                <tr>
                    <td>${escapeHTML(t.monthlyUnified.workers.name)}</td>
                    <td>${t.monthlyUnified.workers.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${escapeHTML(t.monthlyUnified.students.name)}</td>
                    <td>${t.monthlyUnified.students.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${escapeHTML(t.monthlyUnified.pensioners.name)}</td>
                    <td>${t.monthlyUnified.pensioners.price.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>
    `;

    const disclaimerText = lang === 'bhs'
        ? '<p class="price-disclaimer">Prikazane cijene su informativne. Za tačne i ažurirane cijene, kao i za cijene prigradskih linija, provjerite informacije kod nadležnih institucija i prevoznika.</p>'
        : '<p class="price-disclaimer">Displayed prices are informational. For current and updated prices, including suburban lines, verify information with relevant institutions and operators.</p>';

    tableHtml += disclaimerText;

    priceTableContainer.innerHTML = tableHtml;
    priceTablesContainer.appendChild(priceTableContainer);
}

window.PricingUI = { renderPriceTables };


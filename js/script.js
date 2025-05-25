// Global variables for translations and current language
let translations = {};
let prices = {};
let currentLang = localStorage.getItem('selectedLanguage') || 'bhs'; // Get language from localStorage or default to 'bhs'

// Make currentLang available globally
window.currentLang = currentLang;

// Helper function to sort lines by ID
function sortLinesByID(a, b) {
    const numA = parseInt(a.lineId);
    const numB = parseInt(b.lineId);
    if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
    }
    return a.lineId.localeCompare(b.lineId);
}

document.addEventListener('DOMContentLoaded', function () {
    // Restore scroll position if coming from a language change
    const savedScrollPosition = sessionStorage.getItem('scrollPosition');
    if (savedScrollPosition) {
        window.scrollTo(0, parseInt(savedScrollPosition));
        sessionStorage.removeItem('scrollPosition'); // Clear after use
    }

    // Load translations
    loadTranslations().then(() => {
        // Setup language switcher
        setupLanguageSwitcher();

        // Load bus lines data
        loadLines();

        // Load prices data
        loadPrices();

        // Load contacts data
        loadContacts();

        // Setup timetable selection
        setupTimetableSelection();

        // Setup smooth scrolling for navigation
        setupSmoothScrolling();



        // Setup mobile menu toggle
        setupMobileMenu();
    });
});

// Load translations
async function loadTranslations() {
    try {
        const response = await fetch('data/translations.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        translations = await response.json();
        applyTranslation(currentLang);
    } catch (error) {
        console.error('Error loading translations:', error);
        // Fallback to basic functionality without translations
        document.body.classList.add('translations-failed');
    }
}

// Setup language switcher
function setupLanguageSwitcher() {
    // Activate the correct language button based on current language
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.getAttribute('data-lang') === currentLang) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        btn.addEventListener('click', function () {
            const lang = this.getAttribute('data-lang');
            if (lang !== currentLang) {
                // Save current scroll position
                sessionStorage.setItem('scrollPosition', window.pageYOffset);

                // Save currently selected timetable line if any
                const lineSelect = document.getElementById('line-select');
                if (lineSelect && lineSelect.value) {
                    sessionStorage.setItem('selectedLine', lineSelect.value);
                }

                // Close mobile menu if open
                document.body.classList.remove('mobile-nav-active');

                // Store the selected language in localStorage
                localStorage.setItem('selectedLanguage', lang);

                // Reload the page to apply changes completely
                window.location.reload();
            }
        });
    });
}

// Apply translation to the whole page
function applyTranslation(lang) {
    const t = translations[lang];
    if (!t) return;

    // Update current language
    currentLang = lang;
    window.currentLang = lang; // Update global variable

    // Helper function to safely update element text
    function safelyUpdateText(id, text) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = text;
        }
    }

    // Header
    safelyUpdateText('site-title', t.header.title);

    // Navigation - Mobile
    safelyUpdateText('nav-map', t.header.nav.map);
    safelyUpdateText('nav-lines', t.header.nav.lines);
    safelyUpdateText('nav-timetable', t.header.nav.timetable);
    safelyUpdateText('nav-airport', t.header.nav.airport);
    safelyUpdateText('nav-contact', t.header.nav.contact);
    safelyUpdateText('nav-price-tables', t.header.nav.prices || (lang === 'bhs' ? 'Cjenovnik' : 'Prices'));

    // Navigation - Desktop
    safelyUpdateText('nav-map-desktop', t.header.nav.map);
    safelyUpdateText('nav-lines-desktop', t.header.nav.lines);
    safelyUpdateText('nav-timetable-desktop', t.header.nav.timetable);
    safelyUpdateText('nav-airport-desktop', t.header.nav.airport);
    safelyUpdateText('nav-contact-desktop', t.header.nav.contact);
    safelyUpdateText('nav-price-tables-desktop', t.header.nav.prices || (lang === 'bhs' ? 'Cjenovnik' : 'Prices'));



    // Update sections
    // Map section
    safelyUpdateText('map-title', t.sections.map.title);

    // Lines section
    safelyUpdateText('lines-title', t.sections.lines.title);
    safelyUpdateText('price-tables-title', t.sections.prices?.title || (lang === 'bhs' ? 'Cjenovnik karata' : 'Ticket Prices'));

    // Lines introduction and ticket note
    const linesIntroText = lang === 'bhs'
        ? 'Javni prevoz u Banjoj Luci organizovan je u tri grupe linija. Za svaku grupu linija potrebno je kupiti odgovarajuću kartu. Karte nisu prenosive između grupa.'
        : 'Public transport in Banja Luka is organized into three groups of lines. For each group of lines, you need to purchase a corresponding ticket. Tickets are not transferable between groups.';
    safelyUpdateText('lines-intro-text', linesIntroText);

    // Operator legend title
    const operatorLegendTitle = lang === 'bhs'
        ? 'Prevoznici'
        : 'Operators';
    safelyUpdateText('operator-legend-title', operatorLegendTitle);

    // Reload lines with new language
    loadLines();



    // Timetable section
    safelyUpdateText('timetable-title', t.sections.timetable.title);

    // Add translations for timetable if not present
    if (t.sections && t.sections.timetable) {
        // From-To label
        if (!t.sections.timetable.fromTo) {
            t.sections.timetable.fromTo = lang === 'bhs' ? 'Relacija:' : 'Route:';
        }

        // Select day label
        if (!t.sections.timetable.selectDay) {
            t.sections.timetable.selectDay = lang === 'bhs' ? 'Izaberite dan' : 'Select day';
        }

        // Hour and Minutes labels
        if (!t.sections.timetable.hourLabel) {
            t.sections.timetable.hourLabel = lang === 'bhs' ? 'Sat' : 'Hour';
        }

        if (!t.sections.timetable.minutesLabel) {
            t.sections.timetable.minutesLabel = lang === 'bhs' ? 'Minute' : 'Minutes';
        }
    }

    // Contact section
    safelyUpdateText('contact-title', t.sections.contact.title);
    safelyUpdateText('email-label', t.sections.contact.email);
    safelyUpdateText('phone-label', t.sections.contact.phone);
    safelyUpdateText('timetable-info-label', t.sections.contact.timetableInfo);

    // Update disclaimer text
    const disclaimerText = lang === 'bhs'
        ? 'Ova internet stranica nije službena stranica Grada Banja Luka niti bilo kojeg prevoznika. Svi podaci su dati samo u informativne svrhe. Za zvanične informacije o redovima vožnje, cijenama i drugim detaljima, molimo vas da kontaktirate nadležne institucije ili prevoznike.'
        : 'This website is not officially affiliated with the City of Banja Luka or any transport operators. All data is provided for informational purposes only. For official information about schedules, prices, and other details, please contact the relevant authorities or transport companies.';
    safelyUpdateText('disclaimer-text', disclaimerText);



    // Update timetable display if it has content
    updateTimetableLanguage();

    // Update pricing tables
    if (prices && Object.keys(prices).length > 0) {
        renderPriceTables();
    }

    // Dispatch a custom event to notify other components that the language has changed
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));

    // Airport shuttle section
    safelyUpdateText('airport-title', t.sections.airport.title);
    safelyUpdateText('airport-description-title', t.sections.airport.descriptionTitle);
    safelyUpdateText('airport-price', t.sections.airport.price);
    safelyUpdateText('airport-departure-location', t.sections.airport.departureLocation);
    safelyUpdateText('airport-more-info', t.sections.airport.moreInfo);
    safelyUpdateText('airport-website-link', t.sections.airport.websiteLink);

    // Bus stops note translation
    const busStopsNoteText = lang === 'bhs'
        ? 'Autobuska stajališta javnog prevoza prikazana su na mapi. Prikaz možete isključiti ili uključiti korištenjem kontrole filtera u donjem desnom uglu mape.'
        : 'Public transport bus stops are shown on the map. You can toggle their visibility using the filter control in the bottom right corner of the map.';
    safelyUpdateText('bus-stops-note-text', busStopsNoteText);
}

// Load bus lines data
function loadLines() {
    // Create simplified lines view in the lines section
    const linesSection = document.getElementById('lines-info');
    linesSection.innerHTML = ''; // Clear existing content

    // Create container for the simplified view
    const simplifiedContainer = document.createElement('div');
    simplifiedContainer.id = 'simplified-lines';
    simplifiedContainer.className = 'simplified-lines-container';
    linesSection.appendChild(simplifiedContainer);

    // Get translations for urban and suburban
    const lang = currentLang;
    const urbanTitle = lang === 'bhs' ? 'Gradske linije' : 'Urban Lines';
    const suburbanTitle = lang === 'bhs' ? 'Prigradske linije' : 'Suburban Lines';

    // Get translations for details
    const detailsLabel = lang === 'bhs' ? 'Detalji' : 'Details';
    const operatorLabel = lang === 'bhs' ? 'Prevoznik' : 'Operator';
    const viewTimetableLabel = lang === 'bhs' ? 'Pogledaj red vožnje' : 'View timetable';

    // Create the tabs and content structure
    let html = `
        <div class="lines-tabs">
            <button class="tab-btn active" data-tab="urban">${urbanTitle}</button>
            <button class="tab-btn" data-tab="suburban">${suburbanTitle}</button>
        </div>
        <div class="lines-content">
    `;

    // Fetch line ownership data
    fetch('data/line_company_ownership.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const urbanLines = [];
            const suburbanLines = [];

            // Process urban lines from line_company_ownership.json
            data.urban.forEach(company => {
                company.lines.forEach(line => {
                    urbanLines.push({
                        lineId: line.lineId,
                        lineName: line.lineName,
                        companyName: company.companyName,
                        group: line.group
                    });
                });
            });

            // Process suburban lines from line_company_ownership.json
            data.suburban.forEach(company => {
                company.lines.forEach(line => {
                    suburbanLines.push({
                        lineId: line.lineId.replace('suburban_', ''),
                        lineName: line.lineName,
                        companyName: company.companyName,
                        group: line.group
                    });
                });
            });

            // Sort lines by ID
            urbanLines.sort(sortLinesByID);
            suburbanLines.sort(sortLinesByID);

            // Generate HTML for urban lines
            html += `<div class="tab-content active" id="urban-lines">`;
            urbanLines.forEach(line => {
                const lineColor = getCompanyClass(line.companyName);

                html += `
                    <div class="line-card ${lineColor}" data-line-id="${line.lineId}">
                        <div class="line-header">
                            <div class="line-info">
                                <span class="line-id">${line.lineId}</span>
                                <span class="line-name">${line.lineName[lang]}</span>
                            </div>
                            <div class="line-buttons">
                                <button class="details-btn" data-line-id="${line.lineId}">
                                    <i class="fas fa-info-circle"></i> ${detailsLabel}
                                </button>
                                <button class="timetable-btn" data-line-id="${line.lineId}" onclick="scrollToTimetable('${line.lineId}')">
                                    <i class="fas fa-clock"></i> ${viewTimetableLabel}
                                </button>
                            </div>
                        </div>
                        <div class="line-details" id="details-${line.lineId}">
                            <p><strong>${operatorLabel}:</strong> ${line.companyName}</p>
                            <p><strong>Group:</strong> ${line.group}</p>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;

            // Generate HTML for suburban lines
            html += `<div class="tab-content" id="suburban-lines">`;
            suburbanLines.forEach(line => {
                const lineColor = getCompanyClass(line.companyName);

                html += `
                    <div class="line-card ${lineColor}" data-line-id="${line.lineId}">
                        <div class="line-header">
                            <div class="line-info">
                                <span class="line-id">${line.lineId}</span>
                                <span class="line-name">${line.lineName[lang]}</span>
                            </div>
                            <div class="line-buttons">
                                <button class="details-btn" data-line-id="${line.lineId}">
                                    <i class="fas fa-info-circle"></i> ${detailsLabel}
                                </button>
                            </div>
                        </div>
                        <div class="line-details" id="details-${line.lineId}">
                            <p><strong>${operatorLabel}:</strong> ${line.companyName}</p>
                            <p><strong>Group:</strong> ${line.group}</p>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;

            html += `</div>`; // Close lines-content div

            // Set the HTML content
            simplifiedContainer.innerHTML = html;

            // Add event listeners for tabs
            simplifiedContainer.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    // Update active tab button
                    simplifiedContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                    this.classList.add('active');

                    // Show the selected tab content
                    const tabId = this.getAttribute('data-tab');
                    simplifiedContainer.querySelectorAll('.tab-content').forEach(content => {
                        content.classList.remove('active');
                    });
                    simplifiedContainer.querySelector(`#${tabId}-lines`).classList.add('active');
                });
            });

            // Add event listeners for detail buttons
            simplifiedContainer.querySelectorAll('.details-btn').forEach(btn => {
                btn.addEventListener('click', function () {
                    const lineId = this.getAttribute('data-line-id');
                    const detailsElement = document.getElementById(`details-${lineId}`);

                    if (detailsElement.style.display === 'block') {
                        detailsElement.style.display = 'none';
                    } else {
                        detailsElement.style.display = 'block';
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error loading line data:', error);
            const errorMessage = translations[currentLang]?.ui?.error || 'Failed to load line data. Please try again later.';
            simplifiedContainer.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="loadLines()">
                        ${translations[currentLang]?.ui?.retry || 'Retry'}
                    </button>
                </div>
            `;
        });
}

// Function to get company class name for styling
function getCompanyClass(companyName) {
    if (companyName.includes('AUTOPREVOZ')) return 'autoprevoz-line';
    if (companyName.includes('PAVLOVIĆ')) return 'pavlovic-line';
    if (companyName.includes('BOČAC')) return 'bocac-line';
    if (companyName.includes('ALDEMO')) return 'aldemo-line';
    if (companyName.includes('RALE')) return 'rale-line';
    return '';
}

// Function to scroll to timetable and select a line
function scrollToTimetable(lineId) {
    const lineSelect = document.getElementById('line-select');
    if (lineSelect) {
        lineSelect.value = lineId;
        // Trigger change event to load the timetable
        const event = new Event('change');
        lineSelect.dispatchEvent(event);
    }

    // Scroll to the timetable section
    const timetableSection = document.getElementById('timetable');
    if (timetableSection) {
        timetableSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Load prices data
function loadPrices() {
    fetch('data/prices.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            prices = data;
            renderPriceTables();

            // Register an event listener for language changes to update price tables
            if (!window._priceTablesLanguageListenerAdded) {
                document.addEventListener('languageChanged', () => {
                    renderPriceTables();
                });
                window._priceTablesLanguageListenerAdded = true;
            }
        })
        .catch(error => {
            console.error('Error loading price data:', error);
            const priceTablesContainer = document.querySelector('#price-tables .price-tables');
            if (priceTablesContainer) {
                const errorMessage = translations[currentLang]?.ui?.error || 'Failed to load price data. Please try again later.';
                priceTablesContainer.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${errorMessage}</p>
                        <button class="retry-btn" onclick="loadPrices()">
                            ${translations[currentLang]?.ui?.retry || 'Retry'}
                        </button>
                    </div>
                `;
            }
        });
}

// Render price tables
function renderPriceTables() {
    if (!prices || !prices[currentLang]) return;

    const priceTablesContainer = document.querySelector('#price-tables .price-tables');
    if (!priceTablesContainer) return;

    priceTablesContainer.innerHTML = '';

    const priceData = prices[currentLang];
    const labels = priceData.labels;

    // Create a single price table container
    const priceTableContainer = document.createElement('div');
    priceTableContainer.className = 'price-table-container';

    // Build a single table with all price information
    let tableHtml = `
        <table class="unified-price-table">
            <thead>
                <tr>
                    <th>${labels.ticketTypes}</th>
                    <th>${labels.price} (${labels.km})</th>
                </tr>
            </thead>
            <tbody>
                <!-- Single and Daily Tickets Section -->
                <tr class="category-header">
                    <td colspan="2">${currentLang === 'bhs' ? 'Pojedinačne i dnevne karte' : 'Single and Daily Tickets'}</td>
                </tr>
                <tr>
                    <td>
                        ${priceData.ticketTypes.single.name}
                        <div class="description">${priceData.ticketTypes.single.description}</div>
                    </td>
                    <td>${priceData.ticketTypes.single.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>
                        ${priceData.ticketTypes.singleInSet.name}
                        <div class="description">${priceData.ticketTypes.singleInSet.description}</div>
                    </td>
                    <td>${priceData.ticketTypes.singleInSet.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>
                        ${priceData.ticketTypes.daily.name}
                        <div class="description">${priceData.ticketTypes.daily.description}</div>
                    </td>
                    <td>${priceData.ticketTypes.daily.price.toFixed(2)}</td>
                </tr>

                <!-- Monthly Group Tickets Section -->
                <tr class="category-header">
                    <td colspan="2">${priceData.ticketTypes.monthlyGroup.name}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyGroup.workers.name}</td>
                    <td>${priceData.ticketTypes.monthlyGroup.workers.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyGroup.students.name}</td>
                    <td>${priceData.ticketTypes.monthlyGroup.students.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyGroup.pensioners.name}</td>
                    <td>${priceData.ticketTypes.monthlyGroup.pensioners.price.toFixed(2)}</td>
                </tr>

                <!-- Unified Monthly Tickets Section -->
                <tr class="category-header">
                    <td colspan="2">${priceData.ticketTypes.monthlyUnified.name}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyUnified.workers.name}</td>
                    <td>${priceData.ticketTypes.monthlyUnified.workers.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyUnified.students.name}</td>
                    <td>${priceData.ticketTypes.monthlyUnified.students.price.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>${priceData.ticketTypes.monthlyUnified.pensioners.name}</td>
                    <td>${priceData.ticketTypes.monthlyUnified.pensioners.price.toFixed(2)}</td>
                </tr>
            </tbody>
        </table>
    `;

    // Add disclaimer
    const disclaimerText = currentLang === 'bhs'
        ? `<p class="price-disclaimer">Prikazane cijene su informativnog karaktera. Za tačne i ažurirane cijene, kao i za cijene prigradskih linija, molimo posjetite <a href="https://www.banjaluka.rs.ba/gradjani/saobracaj/javni-prevoz/" target="_blank">zvaničnu internet stranicu Grada Banja Luka</a> ili se obratite na prodajnim mjestima prevoznika.</p>`
        : `<p class="price-disclaimer">Displayed prices are for informational purposes only. For current and updated prices, as well as suburban line prices, please visit the <a href="https://www.banjaluka.rs.ba/gradjani/saobracaj/javni-prevoz/" target="_blank">official City of Banja Luka website</a> or inquire at operator's sales points.</p>`;

    tableHtml += disclaimerText;

    priceTableContainer.innerHTML = tableHtml;
    priceTablesContainer.appendChild(priceTableContainer);

    // Add CSS for the table if not already added
    if (!document.getElementById('price-table-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'price-table-styles';
        styleElement.textContent = `
            .unified-price-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                border-radius: 8px;
                overflow: hidden;
            }
            
            .unified-price-table th {
                background-color: #2c3e50;
                color: white;
                padding: 12px 15px;
                text-align: left;
                font-weight: 600;
            }
            
            .unified-price-table td {
                padding: 12px 15px;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .unified-price-table tr:last-child td {
                border-bottom: none;
            }
            
            .unified-price-table tr:hover {
                background-color: #f5f5f5;
            }
            
            .category-header {
                background-color: #ecf0f1;
                font-weight: bold;
            }
            
            .description {
                font-size: 0.9em;
                color: #7f8c8d;
                margin-top: 4px;
            }
            
            #price-tables-title {
                margin-bottom: 20px;
                color: #2c3e50;
                border-bottom: 2px solid #3498db;
                padding-bottom: 10px;
            }
            
            .price-table-container {
                background-color: white;
                border-radius: 8px;
                overflow: hidden;
                max-width: 800px;
                margin: 0 auto;
            }
            
            .price-disclaimer {
                margin-top: 20px;
                padding: 15px;
                background-color: #f8f9fa;
                border-left: 4px solid rgb(250, 0, 0);
                color: #555;
                font-size: 0.9em;
                line-height: 1.5;
                border-radius: 0 4px 4px 0;
            }
            
            .price-disclaimer a {
                color: #3498db;
                text-decoration: none;
                font-weight: 500;
            }
            
            .price-disclaimer a:hover {
                text-decoration: underline;
            }
            
            @media (max-width: 600px) {
                .unified-price-table th, 
                .unified-price-table td {
                    padding: 10px;
                }
                
                .description {
                    font-size: 0.8em;
                }
                
                .price-disclaimer {
                    font-size: 0.85em;
                    padding: 12px;
                }
            }
        `;
        document.head.appendChild(styleElement);
    }
}

// Setup timetable selection
function setupTimetableSelection() {
    const lineSelect = document.getElementById('line-select');
    const timetableDisplay = document.getElementById('timetable-display');

    // First load the real timetable data
    fetch('data/timetables.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(timetableData => {
            // Store timetable data globally for later use
            window._realTimetableData = timetableData;

            // Update the dropdown with the timetable data
            updateTimetableSelect(null, lineSelect, timetableData);

            // Add change event listener
            lineSelect.addEventListener('change', function () {
                if (this.value) {
                    loadTimetable(this.value);
                } else {
                    timetableDisplay.innerHTML = `<p>${translations[currentLang]?.sections?.timetable?.select || 'Please select a bus line to view its timetable.'}</p>`;
                }
            });

            // Add event listener for language changes if not already added
            if (!window._timetableLanguageListenerAdded) {
                document.addEventListener('languageChanged', () => {
                    // Update timetable dropdown with new language
                    if (window._realTimetableData) {
                        updateTimetableSelect(null, lineSelect, window._realTimetableData);
                    }

                    // Also update the timetable if one is selected
                    if (lineSelect.value) {
                        loadTimetable(lineSelect.value);
                    }
                });
                window._timetableLanguageListenerAdded = true;
            }

            // Initialize with first real timetable if available or restore previously selected line
            const savedLine = sessionStorage.getItem('selectedLine');
            if (savedLine) {
                lineSelect.value = savedLine;
                loadTimetable(savedLine);
                sessionStorage.removeItem('selectedLine'); // Clear after use
            } else if (timetableData && timetableData.length > 0) {
                lineSelect.value = timetableData[0].lineId;
                loadTimetable(timetableData[0].lineId);
            }
        })
        .catch(error => {
            console.error('Error loading real timetable data:', error);
            const errorMessage = translations[currentLang]?.ui?.error || 'Failed to load timetable data. Please try again later.';
            timetableDisplay.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="setupTimetableSelection()">
                        ${translations[currentLang]?.ui?.retry || 'Retry'}
                    </button>
                </div>
            `;
        });
}

// Update timetable select dropdown with language support
function updateTimetableSelect(data, lineSelect, realTimetableData) {
    // Add default option
    const selectPrompt = translations[currentLang]?.sections?.timetable?.select || 'Select a bus line';
    lineSelect.innerHTML = `<option value="">${selectPrompt}</option>`;

    // Check if we're working with real timetable data or line ownership data
    // Add real lines from timetables.json
    if (realTimetableData && realTimetableData.length > 0) {
        // Separate urban and suburban lines
        const urbanLines = [];
        const suburbanLines = [];

        realTimetableData.forEach(line => {
            // Check if it's a suburban line based on line ID patterns
            if (line.lineId.match(/^(42|26|32|37|7A|40|45|41|18A|34|28|12B|12|PT1|5A|16A|AT1|AT2|AT3|AT4|ZK1|ZB1|PK1|SBJ1|DNK1|RM1|BK1)$/)) {
                suburbanLines.push(line);
            } else {
                urbanLines.push(line);
            }
        });

        // Sort lines by line number
        urbanLines.sort(sortLinesByID);
        suburbanLines.sort(sortLinesByID);

        // Add optgroup for urban lines
        if (urbanLines.length > 0) {
            const urbanOptgroup = document.createElement('optgroup');
            urbanOptgroup.label = currentLang === 'bhs' ? 'Gradske linije' : 'Urban Lines';

            urbanLines.forEach(line => {
                const option = document.createElement('option');
                option.value = line.lineId;
                option.textContent = `${line.lineName[currentLang] || line.lineName.en}`;
                urbanOptgroup.appendChild(option);
            });

            lineSelect.appendChild(urbanOptgroup);
        }

        // Add optgroup for suburban lines
        if (suburbanLines.length > 0) {
            const suburbanOptgroup = document.createElement('optgroup');
            suburbanOptgroup.label = currentLang === 'bhs' ? 'Prigradske linije' : 'Suburban Lines';

            suburbanLines.forEach(line => {
                const option = document.createElement('option');
                option.value = line.lineId;
                option.textContent = `${line.lineName[currentLang] || line.lineName.en}`;
                suburbanOptgroup.appendChild(option);
            });

            lineSelect.appendChild(suburbanOptgroup);
        }
    }
}

// Load timetable for selected line
function loadTimetable(lineId) {
    const timetableDisplay = document.getElementById('timetable-display');
    timetableDisplay.innerHTML = `<p>${translations[currentLang]?.sections?.timetable?.loading || 'Loading timetable...'}</p>`;

    // Check if we have real timetable data stored
    if (window._realTimetableData) {
        const timetable = window._realTimetableData.find(t => t.lineId === lineId);

        if (timetable) {
            renderTimetable(timetable, timetableDisplay);
            return;
        }
    }

    // Otherwise, fetch timetables.json
    fetch('data/timetables.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Store for future use
            window._realTimetableData = data;

            const timetable = data.find(t => t.lineId === lineId);

            if (timetable) {
                renderTimetable(timetable, timetableDisplay);
            } else {
                timetableDisplay.innerHTML = `<p>${translations[currentLang]?.sections?.timetable?.notFound || 'Timetable not found for the selected line.'}</p>`;
            }
        })
        .catch(error => {
            console.error('Error loading timetable:', error);
            const errorMessage = translations[currentLang]?.ui?.error || 'Failed to load timetable data. Please try again later.';
            timetableDisplay.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="loadTimetable('${lineId}')">
                        ${translations[currentLang]?.ui?.retry || 'Retry'}
                    </button>
                </div>
            `;
        });
}

// Render timetable with language support
function renderTimetable(timetable, container) {
    const t = translations[currentLang]?.sections?.timetable;
    const weekdayLabel = t?.days?.weekday || 'Weekdays';
    const saturdayLabel = t?.days?.saturday || 'Saturday';
    const sundayLabel = t?.days?.sunday || 'Sunday';
    const directionLabel = t?.direction || 'Direction:';
    const fromToLabel = t?.fromTo || 'From - To:';
    const selectDayLabel = t?.selectDay || (currentLang === 'bhs' ? 'Izaberite dan' : 'Select day');
    const hourLabel = t?.hourLabel || (currentLang === 'bhs' ? 'Sat' : 'Hour');
    const minutesLabel = t?.minutesLabel || (currentLang === 'bhs' ? 'Minute' : 'Minutes');

    // Create direction IDs based on lineId
    const directionAId = timetable.lineId + 'a';
    const directionBId = timetable.lineId + 'b';

    // Create timetable HTML
    let html = `
        <h3 class="timetable-line-name">${timetable.lineName[currentLang]}</h3>
        
        <div class="timetable-controls">
            <div class="direction-toggle">
                <p id="direction-label">${fromToLabel}</p>
                <div class="direction-buttons" role="group" aria-labelledby="direction-label">
                    <button class="direction-btn active" data-direction="${directionAId}" aria-pressed="true" aria-label="${timetable.directions[currentLang][0]}">${timetable.directions[currentLang][0]}</button>
                    <button class="direction-btn" data-direction="${directionBId}" aria-pressed="false" aria-label="${timetable.directions[currentLang][1]}">${timetable.directions[currentLang][1]}</button>
                </div>
            </div>
            
            <div class="day-toggle">
                <p id="day-label" class="visually-hidden">${selectDayLabel}</p>
                <div role="group" aria-labelledby="day-label">
                    <button class="day-btn active" data-day="weekday" aria-pressed="true" aria-label="${weekdayLabel}">${weekdayLabel}</button>
                    <button class="day-btn" data-day="saturday" aria-pressed="false" aria-label="${saturdayLabel}">${saturdayLabel}</button>
                    <button class="day-btn" data-day="sunday" aria-pressed="false" aria-label="${sundayLabel}">${sundayLabel}</button>
                </div>
            </div>
        </div>
    `;

    // Add notes section if notes exist
    if (timetable.notes && timetable.notes[currentLang]) {
        html += `
            <div class="timetable-notes">
                <div class="notes-icon">
                    <i class="fas fa-info-circle"></i>
                </div>
                <div class="notes-content">
                    <strong>${currentLang === 'bhs' ? 'Napomene:' : 'Notes:'}</strong>
                    <p>${timetable.notes[currentLang]}</p>
                </div>
            </div>
        `;
    }

    html += `<div class="timetable-container">`;

    // Create tables for each day type and direction
    const dayTypes = ['weekday', 'saturday', 'sunday'];
    const directions = [directionAId, directionBId];

    // Generate all possible combinations of day/direction tables, but hide the inactive ones
    dayTypes.forEach((dayType, dayIndex) => {
        directions.forEach((direction, dirIndex) => {
            const isActive = dayIndex === 0 && dirIndex === 0 ? '' : 'style="display: none;"';
            const tableId = `timetable-${dayType}-${direction}`;

            html += `
                <div class="timetable-view" id="${tableId}" ${isActive}>
                    <table class="hours-minutes-table">
                        <thead>
                            <tr>
                                <th>${hourLabel}</th>
                                <th>${minutesLabel}</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            // Process departure times for this day type and direction
            // Collect all departure times from all stations
            let allDepartures = [];

            timetable.stations.forEach(station => {
                const directionIndex = dirIndex; // 0 for directionA, 1 for directionB
                const stationTimes = station.times[dayType][directionIndex];
                stationTimes.forEach(time => {
                    allDepartures.push(time);
                });
            });

            // Remove duplicates and sort
            allDepartures = [...new Set(allDepartures)].sort();

            // Group by hour
            const departuresByHour = {};
            allDepartures.forEach(time => {
                const [hour, minute] = time.split(':');
                if (!departuresByHour[hour]) {
                    departuresByHour[hour] = [];
                }
                departuresByHour[hour].push(minute);
            });

            // Get current time info for highlighting
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            // First pass: Find the very next departure time
            let nextDepartureHour = null;
            let nextDepartureMinute = null;

            // Check each hour in chronological order
            Object.keys(departuresByHour).sort().forEach(hour => {
                const hourValue = parseInt(hour);
                if (nextDepartureHour !== null) return; // Already found next departure

                // If this hour is in the future, first minute is next departure
                if (hourValue > currentHour) {
                    nextDepartureHour = hourValue;
                    nextDepartureMinute = Math.min(...departuresByHour[hour].map(m => parseInt(m)));
                    return;
                }

                // If this is the current hour, check each minute
                if (hourValue === currentHour) {
                    // Get minutes in ascending order
                    const sortedMinutes = departuresByHour[hour].map(m => parseInt(m)).sort((a, b) => a - b);

                    // Find first minute that is >= current minute
                    for (const minute of sortedMinutes) {
                        if (minute >= currentMinute) {
                            nextDepartureHour = hourValue;
                            nextDepartureMinute = minute;
                            break;
                        }
                    }
                }
            });

            // Create rows for each hour
            Object.keys(departuresByHour).sort().forEach(hour => {
                const minutes = departuresByHour[hour].sort((a, b) => parseInt(a) - parseInt(b));
                const hourValue = parseInt(hour);

                html += `
                    <tr>
                        <td class="hour-cell">${hour}</td>
                        <td class="minutes-cell">
                `;

                // Create styled boxes for minutes
                minutes.forEach(minute => {
                    const minuteValue = parseInt(minute);
                    let timeClass = '';

                    // Determine status of this departure time
                    if (hourValue < currentHour || (hourValue === currentHour && minuteValue < currentMinute)) {
                        // Past departure
                        timeClass = 'past';
                    } else if (hourValue === nextDepartureHour && minuteValue === nextDepartureMinute) {
                        // The very next departure
                        timeClass = 'next';
                    } else {
                        // All other future departures
                        timeClass = 'upcoming';
                    }

                    html += `<span class="minute-box ${timeClass}">${minute}</span>`;
                });

                html += `
                        </td>
                    </tr>
                `;
            });

            html += `
                        </tbody>
                    </table>
                </div>
            `;
        });
    });

    html += `</div>`; // Close timetable-container

    // Render the timetable
    container.innerHTML = html;

    // Add styles for the timetable if not already added
    if (!document.getElementById('timetable-styles')) {
        const styleElement = document.createElement('style');
        styleElement.id = 'timetable-styles';
        styleElement.textContent = `
            .timetable-line-name {
                margin-bottom: 15px;
                color: #2c3e50;
                font-size: 20px;
            }
            
            .timetable-controls {
                display: flex;
                flex-direction: column;
                gap: 20px;
                margin-bottom: 25px;
                max-width: 100%;
            }
            
            .direction-toggle, .day-toggle {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .direction-toggle p {
                margin: 0;
                font-weight: 600;
                color: #555;
                font-size: 14px;
            }
            
            .direction-buttons, .day-toggle > div {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            
            .direction-btn, .day-btn {
                padding: 10px 16px;
                border: 2px solid #e1e8ed;
                background-color: #ffffff;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
                color: #2c3e50;
                min-width: 100px;
                text-align: center;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                position: relative;
                overflow: hidden;
            }
            
            .direction-btn:hover, .day-btn:hover {
                border-color: #3498db;
                background-color: #f8fbff;
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(52, 152, 219, 0.15);
            }
            
            .direction-btn.active, .day-btn.active {
                background-color: #3498db;
                color: white;
                border-color: #3498db;
                box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
                transform: translateY(-1px);
            }
            
            .direction-btn.active:hover, .day-btn.active:hover {
                background-color: #2980b9;
                border-color: #2980b9;
            }
            
            .visually-hidden {
                position: absolute;
                width: 1px;
                height: 1px;
                margin: -1px;
                padding: 0;
                overflow: hidden;
                clip: rect(0, 0, 0, 0);
                border: 0;
            }
            
            /* Adjust day toggle to match direction toggle layout */
            .day-toggle > div {
                display: flex;
                gap: 8px;
            }
            
            .timetable-notes {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 6px;
                padding: 15px;
                margin-bottom: 20px;
                font-size: 14px;
                line-height: 1.5;
            }
            
            .notes-icon {
                color: #856404;
                font-size: 16px;
                margin-top: 2px;
                flex-shrink: 0;
            }
            
            .notes-content {
                flex: 1;
            }
            
            .notes-content strong {
                color: #856404;
                display: block;
                margin-bottom: 5px;
            }
            
            .notes-content p {
                margin: 0;
                color: #6c5700;
            }
            
            @media (min-width: 768px) {
                .timetable-controls {
                    flex-direction: column;
                    max-width: 100%;
                }
            }
            
            .hours-minutes-table {
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
                border-collapse: collapse;
                box-shadow: 0 1px 4px rgba(0,0,0,0.1);
                border-radius: 6px;
                overflow: hidden;
                font-size: 14px;
            }
            
            .hours-minutes-table th {
                background-color: #2c3e50;
                color: white;
                padding: 8px 10px;
                text-align: left;
                font-size: 14px;
            }
            
            .hours-minutes-table td {
                padding: 6px 10px;
                border-bottom: 1px solid #eee;
            }
            
            .hours-minutes-table tr:last-child td {
                border-bottom: none;
            }
            
            .hour-cell {
                font-weight: 600;
                color: #ffffff;
                font-size: 14px;
                width: 50px;
                background-color: #34495e;
                text-align: center;
                border-radius: 4px;
                padding: 4px 6px;
                box-shadow: 0 1px 3px rgba(52, 73, 94, 0.3);
                position: relative;
                vertical-align: middle;
            }
            
            .hour-cell::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 2px;
                background-color: #3498db;
                border-radius: 4px 0 0 4px;
            }
            
            .minutes-cell {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
                align-items: center;
            }
            
            .minute-box {
                display: inline-block;
                padding: 3px 6px;
                background-color: #f1f8ff;
                border-radius: 3px;
                font-size: 13px;
                color: #333;
                border-bottom: 2px solid #3498db;
                font-weight: 500;
            }
            
            /* Added styles for past and next departures */
            .minute-box.past {
                background-color: #f5f5f5;
                color: #999;
                border-bottom: 2px solid #ccc;
            }
            
            .minute-box.next {
                background-color: #d4edda;
                color: #155724;
                border-bottom: 2px solid #28a745;
                font-weight: bold;
            }
            
            .minute-box.upcoming {
                background-color: #f1f8ff;
                color: #333;
                border-bottom: 2px solid #3498db;
            }
            
            /* Optimize number of minutes per row for better use of space */
            @media (min-width: 768px) {
                .timetable-container {
                    max-width: 850px;
                    margin: 0 auto;
                }
                
                .hours-minutes-table {
                    max-width: 750px;
                }
                
                .minutes-cell {
                    max-width: calc(100% - 50px);
                }
                
                .timetable-controls {
                    flex-direction: row;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 30px;
                    flex-wrap: wrap;
                }
                
                .direction-toggle, .day-toggle {
                    flex: 1;
                    min-width: 250px;
                }
                
                .direction-buttons, .day-toggle > div {
                    justify-content: flex-start;
                }
                
                .direction-btn, .day-btn {
                    min-width: 120px;
                    padding: 12px 20px;
                    font-size: 15px;
                }
            }
            
            @media (min-width: 1024px) {
                .timetable-container {
                    max-width: 900px;
                }
                
                .hours-minutes-table {
                    max-width: 800px;
                }
                
                .timetable-controls {
                    max-width: 800px;
                    margin: 0 auto 30px auto;
                }
                
                .direction-toggle, .day-toggle {
                    flex: 0 1 auto;
                    min-width: 300px;
                }
                
                .direction-btn, .day-btn {
                    min-width: 140px;
                    padding: 14px 24px;
                    font-size: 16px;
                }
            }
            
            @media (min-width: 1200px) {
                .timetable-container {
                    max-width: 950px;
                }
                
                .hours-minutes-table {
                    max-width: 850px;
                }
                
                .timetable-controls {
                    max-width: 900px;
                    gap: 40px;
                }
                
                .direction-btn, .day-btn {
                    min-width: 160px;
                    padding: 16px 28px;
                    font-size: 16px;
                    border-radius: 10px;
                }
            }
            
            @media (max-width: 767px) {
                .timetable-controls {
                    flex-direction: column;
                    gap: 15px;
                    margin-bottom: 20px;
                }
                
                .direction-toggle, .day-toggle {
                    gap: 8px;
                }
                
                .direction-btn, .day-btn {
                    min-width: 90px;
                    padding: 8px 12px;
                    font-size: 13px;
                    border-radius: 6px;
                }
                
                .hour-cell {
                    width: 45px;
                    font-size: 13px;
                    padding: 3px 4px;
                }
                
                .minute-box {
                    padding: 2px 5px;
                    font-size: 12px;
                }
                
                .timetable-notes {
                    padding: 12px;
                    font-size: 13px;
                }
                
                .notes-icon {
                    font-size: 14px;
                }
            }
        `;
        document.head.appendChild(styleElement);
    }

    // Add event listeners for direction toggle
    document.querySelectorAll('.direction-btn').forEach(button => {
        button.addEventListener('click', function () {
            // Update active direction button
            document.querySelectorAll('.direction-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            // Get current active day
            const activeDay = document.querySelector('.day-btn.active').getAttribute('data-day');
            const direction = this.getAttribute('data-direction');

            // Hide all timetable views
            document.querySelectorAll('.timetable-view').forEach(view => {
                view.style.display = 'none';
            });

            // Show the selected timetable view
            document.getElementById(`timetable-${activeDay}-${direction}`).style.display = 'block';

            // Update time highlighting for the new view
            updateTimeHighlighting();
        });
    });

    // Add event listeners for day toggle
    document.querySelectorAll('.day-btn').forEach(button => {
        button.addEventListener('click', function () {
            // Update active day button
            document.querySelectorAll('.day-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-pressed', 'true');

            // Get current active direction
            const activeDirection = document.querySelector('.direction-btn.active').getAttribute('data-direction');
            const day = this.getAttribute('data-day');

            // Hide all timetable views
            document.querySelectorAll('.timetable-view').forEach(view => {
                view.style.display = 'none';
            });

            // Show the selected timetable view
            document.getElementById(`timetable-${day}-${activeDirection}`).style.display = 'block';

            // Update time highlighting for the new view
            updateTimeHighlighting();
        });
    });

    // Setup automatic time highlighting
    setupTimeHighlighting();
}

// Setup time highlighting
function setupTimeHighlighting() {
    // Clear any existing interval
    if (window.timeHighlightInterval) {
        clearInterval(window.timeHighlightInterval);
    }

    // Update immediately
    updateTimeHighlighting();

    // Then update every minute
    window.timeHighlightInterval = setInterval(updateTimeHighlighting, 60000);
}

// Global function to update time highlighting
function updateTimeHighlighting() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Get all visible timetable views
    let visibleTimetableViews = document.querySelectorAll('.timetable-view:not([style*="display: none"])');

    // Fallback: if no visible views found, try to find any timetable view that's not explicitly hidden
    if (visibleTimetableViews.length === 0) {
        visibleTimetableViews = document.querySelectorAll('.timetable-view');

        // Filter to find the actually visible one
        visibleTimetableViews = Array.from(visibleTimetableViews).filter(view => {
            const style = window.getComputedStyle(view);
            return style.display !== 'none';
        });
    }

    visibleTimetableViews.forEach(tableView => {
        // First pass: collect all times and find the next one
        let allDepartureTimes = [];

        tableView.querySelectorAll('tbody tr').forEach(row => {
            const hourCell = row.querySelector('.hour-cell');
            if (!hourCell) return;

            const hourValue = parseInt(hourCell.textContent);
            if (isNaN(hourValue)) return;

            row.querySelectorAll('.minute-box').forEach(minuteBox => {
                const minuteValue = parseInt(minuteBox.textContent);
                if (isNaN(minuteValue)) return;

                const timeInMinutes = hourValue * 60 + minuteValue;
                allDepartureTimes.push({
                    hour: hourValue,
                    minute: minuteValue,
                    timeInMinutes: timeInMinutes,
                    element: minuteBox
                });
            });
        });

        // Sort by time
        allDepartureTimes.sort((a, b) => a.timeInMinutes - b.timeInMinutes);

        // Find the next departure time (first departure that is current time or later)
        let nextDepartureTime = null;
        for (const time of allDepartureTimes) {
            if (time.timeInMinutes >= currentTimeInMinutes) {
                nextDepartureTime = time;
                break;
            }
        }

        // If no departure found for today, the next departure is the first one tomorrow
        if (!nextDepartureTime && allDepartureTimes.length > 0) {
            nextDepartureTime = allDepartureTimes[0];

        }

        // Second pass: mark all times with appropriate classes
        let pastCount = 0, nextCount = 0, upcomingCount = 0;

        // Check if next departure is tomorrow (all today's departures are past)
        const isNextDepartureTomorrow = nextDepartureTime &&
            allDepartureTimes.every(time => time.timeInMinutes < currentTimeInMinutes);



        allDepartureTimes.forEach(time => {
            // Remove existing classes
            time.element.classList.remove('past', 'next', 'upcoming');

            // Determine status of this departure time
            if (time.timeInMinutes < currentTimeInMinutes) {
                if (isNextDepartureTomorrow && nextDepartureTime &&
                    time.timeInMinutes === nextDepartureTime.timeInMinutes) {
                    // This is the next departure (tomorrow)
                    time.element.classList.add('next');
                    nextCount++;
                } else if (isNextDepartureTomorrow) {
                    // All other departures when next is tomorrow are upcoming (for tomorrow)
                    time.element.classList.add('upcoming');
                    upcomingCount++;
                } else {
                    // Past departure (normal case)
                    time.element.classList.add('past');
                    pastCount++;
                }
            } else if (nextDepartureTime && time.timeInMinutes === nextDepartureTime.timeInMinutes) {
                // The very next departure (today)
                time.element.classList.add('next');
                nextCount++;
            } else {
                // All other future departures (today)
                time.element.classList.add('upcoming');
                upcomingCount++;
            }
        });


    });
}



// Update timetable language if it's already displayed
function updateTimetableLanguage() {
    const timetableDisplay = document.getElementById('timetable-display');
    const lineSelect = document.getElementById('line-select');

    // Check if the timetable is already displayed using any of the possible indicators
    if (timetableDisplay.querySelector('.hours-minutes-table') ||
        timetableDisplay.querySelector('.timetable-table') ||
        timetableDisplay.querySelector('.no-timetable') ||
        timetableDisplay.querySelector('.timetable-view')) {
        if (lineSelect.value) {
            loadTimetable(lineSelect.value);
        }
    }
}

// Setup smooth scrolling for navigation links
function setupSmoothScrolling() {
    // Handle both mobile nav and desktop nav
    document.querySelectorAll('nav a, .nav-desktop a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Get header height to offset scrolling
                const headerHeight = document.querySelector('header').offsetHeight;

                // For mobile view, add extra offset for the map section
                if (targetId === '#map' && window.innerWidth <= 768) {
                    window.scrollTo({
                        top: targetElement.offsetTop - headerHeight - 20, // Add header height offset
                        behavior: 'smooth'
                    });
                } else {
                    window.scrollTo({
                        top: targetElement.offsetTop - headerHeight, // Add header height offset
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
}



// Load and display contacts information
function loadContacts() {
    fetch('data/contacts.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            displayContacts(data);
        })
        .catch(error => {
            console.error('Error loading contacts:', error);
            const contactSection = document.getElementById('contact');
            const errorMessage = translations[currentLang]?.ui?.error || 'Failed to load contact data. Please try again later.';
            contactSection.innerHTML = `
                <h2 id="contact-title">${translations[currentLang]?.sections?.contact?.title || 'Contact Information'}</h2>
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="loadContacts()">
                        ${translations[currentLang]?.ui?.retry || 'Retry'}
                    </button>
                </div>
            `;
        });
}

// Display contacts in contact cards
function displayContacts(data) {
    const contactSection = document.getElementById('contact');
    if (!contactSection) return;

    // Create or get the contact cards container
    let contactCards = contactSection.querySelector('.contact-cards');
    if (!contactCards) {
        // Create container if it doesn't exist
        contactCards = document.createElement('div');
        contactCards.className = 'contact-cards';

        // Get the existing content
        const existingContent = contactSection.innerHTML;

        // Clear the section
        contactSection.innerHTML = '';

        // Add the title back (first h2 element)
        const titleMatch = existingContent.match(/<h2[^>]*>(.*?)<\/h2>/);
        if (titleMatch) {
            const titleElement = document.createElement('h2');
            titleElement.id = 'contact-title';
            titleElement.textContent = translations[currentLang]?.sections?.contact?.title || 'Contact Information';
            contactSection.appendChild(titleElement);
        }

        // Add the contact cards container
        contactSection.appendChild(contactCards);
    } else {
        // Just clear the cards container
        contactCards.innerHTML = '';
    }

    // Generate contact cards
    if (data.contacts && data.contacts.length > 0) {
        data.contacts.forEach(contact => {
            const card = document.createElement('div');
            card.className = 'contact-card';
            card.id = `contact-${contact.id}`;

            // Set card style with organization color
            if (contact.color) {
                card.style.borderLeftColor = contact.color;
            }

            // Get translated content
            const name = contact.name[currentLang] || contact.name.bhs;
            const department = contact.department[currentLang] || contact.department.bhs;
            const type = contact.type[currentLang] || contact.type.bhs;

            // Generate HTML for the card
            let cardContent = `
                <h3>${name}</h3>
                <p class="contact-department">${department}</p>
                <p class="contact-type">${type}</p>
            `;

            // Add phone if available
            if (contact.phoneDisplay) {
                cardContent += `<p class="contact-phone"><strong>${translations[currentLang]?.sections?.contact?.phone || 'Phone:'}</strong> ${contact.phoneDisplay}</p>`;
            }

            // Add website if available
            if (contact.website) {
                cardContent += `<p class="contact-website"><a href="${contact.website}" target="_blank">${translations[currentLang]?.ui?.visit || 'Visit website'}</a></p>`;
            }

            // Set the card content
            card.innerHTML = cardContent;
            contactCards.appendChild(card);
        });
    }
}

// Setup mobile menu
function setupMobileMenu() {
    const hamburger = document.getElementById('mobile-menu-toggle');
    if (hamburger) {
        hamburger.addEventListener('click', function () {
            document.body.classList.toggle('mobile-nav-active');
        });

        // Close menu when clicking on links
        document.querySelectorAll('nav a').forEach(link => {
            link.addEventListener('click', function () {
                document.body.classList.remove('mobile-nav-active');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function (event) {
            const nav = document.querySelector('nav');
            if (!hamburger.contains(event.target) && !nav.contains(event.target)) {
                document.body.classList.remove('mobile-nav-active');
            }
        });
    }
} 
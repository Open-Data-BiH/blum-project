import { FetchHelper } from '../../core/fetch-helper.js';
import { AppI18n } from '../../core/i18n.js';
import { escapeHTML, sanitizeURL } from '../../core/sanitize.js';

// ==========================================
// Contacts Feature Module
// Load, display, and render contact cards
// ==========================================

const loadContacts = async () => {
    const contactSection = document.getElementById('contact');
    if (!contactSection) {
        return;
    }

    try {
        const data = await FetchHelper.fetchJSON('data/transport/contacts.json');
        displayContacts(data);
    } catch (error) {
        console.error('Error loading contacts:', error);
        const section = document.getElementById('contact');
        const errorMessage =
            AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'ui', 'error') ||
            'Failed to load contact data. Please try again later.';
        const contactTitle =
            AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'sections', 'contact', 'title') ||
            'Contact Information';
        const retryText = AppI18n.safeGet(AppI18n.translations, AppI18n.currentLang, 'ui', 'retry') || 'Retry';
        section.innerHTML = `
            <h2 id="contact-title">${contactTitle}</h2>
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${errorMessage}</p>
                <button class="retry-btn" type="button">
                    ${retryText}
                </button>
            </div>
        `;
        section.querySelector('.retry-btn').addEventListener('click', loadContacts);
    }
};

function displayContacts(data) {
    const contactSection = document.getElementById('contact');
    if (!contactSection) {
        return;
    }

    let container = contactSection.querySelector('.container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'container';
        contactSection.appendChild(container);
    }

    const authorityContainer = container.querySelector('#authority-contacts');
    const operatorContainer = container.querySelector('#operator-contacts');

    if (!authorityContainer || !operatorContainer) {
        let contactCards = container.querySelector('.contact-cards');
        if (!contactCards) {
            contactCards = document.createElement('div');
            contactCards.className = 'contact-cards';
            container.appendChild(contactCards);
        } else {
            contactCards.innerHTML = '';
        }

        (data.contacts || []).forEach((contact) => {
            contactCards.appendChild(createContactCard(contact));
        });
        return;
    }

    authorityContainer.innerHTML = '';
    operatorContainer.innerHTML = '';

    const isAuthorityType = (contact) => {
        const typeBhs = AppI18n.safeGet(contact, 'type', 'bhs') || '';
        const typeEn = AppI18n.safeGet(contact, 'type', 'en') || '';
        return typeBhs === 'Gradska uprava' || typeEn === 'City Administration';
    };

    (data.contacts || []).forEach((contact) => {
        const card = createContactCard(contact);
        if (isAuthorityType(contact)) {
            authorityContainer.appendChild(card);
        } else {
            operatorContainer.appendChild(card);
        }
    });
}

function createContactCard(contact) {
    const card = document.createElement('div');
    card.className = 'contact-card';
    card.id = `contact-${contact.id}`;

    if (contact.color) {
        card.style.borderLeftColor = contact.color;
    }

    const lang = AppI18n.currentLang;
    const name = escapeHTML(contact.name[lang] || contact.name.bhs);
    const department = escapeHTML(contact.department[lang] || contact.department.bhs);
    const type = escapeHTML(contact.type[lang] || contact.type.bhs);

    let cardContent = `
        <h3>${name}</h3>
        <p class="contact-department">${department}</p>
        <p class="contact-type">${type}</p>
    `;

    if (contact.phoneDisplay) {
        const phoneLabel = AppI18n.safeGet(AppI18n.translations, lang, 'sections', 'contact', 'phone') || 'Phone:';
        cardContent += `<p class="contact-phone"><strong>${phoneLabel}</strong> ${escapeHTML(contact.phoneDisplay)}</p>`;
    }

    if (contact.email) {
        const emailLabel = AppI18n.safeGet(AppI18n.translations, lang, 'sections', 'contact', 'email') || 'Email:';
        const safeEmail = escapeHTML(contact.email);
        cardContent += `<p class="contact-email"><strong>${emailLabel}</strong> <a href="mailto:${sanitizeURL(contact.email)}">${safeEmail}</a></p>`;
    }

    if (contact.website) {
        const visitLabel = AppI18n.safeGet(AppI18n.translations, lang, 'ui', 'visit') || 'Visit website';
        cardContent += `<p class="contact-website"><a href="${sanitizeURL(contact.website)}" target="_blank" rel="noopener noreferrer">${visitLabel}</a></p>`;
    }

    card.innerHTML = cardContent;
    return card;
}

export { loadContacts };

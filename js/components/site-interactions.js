import { AppI18n } from '../core/i18n.js';

const setupSmoothScrolling = () => {
    document.querySelectorAll('.nav__link').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (!targetId.startsWith('#')) {
                return;
            }

            e.preventDefault();

            const targetElement = document.querySelector(targetId);
            if (!targetElement) {
                return;
            }

            const header = document.querySelector('header');
            const headerHeight = header ? header.offsetHeight : 0;
            const extraOffset = targetId === '#map' && window.innerWidth <= 768 ? 20 : 0;

            window.scrollTo({
                top: targetElement.offsetTop - headerHeight - extraOffset,
                behavior: 'smooth',
            });
        });
    });
};

const setupLinesInfoAccordion = () => {
    const toggle = document.getElementById('lines-info-toggle');
    const content = document.getElementById('lines-info-content');

    if (!toggle || !content) {
        return;
    }

    const updateContentLanguage = () => {
        const bhsElements = content.querySelectorAll('[data-lang="bhs"]');
        const enElements = content.querySelectorAll('[data-lang="en"]');

        bhsElements.forEach((el) => {
            el.style.display = AppI18n.currentLang === 'bhs' ? '' : 'none';
        });
        enElements.forEach((el) => {
            el.style.display = AppI18n.currentLang === 'en' ? '' : 'none';
        });

        const bhsToggleText = toggle.querySelector('[data-lang="bhs"]');
        const enToggleText = toggle.querySelector('[data-lang="en"]');
        if (bhsToggleText) {
            bhsToggleText.style.display = AppI18n.currentLang === 'bhs' ? '' : 'none';
        }
        if (enToggleText) {
            enToggleText.style.display = AppI18n.currentLang === 'en' ? '' : 'none';
        }
    };

    updateContentLanguage();

    toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', !isExpanded);
        content.hidden = isExpanded;

        if (!isExpanded) {
            updateContentLanguage();
        }
    });

    document.addEventListener('languageChanged', updateContentLanguage);
};

const setupMapCreditsDropdown = () => {
    const toggle = document.getElementById('map-credits-toggle');
    const content = document.getElementById('map-credits-content');

    if (!(toggle && content)) {
        return;
    }

    toggle.setAttribute('aria-expanded', 'false');
    content.classList.remove('open');

    function updateContentLanguage() {
        const bhsContent = content.querySelector('.map-context__content[data-lang="bhs"]');
        const enContent = content.querySelector('.map-context__content[data-lang="en"]');

        if (bhsContent && enContent) {
            if (AppI18n.currentLang === 'bhs') {
                bhsContent.style.display = '';
                enContent.style.display = 'none';
            } else {
                bhsContent.style.display = 'none';
                enContent.style.display = '';
            }
        }
    }

    updateContentLanguage();

    toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';

        if (isExpanded) {
            toggle.setAttribute('aria-expanded', 'false');
            content.classList.remove('open');
        } else {
            toggle.setAttribute('aria-expanded', 'true');
            content.classList.add('open');
            updateContentLanguage();
        }
    });

    document.addEventListener('click', (event) => {
        if (!toggle.contains(event.target) && !content.contains(event.target)) {
            toggle.setAttribute('aria-expanded', 'false');
            content.classList.remove('open');
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
            toggle.setAttribute('aria-expanded', 'false');
            content.classList.remove('open');
            toggle.focus();
        }
    });
};

export { setupSmoothScrolling, setupLinesInfoAccordion, setupMapCreditsDropdown };


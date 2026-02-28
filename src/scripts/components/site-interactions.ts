// Site interactions — ported from js/components/site-interactions.js
// Key change: AppI18n.currentLang → getCurrentLanguage() from i18n.ts

import { getCurrentLanguage } from '../core/i18n';

export const setupLinesInfoAccordion = (): void => {
    const toggle = document.getElementById('lines-info-toggle');
    const content = document.getElementById('lines-info-content');

    if (!toggle || !content) {
        return;
    }

    const updateContentLanguage = (): void => {
        const lang = getCurrentLanguage();
        content.querySelectorAll<HTMLElement>('[data-lang="bhs"]').forEach((el) => {
            el.style.display = lang === 'bhs' ? '' : 'none';
        });
        content.querySelectorAll<HTMLElement>('[data-lang="en"]').forEach((el) => {
            el.style.display = lang === 'en' ? '' : 'none';
        });

        const bhsToggleText = toggle.querySelector<HTMLElement>('[data-lang="bhs"]');
        const enToggleText = toggle.querySelector<HTMLElement>('[data-lang="en"]');
        if (bhsToggleText) {
            bhsToggleText.style.display = lang === 'bhs' ? '' : 'none';
        }
        if (enToggleText) {
            enToggleText.style.display = lang === 'en' ? '' : 'none';
        }
    };

    updateContentLanguage();

    toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!isExpanded));
        (content as HTMLElement & { hidden: boolean }).hidden = isExpanded;
        if (!isExpanded) {
            updateContentLanguage();
        }
    });

    document.addEventListener('languageChanged', updateContentLanguage);
};

export const setupMapCreditsDropdown = (): void => {
    const toggle = document.getElementById('map-credits-toggle');
    const content = document.getElementById('map-credits-content');

    if (!toggle || !content) {
        return;
    }

    toggle.setAttribute('aria-expanded', 'false');
    content.classList.remove('open');

    const updateContentLanguage = (): void => {
        const lang = getCurrentLanguage();
        const bhsContent = content.querySelector<HTMLElement>('.map-context__content[data-lang="bhs"]');
        const enContent = content.querySelector<HTMLElement>('.map-context__content[data-lang="en"]');

        if (bhsContent && enContent) {
            bhsContent.style.display = lang === 'bhs' ? '' : 'none';
            enContent.style.display = lang === 'en' ? '' : 'none';
        }
    };

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
        if (!toggle.contains(event.target as Node) && !content.contains(event.target as Node)) {
            toggle.setAttribute('aria-expanded', 'false');
            content.classList.remove('open');
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
            toggle.setAttribute('aria-expanded', 'false');
            content.classList.remove('open');
            (toggle as HTMLElement).focus();
        }
    });

    document.addEventListener('languageChanged', updateContentLanguage);
};

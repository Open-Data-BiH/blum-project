export const setupMapCreditsDropdown = (): void => {
    const toggle = document.getElementById('map-credits-toggle');
    const content = document.getElementById('map-credits-content');

    if (!toggle || !content) {
        return;
    }

    toggle.setAttribute('aria-expanded', 'false');
    content.classList.remove('open');

    toggle.addEventListener('click', () => {
        const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            toggle.setAttribute('aria-expanded', 'false');
            content.classList.remove('open');
        } else {
            toggle.setAttribute('aria-expanded', 'true');
            content.classList.add('open');
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
};

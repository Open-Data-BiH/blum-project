// FAQ accordion toggle — ported from js/features/faq/faq.js
// Static HTML is rendered at build time; this script only handles open/close interactions.

function toggleQuestion(questionButton: HTMLButtonElement): void {
    const faqItem = questionButton.closest<HTMLElement>('.faq-item');
    if (!faqItem) {
        return;
    }

    const answer = faqItem.querySelector<HTMLElement>('.faq-answer');
    if (!answer) {
        return;
    }

    const isActive = faqItem.classList.contains('active');

    if (isActive) {
        faqItem.classList.remove('active');
        answer.classList.remove('active');
        questionButton.setAttribute('aria-expanded', 'false');
        answer.setAttribute('aria-hidden', 'true');
    } else {
        faqItem.classList.add('active');
        answer.classList.add('active');
        questionButton.setAttribute('aria-expanded', 'true');
        answer.setAttribute('aria-hidden', 'false');

        setTimeout(() => {
            const rect = faqItem.getBoundingClientRect();
            const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
            if (!isVisible) {
                faqItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }
}

export function initFAQAccordion(): void {
    const container = document.getElementById('faq-content');
    if (!container) {
        return;
    }

    container.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const questionButton = target?.closest<HTMLButtonElement>('.faq-question');
        if (questionButton) {
            event.preventDefault();
            toggleQuestion(questionButton);
        }
    });

    container.addEventListener('keydown', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const questionButton = target?.closest<HTMLButtonElement>('.faq-question');
        if (questionButton && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            toggleQuestion(questionButton);
        }
    });
}

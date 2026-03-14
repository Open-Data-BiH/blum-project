export const initFooterKofi = (): void => {
    const container = document.getElementById('footer-kofi-container');
    if (!container) {
        return;
    }

    let loaded = false;

    const loadKofi = (): void => {
        if (loaded) {
            return;
        }
        loaded = true;

        const script = document.createElement('script');
        script.src = 'https://storage.ko-fi.com/cdn/widget/Widget_2.js';
        script.onload = () => {
            const lang = (() => {
                try {
                    return localStorage.getItem('selectedLanguage') || 'bhs';
                } catch {
                    return 'bhs';
                }
            })();
            const buttonText = lang === 'en' ? 'Support this project' : 'Podržite ovaj projekat';

            if (typeof window.kofiwidget2 !== 'undefined') {
                window.kofiwidget2.init(buttonText, '#1a4d73', 'J3J11VR53R');
                container.innerHTML = window.kofiwidget2.getHTML();
            }
        };

        document.body.appendChild(script);
    };

    if ('IntersectionObserver' in (window as object)) {
        new IntersectionObserver(
            (entries, observer) => {
                if (entries[0]?.isIntersecting) {
                    observer.disconnect();
                    loadKofi();
                }
            },
            { rootMargin: '200px' },
        ).observe(container);
        return;
    }

    if ('requestIdleCallback' in (window as object)) {
        window.requestIdleCallback(loadKofi);
        return;
    }

    window.addEventListener('load', loadKofi, { once: true });
};

declare global {
    interface Window {
        kofiwidget2?: {
            init: (label: string, color: string, handle: string) => void;
            getHTML: () => string;
        };
    }
}

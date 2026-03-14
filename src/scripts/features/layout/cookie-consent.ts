export const initCookieConsent = (): void => {
    const readConsent = (): string | null => {
        try {
            return localStorage.getItem('analytics-consent');
        } catch {
            return null;
        }
    };

    const writeConsent = (value: 'granted' | 'denied'): void => {
        try {
            localStorage.setItem('analytics-consent', value);
        } catch {
            // Ignore storage write failures.
        }
    };

    const consent = readConsent();

    if (consent === null) {
        const banner = document.getElementById('cookie-consent');
        if (banner) {
            banner.hidden = false;
        }
    }

    const acceptBtn = document.getElementById('cookie-accept');
    const declineBtn = document.getElementById('cookie-decline');
    const banner = document.getElementById('cookie-consent');

    acceptBtn?.addEventListener('click', () => {
        writeConsent('granted');
        if (banner) {
            banner.hidden = true;
        }
        if (typeof window.gtag === 'function') {
            window.gtag('consent', 'update', { analytics_storage: 'granted' });
        }
    });

    declineBtn?.addEventListener('click', () => {
        writeConsent('denied');
        if (banner) {
            banner.hidden = true;
        }
    });
};

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
    }
}

// Header interactions — ported from js/layout/layout.js
// Handles: mobile menu toggle, scroll shadow, active nav link, smooth scrolling
// layoutLoaded event removed: header is server-rendered and always present.

import { setupLanguageSwitcher, applyTranslation, getCurrentLanguage } from './core/i18n';
import { darkModeManager } from './core/dark-mode';

export function initHeaderInteractions(): void {
    document.addEventListener('DOMContentLoaded', () => {
        // Restore scroll position after language reload
        const savedScrollPosition = sessionStorage.getItem('scrollPosition');
        if (savedScrollPosition) {
            window.scrollTo(0, parseInt(savedScrollPosition, 10));
            sessionStorage.removeItem('scrollPosition');
        }

        // Wire up dark mode button
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn && !(toggleBtn as HTMLElement & { _darkModeWired?: boolean })._darkModeWired) {
            (toggleBtn as HTMLElement & { _darkModeWired?: boolean })._darkModeWired = true;
            toggleBtn.addEventListener('click', () => darkModeManager.toggleTheme());
            darkModeManager.updateButtonUI();
        }

        // Apply language from localStorage
        applyTranslation(getCurrentLanguage());
        setupLanguageSwitcher();

        initializeMobileMenu();
        initializeScrollShadow();
        setupSmoothScrolling();
    });
}

function initializeMobileMenu(): void {
    const menuToggle = document.getElementById('mobile-menu-toggle') as HTMLButtonElement | null;
    const nav = document.getElementById('main-nav');
    const body = document.body;

    if (!menuToggle || !nav) {
        return;
    }
    if ((menuToggle as HTMLButtonElement & { _mobileMenuInitialized?: boolean })._mobileMenuInitialized) {
        return;
    }
    (menuToggle as HTMLButtonElement & { _mobileMenuInitialized?: boolean })._mobileMenuInitialized = true;

    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
        menuToggle.setAttribute('aria-expanded', String(!expanded));
        menuToggle.classList.toggle('active');
        nav.classList.toggle('active');
        body.classList.toggle('menu-open');
    });

    document.addEventListener('click', (e) => {
        if (
            nav.classList.contains('active') &&
            !nav.contains(e.target as Node) &&
            !menuToggle.contains(e.target as Node)
        ) {
            menuToggle.classList.remove('active');
            nav.classList.remove('active');
            body.classList.remove('menu-open');
            menuToggle.setAttribute('aria-expanded', 'false');
        }
    });

    nav.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            nav.classList.remove('active');
            body.classList.remove('menu-open');
            menuToggle.setAttribute('aria-expanded', 'false');
        });
    });
}

function initializeScrollShadow(): void {
    const header = document.querySelector('header');
    if (!header) {
        return;
    }
    const onScroll = (): void => {
        header.classList.toggle('header--scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

function setupSmoothScrolling(): void {
    document.querySelectorAll<HTMLAnchorElement>('.nav__link').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href') ?? '';
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
                top: (targetElement as HTMLElement).offsetTop - headerHeight - extraOffset,
                behavior: 'smooth',
            });
        });
    });
}

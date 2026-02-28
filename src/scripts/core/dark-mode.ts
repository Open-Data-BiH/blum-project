// Dark mode manager — ported from js/core/dark-mode.js
// layoutLoaded event removed; header is always present in Astro SSR output.

type ThemeMode = 'light' | 'dark' | 'auto';

class DarkModeManager {
  private mediaQuery: MediaQueryList;
  currentMode: ThemeMode;

  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.currentMode = (localStorage.getItem('theme') as ThemeMode) || 'auto';
    this.init();
  }

  private init(): void {
    this.applyTheme();

    this.mediaQuery.addEventListener('change', () => {
      if (this.currentMode === 'auto') {
        this.applyTheme();
      }
    });
  }

  toggleTheme(): void {
    if (this.currentMode === 'light') {
      this.setTheme('dark');
    } else if (this.currentMode === 'dark') {
      this.setTheme('auto');
    } else {
      this.setTheme('light');
    }
  }

  setTheme(mode: ThemeMode): void {
    this.currentMode = mode;
    localStorage.setItem('theme', mode);
    this.applyTheme();
  }

  applyTheme(): void {
    const isDark =
      this.currentMode === 'auto' ? this.mediaQuery.matches : this.currentMode === 'dark';

    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.body.classList.toggle('dark-mode', isDark);

    window.dispatchEvent(
      new CustomEvent('themeChanged', {
        detail: { mode: this.currentMode, isDark },
      }),
    );

    this.updateButtonUI();
  }

  updateButtonUI(): void {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const icon = btn.querySelector('i');
    if (!icon) return;

    icon.classList.remove('fa-sun', 'fa-moon', 'fa-desktop');

    switch (this.currentMode) {
      case 'light':
        icon.classList.add('fa-sun');
        btn.setAttribute('aria-label', 'Switch to Dark Mode');
        break;
      case 'dark':
        icon.classList.add('fa-moon');
        btn.setAttribute('aria-label', 'Switch to Auto Mode');
        break;
      case 'auto':
        icon.classList.add('fa-desktop');
        btn.setAttribute('aria-label', 'Switch to Light Mode');
        break;
    }
  }
}

export const darkModeManager = new DarkModeManager();
export const cycleTheme = (): void => darkModeManager.toggleTheme();

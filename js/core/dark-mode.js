class DarkModeManager {
    constructor() {
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        // States: 'light', 'dark', 'auto'
        this.currentMode = localStorage.getItem('theme') || 'auto';
        this.init();
    }

    init() {
        this.applyTheme();

        // Listen for system preference changes (always active to support auto mode)
        this.mediaQuery.addEventListener('change', () => {
            if (this.currentMode === 'auto') {
                this.applyTheme();
            }
        });
    }

    toggleTheme() {
        if (this.currentMode === 'light') {
            this.setTheme('dark');
        } else if (this.currentMode === 'dark') {
            this.setTheme('auto');
        } else {
            this.setTheme('light');
        }
    }

    setTheme(mode) {
        this.currentMode = mode;
        localStorage.setItem('theme', mode);
        this.applyTheme();
    }

    applyTheme() {
        let isDark;

        if (this.currentMode === 'auto') {
            isDark = this.mediaQuery.matches;
        } else {
            isDark = this.currentMode === 'dark';
        }

        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        document.body.classList.toggle('dark-mode', isDark);

        // Update UI button if it exists (using CustomEvent for decoupling)
        window.dispatchEvent(
            new CustomEvent('themeChanged', {
                detail: { mode: this.currentMode, isDark: isDark },
            }),
        );

        this.updateButtonUI();
    }

    updateButtonUI() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) {
            return;
        }

        const icon = btn.querySelector('i');
        if (!icon) {
            return;
        }

        // Remove existing classes
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

// Initialize
const darkModeManager = new DarkModeManager();

// Function to wire up the toggle button
function setupThemeToggleButton() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn && !toggleBtn._darkModeWired) {
        toggleBtn._darkModeWired = true; // Prevent double-wiring
        toggleBtn.addEventListener('click', () => {
            darkModeManager.toggleTheme();
        });
        // Initial UI sync
        darkModeManager.updateButtonUI();
    }
}

// Wire up button on DOMContentLoaded (for pages without layout.js)
document.addEventListener('DOMContentLoaded', () => {
    setupThemeToggleButton();
});

// Also wire up on layoutLoaded (for pages with layout.js where header is loaded dynamically)
document.addEventListener('layoutLoaded', () => {
    setupThemeToggleButton();
});

const cycleTheme = () => darkModeManager.toggleTheme();

export { cycleTheme, darkModeManager };

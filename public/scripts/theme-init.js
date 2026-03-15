(function () {
    try {
        var theme = localStorage.getItem('theme') || 'auto';
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } catch (_error) {
        // Ignore unavailable storage/matchMedia errors.
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    // Initialize FAQ Component
    if (window.FAQComponent) {
        const faq = new window.FAQComponent();
        faq.init();

        // Listen for language changes from main script or layout
        document.addEventListener('languageChanged', (e) => {
            if (e.detail && e.detail.language) {
                faq.updateLanguage(e.detail.language);
            }
        });

        // Also check if there is a global language change function we can hook into
        // or just rely on the component checking window.currentLang
    } else {
        console.error('FAQComponent not found!');
    }
});

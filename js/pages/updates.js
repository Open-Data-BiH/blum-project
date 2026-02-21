document.addEventListener('DOMContentLoaded', () => {
    // Initialize Updates Component
    if (window.UpdatesManager) {
        const updates = new window.UpdatesManager();
        updates.init();

        // Listen for language changes from main script or layout
        document.addEventListener('languageChanged', (e) => {
            if (e.detail && e.detail.language) {
                updates.updateLanguage(e.detail.language);
            }
        });
    } else {
        console.error('UpdatesManager not found!');
    }
});

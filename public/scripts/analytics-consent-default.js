(function () {
    window.dataLayer = window.dataLayer || [];
    function gtag() {
        dataLayer.push(arguments);
    }
    window.gtag = gtag;

    var consent = null;
    try {
        consent = localStorage.getItem('analytics-consent');
    } catch (_error) {
        consent = null;
    }
    gtag('consent', 'default', {
        analytics_storage: consent === 'granted' ? 'granted' : 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
    });
})();

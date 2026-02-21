/**
 * Common page initialization script
 * Handles tasks that run on all pages after layout loads
 */

// Global error handlers — catch uncaught errors and unhandled promise rejections
if (!window.__blumGlobalErrorsWired) {
  window.__blumGlobalErrorsWired = true;

  window.addEventListener('error', (event) => {
    console.error('[Global Error]', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    console.error('[Unhandled Promise Rejection]',
      reason instanceof Error ? (reason.stack || reason.message) : reason
    );
    event.preventDefault();
  });
}

document.addEventListener('layoutLoaded', function () {
  // Update copyright year in footer
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});
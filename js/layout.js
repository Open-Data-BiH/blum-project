/**
 * Layout Loader
 * Loads shared Header and Footer components into the page.
 * Handles active navigation state and mobile menu initialization.
 */

// Check if running from file:// protocol and show helpful message
if (window.location.protocol === 'file:') {
    document.addEventListener('DOMContentLoaded', () => {
        const message = document.createElement('div');
        message.id = 'file-protocol-warning';
        message.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.9);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                font-family: system-ui, -apple-system, sans-serif;
                padding: 20px;
            ">
                <div style="max-width: 600px; text-align: center;">
                    <h1 style="color: #ff6b6b; margin-bottom: 20px;">⚠️ Local Server Required</h1>
                    <p style="margin-bottom: 15px; line-height: 1.6;">
                        This website cannot be opened directly from your file system due to browser security restrictions.
                    </p>
                    <p style="margin-bottom: 20px; line-height: 1.6;">
                        <strong>To run this website locally:</strong>
                    </p>
                    <ol style="text-align: left; margin-bottom: 20px; line-height: 1.8;">
                        <li>Open a terminal in the project folder</li>
                        <li>Run: <code style="background: #333; padding: 2px 8px; border-radius: 4px;">npm install</code></li>
                        <li>Run: <code style="background: #333; padding: 2px 8px; border-radius: 4px;">npm start</code></li>
                        <li>Open <code style="background: #333; padding: 2px 8px; border-radius: 4px;">http://localhost:8000</code> in your browser</li>
                    </ol>
                    <p style="color: #aaa; font-size: 14px;">
                        Or use VS Code's "Live Server" extension and click "Go Live"
                    </p>
                </div>
            </div>
        `;
        document.body.appendChild(message);
    });
    // Stop further execution
    throw new Error('File protocol not supported - local server required');
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadComponent('header', 'components/header.html');
        await loadComponent('footer', 'components/footer.html');

        // Mark that layout.js has loaded components
        window._layoutJsLoaded = true;

        // After loading, initialize common UI logic
        highlightActivePage();
        initializeMobileMenu();
        initializeScrollShadow();

        // Dispatch event to notify script.js that layout is ready
        document.dispatchEvent(new CustomEvent('layoutLoaded'));

        // Give script.js a moment to register its listener, then call directly as fallback
        setTimeout(() => {
            if (typeof window.initializeApp === 'function' && !window._appInitialized) {
                window.initializeApp();
            }
        }, 50);
    } catch (e) {
        console.error("Layout loading failed:", e);
        // Still dispatch event so script.js doesn't hang
        document.dispatchEvent(new CustomEvent('layoutLoaded'));
        // Also try to initialize app on error
        setTimeout(() => {
            if (typeof window.initializeApp === 'function' && !window._appInitialized) {
                window.initializeApp();
            }
        }, 50);
    }
});

async function loadComponent(elementId, path) {
    const element = document.getElementById(elementId);
    if (!element) { return; }

    try {
        const html = await FetchHelper.fetchText(path, { timeout: 8000, retries: 2 });
        // Sanitize HTML content using DOMPurify if available
        if (typeof DOMPurify !== 'undefined') {
            element.innerHTML = DOMPurify.sanitize(html, {
                ALLOWED_TAGS: ['header', 'footer', 'nav', 'div', 'span', 'a', 'button', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'img', 'i', 'strong', 'em', 'br', 'hr', 'small', 'label', 'input', 'select', 'option'],
                ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id', 'style', 'src', 'alt', 'role', 'aria-label', 'aria-hidden', 'aria-expanded', 'aria-controls', 'data-page', 'data-lang', 'type', 'for', 'name', 'value'],
                ALLOW_DATA_ATTR: true
            });
        } else {
            element.innerHTML = html;
        }
    } catch (error) {
        console.error(error);
        const errorText = typeof escapeHTML === 'function' ? escapeHTML(`Error loading ${elementId}`) : `Error loading ${elementId}`;
        element.innerHTML = `<p class="error">${errorText}</p>`;
    }
}

function highlightActivePage() {
    const currentPage = document.body.dataset.page || 'home';
    const links = document.querySelectorAll('.nav__link');

    links.forEach(link => {
        if (link.dataset.page === currentPage) {
            link.classList.add('active');
        } else if (link.getAttribute('href') === window.location.pathname.split('/').pop()) {
            link.classList.add('active');
        }
    });
}

function initializeMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const nav = document.getElementById('main-nav');
    const body = document.body;

    if (!menuToggle || !nav) { return; }
    if (menuToggle._mobileMenuInitialized) { return; }

    const activeToggle = menuToggle;
    activeToggle._mobileMenuInitialized = true;

    activeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const expanded = activeToggle.getAttribute('aria-expanded') === 'true';
        activeToggle.setAttribute('aria-expanded', !expanded);
        activeToggle.classList.toggle('active');
        nav.classList.toggle('active');
        body.classList.toggle('menu-open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (nav.classList.contains('active') && !nav.contains(e.target) && !activeToggle.contains(e.target)) {
            activeToggle.classList.remove('active');
            nav.classList.remove('active');
            body.classList.remove('menu-open');
            activeToggle.setAttribute('aria-expanded', 'false');
        }
    });

    // Close menu when clicking a link
    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            activeToggle.classList.remove('active');
            nav.classList.remove('active');
            body.classList.remove('menu-open');
            activeToggle.setAttribute('aria-expanded', 'false');
        });
    });
}

function initializeScrollShadow() {
    const header = document.querySelector('header');
    if (!header) return;
    const onScroll = () => {
        header.classList.toggle('header--scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

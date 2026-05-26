/**
 * Navbar theme picker for QubibyteWebsite (standalone and HMI iframe).
 * Persists via QubibyteTheme → localStorage['qubibyte-theme'].
 * HMI may still push its settings theme on load; user choice is saved to localStorage.
 */
(function (global) {
    const PICKER_ID = 'qubibyteThemePicker';
    const ICON_SRC = '/images/themeicon.png';

    const THEME_OPTIONS = [
        { id: 'dark', label: 'Dark' },
        { id: 'light', label: 'Light' },
        { id: 'midnight', label: 'Midnight' },
        { id: 'quantum', label: 'Quantum' }
    ];

    function syncActiveState(menu) {
        const current = global.QubibyteTheme?.get?.() || global.document.documentElement.dataset.theme || 'dark';
        menu.querySelectorAll('.theme-picker-option').forEach((btn) => {
            const active = btn.dataset.theme === current;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function closeMenu(menu, toggle) {
        menu.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
    }

    function openMenu(menu, toggle) {
        menu.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        syncActiveState(menu);
    }

    function mountThemePicker() {
        if (document.getElementById(PICKER_ID)) return true;

        const nav = document.querySelector('.navbar .navbar-nav');
        if (!nav) return false;

        const li = document.createElement('li');
        li.className = 'nav-item theme-picker-nav-item';

        const wrap = document.createElement('div');
        wrap.className = 'theme-picker';
        wrap.id = PICKER_ID;

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'theme-picker-btn';
        toggle.setAttribute('aria-haspopup', 'listbox');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Choose color theme');

        const icon = document.createElement('img');
        icon.className = 'theme-picker-icon';
        icon.src = ICON_SRC;
        icon.alt = '';
        icon.width = 22;
        icon.height = 22;
        toggle.appendChild(icon);

        const menu = document.createElement('div');
        menu.className = 'theme-picker-menu';
        menu.setAttribute('role', 'listbox');
        menu.setAttribute('aria-label', 'Color theme');

        THEME_OPTIONS.forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'theme-picker-option';
            btn.dataset.theme = opt.id;
            btn.setAttribute('role', 'option');

            const swatch = document.createElement('span');
            swatch.className = 'theme-picker-swatch';
            swatch.dataset.theme = opt.id;
            swatch.setAttribute('aria-hidden', 'true');

            const label = document.createElement('span');
            label.textContent = opt.label;

            btn.appendChild(swatch);
            btn.appendChild(label);

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (global.QubibyteTheme?.apply) {
                    global.QubibyteTheme.apply(opt.id);
                } else {
                    global.document.documentElement.dataset.theme = opt.id;
                    try {
                        global.localStorage.setItem('qubibyte-theme', opt.id);
                    } catch (err) {
                        /* ignore */
                    }
                }
                syncActiveState(menu);
                closeMenu(menu, toggle);
            });

            menu.appendChild(btn);
        });

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (menu.classList.contains('is-open')) {
                closeMenu(menu, toggle);
            } else {
                openMenu(menu, toggle);
            }
        });

        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) {
                closeMenu(menu, toggle);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMenu(menu, toggle);
            }
        });

        wrap.appendChild(toggle);
        wrap.appendChild(menu);
        li.appendChild(wrap);
        nav.appendChild(li);

        syncActiveState(menu);
        return true;
    }

    function tryMount() {
        if (mountThemePicker()) return;
        const observer = new MutationObserver(() => {
            if (mountThemePicker()) observer.disconnect();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        global.setTimeout(() => observer.disconnect(), 10000);
    }

    function init() {
        tryMount();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    global.addEventListener('qubibyte-theme-change', () => {
        const menu = document.querySelector(`#${PICKER_ID} .theme-picker-menu`);
        if (menu) syncActiveState(menu);
    });

    global.addEventListener('load', tryMount);
})(typeof window !== 'undefined' ? window : globalThis);

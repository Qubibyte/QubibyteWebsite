/**
 * HMI software mode for QubibyteWebsite (embedded in-app browser / kiosk).
 *
 * Default: off. Enabled per session by HMI embed via postMessage, not stored in repo:
 *   sessionStorage.setItem('qubibyte-software-mode', '1');
 * Or: window.QUBIBYTE_SOFTWARE_MODE = true;
 */
(function (global) {
    const STORAGE_KEY = 'qubibyte-software-mode';
    const LEGACY_STORAGE_KEY = 'qubibyte-pi-mode';
    const HTTP_ORIGIN_KEY = 'qubibyte-http-origin';

    const BLOCKED_HOSTS = ['trent-rosenthal.com', 'www.trent-rosenthal.com'];

    function getHttpOrigin() {
        if (global.QUBIBYTE_HTTP_ORIGIN) {
            return String(global.QUBIBYTE_HTTP_ORIGIN).replace(/\/$/, '');
        }
        try {
            const stored = global.sessionStorage.getItem(HTTP_ORIGIN_KEY);
            return stored ? stored.replace(/\/$/, '') : '';
        } catch (e) {
            return '';
        }
    }

    function setHttpOrigin(origin) {
        if (!origin) return;
        const normalized = String(origin).replace(/\/$/, '');
        global.QUBIBYTE_HTTP_ORIGIN = normalized;
        try {
            global.sessionStorage.setItem(HTTP_ORIGIN_KEY, normalized);
        } catch (e) {
            /* ignore */
        }
    }

    function getActiveTheme() {
        if (global.QUBIBYTE_THEME) return global.QUBIBYTE_THEME;
        try {
            return global.localStorage.getItem('qubibyte-theme') || 'dark';
        } catch (e) {
            return 'dark';
        }
    }

    /** Directory paths must end with / so relative assets (styles/main.css) resolve correctly. */
    function normalizeDirectoryPathname(pathname) {
        if (!pathname || pathname === '/') return pathname || '/';
        if (pathname.endsWith('/')) return pathname;
        const last = pathname.split('/').pop() || '';
        if (last.includes('.')) return pathname;
        return `${pathname}/`;
    }

    function withThemeInUrl(pathOrUrl) {
        const theme = getActiveTheme();
        try {
            const u = new URL(pathOrUrl, global.location.href);
            u.pathname = normalizeDirectoryPathname(u.pathname);
            if (!u.searchParams.has('theme')) {
                u.searchParams.set('theme', theme);
            }
            return u.pathname + u.search + u.hash;
        } catch (e) {
            if (typeof pathOrUrl === 'string' && pathOrUrl.startsWith('/')) {
                try {
                    const u = new URL(pathOrUrl, 'http://qubibyte.local');
                    u.pathname = normalizeDirectoryPathname(u.pathname);
                    if (!u.searchParams.has('theme')) {
                        u.searchParams.set('theme', theme);
                    }
                    return u.pathname + u.search + u.hash;
                } catch (err2) {
                    return pathOrUrl;
                }
            }
            return pathOrUrl;
        }
    }

    function videoviewerUrl(videoId) {
        const path = withThemeInUrl(`/videoviewer/?v=${encodeURIComponent(videoId)}`);
        const httpOrigin = getHttpOrigin();
        if (!httpOrigin) return path;
        try {
            return new URL(path, httpOrigin).href;
        } catch (e) {
            return httpOrigin + path;
        }
    }

    function isSoftwareMode() {
        if (global.QUBIBYTE_SOFTWARE_MODE === true || global.QUBIBYTE_SOFTWARE_MODE === '1') return true;
        try {
            return global.sessionStorage.getItem(STORAGE_KEY) === '1' ||
            global.sessionStorage.getItem(LEGACY_STORAGE_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function setSoftwareModeClass(on) {
        global.document.documentElement.classList.toggle('software-mode', on);
    }

    function isLocalAppUrl(url) {
        if (!url) return false;
        try {
            const u = new URL(url, global.location.href);
            if (u.protocol === 'qubibyte:') return true;
            if (/^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(u.origin)) return true;
            if (/\/videoviewer\/?/i.test(u.pathname)) return true;
        } catch (e) {
            if (typeof url === 'string' && url.startsWith('/videoviewer')) return true;
        }
        return false;
    }

    function youtubeVideoId(url) {
        if (!url || typeof url !== 'string') return null;
        if (/videoviewer/i.test(url)) {
            const vm = url.match(/[?&]v=([\w-]{11})/);
            if (vm) return vm[1];
        }
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([\w-]{11})/i,
            /youtu\.be\/([\w-]{11})/i,
            /youtube\.com\/embed\/([\w-]{11})/i,
            /youtube-nocookie\.com\/embed\/([\w-]{11})/i,
            /youtube\.com\/shorts\/([\w-]{11})/i
        ];
        for (const re of patterns) {
            const m = url.match(re);
            if (m) return m[1];
        }
        return null;
    }

    function getHostname(url) {
        try {
            return new URL(url, global.location.origin).hostname.toLowerCase();
        } catch (e) {
            return '';
        }
    }

    function isBlockedExternal(url) {
        if (!url || !/^https?:\/\//i.test(url)) return false;
        if (isLocalAppUrl(url)) return false;
        const host = getHostname(url);
        if (BLOCKED_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return true;
        if (/youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(url)) return false;
        return true;
    }

    function isSameSitePath(url) {
        if (!url || url.startsWith('#') || url.startsWith('javascript:')) return false;
        if (url.startsWith('/') && !url.startsWith('//')) return true;
        try {
            const u = new URL(url, global.location.href);
            return u.origin === global.location.origin;
        } catch (e) {
            return false;
        }
    }

    function resolveNavigation(url, target) {
        if (!url || url.startsWith('javascript:') || url.startsWith('#')) {
            return { url, target, blocked: false };
        }

        if (!isSoftwareMode()) {
            return { url, target, blocked: false };
        }

        const absolute = (() => {
            try {
                return new URL(url, global.location.href).href;
            } catch (e) {
                return url;
            }
        })();

        if (isLocalAppUrl(absolute)) {
            return { url: absolute, target: '_self', blocked: false };
        }

        if (isBlockedExternal(absolute)) {
            return { url: null, target: '_self', blocked: true };
        }

        const videoId = youtubeVideoId(absolute);
        if (videoId) {
            return {
                url: videoviewerUrl(videoId),
                target: '_self',
                blocked: false
            };
        }

        if (isSameSitePath(url) || isSameSitePath(absolute)) {
            const path = (() => {
                try {
                    const u = new URL(url, global.location.href);
                    return withThemeInUrl(u.pathname + u.search + u.hash);
                } catch (e) {
                    return withThemeInUrl(url);
                }
            })();
            return { url: path, target: '_self', blocked: false };
        }

        if (/^https?:\/\//i.test(absolute)) {
            return { url: null, target: '_self', blocked: true };
        }

        return { url, target: '_self', blocked: false };
    }

    function navigate(url, target) {
        const resolved = resolveNavigation(url, target);
        if (resolved.blocked || !resolved.url) return null;
        global.location.assign(resolved.url);
        return null;
    }

    let openOverridden = false;
    let clickHandlerInstalled = false;

    function disableBlockedAnchors(root) {
        if (!isSoftwareMode()) return;
        const scope = root || global.document;
        scope.querySelectorAll('a[href]').forEach((anchor) => {
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

            let absolute;
            try {
                absolute = new URL(anchor.href, global.location.href).href;
            } catch (e) {
                return;
            }

            if (!isBlockedExternal(absolute)) return;

            anchor.classList.add('software-link-disabled');
            anchor.setAttribute('aria-disabled', 'true');
            anchor.setAttribute('data-software-blocked', 'true');
            if (!anchor.dataset.softwareOriginalHref) {
                anchor.dataset.softwareOriginalHref = href;
            }
            anchor.removeAttribute('href');
            anchor.style.pointerEvents = 'none';
            anchor.style.cursor = 'default';
            anchor.style.textDecoration = 'none';
        });
    }

    function handleActivatableClick(e) {
        if (!isSoftwareMode()) return;

        const button = e.target.closest('button[data-href], [data-href].tech-row');
        if (button && button.dataset.href) {
            e.preventDefault();
            e.stopImmediatePropagation();
            navigate(button.dataset.href, button.dataset.target);
            return;
        }

        const anchor = e.target.closest('a[href], a[data-software-original-href]');
        if (!anchor) return;
        if (anchor.dataset.softwareBlocked === 'true') {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        const href = anchor.getAttribute('href') || anchor.dataset.softwareOriginalHref;
        if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

        const target = anchor.getAttribute('target');
        const absolute = (() => {
            try {
                return new URL(href, global.location.href).href;
            } catch (err) {
                return href;
            }
        })();

        if (isLocalAppUrl(absolute) || /\/videoviewer\/?/i.test(absolute)) {
            return;
        }

        const videoId = youtubeVideoId(absolute);
        const blocked = isBlockedExternal(absolute);
        const sameSite = isSameSitePath(href) || isSameSitePath(absolute);
        const offSite = /^https?:\/\//i.test(absolute) && !videoId && !sameSite && !isLocalAppUrl(absolute);
        const newWindow = target === '_blank';

        if (blocked) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }

        if (videoId || offSite || newWindow) {
            e.preventDefault();
            e.stopImmediatePropagation();
            navigate(absolute, target);
        }
    }

    function installSoftwareHandlers() {
        const on = isSoftwareMode();
        setSoftwareModeClass(on);

        if (!on) return;

        if (!openOverridden) {
            const nativeOpen = global.open.bind(global);
            global.open = function (url, target, features) {
                if (!url) return nativeOpen(url, target, features);
                if (!isSoftwareMode()) return nativeOpen(url, target, features);
                return navigate(url, target);
            };
            openOverridden = true;
        }

        if (!clickHandlerInstalled) {
            global.addEventListener('click', handleActivatableClick, true);
            clickHandlerInstalled = true;
        }

        disableBlockedAnchors(global.document);

        if (!global.__qubibyteSoftwareObserver) {
            global.__qubibyteSoftwareObserver = new MutationObserver(() => {
                if (isSoftwareMode()) disableBlockedAnchors(global.document);
            });
            global.__qubibyteSoftwareObserver.observe(global.document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    global.QubibyteSoftwareMode = {
        isSoftwareMode,
        youtubeVideoId,
        resolveNavigation,
        navigate,
        isBlockedExternal,
        enableSession() {
            try {
                global.sessionStorage.setItem(STORAGE_KEY, '1');
                global.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
            } catch (e) {
                /* ignore */
            }
            global.QUBIBYTE_SOFTWARE_MODE = true;
            installSoftwareHandlers();
            if (typeof global.refreshBlogCarouselLinks === 'function') {
                global.refreshBlogCarouselLinks();
            }
        },
        disableSession() {
            try {
                global.sessionStorage.removeItem(STORAGE_KEY);
                global.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
            } catch (e) {
                /* ignore */
            }
            global.QUBIBYTE_SOFTWARE_MODE = false;
            setSoftwareModeClass(false);
        },
        refreshLinkPolicies() {
            installSoftwareHandlers();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installSoftwareHandlers);
    } else {
        installSoftwareHandlers();
    }

    global.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY || e.key === LEGACY_STORAGE_KEY) {
            global.QUBIBYTE_SOFTWARE_MODE = isSoftwareMode();
            installSoftwareHandlers();
        }
    });

    global.addEventListener('message', (e) => {
        const data = e.data;
        if (!data) return;
        if (data.type === 'qubibyte-software-mode' || data.type === 'qubibyte-pi-mode') {
            if (data.enabled) {
                global.QubibyteSoftwareMode.enableSession();
            } else {
                global.QubibyteSoftwareMode.disableSession();
            }
            if (data.enabled && typeof global.refreshBlogCarouselLinks === 'function') {
                global.refreshBlogCarouselLinks();
            }
            return;
        }
        if (data.type === 'qubibyte-http-origin' && data.origin) {
            setHttpOrigin(data.origin);
            if (typeof global.refreshBlogCarouselLinks === 'function') {
                global.refreshBlogCarouselLinks();
            }
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);

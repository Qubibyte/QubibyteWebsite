/**
 * Qubibyte site-wide themes (dark, light, midnight, quantum).
 *
 * HMI / parent shell: set before navigation or via shared storage:
 *   window.QUBIBYTE_THEME = 'light';
 *   localStorage.setItem('qubibyte-theme', 'light');
 *
 * Same-origin parent may also postMessage({ type: 'qubibyte-theme', theme: 'light' }).
 */
(function (global) {
    const STORAGE_KEY = 'qubibyte-theme';
    const THEMES = ['dark', 'light', 'midnight', 'quantum'];

    const PAINT = {
        dark: { bg: '#0a0a1a', fg: '#f1f5f9', scheme: 'dark' },
        light: { bg: '#f0f0f5', fg: '#1a1a2e', scheme: 'light' },
        midnight: { bg: '#0f172a', fg: '#e2e8f0', scheme: 'dark' },
        quantum: { bg: '#1a0a25', fg: '#f5f0ff', scheme: 'dark' }
    };

    function paintCriticalBackground(theme) {
        const t = normalize(theme);
        const paint = PAINT[t];
        const root = document.documentElement;
        root.style.backgroundColor = paint.bg;
        root.style.color = paint.fg;
        root.style.colorScheme = paint.scheme;

        let el = document.getElementById('qubibyte-theme-critical');
        if (!el) {
            el = document.createElement('style');
            el.id = 'qubibyte-theme-critical';
            document.head.appendChild(el);
        }
        el.textContent =
            `html,body{background:${paint.bg}!important;color:${paint.fg}!important}` +
            `html{color-scheme:${paint.scheme}!important}`;
    }

    function normalize(theme) {
        return THEMES.includes(theme) ? theme : 'dark';
    }

    function readInitialTheme() {
        if (global.QUBIBYTE_THEME) return normalize(global.QUBIBYTE_THEME);
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) return normalize(saved);
        } catch (e) {
            /* ignore */
        }
        return 'dark';
    }

    function getCssVar(name, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    }

    function cssColorToThree(cssValue, fallbackHex) {
        if (!global.THREE) return new THREE.Color(fallbackHex);
        const probe = document.createElement('span');
        probe.style.color = cssValue;
        document.body.appendChild(probe);
        const rgb = getComputedStyle(probe).color;
        document.body.removeChild(probe);
        const parts = rgb.match(/[\d.]+/g);
        if (!parts || parts.length < 3) return new THREE.Color(fallbackHex);
        return new THREE.Color(
            Number(parts[0]) / 255,
            Number(parts[1]) / 255,
            Number(parts[2]) / 255
        );
    }

    function createThreeBackground() {
        const css = getCssVar('--viz-3d-bg', getCssVar('--background', '#0f172a'));
        return cssColorToThree(css, 0x0f172a);
    }

    function setSceneBackground(scene) {
        if (!scene || !global.THREE) return;
        scene.background = createThreeBackground();
    }

    function refreshThreeJsScenes() {
        if (!global.THREE) return;

        const ui = global.circuitUI;
        if (ui?.visualizer) {
            setSceneBackground(ui.visualizer.blochScene);
            if (ui.visualizer.blochRenderer) {
                ui.visualizer.blochRenderer.setClearColor(createThreeBackground(), 1);
            }
            if (ui.visualizer.maximizedBlochRenderer && ui.visualizer.blochScene) {
                ui.visualizer.maximizedBlochRenderer.setClearColor(createThreeBackground(), 1);
            }
        }

        if (global.gcBlochScene) {
            setSceneBackground(global.gcBlochScene);
            if (global.gcBlochRenderer) {
                global.gcBlochRenderer.setClearColor(createThreeBackground(), 1);
            }
        }

        const nmr = global.nmrSimulator;
        if (nmr?.spectrometerViz?.scene) setSceneBackground(nmr.spectrometerViz.scene);
        if (nmr?.blochViz?.scene) setSceneBackground(nmr.blochViz.scene);
    }

    function refreshChartThemes() {
        const nmr = global.nmrSimulator;
        if (nmr?.spectrumViz?.applyTheme) {
            nmr.spectrumViz.applyTheme();
        }
        if (nmr?.moleculeViz?.applyTheme) {
            nmr.moleculeViz.applyTheme();
        }
    }

    function refreshAllVisuals() {
        refreshThreeJsScenes();
        refreshChartThemes();
        [0, 300, 1500].forEach((ms) => global.setTimeout(refreshThreeJsScenes, ms));
    }

    function normalizeLogoDarkSrc(src) {
        let candidate = src;
        if (/logo\.png/i.test(src) && !/logo_white/i.test(src)) {
            candidate = src.replace(/logo\.png/i, 'logo_white.png');
        } else if (!/logo_white\.png/i.test(src)) {
            return null;
        }
        if (/^https?:\/\//i.test(candidate) || candidate.startsWith('/')) {
            return candidate;
        }
        if (candidate.includes('/')) {
            return candidate;
        }
        return '/images/logo_white.png';
    }

    function logoSrcForTheme(darkSrc, useLightLogo) {
        if (useLightLogo) {
            return darkSrc.replace(/logo_white\.png/i, 'logo.png');
        }
        return darkSrc;
    }

    function updateThemeLogos(theme) {
        const useLightLogo = normalize(theme) === 'light';
        document.querySelectorAll('img').forEach((img) => {
            const src = img.getAttribute('src') || '';
            if (!/logo(_white)?\.png/i.test(src) || /logo_cropped/i.test(src)) return;

            const darkSrc = normalizeLogoDarkSrc(img.dataset.qubibyteLogoDark || src);
            if (!darkSrc) return;
            img.dataset.qubibyteLogoDark = darkSrc;
            const next = logoSrcForTheme(darkSrc, useLightLogo);
            if (img.getAttribute('src') !== next) img.setAttribute('src', next);
        });
    }

    function applyTheme(theme, options = {}) {
        const t = normalize(theme);
        const { persist = true, broadcast = true, refreshVisuals = true } = options;
        const previous = document.documentElement.dataset.theme;

        document.documentElement.dataset.theme = t;
        global.QUBIBYTE_THEME = t;
        paintCriticalBackground(t);
        updateThemeLogos(t);

        if (persist) {
            try {
                localStorage.setItem(STORAGE_KEY, t);
            } catch (e) {
                /* ignore */
            }
            if (global.parent !== global) {
                try {
                    global.parent.postMessage({ type: 'qubibyte-theme', theme: t }, '*');
                } catch (e) {
                    /* ignore */
                }
            }
        }

        if (broadcast) {
            try {
                global.dispatchEvent(new CustomEvent('qubibyte-theme-change', { detail: { theme: t } }));
            } catch (e) {
                /* ignore */
            }
        }

        if (refreshVisuals && previous !== t) {
            global.requestAnimationFrame(refreshAllVisuals);
        }
        return t;
    }

    function getTheme() {
        return document.documentElement.dataset.theme || readInitialTheme();
    }

    global.addEventListener('qubibyte-theme-change', () => refreshAllVisuals());

    global.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY && e.newValue) {
            applyTheme(e.newValue, { persist: false, broadcast: false });
        }
    });

    global.addEventListener('message', (e) => {
        const data = e.data;
        if (!data || data.type !== 'qubibyte-theme') return;
        applyTheme(data.theme);
    });

    /* Boot: inline script in <head> sets data-theme first; we sync API here */
    if (!document.documentElement.dataset.theme) {
        applyTheme(readInitialTheme(), { broadcast: false, refreshVisuals: false });
    } else {
        global.QUBIBYTE_THEME = getTheme();
        paintCriticalBackground(getTheme());
        updateThemeLogos(getTheme());
    }

    function scheduleInitialVisualRefresh() {
        global.requestAnimationFrame(refreshAllVisuals);
    }

    function scheduleLogoRefresh() {
        updateThemeLogos(getTheme());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            scheduleInitialVisualRefresh();
            scheduleLogoRefresh();
        }, { once: true });
    } else {
        scheduleInitialVisualRefresh();
        scheduleLogoRefresh();
    }

    global.addEventListener('qubibyte-theme-change', scheduleLogoRefresh);

    if (typeof MutationObserver !== 'undefined') {
        let logoRefreshTimer;
        const logoObserver = new MutationObserver(() => {
            clearTimeout(logoRefreshTimer);
            logoRefreshTimer = global.setTimeout(scheduleLogoRefresh, 50);
        });
        logoObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    global.QubibyteTheme = {
        apply: applyTheme,
        get: getTheme,
        updateLogos: updateThemeLogos,
        themes: THEMES,
        createThreeBackground,
        refreshVisuals: refreshAllVisuals,
        getChartColors() {
            return {
                title: getCssVar('--chart-title-color', '#f1f5f9'),
                legend: getCssVar('--chart-legend-color', '#94a3b8'),
                tick: getCssVar('--chart-tick-color', '#64748b'),
                grid: getCssVar('--chart-grid-color', 'rgba(71, 85, 105, 0.3)'),
                tooltipBg: getCssVar('--chart-tooltip-bg', 'rgba(15, 23, 42, 0.95)'),
                tooltipTitle: getCssVar('--chart-tooltip-title', '#f1f5f9'),
                tooltipBody: getCssVar('--chart-tooltip-body', '#94a3b8'),
                tooltipBorder: getCssVar('--chart-tooltip-border', '#475569')
            };
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);

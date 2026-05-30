/**
 * Read theme CSS variables for canvas/chart rendering on subpages.
 */
(function (global) {
    function cssVar(name, fallback) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    }

    function getSubpageCanvasColors() {
        return {
            bg: cssVar('--subpage-canvas-bg', cssVar('--bg-primary', '#0a0a1a')),
            grid: cssVar('--subpage-canvas-grid', 'rgba(255,255,255,0.02)'),
            road: cssVar('--subpage-canvas-road', 'rgba(255,255,255,0.06)'),
            label: cssVar('--subpage-canvas-label', 'rgba(255,255,255,0.35)'),
            chartGrid: cssVar('--subpage-chart-grid', 'rgba(255,255,255,0.04)'),
            chartLabel: cssVar('--subpage-chart-label', 'rgba(255,255,255,0.25)'),
            textMuted: cssVar('--text-muted', '#64748b'),
            textSecondary: cssVar('--text-secondary', '#94a3b8')
        };
    }

    global.QubibyteSubpageColors = {
        get: getSubpageCanvasColors,
        cssVar
    };
})(typeof window !== 'undefined' ? window : globalThis);

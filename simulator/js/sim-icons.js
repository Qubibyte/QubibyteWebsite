/** Colored PNG icons for the simulator (CSS mask + gradient fills). */
(function (g) {
    const BASE = '/images/emojis/';

    /** @type {Record<string, string>} Legacy emoji → asset stem */
    const LEGACY_EMOJI = {
        '🔗': 'link',
        '🌐': 'globe_meridian',
        '🌊': 'water_wave',
        '📡': 'satellite_dish',
        '✨': 'sparkles',
        '⚖️': 'balance_scale',
        '🔑': 'key',
        '🔍': 'magnifying_glass',
        '📊': 'graph_bar',
        '⚡': 'lightning_bolt',
        '🎯': 'bullseye_target',
        '🔄': 'rotating_arrows',
        '🛡️': 'shield',
        '⚛️': 'atom',
        '⚙️': 'gear',
        '💡': 'lightbulb',
        '📦': 'box',
        '🖼️': 'framed_picture',
        '📐': 'protractor',
        '📄': 'flipped_page'
    };

    /** Default tone per asset stem */
    const ICON_TONES = {
        link: 'violet',
        globe_meridian: 'cyan',
        water_wave: 'cyan',
        satellite_dish: 'blue',
        sparkles: 'gold',
        balance_scale: 'gold',
        key: 'yellow',
        magnifying_glass: 'purple',
        graph_bar: 'blue',
        lightning_bolt: 'gold',
        bullseye_target: 'red',
        rotating_arrows: 'violet',
        shield: 'cyan',
        atom: 'cyan',
        gear: 'blue',
        lightbulb: 'yellow',
        box: 'violet',
        framed_picture: 'purple',
        protractor: 'blue',
        flipped_page: 'violet'
    };

    function normalizeIconKey(icon) {
        const raw = String(icon ?? '').trim();
        if (!raw) return 'atom';
        if (LEGACY_EMOJI[raw]) return LEGACY_EMOJI[raw];
        return raw.replace(/\.png$/i, '');
    }

    /**
     * @param {string} icon Asset stem, legacy emoji, or filename
     * @param {{ tone?: string, wrapClass?: string, sizeClass?: string }} [opts]
     */
    function simIconHtml(icon, opts = {}) {
        const key = normalizeIconKey(icon);
        const tone = opts.tone || ICON_TONES[key] || 'purple';
        const wrapClass = opts.wrapClass || 'sim-icon-wrap';
        const sizeClass = opts.sizeClass ? ` ${opts.sizeClass}` : '';
        return (
            `<span class="${wrapClass}${sizeClass}" aria-hidden="true">` +
            `<span class="site-icon-colored site-icon--${tone}" style="--site-icon-url: url('${BASE}${key}.png')"></span>` +
            `</span>`
        );
    }

    g.simIconHtml = simIconHtml;
    g.simIconKey = normalizeIconKey;
})(typeof globalThis !== 'undefined' ? globalThis : window);

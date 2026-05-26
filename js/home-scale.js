/**
 * Scales #home-scale-root from a 1920px-wide layout to fit the viewport (992–1919px).
 */
(function () {
    var ROOT_ID = 'home-scale-root';
    var DESIGN_W = 1920;
    var DESIGN_NAV = 80;
    var MIN_W = 992;

    window.HomeScale = window.HomeScale || {};

    function update() {
        var root = document.getElementById(ROOT_ID);
        if (!root || !document.body.classList.contains('qubibyte-home')) {
            return;
        }

        var vw = window.innerWidth;

        if (vw < MIN_W || vw >= DESIGN_W) {
            root.style.transform = '';
            root.style.width = '';
            document.documentElement.style.removeProperty('height');
            document.body.style.removeProperty('min-height');
            window.HomeScale.navOffset = DESIGN_NAV;
            window.HomeScale.scale = 1;
            return;
        }

        var scale = vw / DESIGN_W;
        root.style.width = DESIGN_W + 'px';
        root.style.transformOrigin = 'top left';
        root.style.transform = 'scale(' + scale + ')';

        var navEl = document.querySelector('.navbar');
        var navH = navEl ? navEl.getBoundingClientRect().height : Math.round(DESIGN_NAV * scale);
        var scaledHeight = root.getBoundingClientRect().height;
        /* Only constrain height while scaled — never on 1080p+ full layout */
        document.documentElement.style.height = scaledHeight + 'px';
        document.body.style.minHeight = scaledHeight + 'px';
        window.HomeScale.navOffset = Math.round(navH);
        window.HomeScale.scale = scale;
    }

    var t;
    function schedule() {
        clearTimeout(t);
        t = setTimeout(update, 50);
    }

    function init() {
        update();
        requestAnimationFrame(update);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('resize', schedule);
    window.addEventListener('load', init);

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(schedule);
    }

    /* Reflow after hero typewriter / mission animations change height */
    if (typeof MutationObserver !== 'undefined') {
        var root = document.getElementById(ROOT_ID);
        if (root) {
            var mo = new MutationObserver(schedule);
            mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        }
    }
})();

/**
 * Sporadic diagonal meteor accents for the home welcome section (tablet/desktop only).
 */
(function () {
    const MIN_WIDTH = 768;
    const MAX_ACTIVE = 5;
    const METEOR_COLORS = ['purple', 'blue', 'cyan', 'violet', 'gold'];
    const METEOR_IMAGES = [1, 2, 3, 4, 5, 6, 7];

    let field = null;
    let enabled = false;
    let spawnTimer = 0;
    let activeCount = 0;

    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function isDesktopViewport() {
        return window.innerWidth >= MIN_WIDTH;
    }

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function clearField() {
        if (!field) return;
        field.replaceChildren();
        activeCount = 0;
    }

    function stop() {
        enabled = false;
        if (spawnTimer) {
            clearTimeout(spawnTimer);
            spawnTimer = 0;
        }
        clearField();
    }

    function spawnMeteor() {
        if (!enabled || !field || activeCount >= MAX_ACTIVE) return;

        const flipped = Math.random() < 0.42;
        const meteorIndex = pick(METEOR_IMAGES);
        const color = pick(METEOR_COLORS);
        const size = Math.round(rand(32, 64));
        const duration = rand(11, 21);
        const peakOpacity = rand(0.34, 0.55);
        const travelX = rand(68, 96);
        const travelY = rand(58, 88);

        const wrap = document.createElement('div');
        wrap.className = 'hero-meteor-wrap' + (flipped ? ' is-sw' : ' is-se');

        if (flipped) {
            wrap.style.right = `${rand(-4, 42)}%`;
            wrap.style.top = `${rand(-10, 32)}%`;
            wrap.style.left = 'auto';
        } else {
            wrap.style.left = `${rand(-4, 42)}%`;
            wrap.style.top = `${rand(-10, 32)}%`;
        }

        wrap.style.setProperty('--meteor-duration', `${duration}s`);
        wrap.style.setProperty('--meteor-size', `${size}px`);
        wrap.style.setProperty('--meteor-peak-opacity', peakOpacity.toFixed(3));
        wrap.style.setProperty('--meteor-travel-x', `${travelX}vw`);
        wrap.style.setProperty('--meteor-travel-y', `${travelY}vh`);

        const icon = document.createElement('span');
        icon.className = `hero-meteor site-icon-colored site-icon--${color}`;
        icon.style.setProperty('--site-icon-url', `url('images/flyingobjects/meteor${meteorIndex}.png')`);
        if (flipped) {
            icon.classList.add('is-flipped');
        }

        wrap.appendChild(icon);
        field.appendChild(wrap);
        activeCount += 1;

        const onDone = () => {
            wrap.removeEventListener('animationend', onDone);
            wrap.remove();
            activeCount = Math.max(0, activeCount - 1);
        };
        wrap.addEventListener('animationend', onDone);
    }

    function scheduleSpawn() {
        if (!enabled) return;

        // Occasional quiet gaps so meteors feel sporadic, not constant.
        const delay = rand(2200, 6800);
        const skip = Math.random() < 0.28;

        spawnTimer = window.setTimeout(() => {
            spawnTimer = 0;
            if (!skip) {
                spawnMeteor();
                if (Math.random() < 0.18 && activeCount < MAX_ACTIVE) {
                    window.setTimeout(spawnMeteor, rand(400, 1400));
                }
            }
            scheduleSpawn();
        }, delay);
    }

    function start() {
        if (!field || prefersReducedMotion() || !isDesktopViewport()) {
            stop();
            return;
        }
        enabled = true;
        scheduleSpawn();
        // Seed one shortly after load so the section feels alive.
        window.setTimeout(() => {
            if (enabled) spawnMeteor();
        }, rand(800, 2400));
    }

    function onResize() {
        if (isDesktopViewport() && !prefersReducedMotion()) {
            if (!enabled) start();
        } else {
            stop();
        }
    }

    function init() {
        field = document.getElementById('heroMeteorField');
        if (!field) return;

        start();
        window.addEventListener('resize', onResize, { passive: true });

        const motionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (typeof motionMq.addEventListener === 'function') {
            motionMq.addEventListener('change', onResize);
        } else if (typeof motionMq.addListener === 'function') {
            motionMq.addListener(onResize);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

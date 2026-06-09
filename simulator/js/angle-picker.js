/**
 * Interactive unit-circle angle picker for rotation gate parameters.
 * 0 rad = positive X (3 o'clock), increases counter-clockwise.
 */
(function (global) {
    const TAU = Math.PI * 2;
    const SNAP_DEG = 15;
    const SNAP_THRESHOLD_DEG = 5;

    function normalizeAngle(rad) {
        let a = Number(rad) || 0;
        a %= TAU;
        if (a < 0) a += TAU;
        return a;
    }

    function radToDeg(rad) {
        return (normalizeAngle(rad) * 180) / Math.PI;
    }

    function degToRad(deg) {
        return normalizeAngle((Number(deg) || 0) * (Math.PI / 180));
    }

    function maybeSnapRad(rad, disableSnap) {
        const norm = normalizeAngle(rad);
        if (disableSnap) return norm;
        const deg = radToDeg(norm);
        const snapped = Math.round(deg / SNAP_DEG) * SNAP_DEG;
        const wrapped = ((deg - snapped + 180) % 360 + 360) % 360 - 180;
        if (Math.abs(wrapped) <= SNAP_THRESHOLD_DEG) {
            return degToRad(snapped);
        }
        return norm;
    }

    function formatRad(rad) {
        const n = normalizeAngle(rad);
        return parseFloat(n.toFixed(4));
    }

    function formatDeg(rad) {
        return parseFloat(radToDeg(rad).toFixed(1));
    }

    /**
     * @param {HTMLElement} container
     * @param {{ angleRad?: number, gateType?: string, onChange?: (rad: number) => void }} opts
     */
    function mountAnglePicker(container, opts = {}) {
        if (!container) return { setAngle() {}, destroy() {} };

        let angleRad = normalizeAngle(opts.angleRad ?? 0);
        let onChange = typeof opts.onChange === 'function' ? opts.onChange : null;
        let dragging = false;
        let fineControl = false;
        let destroyed = false;

        const gateFamily = String(opts.gateType || '').toUpperCase();
        const familyClass = gateFamily === 'RX'
            ? 'angle-picker--rx'
            : gateFamily === 'RY'
                ? 'angle-picker--ry'
                : gateFamily === 'RZ'
                    ? 'angle-picker--rz'
                    : '';

        container.innerHTML = '';
        const root = document.createElement('div');
        root.className = `angle-picker ${familyClass}`.trim();
        const gid = `anglePickerGlow_${Math.random().toString(36).slice(2, 9)}`;
        root.innerHTML = `
            <div class="angle-picker__dial" tabindex="0" role="slider"
                aria-label="Rotation angle"
                aria-valuemin="0"
                aria-valuemax="360"
                aria-valuenow="0">
                <svg class="angle-picker__svg" viewBox="0 0 220 220" aria-hidden="true">
                    <defs>
                        <radialGradient id="${gid}" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stop-color="var(--angle-accent)" stop-opacity="0.14"/>
                            <stop offset="100%" stop-color="var(--angle-accent)" stop-opacity="0"/>
                        </radialGradient>
                    </defs>
                    <circle class="angle-picker__glow" cx="110" cy="110" r="98" fill="url(#${gid})"/>
                    <circle class="angle-picker__ring" cx="110" cy="110" r="88"/>
                    <g class="angle-picker__ticks"></g>
                    <line class="angle-picker__axis angle-picker__axis--x" x1="110" y1="110" x2="198" y2="110"/>
                    <line class="angle-picker__axis angle-picker__axis--y" x1="110" y1="110" x2="110" y2="22"/>
                    <line class="angle-picker__arm" x1="110" y1="110" x2="198" y2="110"/>
                    <circle class="angle-picker__hub" cx="110" cy="110" r="6"/>
                    <circle class="angle-picker__handle" cx="198" cy="110" r="11"/>
                    <text class="angle-picker__label angle-picker__label--zero" x="204" y="114">0</text>
                </svg>
            </div>
            <div class="angle-picker__readout">
                <span class="angle-picker__value-deg">0°</span>
                <span class="angle-picker__value-rad">0 rad</span>
            </div>
            <p class="angle-picker__hint">Drag the dot · snaps to 15° · hold Shift for fine control</p>
        `;
        container.appendChild(root);

        const dial = root.querySelector('.angle-picker__dial');
        const svg = root.querySelector('.angle-picker__svg');
        const ticksG = root.querySelector('.angle-picker__ticks');
        const arm = root.querySelector('.angle-picker__arm');
        const handle = root.querySelector('.angle-picker__handle');
        const readoutDeg = root.querySelector('.angle-picker__value-deg');
        const readoutRad = root.querySelector('.angle-picker__value-rad');

        const CX = 110;
        const CY = 110;
        const R = 88;

        for (let deg = 0; deg < 360; deg += SNAP_DEG) {
            const rad = (deg * Math.PI) / 180;
            const major = deg % 90 === 0;
            const inner = major ? 72 : 80;
            const x1 = CX + inner * Math.cos(rad);
            const y1 = CY - inner * Math.sin(rad);
            const x2 = CX + R * Math.cos(rad);
            const y2 = CY - R * Math.sin(rad);
            const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('x1', String(x1));
            tick.setAttribute('y1', String(y1));
            tick.setAttribute('x2', String(x2));
            tick.setAttribute('y2', String(y2));
            tick.setAttribute('class', major ? 'angle-picker__tick angle-picker__tick--major' : 'angle-picker__tick');
            ticksG.appendChild(tick);
        }

        function emitChange() {
            if (onChange) onChange(angleRad);
        }

        function render() {
            const rad = normalizeAngle(angleRad);
            const hx = CX + R * Math.cos(rad);
            const hy = CY - R * Math.sin(rad);
            arm.setAttribute('x2', String(hx));
            arm.setAttribute('y2', String(hy));
            handle.setAttribute('cx', String(hx));
            handle.setAttribute('cy', String(hy));
            readoutDeg.textContent = `${formatDeg(rad)}°`;
            readoutRad.textContent = `${formatRad(rad)} rad`;
            dial.setAttribute('aria-valuenow', String(formatDeg(rad)));
            const deg = radToDeg(rad);
            const rem = ((deg % SNAP_DEG) + SNAP_DEG) % SNAP_DEG;
            root.classList.toggle('is-snapped', rem < 0.08 || rem > SNAP_DEG - 0.08);
        }

        function setAngle(rad, { silent = false, snap = false } = {}) {
            angleRad = snap ? maybeSnapRad(rad, fineControl) : normalizeAngle(rad);
            render();
            if (!silent) emitChange();
        }

        function pointerAngle(clientX, clientY) {
            const rect = svg.getBoundingClientRect();
            const scale = 220 / Math.min(rect.width, rect.height || 220);
            const x = (clientX - rect.left) * scale - CX;
            const y = (clientY - rect.top) * scale - CY;
            return normalizeAngle(Math.atan2(-y, x));
        }

        function onPointerDown(e) {
            if (destroyed || e.button > 0) return;
            e.preventDefault();
            dragging = true;
            fineControl = e.shiftKey;
            dial.setPointerCapture(e.pointerId);
            dial.classList.add('is-dragging');
            setAngle(pointerAngle(e.clientX, e.clientY), { snap: true });
        }

        function onPointerMove(e) {
            if (!dragging || destroyed) return;
            fineControl = e.shiftKey;
            setAngle(pointerAngle(e.clientX, e.clientY), { snap: true });
        }

        function onPointerUp(e) {
            if (!dragging || destroyed) return;
            dragging = false;
            fineControl = e.shiftKey;
            dial.classList.remove('is-dragging');
            try {
                dial.releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            setAngle(angleRad, { snap: true });
        }

        function onKeyDown(e) {
            if (destroyed) return;
            const stepDeg = e.shiftKey ? 1 : SNAP_DEG;
            let handled = false;
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                setAngle(angleRad + (stepDeg * Math.PI) / 180, { snap: !e.shiftKey });
                handled = true;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                setAngle(angleRad - (stepDeg * Math.PI) / 180, { snap: !e.shiftKey });
                handled = true;
            } else if (e.key === 'Home') {
                setAngle(0, { snap: true });
                handled = true;
            }
            if (handled) e.preventDefault();
        }

        dial.addEventListener('pointerdown', onPointerDown);
        dial.addEventListener('pointermove', onPointerMove);
        dial.addEventListener('pointerup', onPointerUp);
        dial.addEventListener('pointercancel', onPointerUp);
        dial.addEventListener('keydown', onKeyDown);

        render();

        return {
            setAngle(rad, options) {
                setAngle(rad, options);
            },
            getAngle() {
                return angleRad;
            },
            setOnChange(fn) {
                onChange = typeof fn === 'function' ? fn : null;
            },
            destroy() {
                if (destroyed) return;
                destroyed = true;
                dial.removeEventListener('pointerdown', onPointerDown);
                dial.removeEventListener('pointermove', onPointerMove);
                dial.removeEventListener('pointerup', onPointerUp);
                dial.removeEventListener('pointercancel', onPointerUp);
                dial.removeEventListener('keydown', onKeyDown);
                container.innerHTML = '';
            }
        };
    }

    global.mountAnglePicker = mountAnglePicker;
    global.normalizeRotationAngle = normalizeAngle;
})(typeof window !== 'undefined' ? window : globalThis);

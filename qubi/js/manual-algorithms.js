/**
 * Qubi manual: compact algorithm browser (same library as /simulator/js/algorithms.js).
 */
(function () {
    'use strict';

    const MAX_QUBITS = 12;
    const SIMULATOR_LOAD_KEY = 'qubibyte_simulator_load_v1';
    const categoryOrder = ['Entanglement', 'Communication', 'Algorithm', 'Concept', 'Error Correction'];
    const categoryIcons = {
        Entanglement: '🔗',
        Communication: '📡',
        Algorithm: '⚙️',
        Concept: '💡',
        'Error Correction': '🛡️'
    };

    function buildParamFieldsHtml(algo) {
        if (!algo.parameterizable || !algo.parameters) return '';
        let html = '<div class="manual-algo-params-inner">';
        algo.parameters.forEach(param => {
            let effectiveMax = param.max;
            if (param.key === 'numQubits') {
                effectiveMax = Math.min(param.max || MAX_QUBITS, MAX_QUBITS);
            } else if (param.key === 'numInputs') {
                effectiveMax = Math.min(param.max || MAX_QUBITS - 1, MAX_QUBITS - 1);
            }
            html += `<div class="manual-algo-param">`;
            html += `<label for="manual_param_${param.key}">${param.name}</label>`;
            if (param.type === 'select' && param.options) {
                html += `<select id="manual_param_${param.key}" class="manual-algo-select" data-param-key="${param.key}">`;
                param.options.forEach(opt => {
                    const sel = opt.value === param.default ? ' selected' : '';
                    html += `<option value="${opt.value}"${sel}>${opt.label}</option>`;
                });
                html += `</select>`;
            } else if (param.type === 'number') {
                const val = Math.min(param.default, effectiveMax || param.default);
                html += `<input type="number" id="manual_param_${param.key}" class="manual-algo-input" data-param-key="${param.key}" value="${val}"`;
                if (param.min !== undefined) html += ` min="${param.min}"`;
                if (effectiveMax !== undefined) html += ` max="${effectiveMax}"`;
                html += `>`;
            } else {
                html += `<input type="text" id="manual_param_${param.key}" class="manual-algo-input" data-param-key="${param.key}" value="${param.default}">`;
            }
            html += `</div>`;
        });
        html += '</div>';
        return html;
    }

    function gatherParams(algo) {
        const params = {};
        if (!algo.parameterizable || !algo.parameters) return params;
        algo.parameters.forEach(param => {
            const el = document.getElementById(`manual_param_${param.key}`);
            if (!el) {
                params[param.key] = param.default;
                return;
            }
            if (param.type === 'number') {
                params[param.key] = parseInt(el.value, 10) || param.default;
            } else {
                params[param.key] = el.value || param.default;
            }
        });
        return params;
    }

    function updatePreview(root, algoKey) {
        const algo = QuantumAlgorithms[algoKey];
        const pre = root.querySelector('#manualAlgoPreview');
        const valEl = root.querySelector('#manualAlgoValidation');
        const metaEl = root.querySelector('#manualAlgoMeta');
        const commentsEl = root.querySelector('#manualAlgoComments');
        if (!algo || !pre || !valEl) return;

        const withComments = commentsEl ? commentsEl.checked : true;
        const params = gatherParams(algo);

        valEl.textContent = '';
        valEl.classList.remove('is-error');
        delete root._pendingSimLoad;

        const validationErrors = validateQuantumAlgorithmParams(algoKey, params, MAX_QUBITS);
        if (validationErrors.length > 0) {
            pre.classList.remove('qubi-syntax-preview');
            pre.innerHTML = '';
            pre.textContent = validationErrors.join('\n');
            pre.classList.add('preview-error');
            valEl.textContent = 'Adjust parameters to see valid Qubi.';
            valEl.classList.add('is-error');
            if (metaEl) metaEl.textContent = '';
            return;
        }

        const result = computeQuantumAlgorithmCode(algoKey, params, withComments);
        if (result.error) {
            pre.classList.remove('qubi-syntax-preview');
            pre.innerHTML = '';
            pre.textContent = result.error;
            pre.classList.add('preview-error');
            if (metaEl) metaEl.textContent = '';
            return;
        }
        if (result.qubits > MAX_QUBITS) {
            pre.classList.remove('qubi-syntax-preview');
            pre.innerHTML = '';
            pre.textContent = `This example needs ${result.qubits} qubits (manual preview is capped at ${MAX_QUBITS}).`;
            pre.classList.add('preview-error');
            if (metaEl) metaEl.textContent = '';
            return;
        }

        pre.classList.remove('preview-error');
        if (typeof window.qubiHighlightCodeToHtml === 'function') {
            pre.classList.add('qubi-syntax-preview');
            pre.innerHTML = window.qubiHighlightCodeToHtml(result.code);
        } else {
            pre.classList.remove('qubi-syntax-preview');
            pre.innerHTML = '';
            pre.textContent = result.code;
        }
        root._pendingSimLoad = { code: result.code, qubits: result.qubits };
        if (metaEl) {
            metaEl.textContent = `${result.qubits} qubit${result.qubits === 1 ? '' : 's'}`;
        }
    }

    function selectAlgorithm(root, algoKey) {
        const algo = QuantumAlgorithms[algoKey];
        if (!algo) return;

        root.dataset.selectedKey = algoKey;
        root.querySelectorAll('.manual-algo-chip').forEach(btn => {
            btn.classList.toggle('is-active', btn.dataset.algoKey === algoKey);
        });

        const titleEl = root.querySelector('#manualAlgoTitle');
        const paramsHost = root.querySelector('#manualAlgoParamsHost');
        if (titleEl) titleEl.textContent = `${algo.icon || '⚛️'} ${algo.name}`;

        if (paramsHost) {
            paramsHost.innerHTML = buildParamFieldsHtml(algo);
            paramsHost.querySelectorAll('select, input').forEach(el => {
                el.addEventListener('input', () => updatePreview(root, algoKey));
                el.addEventListener('change', () => updatePreview(root, algoKey));
            });
        }

        const commentsEl = root.querySelector('#manualAlgoComments');
        if (commentsEl && !commentsEl._bound) {
            commentsEl._bound = true;
            commentsEl.addEventListener('change', () => updatePreview(root, algoKey));
        }

        updatePreview(root, algoKey);
    }

    function buildChipsHtml() {
        const categories = {};
        Object.entries(QuantumAlgorithms).forEach(([key, algo]) => {
            const cat = algo.category || 'Other';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ key, algo });
        });

        let html = '';
        categoryOrder.forEach(catName => {
            if (!categories[catName]) return;
            const icon = categoryIcons[catName] || '📦';
            html += `<div class="manual-algo-cat"><span class="manual-algo-cat-label">${icon} ${catName}</span><div class="manual-algo-chips">`;
            categories[catName].forEach(({ key, algo }) => {
                const safeName = algo.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
                html += `<button type="button" class="manual-algo-chip" data-algo-key="${key}" title="${safeName}">${algo.name}</button>`;
            });
            html += `</div></div>`;
        });
        return html;
    }

    function init() {
        if (typeof QuantumAlgorithms === 'undefined' ||
            typeof validateQuantumAlgorithmParams === 'undefined' ||
            typeof computeQuantumAlgorithmCode === 'undefined') {
            return;
        }

        const mount = document.getElementById('manualAlgoExamplesRoot');
        if (!mount) return;

        const keys = Object.keys(QuantumAlgorithms);
        if (keys.length === 0) return;

        mount.hidden = false;
        mount.innerHTML = `
            <div class="manual-algo-browser" id="manualAlgoBrowser">
                <div class="manual-algo-chip-panel">${buildChipsHtml()}</div>
                <div class="manual-algo-detail">
                    <h3 class="manual-algo-detail-title" id="manualAlgoTitle"></h3>
                    <div id="manualAlgoParamsHost"></div>
                    <label class="manual-algo-comments-label">
                        <input type="checkbox" id="manualAlgoComments" checked>
                        <span>Include comments in Qubi</span>
                    </label>
                    <pre class="manual-algo-preview" id="manualAlgoPreview" aria-live="polite"></pre>
                    <p class="manual-algo-meta" id="manualAlgoMeta"></p>
                    <div class="manual-algo-actions">
                        <button type="button" class="manual-algo-copy-btn" id="manualAlgoCopy">Copy Qubi</button>
                        <a class="manual-algo-sim-link" id="manualOpenSimulator" href="/simulator/">Open in Simulator</a>
                    </div>
                    <p class="manual-algo-validation" id="manualAlgoValidation"></p>
                </div>
            </div>
        `;

        const browser = mount.querySelector('#manualAlgoBrowser');
        browser.querySelectorAll('.manual-algo-chip').forEach(btn => {
            btn.addEventListener('click', () => selectAlgorithm(browser, btn.dataset.algoKey));
        });

        const copyBtn = browser.querySelector('#manualAlgoCopy');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                const pre = browser.querySelector('#manualAlgoPreview');
                const text = pre ? pre.textContent : '';
                if (!text || pre.classList.contains('preview-error')) return;
                try {
                    await navigator.clipboard.writeText(text);
                    copyBtn.textContent = 'Copied';
                    setTimeout(() => { copyBtn.textContent = 'Copy Qubi'; }, 1600);
                } catch {
                    copyBtn.textContent = 'Copy failed';
                    setTimeout(() => { copyBtn.textContent = 'Copy Qubi'; }, 1600);
                }
            });
        }

        const simLink = browser.querySelector('#manualOpenSimulator');
        if (simLink) {
            simLink.addEventListener('click', (e) => {
                const pending = browser._pendingSimLoad;
                if (!pending || typeof pending.code !== 'string' || typeof pending.qubits !== 'number') {
                    e.preventDefault();
                    const valEl = browser.querySelector('#manualAlgoValidation');
                    if (valEl) {
                        valEl.textContent = 'Fix the preview above before opening the simulator.';
                        valEl.classList.add('is-error');
                    }
                    return;
                }
                e.preventDefault();
                try {
                    sessionStorage.setItem(SIMULATOR_LOAD_KEY, JSON.stringify(pending));
                } catch {
                    return;
                }
                window.location.href = simLink.getAttribute('href') || '/simulator/';
            });
        }

        let defaultKey = keys[0];
        for (const cat of categoryOrder) {
            const entry = Object.entries(QuantumAlgorithms).find(([, a]) => (a.category || 'Other') === cat);
            if (entry) {
                defaultKey = entry[0];
                break;
            }
        }
        selectAlgorithm(browser, defaultKey);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

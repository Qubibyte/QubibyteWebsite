(() => {
    'use strict';

    const WORKER_URL = 'https://qubiai.trentrosenthal25.workers.dev/';
    const PREFIX = 'Hey QubiAI, ';
    const MAX_CHARS = 300;
    const COOLDOWN_MS = 10_000;

    let lastRequestTime = 0;
    let cooldownTimer = null;

    const $ = id => document.getElementById(id);

    function formatQubiAiErrorForStatus(message) {
        let m = (message == null ? 'Request failed' : String(message)).trim();
        m = m.replace(/^(ERROR:\s*)+/gi, '').trim();
        return m || 'Request failed';
    }

    /**
     * The worker sometimes returns HTTP 200 with the error message in `code` instead of `error`.
     * Only paste when the payload clearly looks like Qubi circuit lines, not prose errors.
     */
    function pickExplicitError(data) {
        if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
        if (typeof data.detail === 'string' && data.detail.trim()) return data.detail.trim();
        if (Array.isArray(data.errors) && data.errors.length) {
            const e = data.errors[0];
            if (typeof e === 'string' && e.trim()) return e.trim();
            if (e && typeof e.message === 'string' && e.message.trim()) return e.message.trim();
        }
        if (data.success === false) {
            if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
            if (typeof data.reason === 'string' && data.reason.trim()) return data.reason.trim();
            if (typeof data.msg === 'string' && data.msg.trim()) return data.msg.trim();
            return 'Invalid request';
        }
        if (data.ok === false || data.status === 'error') {
            if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
            return 'Request failed';
        }
        return '';
    }

    function parseWorkerPayload(data) {
        if (!data || typeof data !== 'object') return { code: null, err: 'Invalid response' };
        const explicit = pickExplicitError(data);
        if (explicit) {
            return { code: null, err: explicit };
        }
        let raw = data.code;
        if (raw != null && typeof raw !== 'string') {
            raw = String(raw);
        }
        if (typeof raw !== 'string') {
            return { code: null, err: 'No code returned' };
        }
        const trimmed = raw.trim();
        if (!trimmed) {
            return { code: null, err: 'No code returned' };
        }
        const looksLikeErrorText =
            /^(error|invalid|failed|bad request|unauthorized|forbidden)\b/i.test(trimmed) ||
            /invalid request/i.test(trimmed) ||
            /^rate\s*limit/i.test(trimmed);
        if (looksLikeErrorText) {
            return { code: null, err: trimmed };
        }
        const lines = trimmed
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('//'));
        if (lines.length === 0) {
            return { code: null, err: trimmed.length < 160 ? trimmed : 'Response was not Qubi circuit code' };
        }
        const gateLine =
            /^(H|X|Y|Z|S|T|CX|CY|CZ|SWAP|RX|RY|RZ|REPEAT|END|MEASURE)\b/i;
        if (!lines.some(l => gateLine.test(l))) {
            return { code: null, err: trimmed.length < 200 ? trimmed : 'Response was not Qubi circuit code' };
        }
        return { code: trimmed, err: null };
    }

    function init() {
        const input = $('qubiAiInput');
        const btn = $('qubiAiBtn');
        const charcount = $('qubiAiCharcount');
        const cooldownEl = $('qubiAiCooldown');
        const statusEl = $('qubiAiStatus');
        const btnText = btn.querySelector('.qubi-ai-btn-text');
        const btnSpinner = btn.querySelector('.qubi-ai-btn-spinner');

        if (!input || !btn) return;

        input.addEventListener('input', () => {
            const len = input.value.length;
            charcount.textContent = `${len} / ${MAX_CHARS}`;
            charcount.classList.toggle('at-limit', len >= MAX_CHARS);
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                btn.click();
            }
        });

        btn.addEventListener('click', async () => {
            const prompt = input.value.trim();
            if (!prompt) return;

            const now = Date.now();
            const remaining = COOLDOWN_MS - (now - lastRequestTime);
            if (remaining > 0) {
                showCooldown(cooldownEl, remaining);
                return;
            }

            setLoading(true, btn, btnText, btnSpinner, input);
            statusEl.textContent = '';
            statusEl.className = 'qubi-ai-status';

            try {
                const res = await fetch(WORKER_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: PREFIX + prompt })
                });

                let data = {};
                try {
                    data = await res.json();
                } catch {
                    data = {};
                }

                if (!res.ok) {
                    const parsed = parseWorkerPayload(data);
                    const msg = parsed.err && parsed.err !== 'No code returned'
                        ? parsed.err
                        : `Server error ${res.status}`;
                    throw new Error(msg);
                }

                const parsed = parseWorkerPayload(data);
                if (parsed.err) {
                    throw new Error(parsed.err);
                }

                insertCode(parsed.code);
                statusEl.textContent = 'Generated';
                statusEl.className = 'qubi-ai-status success';
                input.value = '';
                charcount.textContent = `0 / ${MAX_CHARS}`;
            } catch (err) {
                statusEl.textContent = `ERROR: ${formatQubiAiErrorForStatus(err.message)}`;
                statusEl.className = 'qubi-ai-status error';
            } finally {
                lastRequestTime = Date.now();
                setLoading(false, btn, btnText, btnSpinner, input);
                startCooldownDisplay(cooldownEl);
            }
        });
    }

    function insertCode(code) {
        const editor = $('qubiCode');
        if (!editor) return;

        const ui = window.circuitUI;
        if (ui && ui.syntaxHighlighter) {
            ui.setEditorCode(code, { preserveUndo: true, adjustQubits: true });
            ui.syncCodeToCircuit();
        } else {
            editor.value = code;
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function setLoading(on, btn, btnText, btnSpinner, input) {
        btn.disabled = on;
        input.disabled = on;
        btnText.style.display = on ? 'none' : '';
        btnSpinner.style.display = on ? 'inline-block' : 'none';
        btn.classList.toggle('loading', on);
    }

    function startCooldownDisplay(cooldownEl) {
        if (cooldownTimer) clearInterval(cooldownTimer);

        const updateText = () => {
            const remaining = COOLDOWN_MS - (Date.now() - lastRequestTime);
            if (remaining <= 0) {
                cooldownEl.textContent = '';
                clearInterval(cooldownTimer);
                cooldownTimer = null;
                return;
            }
            cooldownEl.textContent = `${Math.ceil(remaining / 1000)}s`;
        };
        updateText();
        cooldownTimer = setInterval(updateText, 250);
    }

    function showCooldown(cooldownEl, remaining) {
        cooldownEl.textContent = `Wait ${Math.ceil(remaining / 1000)}s`;
        cooldownEl.classList.add('warn');
        setTimeout(() => cooldownEl.classList.remove('warn'), 1500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

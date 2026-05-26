// Qubi Syntax Highlighter

/**
 * @typedef {'ctrl-last' | 'swap2' | 'broadcast' | 'rotation' | 'measure-q' | 'repeat-block' | 'repeat-end' | 'custom-joint'} QubiAcLayout
 * @typedef {{ insert: string, label: string, desc: string, examples?: string[], kind?: string, acLayout?: QubiAcLayout, acMeta?: { jointQ?: number } }} QubiAcItem
 */

const _qubiEx1 = /** @type {string[]} */ (['G 0', 'G (0,1,2)', 'G [0,1]']);
const _qubiExRot = /** @type {string[]} */ (['G 0', 'G [0,1] 0.5', 'G (0,1) 90deg']);
const _qubiExCtrl = /** @type {string[]} */ (['G [0,1]', 'G [0,1,2]', 'G ([0,1],[2,3])']);

/** Built-in completions (insert text is canonical Qubi spelling). */
const QUBI_BUILTIN_COMPLETIONS = /** @type {QubiAcItem[]} */ ([
    {
        insert: 'H',
        label: 'H',
        desc: 'Hadamard: equal superposition of |0⟩ and |1⟩',
        examples: ['H 0', 'H (0,1,2)', 'H [0,1]'],
        acLayout: 'broadcast'
    },
    { insert: 'X', label: 'X', desc: 'Pauli-X, bit-flip (NOT)', examples: _qubiEx1.map((s) => s.replace('G', 'X')), acLayout: 'broadcast' },
    { insert: 'Y', label: 'Y', desc: 'Pauli-Y', examples: _qubiEx1.map((s) => s.replace('G', 'Y')), acLayout: 'broadcast' },
    { insert: 'Z', label: 'Z', desc: 'Pauli-Z, phase flip on |1⟩', examples: _qubiEx1.map((s) => s.replace('G', 'Z')), acLayout: 'broadcast' },
    { insert: 'S', label: 'S', desc: 'Phase gate S = √Z', examples: _qubiEx1.map((s) => s.replace('G', 'S')), acLayout: 'broadcast' },
    { insert: 'T', label: 'T', desc: 'T gate, π/4 phase on |1⟩', examples: _qubiEx1.map((s) => s.replace('G', 'T')), acLayout: 'broadcast' },
    { insert: 'RX', label: 'RX', desc: 'Rotate around X (optional angle in π, deg, or rad)', examples: _qubiExRot.map((s) => s.replace('G', 'RX')), acLayout: 'rotation' },
    { insert: 'RY', label: 'RY', desc: 'Rotate around Y (optional angle in π, deg, or rad)', examples: _qubiExRot.map((s) => s.replace('G', 'RY')), acLayout: 'rotation' },
    { insert: 'RZ', label: 'RZ', desc: 'Rotate around Z (optional angle in π, deg, or rad)', examples: _qubiExRot.map((s) => s.replace('G', 'RZ')), acLayout: 'rotation' },
    { insert: 'CX', label: 'CX', desc: 'Controlled-X (CNOT, Toffoli, …): NOT on the last wire', examples: _qubiExCtrl.map((s) => s.replace('G', 'CX')), acLayout: 'ctrl-last' },
    { insert: 'CY', label: 'CY', desc: 'Controlled-Y on the last wire', examples: _qubiExCtrl.map((s) => s.replace('G', 'CY')), acLayout: 'ctrl-last' },
    { insert: 'CZ', label: 'CZ', desc: 'Controlled-Z on the last wire', examples: _qubiExCtrl.map((s) => s.replace('G', 'CZ')), acLayout: 'ctrl-last' },
    { insert: 'SWAP', label: 'SWAP', desc: 'Swap two qubits', examples: ['SWAP [0,1]', 'SWAP [1,0]'], acLayout: 'swap2' },
    { insert: 'MEASURE', label: 'MEASURE', desc: 'Projective measurement', examples: ['MEASURE 0', 'MEASURE 1'], acLayout: 'measure-q' },
    { insert: 'REPEAT', label: 'REPEAT', desc: 'Repeat the following block N times (closes with END)', examples: ['REPEAT 3', 'H 0', 'END'], acLayout: 'repeat-block' },
    { insert: 'END', label: 'END', desc: 'End innermost REPEAT block', examples: ['REPEAT 2', 'X 0', 'END'], acLayout: 'repeat-end' },
    { insert: '#import', label: '#import', desc: 'Include another .qubi file', examples: ['#import lib.qubi', '#import ./parts/circuit.qubi'] },
    { insert: '#include', label: '#include', desc: 'Alias of #import', examples: ['#include lib.qubi'] },
    {
        insert: '#define',
        label: '#define',
        desc: 'Define a custom unitary from a bracket matrix',
        examples: ['#define U [1 0; 0 1]', '#define R [0 -1i; 1i 0]', '#define I4 [1 0 0 0; 0 1 0 0; 0 0 1 0; 0 0 0 1]']
    }
]);

/** @param {string} name @param {number} nQubits */
function qubiCustomGateExamples(name, nQubits) {
    const n = Math.min(Math.max(1, Math.round(nQubits)), 4);
    const bracketList = Array.from({ length: n }, (_, i) => i).join(',');
    if (n === 1) {
        return [`${name} 0`, `${name} (0,1,2)`, `${name} [0,1]`];
    }
    if (n === 2) {
        return [`${name} [0,1]`, `${name} ([0,1],[2,3])`];
    }
    return [`${name} [${bracketList}]`];
}

function qubiLexStateAt(source, pos) {
    let state = 'code';
    const len = Math.min(source.length, pos);
    for (let i = 0; i < len; i++) {
        const c = source[i];
        const n = source[i + 1];
        if (state === 'code') {
            if (c === '/' && n === '/') {
                i++;
                state = 'lineComment';
                continue;
            }
            if (c === '/' && n === '*') {
                i++;
                state = 'blockComment';
                continue;
            }
        } else if (state === 'lineComment') {
            if (c === '\n') state = 'code';
        } else if (state === 'blockComment') {
            if (c === '*' && n === '/') {
                i++;
                state = 'code';
            }
        }
    }
    return state;
}

class QubiSyntaxHighlighter {
    constructor(textareaId, highlightId, lineNumbersId) {
        this.textarea = document.getElementById(textareaId);
        this.highlight = document.getElementById(highlightId);
        this.lineNumbers = document.getElementById(lineNumbersId);
        
        if (!this.textarea || !this.highlight) {
            console.warn('Syntax highlighter elements not found');
            return;
        }
        
        this.debounceTimer = null;
        this.debounceDelay = 400; // ms to wait before full syntax validation
        this.lineErrors = new Map(); // Store error messages for each line
        
        this.validGates = new Set([
            'H', 'X', 'Y', 'Z', 'S', 'T',
            'RX', 'RY', 'RZ',
            'CX', 'CY', 'CZ', 'SWAP',
            'MEASURE'
        ]);
        
        this.keywords = new Set(['REPEAT', 'END']);
        
        // Create tooltip elements
        this.tooltip = this.createTooltip();
        this.matrixPopup = this.createMatrixPopup();
        this.autocompleteRoot = null;
        this._acMeasureSpan = null;
        this._acOpen = false;
        this._acReplaceStart = 0;
        this._acReplaceEnd = 0;
        this._acMatches = [];
        this._acSelected = 0;
        /** @type {'gate' | 'directive' | null} */
        this._acMode = null;

        this.initEventListeners();
        this.initAutocompleteUi();
        this.updateHighlight();
        this.updateLineNumbers();
        this.updateWrapperWidth();
        this.updateWrapperHeight();
        this.hideAutocomplete();
    }

    setCode(code, opts = {}) {
        const { preserveUndo = false } = opts || {};
        const text = code == null ? '' : String(code);
        if (!this.textarea) return;

        if (preserveUndo) {
            // Prefer an undoable edit that integrates with native Ctrl+Z.
            // execCommand is deprecated but still the most reliable cross-browser way
            // to produce a real undo step for programmatic inserts.
            this.textarea.focus({ preventScroll: true });
            try {
                this.textarea.setSelectionRange(0, this.textarea.value.length);
            } catch {
                /* ignore */
            }

            let usedUndoablePath = false;
            try {
                if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
                    usedUndoablePath = document.execCommand('insertText', false, text);
                }
            } catch {
                usedUndoablePath = false;
            }

            if (!usedUndoablePath) {
                if (typeof this.textarea.setRangeText === 'function') {
                    this.textarea.setRangeText(text, 0, this.textarea.value.length, 'end');
                } else {
                    this.textarea.value = text;
                }
            }
        } else {
            this.textarea.value = text;
        }

        this.updateHighlight();
        this.updateLineNumbers();
        this.updateWrapperWidth();
        this.updateWrapperHeight();
        this.hideAutocomplete();
    }
    
    createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'syntax-error-tooltip';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);
        return tooltip;
    }
    
    showTooltip(message, x, y) {
        this.tooltip.textContent = message;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
    }
    
    hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    createMatrixPopup() {
        const el = document.createElement('div');
        el.className = 'matrix-preview-popup';
        el.style.display = 'none';
        document.body.appendChild(el);
        return el;
    }

    showMatrixPopup(html, x, y) {
        this.matrixPopup.innerHTML = html;
        this.matrixPopup.style.display = 'block';
        this.matrixPopup.style.left = `${x}px`;
        this.matrixPopup.style.top = `${y}px`;
        // Clamp to viewport
        requestAnimationFrame(() => {
            const rect = this.matrixPopup.getBoundingClientRect();
            if (rect.right > window.innerWidth - 8) {
                this.matrixPopup.style.left = `${window.innerWidth - rect.width - 8}px`;
            }
            if (rect.bottom > window.innerHeight - 8) {
                this.matrixPopup.style.top = `${y - rect.height - 8}px`;
            }
        });
    }

    hideMatrixPopup() {
        if (this.matrixPopup) this.matrixPopup.style.display = 'none';
    }

    initAutocompleteUi() {
        const wrapper = this.textarea && this.textarea.closest('.code-editor-wrapper');
        if (!wrapper) return;
        const root = document.createElement('div');
        root.className = 'qubi-autocomplete';
        root.style.display = 'none';
        root.setAttribute('role', 'listbox');
        root.setAttribute('aria-label', 'Qubi completions');
        root.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
        wrapper.appendChild(root);
        this.autocompleteRoot = root;
    }

    hideAutocomplete() {
        this._acOpen = false;
        this._acMatches = [];
        this._acSelected = 0;
        this._acMode = null;
        if (this.autocompleteRoot) {
            this.autocompleteRoot.style.display = 'none';
            this.autocompleteRoot.innerHTML = '';
        }
    }

    measureEditorTextWidth(text) {
        if (!text) return 0;
        if (!this._acMeasureSpan) {
            const s = document.createElement('span');
            s.style.visibility = 'hidden';
            s.style.position = 'absolute';
            s.style.whiteSpace = 'pre';
            s.style.top = '0';
            s.style.left = '-9999px';
            s.style.pointerEvents = 'none';
            document.body.appendChild(s);
            this._acMeasureSpan = s;
        }
        const el = this._acMeasureSpan;
        const cs = getComputedStyle(this.textarea);
        el.style.fontFamily = cs.fontFamily;
        el.style.fontSize = cs.fontSize;
        el.style.fontWeight = cs.fontWeight;
        el.style.letterSpacing = cs.letterSpacing;
        el.textContent = text;
        return el.offsetWidth;
    }

    gatherAllCompletionItems() {
        const items = QUBI_BUILTIN_COMPLETIONS.slice();
        const seen = new Set(items.map((x) => x.insert));
        const gm = typeof globalThis !== 'undefined' ? globalThis.GateMatrices : null;
        if (gm && typeof gm === 'object') {
            for (const k of Object.keys(gm)) {
                if (!/^[A-Z]{1,4}$/.test(k) || seen.has(k)) continue;
                seen.add(k);
                let nQ = 1;
                const flat = gm[k];
                if (Array.isArray(flat) && flat.length > 0) {
                    const dim = Math.round(Math.sqrt(flat.length));
                    if (dim > 0 && dim * dim === flat.length) {
                        const lg = Math.log2(dim);
                        if (Number.isFinite(lg) && lg >= 0 && Math.abs(lg - Math.round(lg)) < 1e-9) {
                            nQ = Math.round(lg);
                        }
                    }
                }
                /** @type {QubiAcItem} */
                const customItem = {
                    insert: k,
                    label: k,
                    desc: 'Custom unitary from #define in this session',
                    examples: qubiCustomGateExamples(k, nQ),
                    kind: 'custom',
                    acLayout: nQ > 1 ? 'custom-joint' : 'broadcast',
                    acMeta: nQ > 1 ? { jointQ: nQ } : undefined
                };
                items.push(customItem);
            }
        }
        return items;
    }

    /**
     * @returns {{ replaceStart: number, replaceEnd: number, partial: string, mode: 'directive' | 'gate' } | null}
     */
    getAutocompleteContextAtCursor() {
        const ta = this.textarea;
        if (!ta) return null;
        const value = ta.value;
        const cursor = ta.selectionStart;
        if (cursor !== ta.selectionEnd) return null;

        if (qubiLexStateAt(value, cursor) !== 'code') return null;

        const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
        let linePrefix = value.slice(lineStart, cursor);
        const lex = globalThis.QubiLex;
        if (lex && typeof lex.findLineCommentStart === 'function') {
            const cc = lex.findLineCommentStart(linePrefix);
            if (cc !== -1) {
                if (cursor > lineStart + cc) return null;
                linePrefix = linePrefix.slice(0, cc);
            }
        }

        const dir = linePrefix.match(/^\s*(#[A-Za-z]*)$/);
        if (dir) {
            const partial = dir[1];
            const replaceStart = lineStart + linePrefix.indexOf('#');
            return { replaceStart, replaceEnd: cursor, partial, mode: 'directive' };
        }

        const gate = linePrefix.match(/^\s*([A-Za-z0-9]*)$/);
        if (!gate) return null;
        const partial = gate[1];
        if (!partial) return null;
        const replaceStart = lineStart + linePrefix.length - partial.length;
        return { replaceStart, replaceEnd: cursor, partial, mode: 'gate' };
    }

    filterCompletionItems(items, partial, mode) {
        const p = partial.toLowerCase();
        const out = [];
        for (const it of items) {
            const ins = it.insert;
            if (mode === 'directive') {
                if (!ins.startsWith('#')) continue;
                if (!ins.toLowerCase().startsWith(p)) continue;
                if (ins.toLowerCase() === p) continue;
            } else {
                if (ins.startsWith('#')) continue;
                if (!ins.toLowerCase().startsWith(p)) continue;
                if (ins.toLowerCase() === p) continue;
            }
            out.push(it);
        }
        out.sort((a, b) => {
            const la = a.insert.length - partial.length;
            const lb = b.insert.length - partial.length;
            if (la !== lb) return la - lb;
            return a.insert.localeCompare(b.insert);
        });
        return out.slice(0, 14);
    }

    updateAutocompletePanel() {
        if (!this.textarea || !this.autocompleteRoot) return;
        if (this.textarea.selectionStart !== this.textarea.selectionEnd) {
            this.hideAutocomplete();
            return;
        }
        const ctx = this.getAutocompleteContextAtCursor();
        if (!ctx) {
            this.hideAutocomplete();
            return;
        }
        const matches = this.filterCompletionItems(this.gatherAllCompletionItems(), ctx.partial, ctx.mode);
        if (!matches.length) {
            this.hideAutocomplete();
            return;
        }
        this.hideTooltip();
        this._acReplaceStart = ctx.replaceStart;
        this._acReplaceEnd = ctx.replaceEnd;
        this._acMode = ctx.mode;
        this._acMatches = matches;
        this._acOpen = true;
        this._acSelected = 0;
        this.autocompleteRoot.style.display = 'block';
        this.renderAutocompleteList();
        this.positionAutocomplete();
    }

    /** @param {QubiAcItem} item */
    formatAutocompleteExamplesHtml(item) {
        const lines = item.examples;
        if (!lines || !lines.length) return '';
        const body = lines
            .map((ex) => `<span class="qubi-ac-ex-line">${this.escapeHtml(ex)}</span>`)
            .join('');
        return `<span class="qubi-ac-examples">${body}</span>`;
    }

    /**
     * Rich hint for how bracket / argument lists map to roles (controls vs target, etc.).
     * @param {QubiAcItem} item
     */
    formatAutocompleteParamPanelHtml(item) {
        const layout = item.acLayout;
        if (!layout) return '';
        const g = this.escapeHtml(item.insert);
        const lab = this.escapeHtml(item.label);

        switch (layout) {
            case 'ctrl-last': {
                const ex = `${item.insert} [0,1,2]`;
                return (
                    `<div class="qubi-ac-panel qubi-ac-panel-ctrl" aria-label="How qubit indices are interpreted">` +
                    `<div class="qubi-ac-panel-h">Bracket order</div>` +
                    `<div class="qubi-ac-flow">` +
                    `<div class="qubi-ac-node qubi-ac-node-ctl">` +
                    `<span class="qubi-ac-node-k">Controls</span>` +
                    `<span class="qubi-ac-node-v">all listed qubits except the <em>last</em></span>` +
                    `</div>` +
                    `<span class="qubi-ac-flow-arrow" aria-hidden="true">→</span>` +
                    `<div class="qubi-ac-node qubi-ac-node-tgt">` +
                    `<span class="qubi-ac-node-k">Target</span>` +
                    `<span class="qubi-ac-node-v">the <em>last</em> index (${lab} acts here)</span>` +
                    `</div>` +
                    `</div>` +
                    `<p class="qubi-ac-panel-note">So <code>${this.escapeHtml(ex)}</code> is <strong>not</strong> “two targets and one control”: it is controls on <code>0</code> and <code>1</code>, and the controlled gate on <code>2</code>.</p>` +
                    `<p class="qubi-ac-panel-note qubi-ac-panel-note-dim">Parallel in one timestep: <code>${g} ([0,1],[2,3])</code> — each <code>[…]</code> group is its own multi-controlled op on that column.</p>` +
                    `</div>`
                );
            }
            case 'swap2':
                return (
                    `<div class="qubi-ac-panel qubi-ac-panel-swap" aria-label="SWAP arguments">` +
                    `<div class="qubi-ac-panel-h">Exactly two wires</div>` +
                    `<div class="qubi-ac-flow qubi-ac-flow-swap">` +
                    `<div class="qubi-ac-node qubi-ac-node-swap"><span class="qubi-ac-node-k">Wire <code>a</code></span></div>` +
                    `<span class="qubi-ac-swap-glyph" aria-hidden="true">⇄</span>` +
                    `<div class="qubi-ac-node qubi-ac-node-swap"><span class="qubi-ac-node-k">Wire <code>b</code></span></div>` +
                    `</div>` +
                    `<p class="qubi-ac-panel-note">Use <code>SWAP [a,b]</code> — order does not matter; the gate is symmetric.</p>` +
                    `</div>`
                );
            case 'broadcast':
                return (
                    `<div class="qubi-ac-panel qubi-ac-panel-broadcast" aria-label="Single-qubit gate wiring">` +
                    `<div class="qubi-ac-panel-h">Wire arguments</div>` +
                    `<div class="qubi-ac-split2">` +
                    `<div class="qubi-ac-split-col">` +
                    `<span class="qubi-ac-split-tag">One wire</span>` +
                    `<p class="qubi-ac-split-body"><code>${g} 0</code> — shorthand for a single qubit index.</p>` +
                    `</div>` +
                    `<div class="qubi-ac-split-col">` +
                    `<span class="qubi-ac-split-tag">Several wires</span>` +
                    `<p class="qubi-ac-split-body"><code>${g} (0,1,2)</code> or <code>${g} [0,1,2]</code> — apply <code>${g}</code> once to each listed wire (same idea; pick the form you prefer).</p>` +
                    `</div>` +
                    `</div>` +
                    `</div>`
                );
            case 'rotation':
                return (
                    `<div class="qubi-ac-panel qubi-ac-panel-rot" aria-label="Rotation gate arguments">` +
                    `<div class="qubi-ac-panel-h">Angle &amp; wires</div>` +
                    `<p class="qubi-ac-panel-note">One wire: <code>${g} 0</code> then optional angle (defaults to <code>π/2</code>).</p>` +
                    `<p class="qubi-ac-panel-note">Many wires: <code>${g} (0,1)</code> or <code>${g} [0,1]</code>, then optional angle — same rotation applied on each listed wire.</p>` +
                    `</div>`
                );
            case 'measure-q':
                return (
                    `<div class="qubi-ac-panel qubi-ac-panel-meas" aria-label="Measurement syntax">` +
                    `<div class="qubi-ac-panel-h">Syntax</div>` +
                    `<p class="qubi-ac-panel-note"><code>MEASURE q</code> — one non-negative integer: the wire you measure. Bracket lists are not used here.</p>` +
                    `</div>`
                );
            case 'repeat-block':
                return (
                    `<div class="qubi-ac-panel qubi-ac-panel-repeat" aria-label="REPEAT block">` +
                    `<div class="qubi-ac-panel-h">Block structure</div>` +
                    `<p class="qubi-ac-panel-note"><code>REPEAT N</code> starts a block; <code>END</code> closes the innermost <code>REPEAT</code>. Lines between them are repeated <code>N</code> times.</p>` +
                    `</div>`
                );
            case 'repeat-end':
                return (
                    `<div class="qubi-ac-panel qubi-ac-panel-repeat" aria-label="END keyword">` +
                    `<div class="qubi-ac-panel-h">Pairs with REPEAT</div>` +
                    `<p class="qubi-ac-panel-note"><code>END</code> closes the <em>innermost</em> open <code>REPEAT</code> — place it after the lines you want repeated.</p>` +
                    `</div>`
                );
            case 'custom-joint': {
                const k = item.acMeta && item.acMeta.jointQ != null ? Math.max(1, Math.round(item.acMeta.jointQ)) : 2;
                const idx = Array.from({ length: k }, (_, i) => i).join(',');
                return (
                    `<div class="qubi-ac-panel qubi-ac-panel-custom" aria-label="Custom gate arguments">` +
                    `<div class="qubi-ac-panel-h">${k}-qubit unitary</div>` +
                    `<p class="qubi-ac-panel-note">Use exactly <strong>${k}</strong> comma-separated indices as one joint op, e.g. <code>${g} [${this.escapeHtml(idx)}]</code>.</p>` +
                    (k === 2
                        ? `<p class="qubi-ac-panel-note qubi-ac-panel-note-dim">Parallel pairs in one timestep: <code>${g} ([0,1],[2,3])</code>.</p>`
                        : '') +
                    `</div>`
                );
            }
            default:
                return '';
        }
    }

    /**
     * End index (exclusive) of the token being completed: gate name run or #directive letters.
     * Used so applying "RX" replaces "RE" when the cursor is still inside that token.
     * @param {string} value
     * @param {number} tokenStart
     * @param {'gate' | 'directive'} mode
     */
    getAutocompleteTokenEnd(value, tokenStart, mode) {
        const v = value;
        const n = v.length;
        if (tokenStart < 0 || tokenStart >= n) return tokenStart;
        if (mode === 'directive') {
            if (v[tokenStart] !== '#') return tokenStart;
            let i = tokenStart + 1;
            while (i < n && /[A-Za-z]/.test(v[i])) i++;
            return i;
        }
        let i = tokenStart;
        while (i < n && /[A-Za-z0-9]/.test(v[i])) i++;
        return i;
    }

    positionAutocomplete() {
        if (!this.autocompleteRoot || !this.textarea || this.autocompleteRoot.style.display === 'none') return;
        const ta = this.textarea;
        const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22;
        const padT = parseFloat(getComputedStyle(ta).paddingTop) || 16;
        const padL = parseFloat(getComputedStyle(ta).paddingLeft) || 16;
        const before = ta.value.slice(0, this._acReplaceStart);
        const lines = before.split('\n');
        const lineIdx = lines.length - 1;
        const colPrefix = lines[lineIdx];
        const top = padT + (lineIdx + 1) * lh;
        const left = padL + this.measureEditorTextWidth(colPrefix);
        this.autocompleteRoot.style.top = `${top}px`;
        this.autocompleteRoot.style.left = `${left}px`;
        requestAnimationFrame(() => {
            if (!this.autocompleteRoot || this.autocompleteRoot.style.display === 'none') return;
            const wrap = ta.closest('.code-editor-wrapper');
            if (!wrap) return;
            const wr = wrap.getBoundingClientRect();
            const pr = this.autocompleteRoot.getBoundingClientRect();
            if (pr.bottom > window.innerHeight - 6) {
                const above = padT + lineIdx * lh - pr.height;
                if (above >= 0) this.autocompleteRoot.style.top = `${above}px`;
            }
            if (pr.right > wr.right - 4) {
                const shift = pr.right - wr.right + 8;
                const cur = parseFloat(this.autocompleteRoot.style.left) || left;
                this.autocompleteRoot.style.left = `${Math.max(padL, cur - shift)}px`;
            }
        });
    }

    renderAutocompleteList() {
        if (!this.autocompleteRoot) return;
        const root = this.autocompleteRoot;
        root.innerHTML = '';
        this._acMatches.forEach((item, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'qubi-autocomplete-item' + (idx === this._acSelected ? ' is-active' : '');
            btn.setAttribute('role', 'option');
            btn.setAttribute('aria-selected', idx === this._acSelected ? 'true' : 'false');
            const panelHtml = this.formatAutocompleteParamPanelHtml(item);
            const exHtml = this.formatAutocompleteExamplesHtml(item);
            btn.innerHTML =
                `<span class="qubi-ac-label">${this.escapeHtml(item.label)}</span>` +
                `<span class="qubi-ac-desc">${this.escapeHtml(item.desc)}</span>` +
                panelHtml +
                exHtml;
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
            btn.addEventListener('click', () => {
                this._acSelected = idx;
                this.applyAutocompleteSelection();
            });
            root.appendChild(btn);
        });
        requestAnimationFrame(() => {
            const active = root.querySelector('.qubi-autocomplete-item.is-active');
            if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
    }

    applyAutocompleteSelection() {
        const item = this._acMatches[this._acSelected];
        if (!item || !this.textarea) return;
        const ta = this.textarea;
        const start = this._acReplaceStart;
        let end = this._acReplaceEnd;
        const v = ta.value;
        const mode = this._acMode || 'gate';
        const tokenEnd = this.getAutocompleteTokenEnd(v, start, mode);
        if (tokenEnd > end) end = tokenEnd;
        const ins = item.insert;
        ta.value = v.slice(0, start) + ins + v.slice(end);
        const newPos = start + ins.length;
        ta.selectionStart = ta.selectionEnd = newPos;
        this.hideAutocomplete();
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    tryAutocompleteKeydown(e) {
        if (!this._acOpen || !this._acMatches.length) return false;
        if (e.key === 'Escape') {
            this.hideAutocomplete();
            e.preventDefault();
            e.stopPropagation();
            return true;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const n = this._acMatches.length;
            this._acSelected = (this._acSelected + 1) % n;
            this.renderAutocompleteList();
            this.positionAutocomplete();
            return true;
        }
        if (e.key === 'ArrowUp') {
            if (!e.ctrlKey && !e.metaKey && !e.altKey && this._acSelected === 0) {
                this.hideAutocomplete();
                e.preventDefault();
                return true;
            }
            e.preventDefault();
            this._acSelected = Math.max(this._acSelected - 1, 0);
            this.renderAutocompleteList();
            this.positionAutocomplete();
            return true;
        }
        if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            this.hideAutocomplete();
            return false;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.applyAutocompleteSelection();
            return true;
        }
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            this.applyAutocompleteSelection();
            return true;
        }
        if (e.key === 'Tab' && e.shiftKey) {
            this.hideAutocomplete();
            return false;
        }
        return false;
    }

    splitMatrixRow(row) {
        const tokens = [];
        let cur = '';
        let depth = 0;
        for (let j = 0; j < row.length; j++) {
            const ch = row[j];
            if (ch === '(') depth++;
            else if (ch === ')') depth = Math.max(0, depth - 1);
            if (depth === 0 && (ch === ',' || ch === ' ' || ch === '\t')) {
                if (cur.trim()) tokens.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        if (cur.trim()) tokens.push(cur.trim());
        return tokens;
    }

    tryParseDefineMatrix(line) {
        const m = line.match(/^#define\s+[A-Za-z]{1,4}\s+(\[.*?\])/i);
        if (!m) return null;
        const body = m[1];
        const inside = body.slice(1, -1).trim();
        if (!inside) return null;
        const rows = inside.split(';').map(r => r.trim()).filter(Boolean);
        if (rows.length === 0) return null;
        const dim = rows.length;
        const parsed = [];
        for (const row of rows) {
            const cells = this.splitMatrixRow(row);
            if (cells.length !== dim) return null;
            parsed.push(cells);
        }
        if ((dim & (dim - 1)) !== 0 || dim < 2) return null;
        return parsed;
    }

    formatMatrixHtml(cells) {
        const dim = cells.length;
        let html = '<div class="mp-grid" style="grid-template-columns: repeat(' + dim + ', auto);">';
        for (let r = 0; r < dim; r++) {
            for (let c = 0; c < dim; c++) {
                html += `<span class="mp-cell">${this.escapeHtml(cells[r][c])}</span>`;
            }
        }
        html += '</div>';
        return html;
    }

    getLineAtY(clientY) {
        if (!this.textarea) return -1;
        const wrapper = this.textarea.closest('.code-editor-wrapper');
        if (!wrapper) return -1;
        const wrapperRect = wrapper.getBoundingClientRect();
        const scrollTop = wrapper.scrollTop;
        const lineHeight = parseFloat(getComputedStyle(this.textarea).lineHeight) || 22;
        const paddingTop = parseFloat(getComputedStyle(this.textarea).paddingTop) || 16;
        const relativeY = clientY - wrapperRect.top + scrollTop - paddingTop;
        return Math.floor(relativeY / lineHeight);
    }

    initEventListeners() {
        // Input event - immediate visual update, debounced validation
        this.textarea.addEventListener('input', () => {
            this.hideTooltip();
            this.hideMatrixPopup();
            this.updateHighlightImmediate(); // Show text immediately
            this.updateLineNumbers(); // Update line numbers immediately
            this.updateWrapperWidth(); // Update wrapper width for horizontal scrolling
            this.updateWrapperHeight(); // Update wrapper height for vertical scrolling
            this.syncScroll();
            this.debouncedValidation(); // Validate after delay
            this.updateAutocompletePanel();
        });
        
        // Scroll sync - listen to wrapper scroll instead
        const wrapper = this.textarea.closest('.code-editor-wrapper');
        if (wrapper) {
            wrapper.addEventListener('scroll', () => {
                this.syncScroll();
                this.positionAutocomplete();
            });
        }
        
        // Also handle textarea scroll for compatibility
        this.textarea.addEventListener('scroll', () => {
            this.syncScroll();
        });
        
        // Tab indent vs autocomplete (Tab / Enter accept suggestion)
        this.textarea.addEventListener('keydown', (e) => {
            if (this.tryAutocompleteKeydown(e)) return;
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.textarea.selectionStart;
                const end = this.textarea.selectionEnd;
                const value = this.textarea.value;
                this.textarea.value = value.substring(0, start) + '    ' + value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
                this.updateHighlightImmediate();
                this.updateLineNumbers();
            }
        });
        
        // Show tooltip on cursor position change (click or arrow keys)
        this.textarea.addEventListener('click', (e) => {
            this.updateAutocompletePanel();
            this.checkErrorAtCursor(e);
        });
        
        this.textarea.addEventListener('keyup', (e) => {
            if (this._acOpen && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                this.hideTooltip();
                return;
            }
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Backspace', 'Delete'].includes(e.key)) {
                this.updateAutocompletePanel();
                this.checkErrorAtCursor(e);
            }
        });
        
        // Hide tooltip when textarea loses focus
        this.textarea.addEventListener('blur', () => {
            this.hideTooltip();
            this.hideAutocomplete();
        });

        // Matrix preview popup on hover over #define lines
        this._matrixHoverLine = -1;
        const editorWrapper = this.textarea.closest('.code-editor-wrapper');
        if (editorWrapper) {
            editorWrapper.addEventListener('mousemove', (e) => {
                const lineIdx = this.getLineAtY(e.clientY);
                if (lineIdx === this._matrixHoverLine) return;
                this._matrixHoverLine = lineIdx;
                const lines = this.textarea.value.split('\n');
                if (lineIdx < 0 || lineIdx >= lines.length) {
                    this.hideMatrixPopup();
                    return;
                }
                const line = lines[lineIdx].trim();
                const cells = this.tryParseDefineMatrix(line);
                if (!cells) {
                    this.hideMatrixPopup();
                    return;
                }
                const html = this.formatMatrixHtml(cells);
                this.showMatrixPopup(html, e.clientX + 16, e.clientY + 16);
            });
            editorWrapper.addEventListener('mouseleave', () => {
                this._matrixHoverLine = -1;
                this.hideMatrixPopup();
            });
        }
        
        // Line numbers hover
        if (this.lineNumbers) {
            this.lineNumbers.addEventListener('mouseover', (e) => {
                if (e.target.classList.contains('line-num') && e.target.classList.contains('error')) {
                    const lineNum = parseInt(e.target.textContent) - 1;
                    const errorMsg = this.lineErrors.get(lineNum);
                    if (errorMsg) {
                        const rect = e.target.getBoundingClientRect();
                        this.showTooltip(errorMsg, rect.right + 10, rect.top);
                    }
                }
            });
            
            this.lineNumbers.addEventListener('mouseout', (e) => {
                if (e.target.classList.contains('line-num')) {
                    this.hideTooltip();
                }
            });
        }
    }
    
    checkErrorAtCursor(e) {
        if (this._acOpen) {
            this.hideTooltip();
            return;
        }
        const cursorPos = this.textarea.selectionStart;
        const textBeforeCursor = this.textarea.value.substring(0, cursorPos);
        const lineNum = textBeforeCursor.split('\n').length - 1;
        
        const errorMsg = this.lineErrors.get(lineNum);
        if (errorMsg) {
            // Position tooltip near the textarea
            const rect = this.textarea.getBoundingClientRect();
            const lines = textBeforeCursor.split('\n');
            const lineHeight = parseFloat(getComputedStyle(this.textarea).lineHeight) || 22;
            const paddingTop = parseFloat(getComputedStyle(this.textarea).paddingTop) || 16;
            const yOffset = (lines.length * lineHeight) + paddingTop - this.textarea.scrollTop;
            
            this.showTooltip(errorMsg, rect.left + 20, rect.top + Math.min(yOffset, rect.height - 30));
        } else {
            this.hideTooltip();
        }
    }
    
    debouncedValidation() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.updateHighlight(); // Full syntax highlighting with validation
            this.updateLineNumbers();
        }, this.debounceDelay);
    }
    
    // Immediate highlight without error checking - just show the text with basic coloring
    updateHighlightImmediate() {
        if (!this.highlight) return;
        
        const code = this.textarea.value;
        const lines = code.split('\n');

        let inBlock = false;
        const highlightedLines = lines.map((line) => {
            const r = this.highlightLineWithEmbeddedComments(line, inBlock, null);
            inBlock = r.inBlock;
            return r.html;
        });
        
        this.highlight.innerHTML = highlightedLines.join('\n') + '\n';
    }
    
    updateWrapperWidth() {
        // Update textarea and highlight width based on content
        if (!this.textarea || !this.highlight) return;
        
        // Calculate the maximum line width
        const lines = this.textarea.value.split('\n');
        let maxWidth = 0;
        
        // Create a temporary element to measure text width
        const measureEl = document.createElement('span');
        measureEl.style.visibility = 'hidden';
        measureEl.style.position = 'absolute';
        measureEl.style.fontFamily = getComputedStyle(this.textarea).fontFamily;
        measureEl.style.fontSize = getComputedStyle(this.textarea).fontSize;
        measureEl.style.whiteSpace = 'pre';
        document.body.appendChild(measureEl);
        
        for (const line of lines) {
            measureEl.textContent = line || ' '; // Use space for empty lines
            const width = measureEl.offsetWidth;
            maxWidth = Math.max(maxWidth, width);
        }
        
        document.body.removeChild(measureEl);
        
        // Add padding (1rem on each side = 32px total)
        const padding = 32;
        const contentWidth = maxWidth + padding;
        const wrapper = this.textarea.closest('.code-editor-wrapper');
        const wrapperWidth = wrapper ? wrapper.offsetWidth : 0;
        
        // Set width to be at least wrapper width, but expand if content is wider
        const finalWidth = Math.max(wrapperWidth, contentWidth);
        this.textarea.style.width = `${finalWidth}px`;
        this.highlight.style.width = `${finalWidth}px`;
    }

    updateWrapperHeight() {
        // Ensure the wrapper can scroll vertically as lines grow.
        // We keep textarea overflow hidden and instead grow the absolute-positioned layers.
        if (!this.textarea || !this.highlight) return;

        const wrapper = this.textarea.closest('.code-editor-wrapper');
        const minHeight = wrapper ? wrapper.clientHeight : 0;

        // Temporarily shrink so scrollHeight reflects content, not previous set height.
        this.textarea.style.height = '0px';
        const contentHeight = this.textarea.scrollHeight;

        const finalHeight = Math.max(minHeight, contentHeight);
        this.textarea.style.height = `${finalHeight}px`;
        this.highlight.style.height = `${finalHeight}px`;
    }
    
    syncScroll() {
        // Sync scroll with wrapper instead of textarea's internal scroll
        const wrapper = this.textarea.closest('.code-editor-wrapper');
        if (wrapper) {
            // Get the scroll position from the wrapper
            const scrollLeft = wrapper.scrollLeft;
            const scrollTop = wrapper.scrollTop;
            
            // Apply to highlight and line numbers
            if (this.highlight) {
                this.highlight.scrollTop = scrollTop;
                this.highlight.scrollLeft = scrollLeft;
            }
            if (this.lineNumbers) {
                this.lineNumbers.scrollTop = scrollTop;
            }
        }
    }
    
    updateLineNumbers() {
        if (!this.lineNumbers) return;
        
        const lines = this.textarea.value.split('\n');
        
        let html = '';
        for (let i = 0; i < lines.length; i++) {
            const errorMsg = this.lineErrors.get(i);
            const isError = !!errorMsg;
            html += `<span class="line-num${isError ? ' error' : ''}">${i + 1}</span>`;
        }
        
        this.lineNumbers.innerHTML = html;
    }
    
    validateLines() {
        this.lineErrors.clear();
        const code = this.textarea ? this.textarea.value : '';
        const stripped = (typeof globalThis !== 'undefined' && globalThis.QubiLex)
            ? globalThis.QubiLex.lexStripComments(code)
            : code;
        const strippedLines = stripped.split('\n');

        if (globalThis.QubiLex && globalThis.QubiLex.scanUnclosedBlockComment) {
            const be = globalThis.QubiLex.scanUnclosedBlockComment(code);
            if (be) {
                this.lineErrors.set(be.line, be.msg);
            }
        }

        let inRepeat = 0;
        const repeatStack = [];

        for (let i = 0; i < strippedLines.length; i++) {
            if (this.lineErrors.has(i)) {
                continue;
            }
            const line = strippedLines[i].trim();
            if (!line) {
                continue;
            }
            // Ignore single-line comments (even if lexer isn't available).
            if (line.startsWith('//')) {
                continue;
            }

            const error = this.getLineError(line);
            if (error) {
                this.lineErrors.set(i, error);
                continue;
            }

            if (line.startsWith('REPEAT')) {
                inRepeat++;
                repeatStack.push(i);
            } else if (line === 'END') {
                if (inRepeat <= 0) {
                    this.lineErrors.set(i, 'END without matching REPEAT');
                } else {
                    inRepeat--;
                    repeatStack.pop();
                }
            }
        }

        for (const lineNum of repeatStack) {
            this.lineErrors.set(lineNum, 'REPEAT without matching END');
        }
    }
    
    getLineError(line) {
        if (!line) {
            return null;
        }
        
        // #import / #include validation
        if (/^#(?:import|include)\b/i.test(line)) {
            const m = line.match(/^#(?:import|include)\s+(.+)$/i);
            if (!m || !m[1].trim()) return '#import requires a filename (e.g. #import utils.qubi)';
            const fname = m[1].trim();
            if (!/^[A-Za-z0-9._-]+$/.test(fname)) return `#import: invalid filename "${fname}"`;
            if (!fname.endsWith('.qubi')) return '#import: filename must end with .qubi';
            return null;
        }

        // #define validation — supports: #define LABEL [matrix] optional:"Name" optional:"color"
        if (/^#define\b/i.test(line)) {
            const m = line.match(/^#define\s+(.*)$/i);
            if (!m || !m[1].trim()) return '#define requires a gate name and matrix (e.g. #define U [1 0; 0 i])';
            const rest = m[1].trim();
            const nameMatch = rest.match(/^([A-Za-z]+)\s*(.*)/);
            if (!nameMatch) return '#define: gate name must be letters (A–Z) only';
            const gateName = nameMatch[1];
            if (gateName.length < 1 || gateName.length > 4) {
                return `#define: gate name must be between 1 and 4 letters (got "${gateName}")`;
            }
            const afterName = nameMatch[2].trim();
            if (!afterName) return `#define ${gateName}: missing matrix (e.g. #define ${gateName} [1 0; 0 -1])`;
            if (!afterName.startsWith('[')) return `#define ${gateName}: matrix must start with [`;
            // Find matching closing bracket (not greedy — handle expressions with brackets inside)
            const bracketEnd = afterName.indexOf(']');
            if (bracketEnd === -1) return `#define ${gateName}: matrix must end with ]`;
            const body = afterName.slice(0, bracketEnd + 1);
            const inside = body.slice(1, -1).trim();
            if (!inside) return `#define ${gateName}: matrix is empty`;
            const rows = inside.split(';').map(r => r.trim()).filter(Boolean);
            if (rows.length === 0) return `#define ${gateName}: matrix has no rows`;
            const colCounts = rows.map(r => this.splitMatrixRow(r).length);
            if (!colCounts.every(c => c === rows.length)) return `#define ${gateName}: matrix must be square (${rows.length} rows but some rows have different column counts)`;
            const dim = rows.length;
            if ((dim & (dim - 1)) !== 0 || dim < 1) return `#define ${gateName}: matrix dimension must be a power of 2 (got ${dim})`;
            if (dim > 16) return `#define ${gateName}: matrix too large (max 16×16)`;
            // Validate optional extras after the matrix: "name" "color" or . "color"
            const extras = afterName.slice(bracketEnd + 1).trim();
            if (extras) {
                let ep = extras;
                while (ep.length > 0) {
                    ep = ep.trim();
                    if (!ep) break;
                    if (ep.startsWith('"')) {
                        const end = ep.indexOf('"', 1);
                        if (end === -1) return `#define ${gateName}: unclosed quote in options`;
                        ep = ep.slice(end + 1);
                    } else if (ep.startsWith('.')) {
                        ep = ep.slice(1);
                    } else {
                        return `#define ${gateName}: unexpected "${ep.charAt(0)}" after matrix. Use "name" "color" or . "color"`;
                    }
                }
            }
            return null;
        }

        // Unknown preprocessor directive
        if (/^#/.test(line)) {
            return 'Unknown directive. Valid directives: #import, #include, #define';
        }

        // REPEAT N
        if (/^REPEAT\s*/.test(line)) {
            if (!/^REPEAT\s+\d+$/.test(line)) {
                return 'REPEAT requires a number (e.g., REPEAT 5)';
            }
            return null;
        }
        
        // END
        if (line === 'END') return null;
        
        // Extract the first word (potential gate name)
        const firstWord = line.split(/[\s(\[]/)[0];
        
        // Check if it's a valid gate
        const dynamicGateOk =
            (typeof globalThis !== 'undefined' &&
                globalThis.GateMatrices &&
                Object.prototype.hasOwnProperty.call(globalThis.GateMatrices, firstWord));

        if (!this.validGates.has(firstWord) && !this.keywords.has(firstWord) && !dynamicGateOk) {
            return `"${firstWord}" is not a recognized gate. Valid gates: H, X, Y, Z, S, T, RX, RY, RZ, CX, CY, CZ, SWAP, MEASURE`;
        }
        
        // Rotation gates: RX q [θ], RX (q,…) [θ], RX [q,…] [θ]; omitted θ defaults to π/2 (executor-aligned)
        if (/^(RX|RY|RZ)\b/i.test(line)) {
            const g = firstWord.toUpperCase();
            const bracket = line.match(/^(RX|RY|RZ)\s*\[\s*([^\]]+)\](?:\s+(.+))?$/i);
            if (bracket) {
                const inner = bracket[2].trim();
                if (!/^[\d,\s]+$/.test(inner)) {
                    return 'Invalid qubit list in [ ] for rotation';
                }
                const qs = inner.split(',').map((x) => parseInt(x.trim(), 10));
                if (!qs.length || !qs.every((q) => Number.isInteger(q) && q >= 0)) {
                    return 'Invalid qubit indices in [ ]';
                }
                const angPart = bracket[3];
                if (angPart != null && String(angPart).trim()) {
                    const ang =
                        typeof globalThis.parseQubiRotationAngle === 'function'
                            ? globalThis.parseQubiRotationAngle(String(angPart).trim())
                            : NaN;
                    if (isNaN(ang)) {
                        return `${g} […]: angle must be a π-multiple, …deg, or …rad (e.g. ${g} [0,1] 0.5)`;
                    }
                }
                return null;
            }
            const paren = line.match(/^(RX|RY|RZ)\s*\(\s*([^)]+)\)(?:\s+(.+))?$/i);
            if (paren) {
                const inner = paren[2].trim();
                if (!/^[\d,\s]+$/.test(inner)) {
                    return 'Invalid qubit list in ( ) for rotation';
                }
                const qs = inner.split(',').map(x => parseInt(x.trim(), 10));
                if (!qs.length || !qs.every(q => Number.isInteger(q) && q >= 0)) {
                    return 'Invalid qubit indices in ( )';
                }
                const angPart = paren[3];
                if (angPart != null && String(angPart).trim()) {
                    const ang =
                        typeof globalThis.parseQubiRotationAngle === 'function'
                            ? globalThis.parseQubiRotationAngle(String(angPart).trim())
                            : NaN;
                    if (isNaN(ang)) {
                        return `${g} (…): angle must be a π-multiple, …deg, or …rad (e.g. ${g} (0,1) 0.5)`;
                    }
                }
                return null;
            }
            const single = line.match(/^(RX|RY|RZ)\s+(\d+)(?:\s+(.+))?$/i);
            if (single) {
                const angPart = single[3];
                if (angPart != null && String(angPart).trim()) {
                    const ang =
                        typeof globalThis.parseQubiRotationAngle === 'function'
                            ? globalThis.parseQubiRotationAngle(String(angPart).trim())
                            : NaN;
                    if (isNaN(ang)) {
                        return `${g} needs a valid angle: π-multiple, …deg, or …rad (e.g. ${g} 0 1rad)`;
                    }
                }
                return null;
            }
            return `Invalid ${g} syntax`;
        }
        
        // Gate with shorthand: H 0
        if (/^[A-Z0-9]+\s+\d+$/.test(line)) {
            return null;
        }

        if (/^MEASURE\s+\[/i.test(line.trim())) {
            return 'MEASURE does not use […]; use MEASURE q';
        }

        // CX/CY/CZ/SWAP: (0,1) parallel form is invalid — use […] or ([…], …)
        const badCxParen = line.trim().match(/^(CX|CY|CZ|SWAP)\s*\(\s*[0-9]/i);
        if (badCxParen) {
            const g = badCxParen[1].toUpperCase();
            return `${g} cannot use (…) with bare qubit indices (that would mean parallel single-qubit ${g}s). Use ${g} [controls…, target] or ${g} ([…], […]).`;
        }

        const gateRest = line.trim().match(/^([A-Z0-9]+)\s+(.+)$/);
        if (gateRest && globalThis.QubiParser && typeof globalThis.QubiParser.tryTokenizeGateRegister === 'function') {
            const tok = globalThis.QubiParser.tryTokenizeGateRegister(gateRest[1], gateRest[2].trim(), 0);
            if (tok) return null;
        }

        // Gate with parentheses only (single-qubit parallel): H (0,1,2)
        if (/^[A-Z0-9]+\s*\([^)]*\)\s*$/.test(line.trim())) {
            const g0 = line.match(/^([A-Z0-9]+)\s*\(/)[1];
            const content = line.match(/\(([^)]*)\)/)?.[1];
            if (!content || !/^[\d,\s]+$/.test(content)) {
                return 'Invalid qubit list in parentheses. Use numbers separated by commas (e.g., (0,1,2))';
            }
            if (['CX', 'CY', 'CZ', 'SWAP'].includes(g0)) {
                return `${g0} cannot use (…) with bare qubit indices; use square brackets.`;
            }
            return null;
        }

        // Single bracket list: CX [0,1]
        if (/^[A-Z0-9]+\s*\[[^\]]*\]\s*$/.test(line.trim())) {
            const content = line.match(/\[([^\]]*)\]/)?.[1];
            if (!content || !/^[\d,\s]+$/.test(content)) {
                return 'Invalid qubit list in brackets. Use numbers separated by commas (e.g., [0,1,2])';
            }
            return null;
        }
        
        // Incomplete or invalid syntax
        if (line.includes('(') && !line.includes(')')) {
            return 'Missing closing parenthesis';
        }
        if (line.includes('[') && !line.includes(']')) {
            return 'Missing closing bracket';
        }
        
        return 'Invalid syntax. Examples: H 0, H (0,1,2), CX [0,1], CX ([0,1], [2,3]), RZ [0,1] 0.5';
    }
    
    updateHighlight() {
        if (!this.highlight) return;
        
        const code = this.textarea.value;
        const lines = code.split('\n');

        this.validateLines();

        let inBlock = false;
        const highlightedLines = lines.map((line, index) => {
            const errorMsg = this.lineErrors.get(index);
            const r = this.highlightLineWithEmbeddedComments(line, inBlock, errorMsg);
            inBlock = r.inBlock;
            return r.html;
        });
        
        // Add a trailing newline to match textarea behavior
        this.highlight.innerHTML = highlightedLines.join('\n') + '\n';
        
        // Update wrapper width after highlighting
        this.updateWrapperWidth();
        this.updateWrapperHeight();
        
        // Trigger error state update event
        const errorEvent = new CustomEvent('qubiErrorStateChanged', {
            detail: { hasErrors: this.lineErrors.size > 0 }
        });
        this.textarea.dispatchEvent(errorEvent);
    }
    
    highlightLineBasic(line) {
        const r = this.highlightLineWithEmbeddedComments(line, false, null);
        return r.html;
    }

    highlightLine(line, errorMsg) {
        const r = this.highlightLineWithEmbeddedComments(line, false, errorMsg);
        return r.html;
    }

    /**
     * Highlight one physical line; supports slash-slash, slash-star blocks, and block continuation.
     */
    highlightLineWithEmbeddedComments(rawLine, startsInBlock, errorMsg) {
        if (!rawLine) {
            return { html: '', inBlock: startsInBlock };
        }

        const hasError = !!errorMsg;
        const tooltip = hasError ? ` title="${this.escapeHtml(errorMsg)}"` : '';
        const errOpen = hasError ? `<span class="line-error"${tooltip}>` : '';
        const errClose = hasError ? '</span>' : '';

        let inBlock = startsInBlock;
        let i = 0;
        let out = '';

        if (inBlock) {
            const end = rawLine.indexOf('*/');
            if (end === -1) {
                return {
                    html: errOpen + `<span class="token-comment">${this.escapeHtml(rawLine)}</span>` + errClose,
                    inBlock: true
                };
            }
            out += `<span class="token-comment">${this.escapeHtml(rawLine.slice(0, end + 2))}</span>`;
            i = end + 2;
            inBlock = false;
        }

        while (i < rawLine.length) {
            const ch = rawLine[i];
            const ch2 = rawLine[i + 1];
            if (ch === '/' && ch2 === '/') {
                out += `<span class="token-comment">${this.escapeHtml(rawLine.slice(i))}</span>`;
                break;
            }
            if (ch === '/' && ch2 === '*') {
                const end = rawLine.indexOf('*/', i + 2);
                if (end === -1) {
                    out += `<span class="token-comment">${this.escapeHtml(rawLine.slice(i))}</span>`;
                    inBlock = true;
                    break;
                }
                out += `<span class="token-comment">${this.escapeHtml(rawLine.slice(i, end + 2))}</span>`;
                i = end + 2;
                continue;
            }
            let next = -1;
            let dp = 0;
            let db = 0;
            for (let k = 0; k < i; k++) {
                const hc = rawLine[k];
                if (hc === '(') {
                    dp++;
                } else if (hc === ')') {
                    dp = Math.max(0, dp - 1);
                } else if (hc === '[') {
                    db++;
                } else if (hc === ']') {
                    db = Math.max(0, db - 1);
                }
            }
            for (let j = i; j < rawLine.length - 1; j++) {
                const jc = rawLine[j];
                const jn = rawLine[j + 1];
                if (jc === '/' && jn === '/' && dp === 0 && db === 0) {
                    next = j;
                    break;
                }
                if (jc === '/' && jn === '*') {
                    next = j;
                    break;
                }
                if (jc === '(') {
                    dp++;
                } else if (jc === ')') {
                    dp = Math.max(0, dp - 1);
                } else if (jc === '[') {
                    db++;
                } else if (jc === ']') {
                    db = Math.max(0, db - 1);
                }
            }
            if (next === -1) {
                out += this.tokenizeLine(rawLine.slice(i), hasError);
                break;
            }
            if (next > i) {
                out += this.tokenizeLine(rawLine.slice(i, next), hasError);
            }
            i = next;
        }

        return { html: errOpen + out + errClose, inBlock };
    }

    tokenizeLine(line, hasError) {
        let result = '';
        let remaining = line;

        // Preprocessor directives — color the entire line
        const ppMatch = remaining.match(/^(\s*)(#(?:import|include|define)\b)(.*)/i);
        if (ppMatch) {
            result += ppMatch[1]; // leading whitespace
            result += `<span class="token-preprocessor">${this.escapeHtml(ppMatch[2])}${this.escapeHtml(ppMatch[3])}</span>`;
            return result;
        }
        
        // Tokenize and highlight
        while (remaining.length > 0) {
            // Leading whitespace
            const wsMatch = remaining.match(/^(\s+)/);
            if (wsMatch) {
                result += wsMatch[1];
                remaining = remaining.substring(wsMatch[1].length);
                continue;
            }
            
            // Inline comment
            const commentMatch = remaining.match(/^(\/\/.*)$/);
            if (commentMatch) {
                result += `<span class="token-comment">${this.escapeHtml(commentMatch[1])}</span>`;
                break;
            }
            
            // Keywords (REPEAT, END)
            const keywordMatch = remaining.match(/^(REPEAT|END)\b/);
            if (keywordMatch) {
                result += `<span class="token-keyword">${keywordMatch[1]}</span>`;
                remaining = remaining.substring(keywordMatch[1].length);
                continue;
            }
            
            // Gate names (uppercase)
            const gateMatch = remaining.match(/^([A-Z]+)/);
            if (gateMatch) {
                const gate = gateMatch[1];
                const isValid = this.validGates.has(gate);
                const tokenClass = hasError && !isValid ? 'token-invalid' : 'token-gate';
                result += `<span class="${tokenClass}">${gate}</span>`;
                remaining = remaining.substring(gate.length);
                continue;
            }
            
            // Brackets with content: [0,1,2]
            const bracketMatch = remaining.match(/^(\[[^\]]*\]?)/);
            if (bracketMatch) {
                result += `<span class="token-control-qubits">${this.escapeHtml(bracketMatch[1])}</span>`;
                remaining = remaining.substring(bracketMatch[1].length);
                continue;
            }
            
            // Parentheses with content: (0,1,2)
            const parenMatch = remaining.match(/^(\([^)]*\)?)/);
            if (parenMatch) {
                result += `<span class="token-target-qubits">${this.escapeHtml(parenMatch[1])}</span>`;
                remaining = remaining.substring(parenMatch[1].length);
                continue;
            }
            
            // Angle with unit: 1rad, 35deg, 0.5 rad (after optional spaces)
            const angleWithUnit = remaining.match(
                /^(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*(deg(?:rees)?|rad(?:ians)?)\b/i
            );
            if (angleWithUnit) {
                const full = angleWithUnit[0];
                result += `<span class="token-number">${this.escapeHtml(full)}</span>`;
                remaining = remaining.substring(full.length);
                continue;
            }

            // Numbers (including decimals)
            const numMatch = remaining.match(/^(\d+\.?\d*(?:[eE][+-]?\d+)?)/);
            if (numMatch) {
                result += `<span class="token-number">${numMatch[1]}</span>`;
                remaining = remaining.substring(numMatch[1].length);
                continue;
            }
            
            // Word characters (potential invalid identifier) - show as text
            const wordMatch = remaining.match(/^([a-z]+)/i);
            if (wordMatch) {
                result += this.escapeHtml(wordMatch[1]);
                remaining = remaining.substring(wordMatch[1].length);
                continue;
            }
            
            // Any other character - just show it
            result += this.escapeHtml(remaining[0]);
            remaining = remaining.substring(1);
        }
        
        return result;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Public method to force update (e.g., when code is loaded programmatically)
    refresh() {
        this.updateHighlight();
        this.updateLineNumbers();
        this.updateWrapperWidth();
        this.updateWrapperHeight();
    }
    
    // Set code programmatically and update highlighting
    // Back-compat alias: previous API signature.
    // Note: this keeps the old default (overwrite, not undoable) unless opts are passed by newer callers.
    // eslint-disable-next-line no-unused-vars
    setCodeLegacy(code) { /* replaced by setCode above */ }
}

/**
 * Highlight Qubi source for read-only previews (no editor DOM required).
 * @param {string} code
 * @returns {string} HTML (spans with token-* classes, same as the live editor)
 */
function qubiHighlightCodeToHtml(code) {
    const shim = Object.create(QubiSyntaxHighlighter.prototype);
    shim.validGates = new Set([
        'H', 'X', 'Y', 'Z', 'S', 'T',
        'RX', 'RY', 'RZ',
        'CX', 'CY', 'CZ', 'SWAP',
        'MEASURE'
    ]);
    shim.keywords = new Set(['REPEAT', 'END']);
    const text = code == null ? '' : String(code);
    const lines = text.split('\n');
    let inBlock = false;
    const parts = [];
    for (let i = 0; i < lines.length; i++) {
        const r = QubiSyntaxHighlighter.prototype.highlightLineWithEmbeddedComments.call(
            shim,
            lines[i],
            inBlock,
            null
        );
        inBlock = r.inBlock;
        parts.push(r.html);
    }
    return parts.join('\n') + '\n';
}

if (typeof window !== 'undefined') {
    window.qubiHighlightCodeToHtml = qubiHighlightCodeToHtml;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QubiSyntaxHighlighter, qubiHighlightCodeToHtml };
}


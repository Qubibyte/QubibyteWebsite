// UI Interaction Handlers

/** Scale gate letter(s) to fill the box without overflowing */
function fitGateLabel(el, text) {
    const t = String(text).trim();
    const len = t.length;
    const isSingleGlyph = len <= 1 || t === '⇄' || t === '↻' || t === '⊣';
    el.classList.remove('gate-label--single', 'gate-label--double', 'gate-label--multi');
    el.classList.add(isSingleGlyph ? 'gate-label--single' : len === 2 ? 'gate-label--double' : 'gate-label--multi');
}

/** Label shown on palette drag ghost */
function getPaletteDragLabel(item) {
    const sym = item.querySelector('.gate-symbol');
    if (!sym) return item.dataset.gate;
    const labelEl = sym.querySelector('.gate-symbol-label');
    if (labelEl) return labelEl.textContent.trim();
    const text = Array.from(sym.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent)
        .join('')
        .trim();
    if (text) return text;
    const fallback = { SWAP: '⇄', MEASURE: 'M', REPEAT: '↻', END: '⊣' };
    return fallback[item.dataset.gate] || item.dataset.gate;
}

const PALETTE_DRAG_GHOST_SIZE = 50;

/** Drag image matching sidebar .gate-symbol (50×50). */
function buildPaletteDragGhost(item) {
    const sym = item.querySelector('.gate-symbol');
    if (!sym) return null;

    const wrap = document.createElement('div');
    wrap.className = `gate-palette palette-drag-ghost-wrap ${item.className}`;
    if (item.dataset.gate) wrap.dataset.gate = item.dataset.gate;
    wrap.style.cssText =
        'position:absolute;left:-9999px;top:0;width:50px;height:50px;padding:0;margin:0;border:none;background:none;box-shadow:none;pointer-events:none;';

    const ghost = sym.cloneNode(true);
    ghost.classList.add('palette-drag-ghost');
    ghost.style.transform = 'none';
    ghost.style.filter = 'none';
    ghost.style.animation = 'none';
    ghost.style.outline = 'none';
    ghost.style.opacity = '0.95';
    ghost.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.28)';

    wrap.appendChild(ghost);
    document.body.appendChild(wrap);
    return wrap;
}

/** Lightweight drag image for placed circuit gates (same strategy as palette). */
function buildPlacedGateDragGhost(gateEl) {
    if (!gateEl) return null;

    const wrap = document.createElement('div');
    wrap.className = 'placed-gate-drag-ghost-wrap';
    wrap.style.cssText =
        'position:absolute;left:-9999px;top:0;width:50px;height:50px;padding:0;margin:0;border:none;background:none;box-shadow:none;pointer-events:none;';

    const classCopy = [...gateEl.classList].filter(
        (c) => c !== 'gate-drag-source-faded' && c !== 'placed-gate-drag-ghost'
    ).join(' ');

    const ghost = document.createElement('div');
    ghost.className = `gate-on-wire palette-drag-ghost placed-gate-drag-ghost ${classCopy}`;
    ghost.style.cssText =
        'width:50px;height:50px;display:flex;align-items:center;justify-content:center;transform:none;filter:none;animation:none;opacity:0.95;box-shadow:0 4px 14px rgba(0,0,0,0.28);position:relative;margin:0;';

    if (gateEl.style.background) ghost.style.background = gateEl.style.background;
    if (gateEl.style.borderColor) ghost.style.borderColor = gateEl.style.borderColor;
    if (gateEl.style.boxShadow) ghost.style.boxShadow = gateEl.style.boxShadow;

    if (gateEl.classList.contains('swap-block')) {
        const symSpan = document.createElement('span');
        symSpan.className = 'swap-symbol';
        symSpan.textContent = gateEl.querySelector('.swap-symbol')?.textContent || '⇄';
        ghost.appendChild(symSpan);
    } else {
        const label = gateEl.querySelector('.gate-on-wire-label')?.textContent
            || gateEl.textContent?.replace(/\s×\s*$/, '').trim()
            || gateEl.dataset.gateType
            || '';
        const textSpan = document.createElement('span');
        textSpan.className = 'gate-on-wire-label';
        textSpan.textContent = label;
        ghost.appendChild(textSpan);
    }

    wrap.appendChild(ghost);
    document.body.appendChild(wrap);
    return wrap;
}

const DRAG_GHOST_STRIP_CLASSES = new Set([
    'gate-drag-source-faded',
    'placed-gate-drag-ghost',
    'shift-preview',
    'circuit-selected',
    'executing'
]);

/** Display label for qubit count input (e.g. "1 Qubit", "3 Qubits"). */
function formatQubitCountLabel(n) {
    const num = Math.max(0, Math.floor(Number(n)) || 0);
    return num === 1 ? '1 Qubit' : `${num} Qubits`;
}

class CircuitUI {
    constructor() {
        // Load settings first to get optimization preference
        const settings = this.getSettings();

        this.circuit = new QuantumCircuit(2, settings.useOptimizedGates);

        // Initialize visualizers only if containers exist
        const qubitVizContainer = document.getElementById('qubitVisualization');
        const graphContainer = document.getElementById('probabilityGraphs');
        this.visualizer = qubitVizContainer ? new QubitVisualizer('qubitVisualization') : null;
        this.graphVisualizer = graphContainer ? new ProbabilityGraphs('probabilityGraphs') : null;

        // Initialize NMR Simulator (will be created when tab is first opened)
        this.nmrSimulator = null;
        this.nmrInitialized = false;
        this.resourcesInitialized = false;
        this.analysisInitialized = false;
        this.gateCreatorInitialized = false;

        this.qubiExecutor = new QubiExecutor(this.circuit);
        this.selectedGate = null;
        this.draggedGate = null;
        this._phantomQubitEl = null;
        this._phantomQubitActive = false;
        this._phantomDropColumn = null;
        this._qubitRowHeight = 68;
        this._pointerTouchMoved = false;
        this._pointerStart = null;
        this._palettePointerDrag = null;
        this._suppressPaletteClick = false;
        this._placedGateDrag = null;
        this._placedGateDragBound = false;
        this._suppressPlacedGateClick = false;
        this._dragOverSlot = null;
        this._shiftPreviewKey = '';
        this._shiftPreviewEls = new Set();
        this._circuitSelection = new Set();
        this._circuitSelectionCF = new Set();
        this._marqueeSelect = null;
        this._groupGateDrag = null;
        this._circuitSelectionBound = false;
        this._selectionLayerEl = null;
        this._marqueeBoxEl = null;
        this._suppressCircuitSelectionClick = false;
        this._palettePointerDragBound = false;
        this._paletteDragModeMqBound = false;
        this._gateEditSyncRaf = 0;
        this._anglePicker = null;
        this.customGateMeta = {}; // gateType -> { label, colorBg, colorGlow, displayName }
        /** @returns {number} 0 if not a custom gate matrix; else log2(dim) */
        this.getCustomGateWireCount = (gateType) => {
            if (!this.customGateMeta[gateType]) return 0;
            if (typeof GateMatrices === 'undefined' || !GateMatrices[gateType]) return 0;
            const mat = GateMatrices[gateType];
            const nCells = mat.length;
            const dim = Math.round(Math.sqrt(nCells));
            if (dim < 2 || dim * dim !== nCells || (dim & (dim - 1)) !== 0) return 0;
            return Math.round(Math.log2(dim));
        };
        this.getCustomGateRequiredControlCount = (gateType) => {
            const k = this.getCustomGateWireCount(gateType);
            return k > 1 ? k - 1 : null;
        };
        this.isMultiWireCustomGate = (gateType) => this.getCustomGateRequiredControlCount(gateType) !== null;
        this.defineColorMap = {
            purple:  { bg: 'linear-gradient(135deg, #a855f7, #9333ea)', glow: 'rgba(168, 85, 247, 0.45)' },
            red:     { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', glow: 'rgba(239, 68, 68, 0.45)' },
            green:   { bg: 'linear-gradient(135deg, #22c55e, #16a34a)', glow: 'rgba(34, 197, 94, 0.45)' },
            blue:    { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', glow: 'rgba(59, 130, 246, 0.45)' },
            cyan:    { bg: 'linear-gradient(135deg, #06b6d4, #0891b2)', glow: 'rgba(6, 182, 212, 0.45)' },
            orange:  { bg: 'linear-gradient(135deg, #f97316, #ea580c)', glow: 'rgba(249, 115, 22, 0.45)' },
            pink:    { bg: 'linear-gradient(135deg, #ec4899, #db2777)', glow: 'rgba(236, 72, 153, 0.45)' },
            amber:   { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', glow: 'rgba(245, 158, 11, 0.45)' },
            teal:    { bg: 'linear-gradient(135deg, #14b8a6, #0d9488)', glow: 'rgba(20, 184, 166, 0.45)' },
            slate:   { bg: 'linear-gradient(135deg, #64748b, #475569)', glow: 'rgba(100, 116, 139, 0.45)' },
        };
        this.defaultCustomColor = { bg: 'linear-gradient(135deg, #64748b, #475569)', glow: 'rgba(100, 116, 139, 0.45)' };
        this.currentColumn = 0;
        this.gateWidth = 50;
        this.columnSpacing = 60;
        this.isPlaying = false;
        this.playbackInterval = null;
        this.playbackSpeed = 1;
        this.loopEnabled = false;
        this.executionHistory = []; // For step back
        this.historyIndex = -1;
        this.stepStates = []; // Store state at each step for timeline
        this.executionTimeline = [];
        this.currentStepIndex = -1;
        this.zoomLevel = 1; // Zoom level for circuit view

        // Initialize syntax highlighter for Qubi editor
        this.syntaxHighlighter = new QubiSyntaxHighlighter('qubiCode', 'codeHighlight', 'lineNumbers');
        this.qubiFiles = []; // [{ id, name, code }]
        this.activeQubiFileId = null;

        // Bidirectional sync state
        this.isUpdatingFromCircuit = false;
        this.isUpdatingFromCode = false;
        this._skipDebouncedCodeToCircuitSync = false;
        this._historyApplying = false;
        this._undoApplying = false;
        this.codeChangeDebounceTimer = null;
        this.codeChangeDebounceDelay = 500; // ms to wait before syncing code changes to circuit

        this.initializeEventListeners();
        this._initPaletteDismissListeners();
        this._initPaletteGateItems();
        this._syncPaletteDraggableState();
        this._syncPlacedGateDraggableState();
        this._initPalettePointerDrag();
        this._initPlacedGateDrag();
        this._initCircuitSelection();
        this._initSidebarExamplesList();
        this.initDesktopPanelResize();
        this.updateQubitInputMax();
        this.renderCircuit();
        this.updateVisualization();

        // Initialize error state
        this.updateErrorState();

        this.applyPendingSessionQubiLoad();

        this.initializeQubiTabs();
        this._initQubiHistory();
        this._initQubiUndo();
        this._ensureSchedulingDirectiveInEditor();
        this.syncCodeToCircuit({ suppressAutoRun: true });
    }

    initializeQubiTabs() {
        const tabList = document.getElementById('qubiTabList');
        const addBtn = document.getElementById('addQubiTabBtn');

        // Ensure main exists
        if (this.qubiFiles.length === 0) {
            const initialCode = (() => {
                const el = document.getElementById('qubiCode');
                return el ? String(el.value || '') : '';
            })();
            this.qubiFiles.push({ id: 'main', name: 'main.qubi', code: initialCode });
            this.activeQubiFileId = 'main';
        }

        const sanitizeFileName = (name) => {
            const raw = String(name ?? '').trim();
            if (!raw) return null;
            let n = raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            if (!/\.qubi$/i.test(n)) n += '.qubi';
            if (n.length > 64) n = n.slice(0, 64);
            return n;
        };

        const sanitizeStem = (stem) => {
            const raw = String(stem ?? '').trim();
            if (!raw) return null;
            // Keep it simple + safe for filenames
            let s = raw.replace(/[<>:"/\\|?*\x00-\x1F.]/g, '_'); // disallow dots (we control extension)
            s = s.replace(/\s+/g, ' ').trim();
            if (!s) return null;
            if (s.length > 60) s = s.slice(0, 60);
            return s;
        };

        const uniqueName = (base, excludeFileId = null) => {
            const existing = new Set(
                this.qubiFiles
                    .filter(f => excludeFileId == null || f.id !== excludeFileId)
                    .map(f => f.name.toLowerCase())
            );
            if (!existing.has(base.toLowerCase())) return base;
            const stem = base.replace(/\.qubi$/i, '');
            for (let i = 2; i < 200; i++) {
                const candidate = `${stem}${i}.qubi`;
                if (!existing.has(candidate.toLowerCase())) return candidate;
            }
            return `${stem}${Date.now()}.qubi`;
        };

        const startRename = (fileId) => {
            if (!tabList) return;
            if (fileId === 'main') return;
            const tab = tabList.querySelector(`.qubi-tab[data-file-id="${fileId}"]`);
            if (!tab) return;
            const file = this.qubiFiles.find(f => f.id === fileId);
            if (!file) return;

            // Avoid duplicate editors
            if (tab.querySelector('.qubi-tab-rename-wrap')) return;

            const currentStem = String(file.name || '').replace(/\.qubi$/i, '');
            const nameSpan = tab.querySelector('.qubi-tab-name');
            if (!nameSpan) return;

            tab.classList.add('is-renaming');

            const wrap = document.createElement('span');
            wrap.className = 'qubi-tab-rename-wrap';

            const measure = document.createElement('span');
            measure.className = 'qubi-tab-rename-measure';
            measure.setAttribute('aria-hidden', 'true');

            const input = document.createElement('input');
            input.className = 'qubi-tab-rename';
            input.type = 'text';
            input.value = currentStem;
            input.setAttribute('aria-label', 'Qubi file name');
            input.autocomplete = 'off';
            input.spellcheck = false;

            const suffix = document.createElement('span');
            suffix.className = 'qubi-tab-rename-suffix';
            suffix.textContent = '.qubi';
            suffix.setAttribute('aria-hidden', 'true');

            wrap.appendChild(measure);
            wrap.appendChild(input);
            wrap.appendChild(suffix);

            const syncRenameWidth = () => {
                measure.textContent = input.value || ' ';
                const w = Math.ceil(measure.offsetWidth);
                input.style.width = `${Math.max(w + 2, 28)}px`;
            };

            // Replace span with inline rename field
            nameSpan.replaceWith(wrap);
            syncRenameWidth();
            input.focus({ preventScroll: true });
            try { input.setSelectionRange(0, input.value.length); } catch { /* ignore */ }

            input.addEventListener('input', syncRenameWidth);

            let renameCommitted = false;
            const commit = () => {
                if (renameCommitted) return;
                renameCommitted = true;
                const stem = sanitizeStem(input.value);
                if (!stem) {
                    render();
                    return;
                }
                const proposed = sanitizeFileName(`${stem}.qubi`);
                const unique = uniqueName(proposed, file.id);
                file.name = unique;
                render();
            };

            const cancel = () => {
                render();
            };

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    commit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancel();
                }
            });
            input.addEventListener('blur', () => commit());
        };

        const render = () => {
            if (!tabList) return;
            tabList.innerHTML = '';
            for (const f of this.qubiFiles) {
                const tab = document.createElement('div');
                tab.className = 'qubi-tab' + (f.id === this.activeQubiFileId ? ' active' : '');
                tab.setAttribute('role', 'tab');
                tab.setAttribute('aria-selected', f.id === this.activeQubiFileId ? 'true' : 'false');
                tab.dataset.fileId = f.id;
                tab.title = f.name;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'qubi-tab-name';
                nameSpan.textContent = f.name;
                tab.appendChild(nameSpan);

                if (f.id !== 'main') {
                    const close = document.createElement('button');
                    close.className = 'qubi-tab-close';
                    close.type = 'button';
                    close.title = 'Close tab';
                    close.textContent = '×';
                    close.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const idx = this.qubiFiles.findIndex(x => x.id === f.id);
                        if (idx >= 0) {
                            if (this.qubiHistory) this.qubiHistory.archiveFile(f.id, f.name, 'tab_closed');
                            this.qubiUndo?.removeFile(f.id);
                            this.qubiFiles.splice(idx, 1);
                            if (this.activeQubiFileId === f.id) {
                                const prevMain = this.activeQubiFileId;
                                this.activeQubiFileId = 'main';
                                this.qubiUndo?.onTabSwitch(prevMain, 'main');
                                this._loadActiveQubiFileIntoEditor({ preserveUndo: false });
                                // Refresh circuit to match main tab
                                this.syncCodeToCircuit();
                            }
                            render();
                        }
                    });
                    tab.appendChild(close);
                }

                tab.addEventListener('click', () => {
                    if (this.activeQubiFileId === f.id) return;
                    const fromFileId = this.activeQubiFileId;
                    this._snapshotQubiHistoryForFile(fromFileId);
                    this._persistActiveQubiEditorToFile();
                    this.activeQubiFileId = f.id;
                    this.qubiUndo?.onTabSwitch(fromFileId, f.id);
                    this._loadActiveQubiFileIntoEditor({ preserveUndo: false });
                    // Ensure circuit builder reflects this tab immediately
                    this.syncCodeToCircuit();
                    render();
                });

                tab.addEventListener('dblclick', (e) => {
                    // Don't rename if double-clicking the close button
                    if (e.target.closest('.qubi-tab-close')) return;
                    startRename(f.id);
                });

                tabList.appendChild(tab);
            }
        };

        // Expose for save/load flows that add many tabs at once.
        this._renderQubiTabs = render;

        const addNewTab = () => {
            const name = uniqueName('untitled.qubi');
            const id = `file_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
            this._persistActiveQubiEditorToFile();
            this.qubiFiles.push({ id, name, code: '' });
            this.activeQubiFileId = id;
            this._loadActiveQubiFileIntoEditor({ preserveUndo: false });
            this._applySchedulingSettingToEditor(this.getSettings().codeGateParallelism || 'default');
            // Initialize circuit to match new (empty) file deterministically
            this.syncCodeToCircuit();
            render();
            const ed = document.getElementById('qubiCode');
            this.qubiUndo?.reset(id, ed?.value || '');
            this.qubiHistory?.ensureFile(id, ed?.value || '');
            if (typeof this._persistActiveQubiEditorToFile === 'function') {
                this._persistActiveQubiEditorToFile();
            }
            // Immediately allow editing the stem (like typical editors)
            startRename(id);
        };

        if (addBtn && !addBtn._qubiTabsBound) {
            addBtn._qubiTabsBound = true;
            addBtn.addEventListener('click', addNewTab);
        }

        this._persistActiveQubiEditorToFile = () => {
            const active = this.qubiFiles.find(f => f.id === this.activeQubiFileId);
            const editor = document.getElementById('qubiCode');
            if (active && editor) active.code = String(editor.value || '');
        };

        this._loadActiveQubiFileIntoEditor = ({ preserveUndo = false } = {}) => {
            const active = this.qubiFiles.find(f => f.id === this.activeQubiFileId) || this.qubiFiles[0];
            if (!active) return;
            this.setEditorCode(active.code, { preserveUndo, adjustQubits: true });
        };

        render();
    }

    _initQubiUndo() {
        if (typeof QubiUndoManager === 'undefined') return;
        this.qubiUndo = new QubiUndoManager({ ui: this });
        this.qubiUndo.bindUi();
        for (const f of this.qubiFiles) {
            this.qubiUndo.reset(f.id, f.code);
        }
    }

    _initQubiHistory() {
        if (typeof QubiFileHistory === 'undefined') return;
        this.qubiHistory = new QubiFileHistory({ ui: this });
        this.qubiHistory.bindUi();
        this.qubiHistory.reconcileOrphanedHistories(this.qubiFiles.map((f) => f.id));
        const editor = document.getElementById('qubiCode');
        for (const f of this.qubiFiles) {
            const code = f.id === this.activeQubiFileId && editor
                ? String(editor.value || f.code || '')
                : String(f.code || '');
            this.qubiHistory.ensureFile(f.id, code);
        }
    }

    _snapshotQubiHistoryForFile(fileId) {
        if (!this.qubiHistory || !fileId) return;
        const editor = document.getElementById('qubiCode');
        const code = editor ? String(editor.value || '') : '';
        this.qubiHistory.flushPending(fileId, code);
    }

    /** Save a version-history snapshot for the active Qubi file. */
    _recordQubiVersionSnapshot(meta = {}) {
        if (this._undoApplying || this._historyApplying) return;
        const fileId = this.activeQubiFileId;
        const editor = document.getElementById('qubiCode');
        if (!this.qubiHistory || !fileId || !editor) return;

        if (typeof this._persistActiveQubiEditorToFile === 'function') {
            this._persistActiveQubiEditorToFile();
        }

        this.qubiHistory.recordImmediate(fileId, editor.value, {
            kind: meta.kind || 'edit',
            label: meta.label || 'Edit',
            force: Boolean(meta.force)
        });
    }

    inferRequiredQubitsFromCode(code) {
        const raw = code == null ? '' : String(code);
        const lines = raw.split(/\r?\n/);
        let maxQ = -1;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (!line) continue;
            line = line.trim();
            if (!line) continue;
            if (line.startsWith('//')) continue;

            // Strip inline comments.
            const cidx = line.indexOf('//');
            if (cidx >= 0) line = line.slice(0, cidx).trim();
            if (!line) continue;

            // Control flow: ignore REPEAT count.
            if (/^REPEAT\b/i.test(line) || /^END\b/i.test(line)) continue;

            const rotBracket = line.match(/^(RX|RY|RZ)\s*\[\s*([^\]]+)\]/i);
            if (rotBracket) {
                const qs = rotBracket[2].split(',').map((x) => x.trim()).filter(Boolean);
                for (const p of qs) {
                    const n = parseInt(p, 10);
                    if (Number.isInteger(n)) maxQ = Math.max(maxQ, n);
                }
                continue;
            }
            const rotParen = line.match(/^(RX|RY|RZ)\s*\(\s*([^)]+)\)/i);
            if (rotParen) {
                const qs = rotParen[2].split(',').map((x) => x.trim()).filter(Boolean);
                for (const p of qs) {
                    const n = parseInt(p, 10);
                    if (Number.isInteger(n)) maxQ = Math.max(maxQ, n);
                }
                continue;
            }

            const gateLine = line.match(/^([A-Z0-9]+)\s+(.+)$/);
            if (gateLine && typeof globalThis.QubiParser !== 'undefined') {
                const tok = globalThis.QubiParser.tryTokenizeGateRegister(gateLine[1], gateLine[2].trim(), 0);
                if (tok) {
                    if (tok.parallelBracketSegments) {
                        for (const seg of tok.parallelBracketSegments) {
                            for (const q of seg) {
                                if (Number.isInteger(q)) maxQ = Math.max(maxQ, q);
                            }
                        }
                    } else if (tok.qubits) {
                        for (const q of tok.qubits) {
                            if (Number.isInteger(q)) maxQ = Math.max(maxQ, q);
                        }
                    }
                    continue;
                }
            }

            // Fallback: first bracket or paren list of integers (partial / legacy lines)
            const listMatch = line.match(/[\(\[]\s*([0-9,\s]+)\s*[\)\]]/);
            if (listMatch) {
                const inner = listMatch[1];
                const parts = inner.split(',').map(x => x.trim()).filter(Boolean);
                for (const p of parts) {
                    const n = parseInt(p, 10);
                    if (Number.isInteger(n)) maxQ = Math.max(maxQ, n);
                }
                continue;
            }

            // Shorthand gate form: GATE q (angles may follow; we only want the qubit index).
            const singleMatch = line.match(/^[A-Z]+\s+(\d+)\b/i);
            if (singleMatch) {
                const n = parseInt(singleMatch[1], 10);
                if (Number.isInteger(n)) maxQ = Math.max(maxQ, n);
            }
        }

        return Math.max(0, maxQ + 1);
    }

    adjustQubitsForCode(code) {
        const needed = this.inferRequiredQubitsFromCode(code);
        if (!needed) return;
        const settings = this.getSettings();
        const maxQubits = settings.maxQubits || 12;
        const desired = Math.max(1, Math.min(needed, maxQubits));
        if (desired !== this.circuit.numQubits) {
            // Prevent setQubitCount() from overwriting the code editor via syncCircuitToCode().
            const prev = this.isUpdatingFromCode;
            this.isUpdatingFromCode = true;
            try {
                this.setQubitCount(desired);
            } finally {
                this.isUpdatingFromCode = prev;
            }
        }
        if (this.syntaxHighlighter) {
            this.syntaxHighlighter.validateLines();
            this.syntaxHighlighter.updateLineNumbers();
        }
    }

    setEditorCode(code, { preserveUndo = false, adjustQubits = false, focus = true } = {}) {
        const text = code == null ? '' : String(code);
        this.isUpdatingFromCircuit = true;
        if (this.syntaxHighlighter) {
            this.syntaxHighlighter.setCode(text, { preserveUndo, focus });
        } else {
            this._skipDebouncedCodeToCircuitSync = true;
            const editor = document.getElementById('qubiCode');
            if (editor) {
                if (preserveUndo) {
                    if (focus) {
                        editor.focus({ preventScroll: true });
                    }
                    try {
                        editor.setSelectionRange(0, editor.value.length);
                    } catch {
                        /* ignore */
                    }
                    if (focus) {
                        let usedUndoablePath = false;
                        try {
                            if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
                                usedUndoablePath = document.execCommand('insertText', false, text);
                            }
                        } catch {
                            usedUndoablePath = false;
                        }
                        if (!usedUndoablePath) {
                            if (typeof editor.setRangeText === 'function') {
                                editor.setRangeText(text, 0, editor.value.length, 'end');
                            } else {
                                editor.value = text;
                            }
                        }
                    } else if (typeof editor.setRangeText === 'function') {
                        editor.setRangeText(text, 0, editor.value.length, 'end');
                    } else {
                        editor.value = text;
                    }
                } else {
                    editor.value = text;
                }
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
        this.isUpdatingFromCircuit = false;

        if (adjustQubits) {
            this.adjustQubitsForCode(text);
        }
        this.updateErrorState();
    }

    /** Load Qubi from manual / deep-link (sessionStorage handoff). */
    applyPendingSessionQubiLoad() {
        const KEY = 'qubibyte_simulator_load_v1';
        try {
            const raw = sessionStorage.getItem(KEY);
            if (!raw) return;
            sessionStorage.removeItem(KEY);
            const payload = JSON.parse(raw);
            if (!payload || typeof payload.code !== 'string' || typeof payload.qubits !== 'number') return;
            // Load preserving undo + infer qubits from code (payload.qubits may be stale).
            this.loadAlgorithm({ code: payload.code, qubits: payload.qubits }, false);
        } catch {
            try {
                sessionStorage.removeItem(KEY);
            } catch {
                /* ignore */
            }
        }
    }

    updateQubitInputMax() {
        // No longer needed since we're using text input, but keeping for compatibility
        // The validation happens in setQubitCount
    }

    _prefersPointerPaletteDrag() {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia('(pointer: coarse)').matches
            || window.matchMedia('(hover: none)').matches;
    }

    _setGateItemDraggable(item) {
        if (!item) return;
        item.draggable = !this._prefersPointerPaletteDrag();
    }

    _syncPaletteDraggableState() {
        document.querySelectorAll('.gate-palette .gate-item').forEach((item) => {
            this._setGateItemDraggable(item);
        });
        if (typeof window !== 'undefined' && window.matchMedia && !this._paletteDragModeMqBound) {
            this._paletteDragModeMqBound = true;
            const sync = () => {
                this._syncPaletteDraggableState();
                this._syncPlacedGateDraggableState();
            };
            window.matchMedia('(pointer: coarse)').addEventListener('change', sync);
            window.matchMedia('(hover: none)').addEventListener('change', sync);
        }
    }

    _setGateOnWireDraggable(gateEl) {
        if (!gateEl) return;
        // Placed gates always use pointer drag — native HTML5 drag conflicts with it.
        gateEl.draggable = false;
    }

    _syncPlacedGateDraggableState() {
        document.querySelectorAll('#circuitCanvas .gate-on-wire').forEach((el) => {
            this._setGateOnWireDraggable(el);
        });
    }

    _positionPaletteDragGhost(ghost, clientX, clientY) {
        if (!ghost) return;
        const half = PALETTE_DRAG_GHOST_SIZE / 2;
        ghost.style.position = 'fixed';
        ghost.style.left = '0';
        ghost.style.top = '0';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '10000';
        ghost.style.transform = `translate(${clientX - half}px, ${clientY - half}px)`;
    }

    _updatePlacedGateDragTarget(clientX, clientY) {
        const drag = this._placedGateDrag;
        if (!drag?.active) return;

        const canvas = document.getElementById('circuitCanvas');
        const deleteZone = this._isPlacedGateDeleteZone(clientX, clientY, drag.slotCache);

        if (deleteZone) {
            if (drag.lastTargetKey !== '__delete__' || !drag.lastDeleteTarget) {
                drag.lastTargetKey = '__delete__';
                drag.lastDeleteTarget = true;
                this._hidePhantomQubitLine();
                this._setDragOverSlot(null);
                this._clearShiftPreview();
                canvas?.classList.add('is-placed-gate-delete-target');
            }
            return;
        }
        canvas?.classList.remove('is-placed-gate-delete-target');

        // Drag below the last wire to spawn a new qubit line for this gate.
        if (this._canAddQubit() && this._isInAddQubitZone(clientX, clientY)) {
            const col = this._getColumnFromClientX(clientX);
            const slotKey = `phantom:${col}`;
            if (drag.lastTargetKey !== slotKey || drag.lastDeleteTarget) {
                drag.lastTargetKey = slotKey;
                drag.lastDeleteTarget = false;
                this._showPhantomQubitLine(col);
                this._setDragOverSlot(null);
                this._clearShiftPreview();
            }
            return;
        }

        const slot = this._resolveGateSlotFast(clientX, clientY, drag.slotCache)
            || this._resolveGateSlotFromPointer(clientX, clientY);
        const onValidSlot = slot && !slot.closest('.qubit-line-phantom');
        const slotKey = onValidSlot ? `${slot.dataset.qubit}:${slot.dataset.column}` : '';

        if (drag.lastTargetKey === slotKey && !drag.lastDeleteTarget) return;
        drag.lastTargetKey = slotKey;
        drag.lastDeleteTarget = false;

        if (onValidSlot) {
            this._hidePhantomQubitLine();
            this._setDragOverSlot(slot);
            const anchorQubit = this._anchorQubitFromPointerSlot(parseInt(slot.dataset.qubit, 10), drag);
            const hoverColumn = parseInt(slot.dataset.column, 10);
            this._updatePlacedGateShiftPreview(drag, anchorQubit, hoverColumn);
            return;
        }

        this._hidePhantomQubitLine();
        this._setDragOverSlot(null);
        this._clearShiftPreview();
    }

    /** Cascade-accurate shift preview for a single placed gate being dragged. */
    _updatePlacedGateShiftPreview(drag, anchorQubit, hoverColumn) {
        const gate = drag.gate;
        const deltaQ = anchorQubit - gate.qubit;
        const deltaCol = hoverColumn - gate.column;
        const sim = this.circuit.simulateGroupPlacement(
            [gate],
            deltaQ,
            deltaCol,
            [],
            new Set([gate])
        );
        this._clearShiftPreview();
        if (sim.valid && sim.needsShift) {
            this._applyGroupMovesPreview(sim);
        }
    }

    _updateGroupGateDragTarget(clientX, clientY) {
        const drag = this._groupGateDrag;
        if (!drag?.active) return;

        const canvas = document.getElementById('circuitCanvas');
        const canDelete = Boolean(drag.gates?.length || drag.controlFlow?.length);
        const deleteZone = Boolean(canDelete && this._isPlacedGateDeleteZone(clientX, clientY, drag.slotCache));

        if (deleteZone && canDelete) {
            if (drag.lastTargetKey !== '__delete__' || !drag.lastDeleteTarget) {
                drag.lastTargetKey = '__delete__';
                drag.lastDeleteTarget = true;
                this._hidePhantomQubitLine();
                this._setDragOverSlot(null);
                this._clearShiftPreview();
                canvas?.classList.add('is-placed-gate-delete-target');
            }
            return;
        }
        canvas?.classList.remove('is-placed-gate-delete-target');

        if (!deleteZone && drag.gates?.length && this._canAddQubit() &&
            this._isInAddQubitZone(clientX, clientY)) {
            const col = this._getColumnFromClientX(clientX);
            const slotKey = `phantom:${col}`;
            if (drag.lastTargetKey !== slotKey || drag.lastDeleteTarget) {
                drag.lastTargetKey = slotKey;
                drag.lastDeleteTarget = false;
                this._showPhantomQubitLine(col);
                this._setDragOverSlot(null);
                this._updateGroupShiftPreview(drag, clientX, clientY);
            }
            return;
        }

        const slot = this._resolveGroupDragSlot(drag, clientX, clientY);
        const slotKey = slot ? `${slot.dataset.qubit}:${slot.dataset.column}` : '';

        if (drag.lastTargetKey === slotKey && !drag.lastDeleteTarget) return;
        drag.lastTargetKey = slotKey;
        drag.lastDeleteTarget = false;

        if (slot) {
            this._hidePhantomQubitLine();
            this._setDragOverSlot(slot);
            this._updateGroupShiftPreview(drag, clientX, clientY);
            return;
        }

        this._hidePhantomQubitLine();
        this._setDragOverSlot(null);
        this._clearShiftPreview();
    }

    _updateCircuitDragTarget(clientX, clientY, {
        excludeGate = null,
        excludeGates = null,
        allowPhantomQubit = true,
        fastSlot = false,
        slotCache = null,
        skipShiftPreview = false,
        dragState = null
    } = {}) {
        const excludeSet = excludeGates || (excludeGate ? new Set([excludeGate]) : null);
        const canvas = document.getElementById('circuitCanvas');
        const groupDrag = dragState === this._groupGateDrag ? dragState : null;
        const canDelete = Boolean(
            excludeSet?.size ||
            (groupDrag && (groupDrag.gates?.length || groupDrag.controlFlow?.length))
        );
        const deleteZone = Boolean(canDelete && this._isPlacedGateDeleteZone(clientX, clientY, slotCache));
        const cacheDrag = dragState || (excludeGate && this._placedGateDrag?.active ? this._placedGateDrag : null);

        if (cacheDrag?.active) {
            let slotKey = '';
            if (!deleteZone) {
                const slot = fastSlot
                    ? this._resolveGateSlotFast(clientX, clientY, slotCache)
                    : this._resolveGateSlotFromPointer(clientX, clientY);
                if (slot && !slot.closest('.qubit-line-phantom')) {
                    slotKey = `${slot.dataset.qubit}:${slot.dataset.column}`;
                }
            } else {
                slotKey = '__delete__';
            }
            if (cacheDrag.lastTargetKey === slotKey && cacheDrag.lastDeleteTarget === deleteZone) return;
            cacheDrag.lastTargetKey = slotKey;
            cacheDrag.lastDeleteTarget = deleteZone;
        }

        if (deleteZone && canDelete) {
            this._hidePhantomQubitLine();
            this._setDragOverSlot(null);
            this._clearShiftPreview();
            canvas?.classList.add('is-placed-gate-delete-target');
            return;
        }
        canvas?.classList.remove('is-placed-gate-delete-target');

        const slot = fastSlot
            ? this._resolveGateSlotFast(clientX, clientY, slotCache)
            : this._resolveGateSlotFromPointer(clientX, clientY);
        const onPhantom = slot && slot.closest('.qubit-line-phantom');

        if (slot && !onPhantom) {
            this._hidePhantomQubitLine();
            this._setDragOverSlot(slot);
            if (!skipShiftPreview) {
                this._updateShiftPreviewFromSlot(slot, excludeGate, excludeSet);
            }
            return;
        }

        if (allowPhantomQubit && this._canAddQubit() && this._isInAddQubitZone(clientX, clientY)) {
            const col = this._getColumnFromClientX(clientX);
            this._showPhantomQubitLine(col);
            this._clearShiftPreview();
        } else {
            this._hidePhantomQubitLine();
            this._setDragOverSlot(null);
            this._clearShiftPreview();
        }
    }

    _updatePaletteDragTarget(clientX, clientY) {
        this._updateCircuitDragTarget(clientX, clientY, { allowPhantomQubit: true });
    }

    _completePaletteGateDrop(gate, clientX, clientY) {
        if (!gate) return;

        if (this._phantomQubitActive && this._phantomDropColumn !== null) {
            const column = this._phantomDropColumn;
            this._hidePhantomQubitLine();
            this._clearDragOverHighlights();
            if (this._canAddQubit()) {
                this.addQubit();
                const qubit = this.circuit.numQubits - 1;
                const slot = document.querySelector(
                    `.gate-slot[data-qubit="${qubit}"][data-column="${column}"]`
                );
                if (slot) this.placeGateOnSlot(slot, gate);
            }
            return;
        }

        this._hidePhantomQubitLine();
        this._clearDragOverHighlights();
        this._clearShiftPreview();

        const slot = this._resolveGateSlotFromPointer(clientX, clientY);
        if (slot && !slot.closest('.qubit-line-phantom')) {
            this.placeGateOnSlot(slot, gate);
        }
    }

    _cleanupPalettePointerDrag() {
        const drag = this._palettePointerDrag;
        if (!drag) return;

        if (drag.ghost) drag.ghost.remove();
        drag.item?.classList.remove('dragging');
        document.body.classList.remove('is-palette-pointer-drag');

        if (drag.active) {
            this.draggedGate = null;
            this._setCircuitDragActive(false);
            this._hidePhantomQubitLine();
            this._clearDragOverHighlights();
            this._clearShiftPreview();
        }

        this._palettePointerDrag = null;
    }

    _initPalettePointerDrag() {
        if (this._palettePointerDragBound) return;
        this._palettePointerDragBound = true;

        const gatePalette = document.querySelector('.gate-palette');
        if (!gatePalette) return;

        const DRAG_THRESHOLD_SQ = 64;

        gatePalette.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && !this._prefersPointerPaletteDrag()) return;
            const item = e.target.closest('.gate-item');
            if (!item || e.button !== 0) return;
            if (e.target.closest('.gate-info-icon')) return;

            this._palettePointerDrag = {
                item,
                gate: item.dataset.gate,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                active: false,
                ghost: null
            };
        });

        document.addEventListener('pointermove', (e) => {
            const drag = this._palettePointerDrag;
            if (!drag || e.pointerId !== drag.pointerId) return;

            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;

            if (!drag.active) {
                if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;
                drag.active = true;
                e.preventDefault();
                drag.item.setPointerCapture(e.pointerId);
                this.draggedGate = drag.gate;
                this._setCircuitDragActive(true);
                drag.item.classList.add('dragging');
                document.body.classList.add('is-palette-pointer-drag');
                drag.ghost = buildPaletteDragGhost(drag.item);
                if (drag.ghost) {
                    drag.ghost.classList.add('touch-drag-ghost');
                }
            } else {
                e.preventDefault();
            }

            this._positionPaletteDragGhost(drag.ghost, e.clientX, e.clientY);
            this._updatePaletteDragTarget(e.clientX, e.clientY);
        }, { passive: false });

        const finishPointerDrag = (e) => {
            const drag = this._palettePointerDrag;
            if (!drag || e.pointerId !== drag.pointerId) return;

            if (drag.active) {
                e.preventDefault();
                const gate = drag.gate;
                this._completePaletteGateDrop(gate, e.clientX, e.clientY);
                this._suppressPaletteClick = true;
                requestAnimationFrame(() => {
                    this._suppressPaletteClick = false;
                });
            }

            try {
                drag.item?.releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            this._cleanupPalettePointerDrag();
        };

        document.addEventListener('pointerup', finishPointerDrag);
        document.addEventListener('pointercancel', finishPointerDrag);
    }

    _buildPlacedGateSlotCache() {
        const canvas = document.getElementById('circuitCanvas');
        if (!canvas) return null;

        const wrapper = canvas.parentElement;
        const canvasRect = (wrapper || canvas).getBoundingClientRect();
        const lines = canvas.querySelectorAll('.qubit-line:not(.qubit-line-phantom)');
        const lineRects = Array.from(lines, (line) => {
            const rect = line.getBoundingClientRect();
            return {
                qubit: parseInt(line.dataset.qubit, 10),
                top: rect.top,
                bottom: rect.bottom
            };
        });

        return {
            canvasRect,
            lineRects,
            firstWireLeft: lines[0]?.querySelector('.qubit-wire')?.getBoundingClientRect().left ?? null
        };
    }

    _isPlacedGateDeleteZone(clientX, clientY, slotCache = null) {
        const canvas = document.getElementById('circuitCanvas');
        if (!canvas) return true;

        const rect = slotCache?.canvasRect ?? (canvas.parentElement || canvas).getBoundingClientRect();
        const activeDrag = Boolean(this._placedGateDrag?.active || this._groupGateDrag?.active);

        // While dragging, only delete when clearly outside the circuit canvas — not over
        // qubit labels, row gaps, or control blocks where slot lookup can miss.
        if (activeDrag) {
            if (clientX >= rect.left - 28 && clientX <= rect.right + 36 &&
                clientY >= rect.top - 28 && clientY <= rect.bottom + 48) {
                return false;
            }
        }

        const slot = this._resolveGateSlotFast(clientX, clientY, slotCache)
            || this._resolveGateSlotFromPointer(clientX, clientY);
        if (slot && !slot.closest('.qubit-line-phantom')) return false;

        if (clientX < rect.left - 36 || clientX > rect.right + 36) return true;
        if (clientY < rect.top - 36) return true;
        if (clientY > rect.bottom + 48) return true;

        const lineRects = slotCache?.lineRects;
        if (lineRects?.length) {
            const lastRect = lineRects[lineRects.length - 1];
            if (clientY > lastRect.bottom + 20) return true;
            if (!activeDrag && slotCache.firstWireLeft !== null && clientX < slotCache.firstWireLeft - 12) {
                return true;
            }
        } else {
            const lines = canvas.querySelectorAll('.qubit-line:not(.qubit-line-phantom)');
            if (lines.length) {
                const lastRect = lines[lines.length - 1].getBoundingClientRect();
                if (clientY > lastRect.bottom + 20) return true;

                if (!activeDrag) {
                    const wire = lines[0].querySelector('.qubit-wire');
                    if (wire && clientX < wire.getBoundingClientRect().left - 12) return true;
                }
            }
        }

        return false;
    }

    _getGrabQubitFromEl(gateEl, fallbackQubit = 0) {
        const q = parseInt(gateEl?.dataset?.qubit, 10);
        return Number.isFinite(q) ? q : fallbackQubit;
    }

    /** Map pointer wire to gate anchor wire when drag started on a control/partner block. */
    _anchorQubitFromPointerSlot(slotQubit, drag) {
        if (!Number.isFinite(slotQubit)) {
            return drag?.originQubit ?? drag?.gate?.qubit ?? 0;
        }
        if (drag?.grabQubit !== undefined && drag?.grabQubit !== null && Number.isFinite(drag.grabQubit)) {
            const base = drag.originQubit ?? drag.gate?.qubit ?? 0;
            return base + (slotQubit - drag.grabQubit);
        }
        if (drag?.grabWireOffset !== undefined && drag?.grabWireOffset !== null && Number.isFinite(drag.grabWireOffset)) {
            return slotQubit - drag.grabWireOffset;
        }
        return slotQubit;
    }

    _resolvePointerSlot(clientX, clientY, slotCache = null) {
        return this._resolveGateSlotFast(clientX, clientY, slotCache)
            || this._resolveGateSlotFromPointer(clientX, clientY);
    }

    /** Group move deltas from pointer travel only — independent of grab point within the selection. */
    _resolveGroupDragDeltas(drag, clientX, clientY, { allowPhantom = false } = {}) {
        const zoom = this.zoomLevel || 1;
        const dragDx = ((drag?.pendingX ?? clientX) - drag.startX) / zoom;
        const dragDy = ((drag?.pendingY ?? clientY) - drag.startY) / zoom;
        const deltaCol = Math.round(dragDx / this.columnSpacing);
        let deltaQ = drag.gates?.length ? Math.round(dragDy / this._qubitRowHeight) : 0;
        const baseQubit = drag.originQubit ?? drag.gate?.qubit ?? 0;

        if (allowPhantom && drag.gates?.length && this._canAddQubit() &&
            this._isInAddQubitZone(clientX, clientY)) {
            deltaQ = this.circuit.numQubits - baseQubit;
        }

        const targetColumn = Math.max(0, drag.originColumn + deltaCol);
        const targetQubit = baseQubit + deltaQ;

        return {
            targetColumn,
            targetQubit,
            deltaCol,
            deltaQ
        };
    }

    _groupDragMinQubit(drag, deltaQ) {
        let minQ = Infinity;
        for (const gate of drag?.gates || []) {
            for (const q of this.circuit.getQubitsInvolvedInGate(gate)) {
                minQ = Math.min(minQ, q + deltaQ);
            }
        }
        return Number.isFinite(minQ) ? minQ : 0;
    }

    _groupRequiredQubitCount(drag, deltaQ) {
        let maxQ = -1;
        for (const gate of drag?.gates || []) {
            for (const q of this.circuit.getQubitsInvolvedInGate(gate)) {
                maxQ = Math.max(maxQ, q + deltaQ);
            }
        }
        return maxQ + 1;
    }

    _maxAllowedQubits() {
        const settings = this.getSettings();
        return settings.maxQubits || 12;
    }

    /** Grow the circuit for a group drop without re-rendering mid-move. */
    _ensureGroupDragQubits(required) {
        const cap = this._maxAllowedQubits();
        const target = Math.min(required, cap);
        while (this.circuit.numQubits < target && this._canAddQubit()) {
            this.circuit.addQubit();
        }
        return this.circuit.numQubits >= required;
    }

    _groupDragDeltasValid(drag, deltas) {
        if (drag.gates?.length) {
            if (this._groupDragMinQubit(drag, deltas.deltaQ) < 0) return false;
            const required = this._groupRequiredQubitCount(drag, deltas.deltaQ);
            if (required > this._maxAllowedQubits()) return false;
        }

        const qubitLimit = drag.gates?.length
            ? Math.max(this.circuit.numQubits, this._groupRequiredQubitCount(drag, deltas.deltaQ))
            : this.circuit.numQubits;

        const sim = this.circuit.simulateGroupPlacement(
            drag.gates,
            deltas.deltaQ,
            deltas.deltaCol,
            drag.controlFlow,
            drag.excludeGates,
            qubitLimit
        );
        return sim.valid;
    }

    _resolvePlacedGateDropTarget(drag, clientX, clientY) {
        const slot = this._resolvePointerSlot(clientX, clientY, drag.slotCache);
        if (!slot || slot.closest('.qubit-line-phantom')) return null;
        return {
            anchorQubit: this._anchorQubitFromPointerSlot(parseInt(slot.dataset.qubit, 10), drag),
            hoverColumn: parseInt(slot.dataset.column, 10)
        };
    }

    _resolveCircuitGateFromEl(gateEl) {
        if (!gateEl) return null;
        const column = parseInt(gateEl.dataset.column, 10);
        const gateType = gateEl.dataset.gateType;
        if (!Number.isFinite(column) || !gateType) return null;

        if (gateType === 'CONTROL') {
            const targetQubit = parseInt(gateEl.dataset.targetQubit, 10);
            const parentGateType = gateEl.dataset.parentGateType || null;
            if (parentGateType) {
                return this.circuit.gates.find(
                    (g) => g.type === parentGateType && g.qubit === targetQubit && g.column === column
                ) || null;
            }
            return this.circuit.gates.find((g) => g.qubit === targetQubit && g.column === column) || null;
        }

        if (gateType === 'SWAP_PARTNER') {
            const partnerQubit = parseInt(gateEl.dataset.partnerQubit, 10);
            return this.circuit.gates.find(
                (g) => g.type === 'SWAP' && g.qubit === partnerQubit && g.column === column
            ) || null;
        }

        if (gateType === 'CSWAP_PARTNER') {
            const partnerQubit = parseInt(gateEl.dataset.partnerQubit, 10);
            return this.circuit.gates.find(
                (g) => g.type === 'CSWAP' && g.qubit === partnerQubit && g.column === column
            ) || null;
        }

        if (gateType === 'JOINT_PARTNER') {
            const anchorQubit = parseInt(gateEl.dataset.anchorQubit, 10);
            const partnerType = gateEl.dataset.partnerGateType || '';
            return this.circuit.gates.find(
                (g) => g.type === partnerType && g.qubit === anchorQubit && g.column === column
            ) || null;
        }

        const qubit = parseInt(gateEl.dataset.qubit, 10);
        return this.circuit.gates.find(
            (g) => g.qubit === qubit && g.column === column && g.type === gateType
        ) || null;
    }

    _forEachGateVisual(gate, fn) {
        if (!gate || typeof fn !== 'function') return;
        const col = gate.column;
        const mark = (el) => { if (el) fn(el); };

        const anchorSlot = document.querySelector(
            `.gate-slot[data-qubit="${gate.qubit}"][data-column="${col}"]`
        );
        if (anchorSlot) {
            anchorSlot.querySelectorAll('.gate-on-wire:not(.control-block)').forEach((el) => mark(el));
        }

        this._shiftPreviewControlQubits(gate).forEach((cq) => {
            mark(this._queryGateVisual(cq, col, '.control-block'));
        });

        if (gate.type === 'SWAP' && gate.target !== null && gate.target !== undefined) {
            mark(this._queryGateVisual(gate.target, col, '[data-gate-type="SWAP_PARTNER"]'));
        }

        if (gate.type === 'CSWAP') {
            const joint = gate.params && gate.params.jointQubits;
            if (Array.isArray(joint) && joint.length === 3) {
                mark(this._queryGateVisual(joint[1], col, '[data-gate-type="CSWAP_PARTNER"]'));
            }
        }

        const joint = gate.params && gate.params.jointQubits;
        if (Array.isArray(joint) && joint.length > 1 && gate.type !== 'CSWAP') {
            joint.forEach((qq) => {
                if (qq === gate.qubit) return;
                mark(this._queryGateVisual(qq, col, '.joint-block'));
            });
        }

        const busKey = this._controlConnectorBusKey(gate);
        if (busKey) {
            document.querySelectorAll('.circuit-control-bus').forEach((el) => {
                if (el.dataset.busKey === busKey) mark(el);
            });
        }
    }

    _collectSelectionVisualElements() {
        const seen = new Set();
        const out = [];
        const add = (el) => {
            if (!el || seen.has(el)) return;
            seen.add(el);
            out.push(el);
        };

        for (const gate of this._circuitSelection) {
            this._forEachGateVisual(gate, add);
        }
        for (const cf of this._circuitSelectionCF) {
            add(document.querySelector(
                `.control-flow-block[data-column="${cf.column}"][data-type="${cf.type}"]`
            ));
        }
        return out;
    }

    _getSelectionOriginPlacement(gates = [], controlFlow = []) {
        const gateList = gates.filter(Boolean);
        const cfList = controlFlow.filter(Boolean);
        const columns = [
            ...gateList.map((g) => g.column),
            ...cfList.map((cf) => cf.column)
        ];
        const originColumn = columns.length ? Math.min(...columns) : 0;

        let originGate = null;
        for (const gate of gateList) {
            if (gate.column !== originColumn) continue;
            if (!originGate || gate.qubit < originGate.qubit) originGate = gate;
        }

        return {
            originColumn,
            originQubit: originGate?.qubit ?? 0,
            originGate
        };
    }

    _ensureSelectionMirrorLayer(box) {
        let layer = box.querySelector('.circuit-selection-mirror-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'circuit-selection-mirror-layer';
            layer.setAttribute('aria-hidden', 'true');
            box.insertBefore(layer, box.firstChild);
        }
        return layer;
    }

    _syncSelectionBoxMirrors(clientBounds) {
        const box = this._selectionLayerEl?.querySelector('.circuit-selection-box');
        if (!box || !clientBounds) return;

        const layer = this._ensureSelectionMirrorLayer(box);
        layer.replaceChildren();

        const zoom = this.zoomLevel || 1;
        for (const el of this._collectSelectionVisualElements()) {
            const r = el.getBoundingClientRect();
            if (!r.width && !r.height) continue;

            const mirror = el.cloneNode(true);
            mirror.classList.add('circuit-selection-mirror');
            mirror.classList.remove('circuit-selected', 'gate-drag-source-faded', 'shift-preview');
            mirror.removeAttribute('id');

            const relLeft = (r.left - clientBounds.left) / zoom;
            const relTop = (r.top - clientBounds.top) / zoom;
            const w = r.width / zoom;
            const h = r.height / zoom;

            mirror.style.position = 'absolute';
            mirror.style.left = `${relLeft}px`;
            mirror.style.top = `${relTop}px`;
            mirror.style.width = `${w}px`;
            mirror.style.height = `${h}px`;
            mirror.style.margin = '0';
            mirror.style.pointerEvents = 'none';
            mirror.style.transform = 'none';
            layer.appendChild(mirror);
        }
    }

    _clearSelectionBoxMirrors() {
        this._selectionLayerEl?.querySelector('.circuit-selection-mirror-layer')?.replaceChildren();
    }

    /** Drop target from selection drag delta (left edge), not pointer slot under cursor. */
    _resolveGroupDropTarget(drag, clientX, clientY) {
        const deltas = this._resolveGroupDragDeltas(drag, clientX, clientY);
        return { column: deltas.targetColumn, qubit: deltas.targetQubit };
    }

    _resolveGroupDragSlot(drag, clientX, clientY) {
        const target = this._resolveGroupDropTarget(drag, clientX, clientY);
        const canvas = document.getElementById('circuitCanvas');
        if (!canvas) return null;
        return canvas.querySelector(
            `.gate-slot[data-qubit="${target.qubit}"][data-column="${target.column}"]`
        );
    }

    _getGroupPlacementSimulation(drag, clientX, clientY, excludeGates = null) {
        if (!drag?.active) return { valid: true, needsShift: false, gateMoves: [], cfMoves: [] };
        const deltas = this._resolveGroupDragDeltas(drag, clientX, clientY, { allowPhantom: true });
        const qubitLimit = drag.gates?.length
            ? Math.max(this.circuit.numQubits, this._groupRequiredQubitCount(drag, deltas.deltaQ))
            : this.circuit.numQubits;
        return this.circuit.simulateGroupPlacement(
            drag.gates,
            deltas.deltaQ,
            deltas.deltaCol,
            drag.controlFlow,
            excludeGates,
            qubitLimit
        );
    }

    _updateGroupShiftPreview(drag, clientX, clientY) {
        const simulation = this._getGroupPlacementSimulation(drag, clientX, clientY, drag.excludeGates);

        if (!simulation.valid || !simulation.needsShift) {
            this._clearShiftPreview();
            return;
        }

        const previewKey = this._groupMovesPreviewKey(simulation);
        if (this._shiftPreviewKey === previewKey) return;

        this._clearShiftPreview();
        this._shiftPreviewKey = previewKey;
        this._applyGroupMovesPreview(simulation);
    }

    /** Stable key describing every obstacle move so identical previews skip a rebuild. */
    _groupMovesPreviewKey(simulation) {
        const g = (simulation.gateMoves || [])
            .map((m) => `${m.gate.column}:${m.gate.qubit}:${m.gate.type}>${m.toCol}`)
            .sort()
            .join(',');
        const c = (simulation.cfMoves || [])
            .map((m) => `${m.cf.column}:${m.cf.type}>${m.toCol}`)
            .sort()
            .join(',');
        return `gm[${g}]cm[${c}]`;
    }

    /** Highlight each obstacle by exactly the distance the cascade will move it. */
    _applyGroupMovesPreview(simulation) {
        for (const move of simulation.gateMoves || []) {
            const dx = `${this.columnSpacing * (move.toCol - move.fromCol)}px`;
            this._markShiftPreviewForGate(move.gate, (el) => {
                if (!el || el.classList.contains('gate-drag-source-faded')) return;
                el.classList.add('shift-preview');
                el.style.setProperty('--shift-preview-dx', dx);
                this._shiftPreviewEls.add(el);
            });
        }

        for (const move of simulation.cfMoves || []) {
            const dx = `${this.columnSpacing * (move.toCol - move.fromCol)}px`;
            const el = document.querySelector(
                `.control-flow-block[data-column="${move.cf.column}"][data-type="${move.cf.type}"]`
            );
            if (!el || el.classList.contains('gate-drag-source-faded')) continue;
            el.classList.add('shift-preview');
            el.style.setProperty('--shift-preview-dx', dx);
            this._shiftPreviewEls.add(el);
        }
    }

    _setPlacedGateVisualFaded(gate, faded) {
        this._forEachGateVisual(gate, (el) => {
            el.classList.toggle('gate-drag-source-faded', faded);
        });
    }

    _countGateVisuals(gate) {
        let count = 0;
        this._forEachGateVisual(gate, () => { count++; });
        return count;
    }

    _gateUsesCompositeDragGhost(gate) {
        return this._countGateVisuals(gate) > 1;
    }

    _cloneDragGhostVisual(el) {
        const piece = document.createElement('div');
        piece.className = 'gate-composite-drag-ghost-piece';

        if (el.classList.contains('circuit-control-bus')) {
            const bus = document.createElement('div');
            bus.className = [...el.classList]
                .filter((c) => !DRAG_GHOST_STRIP_CLASSES.has(c))
                .join(' ');
            const cs = getComputedStyle(el);
            bus.style.cssText =
                'position:absolute;inset:0;width:100%;height:100%;margin:0;transform:none;pointer-events:none;' +
                `background-color:${el.style.backgroundColor || cs.backgroundColor};opacity:0.95;`;
            piece.appendChild(bus);
            return piece;
        }

        const clone = el.cloneNode(true);
        for (const cls of DRAG_GHOST_STRIP_CLASSES) clone.classList.remove(cls);
        clone.querySelectorAll('.gate-delete-btn').forEach((btn) => btn.remove());
        clone.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;margin:0;transform:none;pointer-events:none;';
        clone.style.left = '';
        clone.style.top = '';
        clone.style.right = '';
        clone.style.bottom = '';
        piece.appendChild(clone);
        return piece;
    }

    _buildCompositeGateDragGhost(gate, clientX, clientY) {
        const visuals = [];
        this._forEachGateVisual(gate, (el) => visuals.push(el));
        if (visuals.length < 2) return null;

        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;

        for (const el of visuals) {
            const r = el.getBoundingClientRect();
            if (!r.width && !r.height) continue;
            left = Math.min(left, r.left);
            top = Math.min(top, r.top);
            right = Math.max(right, r.right);
            bottom = Math.max(bottom, r.bottom);
        }

        if (!Number.isFinite(left)) return null;

        const width = Math.max(right - left, 1);
        const height = Math.max(bottom - top, 1);

        const ghost = document.createElement('div');
        ghost.className = 'gate-composite-drag-ghost placed-gate-pointer-ghost';
        ghost.style.width = `${width}px`;
        ghost.style.height = `${height}px`;

        for (const el of visuals) {
            const r = el.getBoundingClientRect();
            if (!r.width && !r.height) continue;

            const piece = this._cloneDragGhostVisual(el);
            piece.style.left = `${r.left - left}px`;
            piece.style.top = `${r.top - top}px`;
            piece.style.width = `${r.width}px`;
            piece.style.height = `${r.height}px`;
            ghost.appendChild(piece);
        }

        document.body.appendChild(ghost);
        return {
            ghost,
            offsetX: clientX - left,
            offsetY: clientY - top
        };
    }

    _buildPlacedGatePointerGhost(gate, gateEl, clientX, clientY) {
        if (gate && this._gateUsesCompositeDragGhost(gate)) {
            const composite = this._buildCompositeGateDragGhost(gate, clientX, clientY);
            if (composite) return composite;
        }

        const wrap = buildPlacedGateDragGhost(gateEl);
        if (!wrap) return null;
        const ghost = wrap.querySelector('.placed-gate-drag-ghost');
        if (!ghost) {
            wrap.remove();
            return null;
        }
        wrap.replaceWith(ghost);
        ghost.classList.add('touch-drag-ghost', 'placed-gate-pointer-ghost');
        ghost.style.position = 'fixed';
        ghost.style.left = '0';
        ghost.style.top = '0';

        const rect = gateEl.getBoundingClientRect();
        return {
            ghost,
            offsetX: clientX - rect.left,
            offsetY: clientY - rect.top
        };
    }

    _positionPlacedGateGhost(ghost, clientX, clientY, offsetX = 0, offsetY = 0) {
        this._positionSoloDragGhost(ghost, clientX, clientY, offsetX, offsetY);
    }

    _startPlacedGatePointerLoop() {
        const drag = this._placedGateDrag;
        if (!drag || drag.rafId) return;

        const tick = () => {
            const active = this._placedGateDrag;
            if (!active?.active) {
                if (active) active.rafId = 0;
                return;
            }
            this._positionPlacedGateGhost(
                active.ghost,
                active.pendingX,
                active.pendingY,
                active.ghostOffsetX,
                active.ghostOffsetY
            );
            this._updatePlacedGateDragTarget(active.pendingX, active.pendingY);
            active.rafId = requestAnimationFrame(tick);
        };
        drag.rafId = requestAnimationFrame(tick);
    }

    _cleanupPlacedGateDrag() {
        const drag = this._placedGateDrag;
        if (!drag) return;

        if (drag.rafId) {
            cancelAnimationFrame(drag.rafId);
            drag.rafId = 0;
        }

        if (drag.gate) this._setPlacedGateVisualFaded(drag.gate, false);
        drag.ghost?.remove();
        this._setSelectionDragPassthrough(false);
        this._setCircuitDragSelectShield(false);
        document.body.classList.remove('is-placed-gate-drag');
        document.getElementById('circuitCanvas')?.classList.remove('is-placed-gate-delete-target');

        if (drag.active) {
            this._setCircuitDragActive(false);
            this._hidePhantomQubitLine();
            this._clearDragOverHighlights();
            this._clearShiftPreview();
        }

        this._placedGateDrag = null;
    }

    _completePlacedGateDrop(clientX, clientY) {
        const drag = this._placedGateDrag;
        if (!drag?.active || !drag.gate) return false;

        this._clearDragOverHighlights();
        this._clearShiftPreview();
        document.getElementById('circuitCanvas')?.classList.remove('is-placed-gate-delete-target');

        const dropX = drag.pendingX ?? clientX;
        const dropY = drag.pendingY ?? clientY;

        // Dropped on a freshly spawned qubit line below the circuit.
        if (this._phantomQubitActive && this._phantomDropColumn !== null) {
            const column = this._phantomDropColumn;
            this._hidePhantomQubitLine();
            if (this._canAddQubit()) {
                const newRow = this.circuit.numQubits;
                const deltaQ = newRow - drag.gate.qubit;
                const required = this._groupRequiredQubitCount({ gates: [drag.gate] }, deltaQ);
                if (this._ensureGroupDragQubits(required)) {
                    const moved = this.circuit.moveGate(drag.gate, newRow, column);
                    if (moved) {
                        this.circuit.state = null;
                        document.getElementById('qubitCount').value = formatQubitCountLabel(this.circuit.numQubits);
                        this._refreshCircuitAfterGateEdit();
                    }
                    return moved;
                }
            }
            return false;
        }

        this._hidePhantomQubitLine();

        const slotCache = drag.slotCache;
        const dropTarget = this._resolvePlacedGateDropTarget(drag, dropX, dropY);

        if (dropTarget) {
            const moved = this.circuit.moveGate(
                drag.gate,
                dropTarget.anchorQubit,
                dropTarget.hoverColumn
            );

            if (moved) {
                this.circuit.state = null;
                this._refreshCircuitAfterGateEdit();
            }
            return moved;
        }

        if (this._isPlacedGateDeleteZone(dropX, dropY, slotCache)) {
            const gateRef = drag.gate;
            this.circuit.removeGateByRef(gateRef);
            this.circuit.state = null;
            this._refreshCircuitAfterGateEdit();
            return true;
        }

        return false;
    }

    _initPlacedGateDrag() {
        if (this._placedGateDragBound) return;
        this._placedGateDragBound = true;

        const canvas = document.getElementById('circuitCanvas');
        if (!canvas) return;

        const DRAG_THRESHOLD_SQ = 64;

        canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            if (this._palettePointerDrag?.active) return;
            if (e.target.closest('.gate-delete-btn')) return;

            const cfEl = e.target.closest('.control-flow-block');
            if (cfEl && canvas.contains(cfEl)) {
                const cf = this._resolveControlFlowFromEl(cfEl);
                if (cf) {
                    const fromMultiSelect = this._circuitSelectionCF.has(cf) && this._circuitSelectionCount() > 1;
                    if (!fromMultiSelect) {
                        this._clearCircuitSelection();
                    }
                    this._beginCircuitGroupDrag(e, { controlFlow: cf, fromSelection: fromMultiSelect });
                    return;
                }
            }

            const gateEl = e.target.closest('.gate-on-wire');
            if (!gateEl || !canvas.contains(gateEl)) return;

            const gate = this._resolveCircuitGateFromEl(gateEl);
            if (!gate) return;

            if (this._circuitSelection.has(gate) && this._circuitSelectionCount() > 1) {
                this._beginCircuitGroupDrag(e, { gate, fromSelection: true, grabEl: gateEl });
                return;
            }

            if (!this._circuitSelection.has(gate)) {
                this._clearCircuitSelection();
            }

            const grabQubit = this._getGrabQubitFromEl(gateEl, gate.qubit);

            this._placedGateDrag = {
                gateEl,
                gate,
                grabQubit,
                grabWireOffset: grabQubit - gate.qubit,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                active: false,
                moved: false,
                ghost: null,
                rafId: 0,
                pendingX: e.clientX,
                pendingY: e.clientY,
                slotCache: null,
                lastTargetKey: '',
                lastDeleteTarget: false
            };
        }, true);

        document.addEventListener('pointermove', (e) => {
            const drag = this._placedGateDrag;
            if (!drag || e.pointerId !== drag.pointerId) return;
            if (this._groupGateDrag?.active) return;

            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;

            if (!drag.active) {
                if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;
                drag.active = true;
                drag.moved = true;
                e.preventDefault();
                try {
                    drag.gateEl.setPointerCapture(e.pointerId);
                } catch {
                    /* ignore */
                }
                document.body.classList.add('is-placed-gate-drag');
                this._setCircuitDragSelectShield(true);
                this._setSelectionDragPassthrough(true);
                this._setCircuitDragActive(true);
                this._clearShiftPreview();
                this._setPlacedGateVisualFaded(drag.gate, true);
                drag.slotCache = this._buildPlacedGateSlotCache();
                const ghostPack = this._buildPlacedGatePointerGhost(
                    drag.gate,
                    drag.gateEl,
                    e.clientX,
                    e.clientY
                );
                drag.ghost = ghostPack?.ghost || null;
                drag.ghostOffsetX = ghostPack?.offsetX ?? (PALETTE_DRAG_GHOST_SIZE / 2);
                drag.ghostOffsetY = ghostPack?.offsetY ?? (PALETTE_DRAG_GHOST_SIZE / 2);
                if (drag.ghost) {
                    this._positionPlacedGateGhost(
                        drag.ghost,
                        e.clientX,
                        e.clientY,
                        drag.ghostOffsetX,
                        drag.ghostOffsetY
                    );
                }
                drag.pendingX = e.clientX;
                drag.pendingY = e.clientY;
                this._startPlacedGatePointerLoop();
            } else {
                e.preventDefault();
            }

            drag.pendingX = e.clientX;
            drag.pendingY = e.clientY;
        }, { passive: false });

        const finishPlacedDrag = (e) => {
            const drag = this._placedGateDrag;
            if (!drag || e.pointerId !== drag.pointerId) return;
            if (this._groupGateDrag?.active) return;

            if (drag.active) {
                e.preventDefault();
                this._completePlacedGateDrop(e.clientX, e.clientY);
                this._suppressPlacedGateClick = true;
                requestAnimationFrame(() => {
                    this._suppressPlacedGateClick = false;
                });
            } else {
                this._placedGateDrag = null;
                return;
            }

            try {
                drag.gateEl?.releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            this._cleanupPlacedGateDrag();
        };

        document.addEventListener('pointerup', finishPlacedDrag);
        document.addEventListener('pointercancel', finishPlacedDrag);
    }

    _clientRectsIntersect(a, b) {
        if (!a || !b) return false;
        const aRight = a.right ?? a.left + a.width;
        const aBottom = a.bottom ?? a.top + a.height;
        const bRight = b.right ?? b.left + b.width;
        const bBottom = b.bottom ?? b.top + b.height;
        return a.left < bRight && aRight > b.left && a.top < bBottom && aBottom > b.top;
    }

    _getGatesClientBounds(gates) {
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        let any = false;

        for (const gate of gates) {
            this._forEachGateVisual(gate, (el) => {
                const r = el.getBoundingClientRect();
                if (!r.width && !r.height) return;
                any = true;
                left = Math.min(left, r.left);
                top = Math.min(top, r.top);
                right = Math.max(right, r.right);
                bottom = Math.max(bottom, r.bottom);
            });
        }

        if (!any) return null;
        return { left, top, right, bottom, width: right - left, height: bottom - top };
    }

    _clientRectToCanvasLocal(clientRect, padding = 0) {
        const canvas = document.getElementById('circuitCanvas');
        if (!canvas || !clientRect) return null;
        const cr = canvas.getBoundingClientRect();
        const zoom = this.zoomLevel || 1;
        const left = (clientRect.left - cr.left) / zoom - padding;
        const top = (clientRect.top - cr.top) / zoom - padding;
        const width = clientRect.width / zoom + padding * 2;
        const height = clientRect.height / zoom + padding * 2;
        return { left, top, width, height };
    }

    _ensureCircuitSelectionLayer() {
        const canvas = document.getElementById('circuitCanvas');
        if (!canvas) return null;

        if (!this._selectionLayerEl) {
            const layer = document.createElement('div');
            layer.className = 'circuit-selection-layer';
            layer.hidden = true;

            const box = document.createElement('div');
            box.className = 'circuit-selection-box';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'circuit-selection-delete';
            deleteBtn.title = 'Delete selected gates';
            deleteBtn.setAttribute('aria-label', 'Delete selected gates');
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._deleteCircuitSelection();
            });
            deleteBtn.addEventListener('pointerdown', (e) => e.stopPropagation());

            box.appendChild(deleteBtn);
            box.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                if (e.target.closest('.circuit-selection-delete')) return;
                if (!this._circuitSelectionCount()) return;
                const gates = [...this._circuitSelection];
                const cfs = [...this._circuitSelectionCF];
                const origin = this._getSelectionOriginPlacement(gates, cfs);
                this._beginCircuitGroupDrag(e, {
                    gate: origin.originGate || gates[0] || null,
                    controlFlow: cfs[0] || null,
                    fromSelection: true
                });
            });

            layer.appendChild(box);
            canvas.appendChild(layer);
            this._selectionLayerEl = layer;
        }

        return this._selectionLayerEl;
    }

    _ensureMarqueeBox() {
        const wrapper = document.querySelector('.circuit-canvas-wrapper');
        if (!wrapper) return null;

        if (!this._marqueeBoxEl) {
            const box = document.createElement('div');
            box.className = 'circuit-marquee-box';
            box.hidden = true;
            wrapper.appendChild(box);
            this._marqueeBoxEl = box;
        }

        return this._marqueeBoxEl;
    }

    _circuitSelectionCount() {
        return this._circuitSelection.size + this._circuitSelectionCF.size;
    }

    _resolveControlFlowFromEl(cfEl) {
        if (!cfEl) return null;
        const column = parseInt(cfEl.dataset.column, 10);
        const type = cfEl.dataset.type;
        if (!Number.isFinite(column) || !type) return null;
        return this.circuit.controlFlow.find((cf) => cf.column === column && cf.type === type) || null;
    }

    _clearCircuitSelection() {
        this._circuitSelection.clear();
        this._circuitSelectionCF.clear();
        document.querySelectorAll('.gate-on-wire.circuit-selected, .control-flow-block.circuit-selected').forEach((el) => {
            el.classList.remove('circuit-selected');
        });
        this._clearSelectionBoxMirrors();
        if (this._selectionLayerEl) {
            this._selectionLayerEl.hidden = true;
            this._selectionLayerEl.classList.remove('is-drag-passthrough');
        }
    }

    _setCircuitSelection(gates = [], controlFlow = []) {
        this._clearCircuitSelection();
        for (const gate of gates) {
            if (gate) this._circuitSelection.add(gate);
        }
        for (const cf of controlFlow) {
            if (cf) this._circuitSelectionCF.add(cf);
        }
        this._applyCircuitSelectionVisuals();
    }

    _shouldShowSelectionChrome() {
        return this._circuitSelectionCount() > 1;
    }

    _applyCircuitSelectionVisuals() {
        document.querySelectorAll('.gate-on-wire.circuit-selected, .control-flow-block.circuit-selected').forEach((el) => {
            el.classList.remove('circuit-selected');
        });

        if (!this._shouldShowSelectionChrome()) {
            this._updateCircuitSelectionOverlay();
            return;
        }

        for (const gate of this._circuitSelection) {
            if (!this.circuit.gates.includes(gate)) {
                this._circuitSelection.delete(gate);
                continue;
            }
            this._forEachGateVisual(gate, (el) => el.classList.add('circuit-selected'));
        }

        for (const cf of this._circuitSelectionCF) {
            if (!this.circuit.controlFlow.includes(cf)) {
                this._circuitSelectionCF.delete(cf);
                continue;
            }
            const block = document.querySelector(
                `.control-flow-block[data-column="${cf.column}"][data-type="${cf.type}"]`
            );
            if (block) block.classList.add('circuit-selected');
        }

        this._updateCircuitSelectionOverlay();
    }

    _getSelectionClientBounds() {
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        let any = false;

        for (const el of this._collectSelectionVisualElements()) {
            const r = el.getBoundingClientRect();
            if (!r.width && !r.height) continue;
            any = true;
            left = Math.min(left, r.left);
            top = Math.min(top, r.top);
            right = Math.max(right, r.right);
            bottom = Math.max(bottom, r.bottom);
        }

        if (!any) return null;
        return { left, top, right, bottom, width: right - left, height: bottom - top };
    }

    _updateCircuitSelectionOverlay() {
        const layer = this._ensureCircuitSelectionLayer();
        if (!layer) return;

        if (!this._shouldShowSelectionChrome() && !this._groupGateDrag?.active) {
            layer.hidden = true;
            return;
        }

        if (this._groupGateDrag?.active && !this._groupGateDrag.useSelectionBox) {
            layer.hidden = true;
            return;
        }

        if (!this._shouldShowSelectionChrome()) {
            layer.hidden = true;
            return;
        }

        const groupDrag = this._groupGateDrag;
        const pad = 8;
        let bounds;
        let local;

        if (groupDrag?.active && groupDrag.frozenLocal && groupDrag.frozenClientBounds) {
            bounds = groupDrag.frozenClientBounds;
            local = groupDrag.frozenLocal;
        } else {
            bounds = this._getSelectionClientBounds();
            if (!bounds) {
                layer.hidden = true;
                return;
            }
            local = this._clientRectToCanvasLocal(bounds, pad);
            if (!local) {
                layer.hidden = true;
                return;
            }
        }

        const box = layer.querySelector('.circuit-selection-box');
        layer.hidden = false;
        box.style.left = `${local.left}px`;
        box.style.top = `${local.top}px`;
        box.style.width = `${Math.max(local.width, 24)}px`;
        box.style.height = `${Math.max(local.height, 24)}px`;

        if (groupDrag?.active && groupDrag.useSelectionBox) {
            const zoom = this.zoomLevel || 1;
            const dragDx = (groupDrag.pendingX - groupDrag.startX) / zoom;
            const dragDy = (groupDrag.pendingY - groupDrag.startY) / zoom;
            box.style.transform = `translate3d(${dragDx}px, ${dragDy}px, 0)`;
        } else {
            this._clearSelectionBoxMirrors();
            box.style.transform = '';
        }
        box.classList.toggle('is-dragging', Boolean(groupDrag?.active && groupDrag.useSelectionBox));
    }

    _collectSelectionInClientRect(selRect) {
        const gates = new Set();
        const controlFlow = new Set();
        const canvas = document.getElementById('circuitCanvas');
        if (!canvas || !selRect) return { gates, controlFlow };

        canvas.querySelectorAll('.gate-on-wire').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (!this._clientRectsIntersect(selRect, r)) return;
            const gate = this._resolveCircuitGateFromEl(el);
            if (gate) gates.add(gate);
        });

        canvas.querySelectorAll('.circuit-control-bus').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (!this._clientRectsIntersect(selRect, r)) return;
            const busKey = el.dataset.busKey;
            if (!busKey) return;
            for (const gate of this.circuit.gates) {
                if (this._controlConnectorBusKey(gate) === busKey) {
                    gates.add(gate);
                    break;
                }
            }
        });

        canvas.querySelectorAll('.control-flow-block').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (!this._clientRectsIntersect(selRect, r)) return;
            const cf = this._resolveControlFlowFromEl(el);
            if (cf) controlFlow.add(cf);
        });

        return { gates, controlFlow };
    }

    _deleteCircuitSelection() {
        const gates = [...this._circuitSelection];
        const cfs = [...this._circuitSelectionCF];
        if (!gates.length && !cfs.length) return;

        this.circuit.removeGatesByRef(gates);
        for (const cf of cfs) {
            this.circuit.removeControlFlow(cf.column);
        }
        this.circuit.state = null;
        this._clearCircuitSelection();
        this._refreshCircuitAfterGateEdit();
    }

    _setSelectionDragPassthrough(active) {
        const layer = this._selectionLayerEl || this._ensureCircuitSelectionLayer();
        if (!layer) return;
        layer.classList.toggle('is-drag-passthrough', Boolean(active));
    }

    _setCircuitDragSelectShield(active) {
        document.body.classList.toggle('is-circuit-drag-select', Boolean(active));
    }

    _setGroupSelectionVisualFaded(faded) {
        const drag = this._groupGateDrag;
        const gates = drag?.gates || [...this._circuitSelection];
        const cfs = drag?.controlFlow || [...this._circuitSelectionCF];

        for (const gate of gates) {
            this._forEachGateVisual(gate, (el) => {
                el.classList.toggle('gate-drag-source-faded', faded);
            });
        }
        for (const cf of cfs) {
            const block = document.querySelector(
                `.control-flow-block[data-column="${cf.column}"][data-type="${cf.type}"]`
            );
            if (block) block.classList.toggle('gate-drag-source-faded', faded);
        }
    }

    _captureCfDragGhostOffset(blockEl, clientX, clientY) {
        if (!blockEl) return { x: 0, y: 0 };
        const rect = blockEl.getBoundingClientRect();
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    _buildControlFlowDragGhost(blockEl) {
        if (!blockEl) return null;

        const rect = blockEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;

        const ghost = document.createElement('div');
        const typeClass = blockEl.classList.contains('control-flow-end')
            ? 'control-flow-end'
            : 'control-flow-repeat';
        ghost.className = `cf-drag-ghost ${typeClass}`;
        ghost.dataset.type = blockEl.dataset.type || '';
        ghost.style.cssText =
            'position:fixed;left:0;top:0;margin:0;padding:0;pointer-events:none;z-index:10001;' +
            `width:${rect.width}px;height:${rect.height}px;box-sizing:border-box;will-change:transform;`;

        const symbolSrc = blockEl.querySelector('.control-flow-symbol');
        if (symbolSrc) {
            const symbol = document.createElement('div');
            symbol.className = 'control-flow-symbol';
            symbol.textContent = symbolSrc.textContent;
            ghost.appendChild(symbol);
        }

        const labelSrc = blockEl.querySelector('.control-flow-label');
        if (labelSrc) {
            const label = document.createElement('div');
            label.className = 'control-flow-label';
            label.textContent = labelSrc.textContent;
            ghost.appendChild(label);
        }

        const endLabelSrc = blockEl.querySelector('.control-flow-end-label');
        if (endLabelSrc) {
            const endLabel = document.createElement('div');
            endLabel.className = 'control-flow-end-label';
            endLabel.textContent = endLabelSrc.textContent;
            ghost.appendChild(endLabel);
        }

        document.body.appendChild(ghost);
        return ghost;
    }

    _positionSoloDragGhost(ghost, clientX, clientY, offsetX = 0, offsetY = 0) {
        if (!ghost) return;
        ghost.style.transform = `translate3d(${clientX - offsetX}px, ${clientY - offsetY}px, 0)`;
    }

    _startGroupGateDragLoop() {
        const drag = this._groupGateDrag;
        if (!drag || drag.rafId) return;

        const tick = () => {
            const active = this._groupGateDrag;
            if (!active?.active) {
                if (active) active.rafId = 0;
                return;
            }
            if (active.soloGhost) {
                this._positionSoloDragGhost(
                    active.soloGhost,
                    active.pendingX,
                    active.pendingY,
                    active.ghostOffsetX,
                    active.ghostOffsetY
                );
            }
            this._updateGroupGateDragTarget(active.pendingX, active.pendingY);
            if (active.useSelectionBox) {
                this._updateCircuitSelectionOverlay();
            }
            active.rafId = requestAnimationFrame(tick);
        };
        drag.rafId = requestAnimationFrame(tick);
    }

    _beginCircuitGroupDrag(e, { gate = null, controlFlow = null, fromSelection = false, grabEl = null } = {}) {
        if (!gate && !controlFlow) return;

        let gates;
        let cfs;

        if (fromSelection) {
            gates = [...this._circuitSelection];
            cfs = [...this._circuitSelectionCF];
        } else {
            this._clearCircuitSelection();
            gates = gate ? [gate] : [];
            cfs = controlFlow ? [controlFlow] : [];
        }

        const anchorGate = gate || gates[0] || null;
        const anchorCF = controlFlow || cfs[0] || null;
        const origin = this._getSelectionOriginPlacement(gates, cfs);
        const useSelectionBox = (gates.length + cfs.length) > 1;
        const grabQubit = grabEl
            ? this._getGrabQubitFromEl(grabEl, origin.originQubit)
            : origin.originQubit;

        this._placedGateDrag = null;

        this._groupGateDrag = {
            gates,
            controlFlow: cfs,
            excludeGates: new Set(gates),
            anchorGate: origin.originGate || anchorGate,
            anchorCF,
            originQubit: origin.originQubit,
            originColumn: origin.originColumn,
            grabQubit,
            useSelectionBox,
            soloGhost: null,
            ghostOffsetX: 0,
            ghostOffsetY: 0,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            active: false,
            moved: false,
            mirrorsBuilt: false,
            frozenClientBounds: null,
            frozenLocal: null,
            pendingX: e.clientX,
            pendingY: e.clientY,
            slotCache: null,
            rafId: 0,
            lastTargetKey: '',
            lastDeleteTarget: false
        };
    }

    _activateGroupGateDrag(e) {
        const drag = this._groupGateDrag;
        if (!drag || drag.active) return;

        drag.active = true;
        drag.moved = true;
        e.preventDefault();
        document.body.classList.add('is-placed-gate-drag');
        this._setCircuitDragSelectShield(true);
        this._setSelectionDragPassthrough(true);
        this._setCircuitDragActive(true);
        this._clearShiftPreview();
        this._setGroupSelectionVisualFaded(true);
        if (!drag.useSelectionBox) {
            document.querySelectorAll('.gate-on-wire.circuit-selected, .control-flow-block.circuit-selected').forEach((el) => {
                el.classList.remove('circuit-selected');
            });
            if (this._selectionLayerEl) this._selectionLayerEl.hidden = true;
        }
        drag.slotCache = this._buildPlacedGateSlotCache();
        drag.pendingX = e.clientX;
        drag.pendingY = e.clientY;

        const pad = 8;
        if (drag.useSelectionBox) {
            drag.frozenClientBounds = this._getSelectionClientBounds();
            drag.frozenLocal = drag.frozenClientBounds
                ? this._clientRectToCanvasLocal(drag.frozenClientBounds, pad)
                : null;
            if (drag.frozenClientBounds) {
                this._syncSelectionBoxMirrors(drag.frozenClientBounds);
                drag.mirrorsBuilt = true;
            }
        } else if (drag.controlFlow.length === 1 && !drag.gates.length) {
            const cf = drag.controlFlow[0];
            const block = document.querySelector(
                `.control-flow-block[data-column="${cf.column}"][data-type="${cf.type}"]`
            );
            if (block) {
                const offset = this._captureCfDragGhostOffset(block, e.clientX, e.clientY);
                drag.ghostOffsetX = offset.x;
                drag.ghostOffsetY = offset.y;
                drag.soloGhost = this._buildControlFlowDragGhost(block);
                this._positionSoloDragGhost(
                    drag.soloGhost,
                    e.clientX,
                    e.clientY,
                    drag.ghostOffsetX,
                    drag.ghostOffsetY
                );
            }
        } else if (drag.gates.length === 1 && !drag.controlFlow.length) {
            const gate = drag.gates[0];
            if (this._gateUsesCompositeDragGhost(gate)) {
                const ghostPack = this._buildCompositeGateDragGhost(gate, e.clientX, e.clientY);
                if (ghostPack) {
                    drag.ghostOffsetX = ghostPack.offsetX;
                    drag.ghostOffsetY = ghostPack.offsetY;
                    drag.soloGhost = ghostPack.ghost;
                    this._positionSoloDragGhost(
                        drag.soloGhost,
                        e.clientX,
                        e.clientY,
                        drag.ghostOffsetX,
                        drag.ghostOffsetY
                    );
                }
            }
        }

        try {
            document.getElementById('circuitCanvas')?.setPointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }
        this._startGroupGateDragLoop();
        this._updateCircuitSelectionOverlay();
    }

    _cleanupGroupGateDrag() {
        const drag = this._groupGateDrag;
        if (!drag) return;

        if (drag.rafId) {
            cancelAnimationFrame(drag.rafId);
            drag.rafId = 0;
        }

        this._setGroupSelectionVisualFaded(false);
        drag.soloGhost?.remove();
        drag.soloGhost = null;
        this._clearSelectionBoxMirrors();
        this._setSelectionDragPassthrough(false);
        this._setCircuitDragSelectShield(false);
        document.body.classList.remove('is-placed-gate-drag');
        document.getElementById('circuitCanvas')?.classList.remove('is-placed-gate-delete-target');

        if (drag.active) {
            this._setCircuitDragActive(false);
            this._hidePhantomQubitLine();
            this._clearDragOverHighlights();
            this._clearShiftPreview();
        }

        this._groupGateDrag = null;
        this._updateCircuitSelectionOverlay();
    }

    _completeGroupGateDrop(clientX, clientY) {
        const drag = this._groupGateDrag;
        if (!drag?.active) return false;

        this._hidePhantomQubitLine();
        this._clearDragOverHighlights();
        this._clearShiftPreview();
        document.getElementById('circuitCanvas')?.classList.remove('is-placed-gate-delete-target');

        const dropX = drag.pendingX ?? clientX;
        const dropY = drag.pendingY ?? clientY;

        const deltas = this._resolveGroupDragDeltas(drag, dropX, dropY, { allowPhantom: true });

        if (!this._isPlacedGateDeleteZone(dropX, dropY, drag.slotCache) &&
            this._groupDragDeltasValid(drag, deltas)) {
            if (drag.gates.length) {
                const required = this._groupRequiredQubitCount(drag, deltas.deltaQ);
                if (!this._ensureGroupDragQubits(required)) {
                    return false;
                }
            }

            const moved = this.circuit.moveCircuitGroup(
                drag.gates,
                drag.controlFlow,
                deltas.deltaQ,
                deltas.deltaCol
            );

            if (moved) {
                this.circuit.state = null;
                document.getElementById('qubitCount').value = formatQubitCountLabel(this.circuit.numQubits);
                this._clearCircuitSelection();
                this._refreshCircuitAfterGateEdit();
            }
            return moved;
        }

        if (this._isPlacedGateDeleteZone(dropX, dropY, drag.slotCache)) {
            this.circuit.removeGatesByRef(drag.gates);
            for (const cf of drag.controlFlow) {
                this.circuit.removeControlFlow(cf.column);
            }
            this.circuit.state = null;
            this._clearCircuitSelection();
            this._refreshCircuitAfterGateEdit();
            return true;
        }

        return false;
    }

    _initCircuitSelection() {
        if (this._circuitSelectionBound) return;
        this._circuitSelectionBound = true;

        const canvas = document.getElementById('circuitCanvas');
        const wrapper = document.querySelector('.circuit-canvas-wrapper');
        if (!canvas || !wrapper) return;

        this._ensureCircuitSelectionLayer();
        this._ensureMarqueeBox();

        const DRAG_THRESHOLD_SQ = 64;

        canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            if (this._palettePointerDrag?.active) return;
            if (this._placedGateDrag) return;
            if (this._groupGateDrag) return;
            if (e.target.closest('.gate-on-wire, .gate-delete-btn, .circuit-selection-layer')) {
                return;
            }

            this._marqueeSelect = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                active: false,
                moved: false
            };
        });

        document.addEventListener('pointermove', (e) => {
            const marquee = this._marqueeSelect;
            if (marquee && e.pointerId === marquee.pointerId) {
                const dx = e.clientX - marquee.startX;
                const dy = e.clientY - marquee.startY;
                if (!marquee.active) {
                    if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;
                    marquee.active = true;
                    marquee.moved = true;
                    e.preventDefault();
                    this._setCircuitDragSelectShield(true);
                } else {
                    e.preventDefault();
                }

                const box = this._ensureMarqueeBox();
                if (!box) return;
                const wr = wrapper.getBoundingClientRect();
                const left = Math.min(marquee.startX, e.clientX) - wr.left + wrapper.scrollLeft;
                const top = Math.min(marquee.startY, e.clientY) - wr.top + wrapper.scrollTop;
                const width = Math.abs(e.clientX - marquee.startX);
                const height = Math.abs(e.clientY - marquee.startY);
                box.hidden = false;
                box.style.left = `${left}px`;
                box.style.top = `${top}px`;
                box.style.width = `${width}px`;
                box.style.height = `${height}px`;
                return;
            }

            const groupDrag = this._groupGateDrag;
            if (groupDrag && e.pointerId === groupDrag.pointerId) {
                const dx = e.clientX - groupDrag.startX;
                const dy = e.clientY - groupDrag.startY;
                if (!groupDrag.active) {
                    if (dx * dx + dy * dy < DRAG_THRESHOLD_SQ) return;
                    this._activateGroupGateDrag(e);
                } else {
                    e.preventDefault();
                }
                groupDrag.pendingX = e.clientX;
                groupDrag.pendingY = e.clientY;
                if (groupDrag.active && groupDrag.soloGhost) {
                    this._positionSoloDragGhost(
                        groupDrag.soloGhost,
                        groupDrag.pendingX,
                        groupDrag.pendingY,
                        groupDrag.ghostOffsetX,
                        groupDrag.ghostOffsetY
                    );
                }
            }
        }, { passive: false });

        const finishMarquee = (e) => {
            const marquee = this._marqueeSelect;
            if (marquee && e.pointerId === marquee.pointerId) {
                const box = this._marqueeBoxEl;
                if (marquee.active && box) {
                    const selRect = {
                        left: Math.min(marquee.startX, e.clientX),
                        top: Math.min(marquee.startY, e.clientY),
                        right: Math.max(marquee.startX, e.clientX),
                        bottom: Math.max(marquee.startY, e.clientY)
                    };
                    selRect.width = selRect.right - selRect.left;
                    selRect.height = selRect.bottom - selRect.top;
                    const picked = this._collectSelectionInClientRect(selRect);
                    const pickCount = picked.gates.size + picked.controlFlow.size;
                    if (pickCount > 1) {
                        this._setCircuitSelection([...picked.gates], [...picked.controlFlow]);
                    } else {
                        this._clearCircuitSelection();
                    }
                    this._suppressCircuitSelectionClick = true;
                    requestAnimationFrame(() => {
                        this._suppressCircuitSelectionClick = false;
                    });
                } else if (!marquee.moved) {
                    this._clearCircuitSelection();
                }

                if (box) box.hidden = true;
                this._setCircuitDragSelectShield(false);
                this._marqueeSelect = null;
            }

            const groupDrag = this._groupGateDrag;
            if (groupDrag && e.pointerId === groupDrag.pointerId) {
                if (groupDrag.active) {
                    e.preventDefault();
                    this._completeGroupGateDrop(e.clientX, e.clientY);
                    this._suppressPlacedGateClick = true;
                    this._suppressCircuitSelectionClick = true;
                    requestAnimationFrame(() => {
                        this._suppressPlacedGateClick = false;
                        this._suppressCircuitSelectionClick = false;
                    });
                } else {
                    this._groupGateDrag = null;
                }

                try {
                    document.getElementById('circuitCanvas')?.releasePointerCapture(e.pointerId);
                } catch {
                    /* ignore */
                }
                this._cleanupGroupGateDrag();
            }
        };

        document.addEventListener('pointerup', finishMarquee);
        document.addEventListener('pointercancel', finishMarquee);
    }

    initDesktopPanelResize() {
        const mobileMq = window.matchMedia('(max-width: 768px)');
        const desktopMq = window.matchMedia('(min-width: 769px)');
        const leftHandle = document.getElementById('leftPanelResize');
        const rightHandle = document.getElementById('rightPanelResize');
        const sidebar = document.querySelector('.main-content > aside.sidebar');
        const codeSidebar = document.querySelector('.main-content > aside.code-sidebar');
        const circuitCanvasWrapper = document.querySelector('.circuit-canvas-wrapper');
        if (!leftHandle || !rightHandle || !sidebar || !codeSidebar) return;

        try {
            localStorage.removeItem('simSidebarWidth');
            localStorage.removeItem('simCodeSidebarWidth');
        } catch {
            /* ignore */
        }

        const HANDLE_TOTAL = 12;
        const minCenter = 280;
        const minSidebar = 184;
        const minCode = 240;
        const defaultCodeWidth = 340;

        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

        const readW = (el) => {
            const r = el.getBoundingClientRect().width;
            return Number.isFinite(r) && r > 0 ? r : 0;
        };

        const readH = (el) => {
            const r = el.getBoundingClientRect().height;
            return Number.isFinite(r) && r > 0 ? r : 0;
        };

        const jointClamp = (sw, cw) => {
            let s = sw;
            let c = cw;
            for (let i = 0; i < 4; i++) {
                const maxS = window.innerWidth - c - HANDLE_TOTAL - minCenter;
                s = clamp(s, minSidebar, Math.max(minSidebar, maxS));
                const maxC = window.innerWidth - s - HANDLE_TOTAL - minCenter;
                c = clamp(c, minCode, Math.max(minCode, maxC));
            }
            return { s, c };
        };

        window.addEventListener('resize', () => {
            if (mobileMq.matches) return;
            if (!sidebar.style.width && !codeSidebar.style.width) return;
            const sw = readW(sidebar) || 260;
            const cw = readW(codeSidebar) || defaultCodeWidth;
            const { s, c } = jointClamp(sw, cw);
            if (sidebar.style.width) sidebar.style.width = `${Math.round(s)}px`;
            if (codeSidebar.style.width) codeSidebar.style.width = `${Math.round(c)}px`;
        });

        const attach = (handle, which) => {
            handle.addEventListener('pointerdown', (e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                handle.setPointerCapture(e.pointerId);
                handle.classList.add('is-dragging');

                let resizeRaf = 0;
                const scheduleLayoutRefresh = () => {
                    if (resizeRaf) return;
                    resizeRaf = requestAnimationFrame(() => {
                        resizeRaf = 0;
                        window.dispatchEvent(new Event('resize'));
                    });
                };

                const finish = (ev) => {
                    handle.releasePointerCapture(ev.pointerId);
                    handle.removeEventListener('pointermove', onMove);
                    handle.removeEventListener('pointerup', finish);
                    handle.removeEventListener('pointercancel', finish);
                    handle.classList.remove('is-dragging');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    document.body.classList.remove('is-panel-resize-drag');

                    if (!mobileMq.matches) {
                        const { s, c } = jointClamp(readW(sidebar) || 260, readW(codeSidebar) || defaultCodeWidth);
                        sidebar.style.width = `${Math.round(s)}px`;
                        codeSidebar.style.width = `${Math.round(c)}px`;
                    }
                    window.dispatchEvent(new Event('resize'));
                };

                let startX = e.clientX;
                let startY = e.clientY;
                let startSidebar = readW(sidebar) || 260;
                let startCode = readW(codeSidebar) || defaultCodeWidth;
                let startCodeHeight = readH(codeSidebar) || 350;
                let startCanvasMax = circuitCanvasWrapper
                    ? circuitCanvasWrapper.getBoundingClientRect().height
                    : Math.round(window.innerHeight * 0.5);

                document.body.classList.add('is-panel-resize-drag');
                document.body.style.userSelect = 'none';

                const onMove = (ev) => {
                    ev.preventDefault();
                    if (mobileMq.matches) {
                        const dy = ev.clientY - startY;
                        if (which === 'left' && circuitCanvasWrapper) {
                            const nh = clamp(
                                startCanvasMax + dy,
                                200,
                                Math.round(window.innerHeight * 0.65)
                            );
                            circuitCanvasWrapper.style.maxHeight = `${Math.round(nh)}px`;
                        } else if (which === 'code') {
                            const nh = clamp(
                                startCodeHeight + dy,
                                200,
                                Math.round(window.innerHeight * 0.75)
                            );
                            codeSidebar.style.height = `${Math.round(nh)}px`;
                            codeSidebar.style.minHeight = `${Math.round(nh)}px`;
                        }
                        scheduleLayoutRefresh();
                        return;
                    }

                    if (!desktopMq.matches) return;
                    const dx = ev.clientX - startX;
                    if (which === 'left') {
                        const nw = clamp(startSidebar + dx, minSidebar,
                            Math.max(minSidebar, window.innerWidth - startCode - HANDLE_TOTAL - minCenter));
                        sidebar.style.width = `${Math.round(nw)}px`;
                    } else {
                        const nw = clamp(startCode - dx, minCode,
                            Math.max(minCode, window.innerWidth - startSidebar - HANDLE_TOTAL - minCenter));
                        codeSidebar.style.width = `${Math.round(nw)}px`;
                    }
                    scheduleLayoutRefresh();
                };

                document.body.style.cursor = mobileMq.matches ? 'row-resize' : 'col-resize';
                handle.addEventListener('pointermove', onMove);
                handle.addEventListener('pointerup', finish);
                handle.addEventListener('pointercancel', finish);
            });
        };

        attach(leftHandle, 'left');
        attach(rightHandle, 'code');

        const resetPanelWidthsToDefault = (e) => {
            e.preventDefault();
            if (mobileMq.matches) {
                if (circuitCanvasWrapper) circuitCanvasWrapper.style.maxHeight = '';
                codeSidebar.style.height = '';
                codeSidebar.style.minHeight = '';
            } else if (desktopMq.matches) {
                sidebar.style.width = '';
                codeSidebar.style.width = '';
            }
            window.dispatchEvent(new Event('resize'));
        };
        leftHandle.addEventListener('dblclick', resetPanelWidthsToDefault);
        rightHandle.addEventListener('dblclick', resetPanelWidthsToDefault);
    }

    initializeEventListeners() {
        // Gate palette handlers (delegated so newly created custom gates work too)
        const gatePalette = document.querySelector('.gate-palette');
        if (gatePalette) {
            gatePalette.addEventListener('dragstart', (e) => {
                const item = e.target.closest('.gate-item');
                if (!item) return;
                this.draggedGate = item.dataset.gate;
                this._setCircuitDragActive(true);
                e.dataTransfer.effectAllowed = 'copy';
                item.classList.add('dragging');

                const ghost = buildPaletteDragGhost(item);
                const half = PALETTE_DRAG_GHOST_SIZE / 2;
                if (ghost) {
                    e.dataTransfer.setDragImage(ghost, half, half);
                }
                setTimeout(() => ghost?.remove(), 0);
            });

            gatePalette.addEventListener('dragend', (e) => {
                e.target.closest('.gate-item')?.classList.remove('dragging');
                document.querySelectorAll('.gate-item.dragging').forEach((el) => el.classList.remove('dragging'));
                this.draggedGate = null;
                this._setCircuitDragActive(false);
                this._hidePhantomQubitLine();
                this._clearDragOverHighlights();
                this._clearShiftPreview();
            });

            gatePalette.addEventListener('click', (e) => {
                if (this._suppressPaletteClick) return;

                const infoBtn = e.target.closest('.gate-info-icon');
                if (infoBtn) {
                    e.stopPropagation();
                    const item = infoBtn.closest('.gate-item');
                    this._pinGateInfoIcon(item);
                    this.showGateInfo(infoBtn.dataset.gate);
                    return;
                }

                const item = e.target.closest('.gate-item');
                if (!item) return;

                const gate = item.dataset.gate;
                if (this.selectedGate === gate) {
                    this.selectedGate = null;
                    document.querySelectorAll('.gate-item').forEach(el => el.classList.remove('gate-selected'));
                    item.classList.remove('info-pinned');
                } else {
                    this.selectedGate = gate;
                    document.querySelectorAll('.gate-item').forEach(el => el.classList.remove('gate-selected'));
                    item.classList.add('gate-selected');
                    this._pinGateInfoIcon(item);
                }
                this._updateSlotReadyState();
            });

            document.addEventListener('click', (e) => {
                if (!e.target.closest('.gate-palette .gate-item')) {
                    document.querySelectorAll('.gate-item.info-pinned').forEach(el => el.classList.remove('info-pinned'));
                }
            });
        }

        // Circuit controls
        document.getElementById('runBtn').addEventListener('click', () => this.runCircuit());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearCircuit());
        document.getElementById('addQubitBtn').addEventListener('click', () => this.addQubit());
        document.getElementById('removeQubitBtn').addEventListener('click', () => this.removeQubit());
        document.getElementById('qubitCount').addEventListener('change', (e) => {
            const value = e.target.value;
            // Extract number from "N Qubits" format
            const numMatch = value.match(/^(\d+)/);
            if (numMatch) {
                const num = parseInt(numMatch[1]);
                this.setQubitCount(num);
            }
        });

        // Format the input on blur to show "N Qubits" and validate
        document.getElementById('qubitCount').addEventListener('blur', (e) => {
            const value = e.target.value;
            const numMatch = value.match(/^(\d+)/);
            if (numMatch) {
                const num = parseInt(numMatch[1]);
                const settings = this.getSettings();
                const maxQubits = settings.maxQubits || 12;
                const validNum = Math.max(1, Math.min(num, maxQubits));
                e.target.value = formatQubitCountLabel(validNum);
                if (validNum !== num) {
                    this.setQubitCount(validNum);
                }
            } else {
                // If no valid number, restore current qubit count
                e.target.value = formatQubitCountLabel(this.circuit.numQubits);
            }
        });

        // Allow typing numbers, but format on blur
        document.getElementById('qubitCount').addEventListener('input', (e) => {
            // Allow typing, but we'll format on blur
        });

        // Zoom controls
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());

        // Tab switching
        // Tab switching for Circuit Builder / NMR Simulator
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Tab switching for Probabilities / State Vector (only in region 1)
        const vizRegion1 = document.querySelector('.viz-region-1');
        if (vizRegion1) {
            vizRegion1.querySelectorAll('.viz-tab-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tab = e.target.dataset.vizTab;
                    this.switchVizTab(tab);
                });
            });
        }

        // Toggle visualization section collapse/expand
        const toggleVizBtn = document.getElementById('toggleVizSectionBtn');
        if (toggleVizBtn) {
            toggleVizBtn.addEventListener('click', () => this.toggleVisualizationSection());

            // Load saved state
            const savedState = localStorage.getItem('vizSectionCollapsed');
            if (savedState == null) {
                // Default: show visualization section (expanded).
                localStorage.setItem('vizSectionCollapsed', 'false');
            } else if (savedState === 'true') {
                this.toggleVisualizationSection(false); // false = don't toggle, just set to collapsed
            }
        }

        // Qubi editor - bidirectional sync
        const qubiCodeTextarea = document.getElementById('qubiCode');
        if (qubiCodeTextarea) {
            qubiCodeTextarea.addEventListener('input', () => {
                this.handleCodeChange();
            });

            // Listen for error state changes from syntax highlighter
            qubiCodeTextarea.addEventListener('qubiErrorStateChanged', () => {
                this.updateErrorState();
            });
        }

        document.getElementById('clearQubiBtn').addEventListener('click', () => {
            this.isUpdatingFromCircuit = true;
            if (this.syntaxHighlighter) {
                this.syntaxHighlighter.setCode('', { preserveUndo: false });
            } else {
                document.getElementById('qubiCode').value = '';
            }
            this.circuit.clear();
            this.renderCircuit();
            this.updateVisualization();
            this.isUpdatingFromCircuit = false;
        });

        // Qubi save/load split menus
        const qubiFileInput = document.getElementById('qubiFileInput');
        if (qubiFileInput) qubiFileInput.addEventListener('change', (e) => this.loadQubiFile(e));

        const qubiFolderInput = document.getElementById('qubiFolderInput');
        if (qubiFolderInput) qubiFolderInput.addEventListener('change', (e) => this.loadQubiFolderFromInput(e));

        const qubiZipInput = document.getElementById('qubiZipInput');
        if (qubiZipInput) qubiZipInput.addEventListener('change', (e) => this.loadQubiZipFromInput(e));

        const saveMainBtn = document.getElementById('saveQubiFileBtn');
        const saveCaretBtn = document.getElementById('qubiSaveMenuBtn');
        const saveMenu = document.getElementById('qubiSaveMenu');
        const saveAsFileItem = document.getElementById('saveQubiAsFileItem');
        const saveAsFolderItem = document.getElementById('saveQubiAsFolderItem');
        const saveAsZipItem = document.getElementById('saveQubiAsZipItem');

        const loadMainBtn = document.getElementById('loadQubiFileBtn');
        const loadCaretBtn = document.getElementById('qubiLoadMenuBtn');
        const loadMenu = document.getElementById('qubiLoadMenu');
        const loadFromFileItem = document.getElementById('loadQubiFromFileItem');
        const loadFromFolderItem = document.getElementById('loadQubiFromFolderItem');
        const loadFromZipItem = document.getElementById('loadQubiFromZipItem');

        const closeMenus = () => {
            if (saveMenu) saveMenu.style.display = 'none';
            if (loadMenu) loadMenu.style.display = 'none';
            if (saveCaretBtn) saveCaretBtn.setAttribute('aria-expanded', 'false');
            if (loadCaretBtn) loadCaretBtn.setAttribute('aria-expanded', 'false');
        };

        const toggleMenu = (which) => {
            const isSave = which === 'save';
            const menu = isSave ? saveMenu : loadMenu;
            const btn = isSave ? saveCaretBtn : loadCaretBtn;
            if (!menu || !btn) return;
            const open = menu.style.display !== 'none' && menu.style.display !== '';
            closeMenus();
            if (!open) {
                menu.style.display = 'block';
                btn.setAttribute('aria-expanded', 'true');
            }
        };

        // Main buttons default to "file" flows.
        if (saveMainBtn) saveMainBtn.addEventListener('click', () => this.saveQubiFile());
        if (loadMainBtn) loadMainBtn.addEventListener('click', () => {
            const input = document.getElementById('qubiFileInput');
            if (input) input.click();
        });

        if (saveCaretBtn) saveCaretBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu('save'); });
        if (loadCaretBtn) loadCaretBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu('load'); });

        if (saveAsFileItem) saveAsFileItem.addEventListener('click', () => { closeMenus(); this.saveQubiFile(); });
        if (saveAsFolderItem) saveAsFolderItem.addEventListener('click', () => { closeMenus(); this.saveQubiFolder(); });
        if (saveAsZipItem) saveAsZipItem.addEventListener('click', () => { closeMenus(); this.saveQubiZip(); });

        if (loadFromFileItem) loadFromFileItem.addEventListener('click', () => {
            closeMenus();
            const input = document.getElementById('qubiFileInput');
            if (input) input.click();
        });
        if (loadFromFolderItem) loadFromFolderItem.addEventListener('click', () => { closeMenus(); this.loadQubiFolder(); });
        if (loadFromZipItem) loadFromZipItem.addEventListener('click', () => {
            closeMenus();
            const input = document.getElementById('qubiZipInput');
            if (input) input.click();
        });

        if (!document._qubiSplitMenusBound) {
            document._qubiSplitMenusBound = true;
            document.addEventListener('click', () => closeMenus());
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeMenus();
            });
        }

        // Fix with QubiAI
        const fixBtn = document.getElementById('fixWithQubiAiBtn');
        if (fixBtn) {
            fixBtn.addEventListener('click', () => this.prefillQubiAiForFix());
        }

        // Algorithms (opened from sidebar examples list)
        document.getElementById('mobileSeeExamplesBtn')?.addEventListener('click', () => this.showAlgorithmsModal());
        document.getElementById('closeAlgorithmsBtn').addEventListener('click', () => {
            document.getElementById('algorithmsModal').classList.remove('active');
            document.getElementById('algorithmParams').style.display = 'none';
            const detail = document.getElementById('algorithmDetail');
            if (detail) detail.style.display = 'none';
        });
        document.getElementById('confirmAlgorithmBtn').addEventListener('click', () => this.confirmAlgorithmLoad());
        document.getElementById('cancelAlgorithmBtn').addEventListener('click', () => {
            document.getElementById('algorithmParams').style.display = 'none';
        });

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());
        document.getElementById('closeSettingsBtn').addEventListener('click', () => {
            document.getElementById('settingsModal').classList.remove('active');
        });
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());

        // Export
        document.getElementById('exportBtn').addEventListener('click', () => this.showExportModal());
        document.getElementById('closeExportBtn').addEventListener('click', () => this.closeExportModal());
        document.getElementById('exportPngBtn').addEventListener('click', () => this.showExportPreview('png'));
        document.getElementById('exportSvgBtn').addEventListener('click', () => this.showExportPreview('svg'));
        document.getElementById('exportPdfBtn').addEventListener('click', () => this.showExportPreview('pdf'));
        document.getElementById('exportBackBtn').addEventListener('click', () => this.showFormatSelection());
        document.getElementById('cancelExportBtn').addEventListener('click', () => this.closeExportModal());
        document.getElementById('confirmExportBtn').addEventListener('click', () => this.confirmExport());

        // Update preview when settings change
        document.getElementById('exportIncludeBackground').addEventListener('change', () => this.updateExportPreview());
        document.getElementById('exportHighRes').addEventListener('change', () => this.updateExportPreview());

        // Gate info modal
        document.getElementById('closeGateInfoBtn').addEventListener('click', () => {
            document.getElementById('gateInfoModal').classList.remove('active');
        });

        // Modal controls
        document.getElementById('confirmParamBtn').addEventListener('click', () => this.confirmGateParameters());
        document.getElementById('cancelParamBtn').addEventListener('click', () => this.cancelGateParameters());
        document.getElementById('confirmTargetBtn').addEventListener('click', () => this.confirmTargetSelection());
        document.getElementById('cancelTargetBtn').addEventListener('click', () => this.cancelTargetSelection());
        document.getElementById('confirmRepeatBtn').addEventListener('click', () => this.confirmRepeat());
        document.getElementById('cancelRepeatBtn').addEventListener('click', () => this.cancelRepeat());

        // Click on gate slots (works for both desktop click and mobile tap)
        document.getElementById('circuitCanvas').addEventListener('click', (e) => {
            // Skip if delete button was clicked (has its own handler)
            if (e.target.closest('.gate-delete-btn')) return;
            if (e.target.closest('.circuit-selection-delete')) return;
            if (this._suppressPlacedGateClick || this._suppressCircuitSelectionClick) return;
            if (e.target.classList.contains('gate-on-wire') || e.target.closest('.gate-on-wire')) {
                const gateEl = e.target.classList.contains('gate-on-wire') ? e.target : e.target.closest('.gate-on-wire');
                const gate = this._resolveCircuitGateFromEl(gateEl);
                if (gate && this._circuitSelectionCount() > 1 && this._circuitSelection.has(gate)) return;
                this.editGate(gateEl);
            } else if (this.selectedGate) {
                const slot = this._resolveGateSlotFromPointer(e.clientX, e.clientY)
                    || (e.target.classList.contains('gate-slot') ? e.target : e.target.closest('.gate-slot'));
                if (slot) {
                    this.placeGateOnSlot(slot);
                }
            }
        });

        // Right-click to delete gates
        document.getElementById('circuitCanvas').addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (e.target.classList.contains('gate-on-wire') || e.target.closest('.gate-on-wire')) {
                const gateEl = e.target.classList.contains('gate-on-wire') ? e.target : e.target.closest('.gate-on-wire');
                this.removeGateFromSlot(gateEl);
            }
        });

        const circuitCanvas = document.getElementById('circuitCanvas');

        // Drag over circuit
        circuitCanvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.draggedGate) return;
            this._updatePaletteDragTarget(e.clientX, e.clientY);
        });

        circuitCanvas.addEventListener('mousemove', (e) => {
            if (this._placedGateDrag?.active) return;
            if (!this.draggedGate && !this.selectedGate) return;
            const slot = this._resolveGateSlotFromPointer(e.clientX, e.clientY);
            if (slot && !slot.closest('.qubit-line-phantom')) {
                this._updateShiftPreviewFromSlot(slot, null);
            }
        });

        circuitCanvas.addEventListener('pointermove', (e) => {
            if (this._placedGateDrag?.active) return;
            if (!this.draggedGate && !this.selectedGate) return;
            const slot = this._resolveGateSlotFromPointer(e.clientX, e.clientY);
            if (slot && !slot.closest('.qubit-line-phantom')) {
                this._updateShiftPreviewFromSlot(slot, null);
            }
        });

        circuitCanvas.addEventListener('mouseleave', () => {
            this._clearShiftPreview();
        });

        circuitCanvas.addEventListener('dragleave', (e) => {
            if (!circuitCanvas.contains(e.relatedTarget)) {
                this._hidePhantomQubitLine();
                this._clearDragOverHighlights();
                this._clearShiftPreview();
                return;
            }
            const slot = e.target.closest('.gate-slot');
            if (slot && !slot.closest('.qubit-line-phantom')) {
                slot.classList.remove('drag-over');
            }
        });

        circuitCanvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const gate = this.draggedGate;
            this.draggedGate = null;
            this._completePaletteGateDrop(gate, e.clientX, e.clientY);
            this._setCircuitDragActive(false);
            document.querySelectorAll('.gate-item.dragging').forEach((el) => el.classList.remove('dragging'));
        });
    }

    _pinGateInfoIcon(item) {
        document.querySelectorAll('.gate-item.info-pinned').forEach(el => {
            if (el !== item) el.classList.remove('info-pinned');
        });
        item?.classList.add('info-pinned');
    }

    _initPaletteGateItems() {
        document.querySelectorAll('.gate-palette .gate-item').forEach(item => {
            const sym = item.querySelector('.gate-symbol');
            if (!sym) return;

            let info = sym.querySelector('.gate-info-icon');
            if (!info) info = item.querySelector('.gate-info-icon');
            if (info && !sym.contains(info)) {
                if (!info.type) info.type = 'button';
                sym.appendChild(info);
            }

            const nameEl = item.querySelector('.gate-name');
            if (nameEl) {
                item.setAttribute('aria-label', nameEl.textContent.trim());
            }

            let labelEl = sym.querySelector('.gate-symbol-label');
            if (!labelEl) {
                const labelText = sym.childNodes[0]?.nodeType === Node.TEXT_NODE
                    ? sym.childNodes[0].textContent.trim()
                    : sym.textContent.replace('ℹ', '').trim();
                sym.childNodes.forEach(n => {
                    if (n.nodeType === Node.TEXT_NODE) sym.removeChild(n);
                });
                labelEl = document.createElement('span');
                labelEl.className = 'gate-symbol-label';
                labelEl.textContent = labelText;
                sym.insertBefore(labelEl, sym.firstChild);
            }
            fitGateLabel(labelEl, labelEl.textContent);
        });
    }

    _initSidebarExamplesList() {
        const container = document.getElementById('sidebarExamplesList');
        if (!container || typeof QuantumAlgorithms === 'undefined') return;

        const categoryOrder = ['Entanglement', 'Algorithm', 'Communication', 'Concept', 'Error Correction'];
        const categories = {};
        Object.entries(QuantumAlgorithms).forEach(([key, algo]) => {
            const cat = algo.category || 'Other';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ key, algo });
        });

        container.innerHTML = '';
        categoryOrder.forEach(catName => {
            const items = categories[catName];
            if (!items?.length) return;

            const section = document.createElement('div');
            section.className = 'sidebar-example-category';
            const title = document.createElement('h3');
            title.className = 'category-title';
            title.textContent = catName;
            section.appendChild(title);

            const list = document.createElement('div');
            list.className = 'sidebar-examples-group';
            items.forEach(({ key, algo }) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'sidebar-example-item';
                btn.textContent = algo.name;
                btn.dataset.algoKey = key;
                btn.addEventListener('click', () => this.openAlgorithmExample(key));
                list.appendChild(btn);
            });
            section.appendChild(list);
            container.appendChild(section);
        });

        const other = categories['Other'];
        if (other?.length) {
            const section = document.createElement('div');
            section.className = 'sidebar-example-category';
            const title = document.createElement('h3');
            title.className = 'category-title';
            title.textContent = 'Other';
            section.appendChild(title);
            const list = document.createElement('div');
            list.className = 'sidebar-examples-group';
            other.forEach(({ key, algo }) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'sidebar-example-item';
                btn.textContent = algo.name;
                btn.dataset.algoKey = key;
                btn.addEventListener('click', () => this.openAlgorithmExample(key));
                list.appendChild(btn);
            });
            section.appendChild(list);
            container.appendChild(section);
        }
    }

    openAlgorithmExample(key) {
        const algo = QuantumAlgorithms[key];
        if (!algo) return;
        this.showAlgorithmsModal();
        this.showAlgorithmDetail(key, algo);
        requestAnimationFrame(() => {
            const list = document.getElementById('algorithmsList');
            if (!list) return;
            list.querySelectorAll('.algorithm-item.selected').forEach(el => el.classList.remove('selected'));
            const item = list.querySelector(`.algorithm-item[data-algo-key="${key}"]`);
            if (item) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        });
    }

    /** Highlight empty slots when a gate is selected for tap-to-place */
    _updateSlotReadyState() {
        const slots = document.querySelectorAll('.gate-slot');
        if (this.selectedGate) {
            slots.forEach(slot => {
                if (!slot.querySelector('.gate-on-wire')) {
                    slot.classList.add('slot-ready');
                }
            });
        } else {
            slots.forEach(slot => slot.classList.remove('slot-ready'));
        }
    }

    _canAddQubit() {
        const settings = this.getSettings();
        const maxQubits = settings.maxQubits || 12;
        return this.circuit.numQubits < maxQubits;
    }

    _getColumnFromClientX(clientX) {
        const canvas = document.getElementById('circuitCanvas');
        const canvasPadding = 32;
        const labelWidth = 60;
        const rect = canvas.getBoundingClientRect();
        const zoom = this.zoomLevel || 1;
        const x = (clientX - rect.left) / zoom;
        const wireX = x - canvasPadding - labelWidth;
        if (wireX < 0) return 0;
        const col = Math.floor(wireX / this.columnSpacing);
        const minColumns = Math.max(this.circuit.maxColumn + 10, 20);
        return Math.max(0, Math.min(col, minColumns - 1));
    }

    /**
     * Gate slot under the pointer, including columns covered by REPEAT/END blocks
     * (those sit above slots in the hit-test order).
     */
    _resolveGateSlotFromPointer(clientX, clientY) {
        const canvas = document.getElementById('circuitCanvas');
        if (!canvas) return null;
        const stack = document.elementsFromPoint(clientX, clientY);
        for (const el of stack) {
            if (!canvas.contains(el)) continue;
            const slot = el.classList?.contains('gate-slot') ? el : el.closest?.('.gate-slot');
            if (slot && canvas.contains(slot) && !slot.closest('.qubit-line-phantom')) {
                return slot;
            }
        }
        return null;
    }

    /** Coordinate-based slot lookup — avoids elementsFromPoint during drag. */
    _resolveGateSlotFast(clientX, clientY, slotCache = null) {
        const canvas = document.getElementById('circuitCanvas');
        if (!canvas) return null;

        const lineRects = slotCache?.lineRects;
        let qubit = -1;

        if (lineRects?.length) {
            const top = lineRects[0].top;
            const bottom = lineRects[lineRects.length - 1].bottom;
            if (clientY < top - 12 || clientY > bottom + 12) return null;
            for (let i = 0; i < lineRects.length; i++) {
                const line = lineRects[i];
                if (clientY >= line.top && clientY <= line.bottom) {
                    qubit = line.qubit;
                    break;
                }
            }
            if (qubit < 0) {
                let bestDist = Infinity;
                for (const line of lineRects) {
                    const mid = (line.top + line.bottom) * 0.5;
                    const dist = Math.abs(clientY - mid);
                    if (dist < bestDist) {
                        bestDist = dist;
                        qubit = line.qubit;
                    }
                }
                if (bestDist > 36) qubit = -1;
            }
        } else {
            const rect = canvas.getBoundingClientRect();
            if (clientY < rect.top || clientY > rect.bottom) return null;
            const lines = canvas.querySelectorAll('.qubit-line:not(.qubit-line-phantom)');
            for (const line of lines) {
                const lr = line.getBoundingClientRect();
                if (clientY >= lr.top && clientY <= lr.bottom) {
                    qubit = parseInt(line.dataset.qubit, 10);
                    break;
                }
            }
        }

        if (qubit < 0) return null;

        const col = this._getColumnFromClientX(clientX);
        return canvas.querySelector(
            `.gate-slot[data-qubit="${qubit}"][data-column="${col}"]`
        );
    }

    _setCircuitDragActive(active) {
        document.getElementById('circuitCanvas')?.classList.toggle('is-gate-drag', Boolean(active));
    }

    _isInAddQubitZone(clientX, clientY) {
        if (!this._canAddQubit()) return false;
        const canvas = document.getElementById('circuitCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        if (clientX < canvasRect.left || clientX > canvasRect.right) return false;
        if (clientY < canvasRect.top || clientY > canvasRect.bottom + this._qubitRowHeight) return false;

        if (this._phantomQubitEl?.classList.contains('is-visible')) {
            const pr = this._phantomQubitEl.getBoundingClientRect();
            if (clientY >= pr.top - 4 && clientY <= pr.bottom + 4) return true;
        }

        const lines = canvas.querySelectorAll('.qubit-line:not(.qubit-line-phantom)');
        if (!lines.length) return false;
        const lastLine = lines[lines.length - 1];
        const lastRect = lastLine.getBoundingClientRect();
        return clientY >= lastRect.bottom - 4 && clientY <= lastRect.bottom + this._qubitRowHeight + 4;
    }

    _syncPhantomQubitLine(minColumns, totalWidth) {
        let phantom = this._phantomQubitEl;
        if (!phantom) {
            phantom = document.createElement('div');
            phantom.className = 'qubit-line qubit-line-phantom';
            phantom.setAttribute('aria-hidden', 'true');
            this._phantomQubitEl = phantom;
        } else {
            phantom.innerHTML = '';
        }

        const nextIndex = this.circuit.numQubits;
        phantom.style.width = `${totalWidth + 80}px`;

        const label = document.createElement('div');
        label.className = 'qubit-label';
        label.textContent = `q[${nextIndex}]`;

        const wire = document.createElement('div');
        wire.className = 'qubit-wire';
        wire.style.width = `${totalWidth}px`;

        const gateContainer = document.createElement('div');
        gateContainer.className = 'gate-container';
        gateContainer.style.width = `${totalWidth}px`;

        for (let col = 0; col < minColumns; col++) {
            const slot = document.createElement('div');
            slot.className = 'gate-slot';
            slot.dataset.column = String(col);
            slot.style.left = `${col * this.columnSpacing}px`;
            gateContainer.appendChild(slot);
        }

        phantom.appendChild(label);
        phantom.appendChild(wire);
        phantom.appendChild(gateContainer);

        const canvas = document.getElementById('circuitCanvas');
        canvas.appendChild(phantom);
        phantom.classList.remove('is-visible');
    }

    _showPhantomQubitLine(column) {
        if (!this._phantomQubitEl || !this._canAddQubit()) return;
        this._phantomQubitActive = true;
        this._phantomDropColumn = column;
        this._phantomQubitEl.classList.add('is-visible');
        this._phantomQubitEl.querySelectorAll('.gate-slot').forEach((s) => s.classList.remove('drag-over'));
        const slot = this._phantomQubitEl.querySelector(`.gate-slot[data-column="${column}"]`);
        if (slot) slot.classList.add('drag-over');
    }

    _hidePhantomQubitLine() {
        this._phantomQubitActive = false;
        this._phantomDropColumn = null;
        if (!this._phantomQubitEl) return;
        this._phantomQubitEl.classList.remove('is-visible');
        this._phantomQubitEl.querySelectorAll('.drag-over').forEach((s) => s.classList.remove('drag-over'));
    }

    _setDragOverSlot(slot) {
        if (this._dragOverSlot === slot) return;
        if (this._dragOverSlot) this._dragOverSlot.classList.remove('drag-over');
        this._dragOverSlot = slot || null;
        if (this._dragOverSlot) this._dragOverSlot.classList.add('drag-over');
    }

    _clearDragOverHighlights() {
        this._setDragOverSlot(null);
        document.querySelectorAll('.qubit-line-phantom .gate-slot.drag-over').forEach((el) => {
            el.classList.remove('drag-over');
        });
    }

    _getInsertPlan(qubit, hoverColumn, excludeGate = null, excludeGates = null, virtualObstacles = null) {
        return this.circuit.getInsertPlan(qubit, hoverColumn, excludeGate, excludeGates, virtualObstacles);
    }

    _applyControlFlowInsertShift(plan) {
        if (plan.shouldShift) {
            this.circuit.shiftForControlFlowInsert(plan.insertColumn);
        }
    }

    _applyInsertShift(qubit, plan) {
        if (plan.shouldShift) {
            this.circuit.shiftForInsertOnWire(qubit, plan.insertColumn);
        }
    }

    _isActiveCircuitDrag() {
        return Boolean(
            document.body.classList.contains('is-placed-gate-drag') ||
            document.body.classList.contains('is-palette-pointer-drag') ||
            document.getElementById('circuitCanvas')?.classList.contains('is-gate-drag')
        );
    }

    _clearShiftPreview() {
        const snap = this._isActiveCircuitDrag();

        this._shiftPreviewEls.forEach((el) => {
            if (snap) el.style.transition = 'none';
            el.classList.remove('shift-preview');
            el.style.removeProperty('--shift-preview-dx');
            if (snap) {
                void el.offsetWidth;
                el.style.removeProperty('transition');
            }
        });
        this._shiftPreviewEls.clear();
        this._shiftPreviewKey = '';
    }

    _updateShiftPreviewFromSlot(slot, excludeGate = null, excludeGates = null) {
        if (!this.draggedGate && !this.selectedGate && !this._placedGateDrag?.active && !this._groupGateDrag?.active) {
            this._clearShiftPreview();
            return;
        }
        if (!slot || slot.closest('.qubit-line-phantom')) {
            this._clearShiftPreview();
            return;
        }
        const groupDrag = this._groupGateDrag;
        const placedDrag = this._placedGateDrag;

        let qubit = parseInt(slot.dataset.qubit, 10);
        let column = parseInt(slot.dataset.column, 10);

        if (placedDrag?.active) {
            qubit = this._anchorQubitFromPointerSlot(qubit, placedDrag);
        }

        const excludeKey = excludeGate
            ? `${excludeGate.column}:${excludeGate.qubit}:${excludeGate.type}`
            : (excludeGates
                ? [...excludeGates].map((g) => `${g.column}:${g.qubit}:${g.type}`).sort().join('|')
                : '');

        if (groupDrag?.active) {
            this._updateGroupShiftPreview(groupDrag, groupDrag.pendingX, groupDrag.pendingY);
            return;
        }

        const plan = this.draggedGate === 'REPEAT' || this.draggedGate === 'END'
            ? this.circuit.getControlFlowInsertPlan(column)
            : this._getInsertPlan(qubit, column, excludeGate, excludeGates);
        if (!plan.shouldShift) {
            this._clearShiftPreview();
            return;
        }

        const previewKey = `${qubit}:${column}:${excludeKey}:1:${plan.insertColumn}`;
        if (this._shiftPreviewKey === previewKey) return;

        this._clearShiftPreview();
        this._shiftPreviewKey = previewKey;

        const dx = `${this.columnSpacing}px`;
        const markPreview = (el) => {
            if (!el) return;
            if (el.classList.contains('gate-drag-source-faded')) return;
            el.classList.add('shift-preview');
            el.style.setProperty('--shift-preview-dx', dx);
            this._shiftPreviewEls.add(el);
        };

        if (this.draggedGate === 'REPEAT' || this.draggedGate === 'END') {
            for (const gate of this.circuit.gates) {
                if (excludeGates?.has(gate)) continue;
                if (gate.column >= plan.insertColumn) {
                    this._markShiftPreviewForGate(gate, markPreview);
                }
            }
        } else {
            this.circuit.getGatesToShiftForInsert(qubit, plan.insertColumn, excludeGate, excludeGates).forEach((gate) => {
                this._markShiftPreviewForGate(gate, markPreview);
            });
        }

        document.querySelectorAll('.control-flow-block').forEach((el) => {
            const col = parseInt(el.dataset.column, 10);
            const cf = this._resolveControlFlowFromEl(el);
            if (cf && this._circuitSelectionCF.has(cf)) return;
            if (col >= plan.insertColumn) markPreview(el);
        });
    }

    _shiftPreviewControlQubits(gate) {
        if (['CX', 'CY', 'CZ'].includes(gate.type)) {
            if (gate.multiQubits && gate.multiQubits.length > 0) return gate.multiQubits;
            if (gate.target !== null && gate.target !== undefined) return [gate.target];
            return [];
        }
        if (gate.type === 'CSWAP') {
            const joint = gate.params && gate.params.jointQubits;
            if (Array.isArray(joint) && joint.length === 3) return [joint[0]];
        }
        return [];
    }

    _queryGateVisual(qubit, column, extraSelector = '') {
        return document.querySelector(
            `.qubit-line[data-qubit="${qubit}"] .gate-on-wire${extraSelector}[data-column="${column}"]`
        );
    }

    /** Fainter shift preview for every visual piece of a multi-qubit gate. */
    _markShiftPreviewForGate(gate, markPreview) {
        const col = gate.column;

        const anchorSlot = document.querySelector(
            `.gate-slot[data-qubit="${gate.qubit}"][data-column="${col}"]`
        );
        if (anchorSlot) {
            // Include swap-family anchors (SWAP / CSWAP wire B use swap-block, not plain labels).
            anchorSlot.querySelectorAll('.gate-on-wire:not(.control-block)').forEach((el) => markPreview(el));
        }

        this._shiftPreviewControlQubits(gate).forEach((cq) => {
            markPreview(this._queryGateVisual(cq, col, '.control-block'));
        });

        if (gate.type === 'SWAP' && gate.target !== null && gate.target !== undefined) {
            markPreview(this._queryGateVisual(gate.target, col, '[data-gate-type="SWAP_PARTNER"]'));
        }

        if (gate.type === 'CSWAP') {
            const joint = gate.params && gate.params.jointQubits;
            if (Array.isArray(joint) && joint.length === 3) {
                markPreview(this._queryGateVisual(joint[1], col, '[data-gate-type="CSWAP_PARTNER"]'));
            }
        }

        const joint = gate.params && gate.params.jointQubits;
        if (Array.isArray(joint) && joint.length > 1 && gate.type !== 'CSWAP') {
            joint.forEach((qq) => {
                if (qq === gate.qubit) return;
                markPreview(this._queryGateVisual(qq, col, '.joint-block'));
            });
        }

        const busKey = this._controlConnectorBusKey(gate);
        if (busKey) {
            document.querySelectorAll('.circuit-control-bus').forEach((el) => {
                if (el.dataset.busKey === busKey) markPreview(el);
            });
        }
    }

    /** Stable key for a gate's vertical control bus (matches _collectControlConnectorSpecs). */
    _controlConnectorBusKey(gate) {
        let controls = [];
        const target = gate.qubit;

        if (['CX', 'CY', 'CZ'].includes(gate.type)) {
            if (gate.multiQubits && gate.multiQubits.length > 0) {
                controls = [...gate.multiQubits];
            } else if (gate.target !== null && gate.target !== undefined) {
                controls = [gate.target];
            }
        } else if (gate.type === 'CSWAP') {
            const joint = gate.params && gate.params.jointQubits;
            if (!Array.isArray(joint) || joint.length !== 3) return null;
            return `${gate.column}:${joint.slice().sort((a, b) => a - b).join(',')}:CSWAP`;
        } else {
            const joint = gate.params && gate.params.jointQubits;
            if (!Array.isArray(joint) || joint.length < 2) return null;
            if (!this.customGateMeta[gate.type]) return null;
            controls = joint.filter((q) => q !== target);
        }

        if (!controls.length) return null;
        const allQubits = [...controls, target];
        return `${gate.column}:${allQubits.slice().sort((a, b) => a - b).join(',')}:${gate.type}`;
    }

    _isCircuitQubitInteractionTarget(el) {
        return !!el.closest(
            '.qubit-line:not(.qubit-line-phantom), .gate-slot, .gate-on-wire, .control-flow-block'
        );
    }

    _clearPaletteGateSelection() {
        this.selectedGate = null;
        document.querySelectorAll('.gate-item.gate-selected').forEach((el) => el.classList.remove('gate-selected'));
        document.querySelectorAll('.gate-item.info-pinned').forEach((el) => el.classList.remove('info-pinned'));
        this._updateSlotReadyState();
        this._clearShiftPreview();
    }

    _initPaletteDismissListeners() {
        document.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') {
                this._pointerTouchMoved = false;
                this._pointerStart = { x: e.clientX, y: e.clientY };
            }
        }, true);

        document.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'touch' || !this._pointerStart) return;
            const dx = e.clientX - this._pointerStart.x;
            const dy = e.clientY - this._pointerStart.y;
            if (dx * dx + dy * dy > 100) this._pointerTouchMoved = true;
        }, true);

        document.addEventListener('pointerup', (e) => {
            if (this._palettePointerDrag?.active) return;
            if (this._placedGateDrag?.active) return;
            if (this._groupGateDrag?.active) return;
            if (this._pointerTouchMoved) {
                this._pointerStart = null;
                return;
            }
            if (e.target.closest('.gate-palette .gate-item')) return;
            if (this._isCircuitQubitInteractionTarget(e.target)) return;
            if (e.target.closest('.modal.active, .modal-overlay')) return;
            this._clearPaletteGateSelection();
            this._pointerStart = null;
        }, true);
    }

    renderCircuit() {
        const canvas = document.getElementById('circuitCanvas');
        const canvasWrapper = canvas.parentElement;
        this._selectionLayerEl = null;
        canvas.innerHTML = '';

        // Calculate minimum columns needed - always extend beyond current depth
        const minColumns = Math.max(this.circuit.maxColumn + 10, 20);
        const totalWidth = minColumns * this.columnSpacing + 100; // Extra padding

        // Set canvas size based on content, then apply zoom
        canvas.style.width = `${totalWidth + 80}px`; // 80px for label
        canvas.style.minWidth = `${totalWidth + 80}px`;
        canvas.style.transform = `scale(${this.zoomLevel})`;
        canvas.style.transformOrigin = 'top left';

        // Create qubit lines
        for (let i = 0; i < this.circuit.numQubits; i++) {
            const qubitLine = document.createElement('div');
            qubitLine.className = 'qubit-line';
            qubitLine.dataset.qubit = i;
            qubitLine.style.width = `${totalWidth + 80}px`;

            const label = document.createElement('div');
            label.className = 'qubit-label';
            label.textContent = `q[${i}]`;

            const wire = document.createElement('div');
            wire.className = 'qubit-wire';
            wire.style.width = `${totalWidth}px`; // Extend wire to cover all gates

            const gateContainer = document.createElement('div');
            gateContainer.className = 'gate-container';
            gateContainer.dataset.qubit = i;
            gateContainer.style.width = `${totalWidth}px`; // Extend container too

            // Create gate slots
            for (let col = 0; col < minColumns; col++) {
                const slot = document.createElement('div');
                slot.className = 'gate-slot';
                slot.dataset.qubit = i;
                slot.dataset.column = col;
                slot.style.left = `${col * this.columnSpacing}px`;
                gateContainer.appendChild(slot);
            }

            qubitLine.appendChild(label);
            qubitLine.appendChild(wire);
            qubitLine.appendChild(gateContainer);
            canvas.appendChild(qubitLine);
        }

        this._syncPhantomQubitLine(minColumns, totalWidth);

        // Place existing gates
        this.circuit.gates.forEach(gate => {
            this.renderGate(gate);
        });

        // Place control flow blocks (REPEAT/END)
        this.circuit.controlFlow.forEach(cf => {
            this.renderControlFlow(cf);
        });

        this._scheduleControlConnectorRefresh();
        this.updateCircuitInfo();
        this._updateSlotReadyState();
        this._applyCircuitSelectionVisuals();
    }

    /** Re-sync code ↔ circuit after palette/modal edits; fixes control-bus layout for CX/CY/CZ. */
    _refreshCircuitAfterGateEdit() {
        this.circuit.state = null;
        this._clearShiftPreview();
        this.renderCircuit();

        if (this._gateEditSyncRaf) cancelAnimationFrame(this._gateEditSyncRaf);
        this._gateEditSyncRaf = requestAnimationFrame(() => {
            this._gateEditSyncRaf = 0;
            this._syncAfterCircuitGateEdit();
        });
    }

    _syncAfterCircuitGateEdit() {
        this.syncCircuitToCode();
        if (this.hasCodeErrors()) {
            this.renderCircuit();
            this.updateVisualization();
            return;
        }

        // Circuit-builder edits keep visual column placement; scheduling runs only
        // when Qubi code is edited or Run Circuit is pressed.
        const autoRun = this.getSettings().autoRun;
        if (autoRun) {
            this._runCircuitCore();
        } else {
            this.resetExecution();
        }
    }

    _scheduleControlConnectorRefresh() {
        if (this._controlConnectorRaf) {
            cancelAnimationFrame(this._controlConnectorRaf);
        }
        this._controlConnectorRaf = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                this._controlConnectorRaf = null;
                this._renderControlConnectors();
            });
        });
    }

    /** Solid accent for custom-gate connectors (avoid gradients on thin lines). */
    _customGateConnectorColor(meta) {
        if (!meta?.colorBg) return null;
        const match = String(meta.colorBg).match(/#[0-9a-f]{3,8}/i);
        return match ? match[0] : null;
    }

    /** Slot center in canvas local coordinates (accounts for circuit zoom). */
    _slotCenterInCanvas(slot) {
        const canvas = document.getElementById('circuitCanvas');
        if (!slot || !canvas) return null;
        const zoom = this.zoomLevel || 1;
        const sr = slot.getBoundingClientRect();
        const cr = canvas.getBoundingClientRect();
        return {
            x: (sr.left + sr.width / 2 - cr.left) / zoom,
            y: (sr.top + sr.height / 2 - cr.top) / zoom
        };
    }

    /**
     * Run callback while the circuit builder can be laid out for measurement.
     * Connectors use slot geometry; a hidden panel (e.g. NMR tab active) yields zero-size rects.
     */
    _withCircuitEditorMeasurable(callback) {
        const circuitEditor = document.getElementById('circuitEditor');
        const canvas = document.getElementById('circuitCanvas');
        if (!circuitEditor || !canvas) {
            callback();
            return;
        }

        const needsOffscreen = !circuitEditor.classList.contains('active');
        if (needsOffscreen) {
            circuitEditor.style.display = 'flex';
            circuitEditor.style.position = 'absolute';
            circuitEditor.style.left = '-9999px';
            circuitEditor.style.visibility = 'visible';
            circuitEditor.style.pointerEvents = 'none';
            void circuitEditor.offsetHeight;
            void canvas.offsetHeight;
        }

        try {
            callback();
        } finally {
            if (needsOffscreen) {
                circuitEditor.style.display = '';
                circuitEditor.style.position = '';
                circuitEditor.style.left = '';
                circuitEditor.style.visibility = '';
                circuitEditor.style.pointerEvents = '';
            }
        }
    }

    /** Single continuous vertical bus per gate; slot centers define exact span. */
    _renderControlConnectors() {
        this._withCircuitEditorMeasurable(() => this._renderControlConnectorsImpl());
    }

    _renderControlConnectorsImpl() {
        const canvas = document.getElementById('circuitCanvas');
        if (!canvas) return;

        canvas.querySelectorAll('.circuit-control-links').forEach((el) => el.remove());
        document.querySelectorAll('.gate-slot.on-control-bus').forEach((slot) => {
            slot.classList.remove('on-control-bus');
        });

        const specs = this._collectControlConnectorSpecs();
        if (!specs.length) return;

        const layer = document.createElement('div');
        layer.className = 'circuit-control-links';
        layer.setAttribute('aria-hidden', 'true');

        const connectorWidth = 4;

        for (const spec of specs) {
            const qubits = [...new Set(spec.qubits)].sort((a, b) => a - b);
            if (qubits.length < 2) continue;

            const qMin = qubits[0];
            const qMax = qubits[qubits.length - 1];
            const col = spec.column;

            const topSlot = document.querySelector(
                `.gate-slot[data-qubit="${qMin}"][data-column="${col}"]`
            );
            const bottomSlot = document.querySelector(
                `.gate-slot[data-qubit="${qMax}"][data-column="${col}"]`
            );
            const top = this._slotCenterInCanvas(topSlot);
            const bottom = this._slotCenterInCanvas(bottomSlot);
            if (!top || !bottom) continue;

            const yTop = Math.min(top.y, bottom.y);
            const yBottom = Math.max(top.y, bottom.y);
            const height = yBottom - yTop;
            if (height <= 0) continue;

            const line = document.createElement('div');
            line.className = 'circuit-control-bus';
            line.dataset.column = String(col);
            if (spec.busKey) line.dataset.busKey = spec.busKey;

            const familyClass = {
                CX: 'gate-x-family',
                CY: 'gate-y-family',
                CZ: 'gate-z-family',
                CSWAP: 'gate-swap-family'
            }[spec.gateType];
            if (familyClass) line.classList.add(familyClass);
            if (spec.customMeta) {
                line.classList.add('gate-custom');
                const solid = this._customGateConnectorColor(spec.customMeta);
                if (solid) line.style.backgroundColor = solid;
            }

            const xCenter = (top.x + bottom.x) / 2;
            line.style.width = `${connectorWidth}px`;
            line.style.left = `${xCenter - connectorWidth / 2}px`;
            line.style.top = `${yTop}px`;
            line.style.height = `${height}px`;

            layer.appendChild(line);

            for (let q = qMin; q <= qMax; q++) {
                const slot = document.querySelector(
                    `.gate-slot[data-qubit="${q}"][data-column="${col}"]`
                );
                if (slot) slot.classList.add('on-control-bus');
            }
        }

        canvas.insertBefore(layer, canvas.firstChild);
    }

    _collectControlConnectorSpecs() {
        const specs = [];
        const seen = new Set();

        for (const gate of this.circuit.gates) {
            const busKey = this._controlConnectorBusKey(gate);
            if (!busKey || seen.has(busKey)) continue;
            seen.add(busKey);

            let customMeta = null;
            let allQubits = [gate.qubit];
            if (['CX', 'CY', 'CZ'].includes(gate.type)) {
                const controls =
                    gate.multiQubits && gate.multiQubits.length > 0
                        ? gate.multiQubits
                        : gate.target !== null && gate.target !== undefined
                          ? [gate.target]
                          : [];
                allQubits = [...controls, gate.qubit];
            } else if (gate.type === 'CSWAP') {
                const joint = gate.params && gate.params.jointQubits;
                allQubits = Array.isArray(joint) && joint.length === 3 ? [...joint] : [gate.qubit];
            } else {
                customMeta = this.customGateMeta[gate.type];
                const joint = gate.params && gate.params.jointQubits;
                allQubits = Array.isArray(joint) ? [...joint] : [gate.qubit];
            }

            specs.push({
                column: gate.column,
                qubits: allQubits,
                gateType: gate.type,
                customMeta,
                busKey
            });
        }

        return specs;
    }

    renderControlFlow(cf) {
        const { type, column, params } = cf;
        const canvas = document.getElementById('circuitCanvas');

        // Create a vertical block that spans all qubits
        const block = document.createElement('div');
        block.className = `control-flow-block control-flow-${type.toLowerCase()}`;
        block.dataset.type = type;
        block.dataset.column = column;

        // Position it at the column
        // Canvas has padding: 2rem (32px), qubit labels are 60px, then column * spacing
        // Gate container is at left: 60px within qubit-line, which starts at the padding
        const canvasPadding = 32; // 2rem = 32px
        const labelWidth = 60;
        const leftOffset = canvasPadding + labelWidth + column * this.columnSpacing;
        block.style.left = `${leftOffset}px`;
        block.style.width = `${this.gateWidth}px`; // Same width as gates (50px)
        block.style.top = `${canvasPadding}px`; // Account for top padding too
        // Each qubit line is 60px height + 0.5rem (8px) margin = 68px per row
        // Total height spans all qubits: numQubits * 68 - 8 (no margin after last)
        const rowHeight = 68; // 60px + 8px margin
        block.style.height = `${this.circuit.numQubits * rowHeight - 8}px`;

        // Create content
        const symbol = document.createElement('div');
        symbol.className = 'control-flow-symbol';

        if (type === 'REPEAT') {
            symbol.textContent = '↻';
            block.title = `REPEAT ${params.count} times - Click to edit, hover × to delete`;

            const label = document.createElement('div');
            label.className = 'control-flow-label';
            label.textContent = `×${params.count}`;
            block.appendChild(symbol);
            block.appendChild(label);
        } else if (type === 'END') {
            symbol.textContent = '⊣';
            block.title = params.endingLabel ? `END ${params.endingLabel} - Hover × to delete` : 'END - Hover × to delete';
            block.appendChild(symbol);

            if (params.endingLabel) {
                const endLabel = document.createElement('div');
                endLabel.className = 'control-flow-end-label';
                endLabel.textContent = params.endingLabel;
                block.appendChild(endLabel);
            }
        }

        // Add delete button
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'gate-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.circuit.removeControlFlow(column);
            this.renderCircuit();
            this.updateVisualization();
            this.syncCircuitToCode();
        });
        block.appendChild(deleteBtn);

        // Add click handlers
        block.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._suppressCircuitSelectionClick) return;
            if (e.target.closest('.gate-delete-btn')) return;

            const cfRef = this._resolveControlFlowFromEl(block);
            if (cfRef && this._circuitSelectionCount() > 1 && this._circuitSelectionCF.has(cfRef)) return;

            if (type === 'REPEAT') {
                this.showRepeatModal(column, params.count, true);
            }
        });

        block.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.circuit.removeControlFlow(column);
            this.renderCircuit();
            this.updateVisualization();
            this.syncCircuitToCode();
        });

        canvas.appendChild(block);
    }

    renderGate(gate) {
        const { type, qubit, column, target, params, multiQubits } = gate;
        const slot = document.querySelector(`.gate-slot[data-qubit="${qubit}"][data-column="${column}"]`);
        if (!slot) return;

        slot.innerHTML = '';

        const gateEl = document.createElement('div');
        gateEl.className = 'gate-on-wire';
        gateEl.dataset.gateType = type;
        gateEl.dataset.qubit = qubit;
        gateEl.dataset.column = column;

        // Set gate symbol
        const symbols = {
            'H': 'H', 'X': 'X', 'Y': 'Y', 'Z': 'Z',
            'S': 'S', 'T': 'T',
            'RX': 'RX', 'RY': 'RY', 'RZ': 'RZ',
            'CX': 'X', 'CY': 'Y', 'CZ': 'Z', 'SWAP': '⇄', 'CSWAP': 'CS',
            'MEASURE': 'M'
        };

        // Gate color families
        const gateFamily = {
            'X': 'gate-x-family', 'CX': 'gate-x-family', 'RX': 'gate-x-family',
            'Y': 'gate-y-family', 'CY': 'gate-y-family', 'RY': 'gate-y-family',
            'Z': 'gate-z-family', 'CZ': 'gate-z-family', 'RZ': 'gate-z-family',
            'H': 'gate-h-family',
            'S': 'gate-phase-family', 'T': 'gate-phase-family',
            'SWAP': 'gate-swap-family',
            'CSWAP': 'gate-swap-family',
            'MEASURE': 'gate-measure-family'
        };

        const meta = this.customGateMeta[type];
        const symbolText = meta?.label || symbols[type] || type;
        gateEl.textContent = symbolText;
        gateEl.title = `Drag to move, click to edit, right-click to delete`;
        gateEl.style.position = 'relative';

        // Add gate family class for coloring
        if (gateFamily[type]) {
            gateEl.classList.add(gateFamily[type]);
        }
        if (meta && meta.colorBg) {
            gateEl.classList.add('gate-custom');
            gateEl.style.background = meta.colorBg;
            gateEl.style.borderColor = meta.colorBg;
            gateEl.style.boxShadow = `0 8px 22px ${meta.colorGlow || 'rgba(99,102,241,0.22)'}`;
        }

        // Add delete button
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'gate-delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeGateFromSlot(gateEl);
        });

        const swapPartnerQubit = type === 'SWAP' && target !== null && target !== undefined
            ? target
            : (type === 'CSWAP' && params && Array.isArray(params.jointQubits) && params.jointQubits.length === 3
                ? params.jointQubits[1]
                : null);

        if (swapPartnerQubit !== null) {
            this._fillSwapWireGate(gateEl, '⇄', swapPartnerQubit, deleteBtn);
        } else {
            const textSpan = document.createElement('span');
            textSpan.className = 'gate-on-wire-label';
            textSpan.textContent = symbolText;
            fitGateLabel(textSpan, symbolText);
            gateEl.textContent = '';
            gateEl.appendChild(textSpan);
            gateEl.appendChild(deleteBtn);
        }

        // Show parameters if present (rotation angle)
        if (params && params.angle !== undefined) {
            gateEl.classList.add('has-params');
            gateEl.dataset.params = `θ=${(params.angle * 180 / Math.PI).toFixed(1)}°`;
        }

        // Add gate to slot first
        slot.appendChild(gateEl);
        this._setGateOnWireDraggable(gateEl);

        // Handle controlled gates - render control blocks AFTER placing target gate
        let controlQubits = [];
        if (['CX', 'CY', 'CZ'].includes(type) && multiQubits && multiQubits.length > 0) {
            // Multi-controlled gate: multiQubits are controls, qubit is target
            controlQubits = multiQubits;
        } else if (['CX', 'CY', 'CZ'].includes(type) && target !== null && target !== undefined) {
            // Single control: target property is the control, qubit is the target
            controlQubits = [target];
        }

        const joint = params && Array.isArray(params.jointQubits) ? params.jointQubits : null;

        if (joint && joint.length > 1 && meta) {
            const controls = joint.filter((qq) => qq !== qubit);
            if (controls.length > 0) {
                this.renderControlBlocks(controls, qubit, column, type, { customMeta: meta });
            }
        } else if (controlQubits.length > 0) {
            this.renderControlBlocks(controlQubits, qubit, column, type);
        }

        // Handle SWAP - render swap partner block
        if (type === 'SWAP' && target !== null && target !== undefined) {
            this.renderSwapPartner(target, qubit, column);
        }

        // Handle CSWAP (Fredkin) — control dot + CS on both swap wires
        if (type === 'CSWAP' && params && Array.isArray(params.jointQubits) && params.jointQubits.length === 3) {
            const [control, swapA, swapB] = params.jointQubits;
            if (swapA !== swapB) {
                this.renderCSwapPartner(swapA, swapB, column);
            }
            this.renderControlBlocks([control], swapB, column, 'CSWAP', { swapQubits: [swapA, swapB] });
        }
    }

    renderJointPartner(partnerQubit, anchorQubit, column, gateType) {
        const partnerSlot = document.querySelector(`.gate-slot[data-qubit="${partnerQubit}"][data-column="${column}"]`);
        if (!partnerSlot) return;
        partnerSlot.innerHTML = '';
        const block = document.createElement('div');
        block.className = 'gate-on-wire joint-block gate-custom';
        block.dataset.gateType = 'JOINT_PARTNER';
        block.dataset.qubit = partnerQubit;
        block.dataset.column = column;
        block.dataset.anchorQubit = anchorQubit;
        block.dataset.partnerGateType = gateType;
        block.title = `Multi-qubit ${gateType} (anchor q[${anchorQubit}])`;
        block.textContent = '·';
        partnerSlot.appendChild(block);
        this._setGateOnWireDraggable(block);
    }

    /** Symbol + ↔qN label inside the gate (SWAP / CSWAP swap wires). */
    _fillSwapWireGate(gateEl, symbol, partnerQubit, deleteBtn = null) {
        gateEl.classList.add('swap-block');
        gateEl.textContent = '';
        const symbolSpan = document.createElement('span');
        symbolSpan.className = 'swap-symbol';
        symbolSpan.textContent = symbol;
        const partnerSpan = document.createElement('span');
        partnerSpan.className = 'swap-arrow';
        partnerSpan.textContent = `↔q${partnerQubit}`;
        gateEl.appendChild(symbolSpan);
        gateEl.appendChild(partnerSpan);
        if (deleteBtn) gateEl.appendChild(deleteBtn);
    }

    _createSwapPartnerBlock(partnerQubit, column, gateType, symbol, anchorQubit) {
        const swapBlock = document.createElement('div');
        swapBlock.className = 'gate-on-wire swap-block gate-swap-family';
        swapBlock.dataset.gateType = gateType;
        swapBlock.dataset.qubit = partnerQubit;
        swapBlock.dataset.column = column;
        swapBlock.dataset.partnerQubit = anchorQubit;
        swapBlock.title = `${gateType === 'SWAP_PARTNER' ? 'SWAP' : 'CSWAP'} with q[${anchorQubit}]`;
        this._fillSwapWireGate(swapBlock, symbol, anchorQubit);
        this._setGateOnWireDraggable(swapBlock);
        return swapBlock;
    }

    renderSwapPartner(partnerQubit, originalQubit, column) {
        const partnerSlot = document.querySelector(`.gate-slot[data-qubit="${partnerQubit}"][data-column="${column}"]`);
        if (!partnerSlot) {
            console.warn(`Swap partner slot not found for qubit ${partnerQubit}, column ${column}`);
            return;
        }

        // Clear the slot
        partnerSlot.innerHTML = '';

        partnerSlot.appendChild(
            this._createSwapPartnerBlock(partnerQubit, column, 'SWAP_PARTNER', '⇄', originalQubit)
        );
    }

    renderCSwapPartner(partnerQubit, anchorQubit, column) {
        const partnerSlot = document.querySelector(`.gate-slot[data-qubit="${partnerQubit}"][data-column="${column}"]`);
        if (!partnerSlot) {
            console.warn(`CSWAP partner slot not found for qubit ${partnerQubit}, column ${column}`);
            return;
        }

        partnerSlot.innerHTML = '';

        partnerSlot.appendChild(
            this._createSwapPartnerBlock(partnerQubit, column, 'CSWAP_PARTNER', '⇄', anchorQubit)
        );
    }

    renderControlBlocks(controlQubits, targetQubit, column, gateType = 'CX', options = {}) {
        const { customMeta, swapQubits } = options;
        // Gate family mapping for control blocks
        const gateFamily = {
            'CX': 'gate-x-family',
            'CY': 'gate-y-family',
            'CZ': 'gate-z-family',
            'CSWAP': 'gate-swap-family'
        };
        const familyClass = customMeta ? '' : (gateFamily[gateType] || '');

        // Render control blocks on each control qubit's slot
        controlQubits.forEach(controlQubit => {
            const controlSlot = document.querySelector(`.gate-slot[data-qubit="${controlQubit}"][data-column="${column}"]`);
            if (!controlSlot) {
                console.warn(`Control slot not found for qubit ${controlQubit}, column ${column}`);
                return;
            }

            // Clear the slot
            controlSlot.innerHTML = '';

            // Create the control block element
            const controlBlock = document.createElement('div');
            controlBlock.className = 'gate-on-wire control-block control-block-circle';
            if (familyClass) {
                controlBlock.classList.add(familyClass);
            }
            if (customMeta) {
                controlBlock.classList.add('gate-custom');
                if (customMeta.colorBg) {
                    controlBlock.style.background = customMeta.colorBg;
                    controlBlock.style.borderColor = customMeta.colorBg;
                    controlBlock.style.boxShadow = `0 6px 16px ${customMeta.colorGlow || 'rgba(99,102,241,0.22)'}`;
                }
            }
            controlBlock.dataset.gateType = 'CONTROL';
            controlBlock.dataset.qubit = controlQubit;
            controlBlock.dataset.column = column;
            controlBlock.dataset.targetQubit = targetQubit;
            controlBlock.dataset.parentGateType = gateType;
            controlBlock.draggable = false;
            const targetLabel = gateType === 'CSWAP' && Array.isArray(swapQubits) && swapQubits.length === 2
                ? swapQubits.map((q) => `q${q}`).join(', ')
                : `q${targetQubit}`;
            controlBlock.title = `Control for ${gateType} on ${targetLabel}`;

            // Create inner content
            const label = document.createElement('span');
            label.className = 'control-label';
            label.textContent = 'C';

            const arrow = document.createElement('span');
            arrow.className = 'control-arrow';
            arrow.textContent = gateType === 'CSWAP' && Array.isArray(swapQubits) && swapQubits.length === 2
                ? `→${swapQubits.map((q) => `q${q}`).join(', ')}`
                : `→q${targetQubit}`;

            controlBlock.appendChild(label);
            controlBlock.appendChild(arrow);

            controlSlot.appendChild(controlBlock);
        });

        // Update target gate to show it's controlled (simple indicator)
        const targetSlot = document.querySelector(`.gate-slot[data-qubit="${targetQubit}"][data-column="${column}"]`);
        if (targetSlot && targetSlot.firstChild) {
            const targetGate = targetSlot.firstChild;
            targetGate.classList.add('controlled-target');
        }
    }

    placeGateOnSlot(slot, gateType = null) {
        const qubit = parseInt(slot.dataset.qubit);
        const column = parseInt(slot.dataset.column);
        const type = gateType || this.selectedGate || this.draggedGate;

        if (!type) return;

        const plan = this._getInsertPlan(qubit, column);
        const insertColumn = plan.insertColumn;

        // Check if control flow (REPEAT/END)
        if (type === 'REPEAT') {
            const cfPlan = this.circuit.getControlFlowInsertPlan(column);
            if (!cfPlan.shouldShift && this.circuit.getControlFlowAtColumn(column)) {
                return;
            }
            this.showRepeatModal(column, 2, false, cfPlan, qubit);
            return;
        }

        if (type === 'END') {
            const cfPlan = this.circuit.getControlFlowInsertPlan(column);
            if (!cfPlan.shouldShift && this.circuit.getControlFlowAtColumn(column)) {
                return;
            }
            this.placeEndBlock(column, qubit, cfPlan);
            return;
        }

        // Block only if control flow occupies the slot and we are not shifting it away
        if (!plan.shouldShift && this.circuit.getControlFlowAtColumn(insertColumn)) {
            return;
        }

        // Check if gate requires parameters
        if (['RX', 'RY', 'RZ'].includes(type)) {
            this.showParameterModal(type, qubit, insertColumn, Math.PI / 2, false, plan);
            return;
        }

        // Check if multi-qubit gate
        // When dragging onto a qubit, that qubit is the TARGET
        // We need to select the CONTROL qubit
        if (['CX', 'CY', 'CZ', 'SWAP', 'CSWAP'].includes(type)) {
            this.showTargetSelectionModal(type, qubit, insertColumn, null, plan);
            return;
        }

        // Multi-qubit custom unitary: pick controls via modal (target = drop wire)
        if (this.isMultiWireCustomGate(type)) {
            this.showTargetSelectionModal(type, qubit, insertColumn, null, plan);
            return;
        }

        // Single qubit gate
        this._applyInsertShift(qubit, plan);
        this.circuit.addGate(type, qubit, insertColumn);
        this._refreshCircuitAfterGateEdit();
    }

    showRepeatModal(column, currentCount = 2, isEdit = false, insertPlan = null, shiftQubit = 0) {
        const modal = document.getElementById('repeatModal');
        const title = document.getElementById('repeatModalTitle');
        const input = document.getElementById('repeatCountInput');
        const plan = insertPlan || { shouldShift: false, insertColumn: column };

        title.textContent = isEdit ? 'Edit Repeat Count' : 'Set Repeat Count';
        input.value = currentCount;

        modal.classList.add('active');
        modal.dataset.column = String(column);
        modal.dataset.insertColumn = String(plan.insertColumn);
        modal.dataset.shouldShift = plan.shouldShift ? '1' : '0';
        modal.dataset.shiftQubit = String(shiftQubit);
        modal.dataset.isEdit = isEdit;

        input.focus();
        input.select();
    }

    confirmRepeat() {
        const modal = document.getElementById('repeatModal');
        const input = document.getElementById('repeatCountInput');
        const column = parseInt(modal.dataset.column, 10);
        const insertColumn = parseInt(modal.dataset.insertColumn, 10);
        const shiftQubit = parseInt(modal.dataset.shiftQubit, 10);
        const shouldShift = modal.dataset.shouldShift === '1';
        const isEdit = modal.dataset.isEdit === 'true';
        const count = parseInt(input.value) || 2;

        if (isEdit) {
            const cf = this.circuit.controlFlow.find(c => c.column === column && c.type === 'REPEAT');
            if (cf) {
                cf.params.count = count;
                this.circuit.refreshRepeatEndPairings();
            }
        } else {
            if (shouldShift) {
                this._applyControlFlowInsertShift({ shouldShift: true, insertColumn });
            }
            this.circuit.addControlFlow('REPEAT', insertColumn, { count });
        }

        modal.classList.remove('active');
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
    }

    cancelRepeat() {
        document.getElementById('repeatModal').classList.remove('active');
    }

    placeEndBlock(column, shiftQubit = 0, insertPlan = null) {
        const plan = insertPlan || { shouldShift: false, insertColumn: column };
        if (plan.shouldShift) {
            this._applyControlFlowInsertShift(plan);
            column = plan.insertColumn;
        }

        this.circuit.addControlFlow('END', column, {});

        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
    }

    showTargetSelectionModal(gateType, targetQubit, column, currentControls = null, insertPlan = null) {
        const modal = document.getElementById('targetModal');
        const plan = insertPlan || { shouldShift: false, insertColumn: column };
        const title = document.getElementById('targetModalTitle');
        const list = document.getElementById('targetQubitList');

        delete modal.dataset.cswapMode;

        if (gateType === 'CSWAP') {
            title.textContent = `Fredkin (CSWAP): q[${targetQubit}] is swap wire B`;
            list.innerHTML = '';

            const hint = document.createElement('div');
            hint.className = 'selection-hint';
            hint.textContent = 'Select a control qubit and the other swap wire (swap wire A).';
            list.appendChild(hint);

            let presetControl = null;
            let presetSwapA = null;
            if (currentControls && typeof currentControls === 'object' && !Array.isArray(currentControls)) {
                presetControl = currentControls.control;
                presetSwapA = currentControls.swapA;
            }

            const addRoleSection = (sectionLabel, role) => {
                const heading = document.createElement('div');
                heading.className = 'selection-hint';
                heading.style.marginTop = '0.75rem';
                heading.textContent = sectionLabel;
                list.appendChild(heading);

                const section = document.createElement('div');
                section.className = `cswap-role-list cswap-role-list--${role}`;
                for (let i = 0; i < this.circuit.numQubits; i++) {
                    if (i === targetQubit) continue;

                    const item = document.createElement('div');
                    item.className = 'target-qubit-item';
                    item.textContent = `Qubit ${i}`;
                    item.dataset.control = i;
                    item.dataset.cswapRole = role;
                    if ((role === 'control' && presetControl === i) || (role === 'swapA' && presetSwapA === i)) {
                        item.classList.add('selected');
                    }
                    item.addEventListener('click', () => {
                        section.querySelectorAll('.target-qubit-item').forEach((el) => el.classList.remove('selected'));
                        item.classList.add('selected');
                        list.querySelectorAll(`.target-qubit-item[data-control="${i}"]`).forEach((el) => {
                            if (el.dataset.cswapRole !== role) el.classList.remove('selected');
                        });
                    });
                    section.appendChild(item);
                }
                list.appendChild(section);
            };

            addRoleSection('Control qubit', 'control');
            addRoleSection('Other swap wire (A)', 'swapA');

            modal.classList.add('active');
            modal.dataset.gateType = gateType;
            modal.dataset.targetQubit = targetQubit;
            modal.dataset.column = plan.insertColumn;
            modal.dataset.shouldShift = plan.shouldShift ? '1' : '0';
            modal.dataset.isEdit = currentControls !== null ? 'true' : 'false';
            modal.dataset.cswapMode = '1';
            delete modal.dataset.allowMultiple;
            delete modal.dataset.requiredControls;
            this._restoreShiftPreviewForModal(targetQubit, plan);
            return;
        }

        const requiredControls = this.getCustomGateRequiredControlCount(gateType);
        const isCustomMulti = requiredControls !== null;
        const customMeta = isCustomMulti ? this.customGateMeta[gateType] : null;
        const customName = customMeta?.displayName || gateType;

        // SWAP only allows single selection, controlled gates allow multiple
        const allowMultiple = gateType !== 'SWAP';
        let labelText;
        if (gateType === 'SWAP') {
            labelText = `Select Qubit to Swap with q[${targetQubit}]`;
        } else if (isCustomMulti) {
            labelText = `Select ${requiredControls} control qubit(s) for ${customName}`;
        } else {
            labelText = `Select Control Qubit(s) for ${gateType}`;
        }

        title.textContent = labelText;
        list.innerHTML = '';

        // Add hint for multi-select
        if (allowMultiple) {
            const hint = document.createElement('div');
            hint.className = 'selection-hint';
            if (isCustomMulti) {
                hint.textContent = `Target wire is q[${targetQubit}]. Select exactly ${requiredControls} control wire(s).`;
            } else {
                hint.textContent = 'Click to select/deselect multiple control qubits';
            }
            list.appendChild(hint);
        }

        // Convert currentControls to array for comparison
        const currentControlsArray = currentControls
            ? (Array.isArray(currentControls) ? currentControls : [currentControls])
            : [];

        for (let i = 0; i < this.circuit.numQubits; i++) {
            if (i === targetQubit) continue;

            const item = document.createElement('div');
            item.className = 'target-qubit-item';
            item.textContent = `Qubit ${i}`;
            item.dataset.control = i;

            if (currentControlsArray.includes(i)) {
                item.classList.add('selected');
            }

            item.addEventListener('click', () => {
                if (allowMultiple) {
                    // Toggle selection for multi-select
                    item.classList.toggle('selected');
                } else {
                    // Single selection for SWAP
                    document.querySelectorAll('.target-qubit-item').forEach(el => {
                        el.classList.remove('selected');
                    });
                    item.classList.add('selected');
                }
            });
            list.appendChild(item);
        }

        modal.classList.add('active');
        modal.dataset.gateType = gateType;
        modal.dataset.targetQubit = targetQubit;
        modal.dataset.column = plan.insertColumn;
        modal.dataset.shouldShift = plan.shouldShift ? '1' : '0';
        modal.dataset.isEdit = currentControls !== null;
        modal.dataset.allowMultiple = allowMultiple;
        if (requiredControls !== null) {
            modal.dataset.requiredControls = String(requiredControls);
        } else {
            delete modal.dataset.requiredControls;
        }

        this._restoreShiftPreviewForModal(targetQubit, plan);
    }

    /** Keep insert shift preview visible while the target/parameter modal is open. */
    _restoreShiftPreviewForModal(qubit, plan) {
        if (!plan?.shouldShift) return;
        if (!this.draggedGate && !this.selectedGate) return;
        requestAnimationFrame(() => {
            const slot = document.querySelector(
                `.gate-slot[data-qubit="${qubit}"][data-column="${plan.insertColumn}"]`
            );
            if (slot) this._updateShiftPreviewFromSlot(slot);
        });
    }

    confirmTargetSelection() {
        const modal = document.getElementById('targetModal');
        const selectedItems = document.querySelectorAll('.target-qubit-item.selected');
        const isEdit = modal.dataset.isEdit === 'true';
        const gateType = modal.dataset.gateType;
        const allowMultiple = modal.dataset.allowMultiple === 'true';

        if (modal.dataset.cswapMode === '1') {
            const list = document.getElementById('targetQubitList');
            const title = document.getElementById('targetModalTitle');
            const controlEl = list.querySelector('.cswap-role-list--control .target-qubit-item.selected');
            const swapAEl = list.querySelector('.cswap-role-list--swapA .target-qubit-item.selected');
            if (!controlEl || !swapAEl) {
                if (title) title.textContent = 'Select both a control qubit and the other swap wire';
                return;
            }

            const targetQubit = parseInt(modal.dataset.targetQubit);
            const column = parseInt(modal.dataset.column);
            const shouldShift = modal.dataset.shouldShift === '1';
            const control = parseInt(controlEl.dataset.control, 10);
            const swapA = parseInt(swapAEl.dataset.control, 10);
            const swapB = targetQubit;

            if (control === swapA || control === swapB || swapA === swapB) {
                if (title) title.textContent = 'Control and swap wires must all be different';
                return;
            }

            const jointQubits = [control, swapA, swapB];

            if (isEdit) {
                const gate = this.circuit.gates.find((g) => g.qubit === swapB && g.column === column && g.type === 'CSWAP');
                if (gate) {
                    gate.params = { ...(gate.params || {}), jointQubits };
                }
            } else {
                this._applyInsertShift(swapB, { shouldShift, insertColumn: column });
                this.circuit.addGate('CSWAP', swapB, column, null, { jointQubits });
            }

            this.circuit.state = null;
            modal.classList.remove('active');
            delete modal.dataset.cswapMode;
            this._refreshCircuitAfterGateEdit();
            return;
        }

        if (selectedItems.length > 0) {
            const targetQubit = parseInt(modal.dataset.targetQubit);
            const column = parseInt(modal.dataset.column);
            const shouldShift = modal.dataset.shouldShift === '1';
            const requiredControls = modal.dataset.requiredControls
                ? parseInt(modal.dataset.requiredControls, 10)
                : null;

            // Get selected control qubits
            const controlQubits = Array.from(selectedItems).map(item => parseInt(item.dataset.control));

            if (requiredControls !== null && controlQubits.length !== requiredControls) {
                const title = document.getElementById('targetModalTitle');
                if (title) {
                    title.textContent = `Select exactly ${requiredControls} control qubit(s) (${controlQubits.length} selected)`;
                }
                return;
            }

            if (isEdit) {
                // Update existing gate
                const gate = this.circuit.gates.find(g =>
                    g.qubit === targetQubit && g.column === column
                );
                if (gate) {
                    if (requiredControls !== null) {
                        const jointQubits = [...controlQubits].sort((a, b) => a - b).concat(targetQubit);
                        gate.target = null;
                        gate.multiQubits = null;
                        gate.params = { ...(gate.params || {}), jointQubits };
                    } else if (allowMultiple && controlQubits.length > 1) {
                        gate.target = null;
                        gate.multiQubits = controlQubits;
                    } else {
                        gate.target = controlQubits[0];
                        gate.multiQubits = null;
                    }
                }
            } else {
                this._applyInsertShift(targetQubit, { shouldShift, insertColumn: column });
                if (requiredControls !== null) {
                    const jointQubits = [...controlQubits].sort((a, b) => a - b).concat(targetQubit);
                    this.circuit.addGate(gateType, targetQubit, column, null, { jointQubits });
                } else if (allowMultiple && controlQubits.length > 1) {
                    this.circuit.addGate(gateType, targetQubit, column, null, {}, controlQubits);
                } else if (['CX', 'CY', 'CZ'].includes(gateType)) {
                    this.circuit.addGate(gateType, targetQubit, column, null, {}, [controlQubits[0]]);
                } else {
                    this.circuit.addGate(gateType, targetQubit, column, controlQubits[0]);
                }
            }

            modal.classList.remove('active');
            this._refreshCircuitAfterGateEdit();
            return;
        }

        modal.classList.remove('active');
    }

    cancelTargetSelection() {
        document.getElementById('targetModal').classList.remove('active');
    }

    editGate(gateEl) {
        const type = gateEl.dataset.gateType;
        let qubit = parseInt(gateEl.dataset.qubit);
        const column = parseInt(gateEl.dataset.column);

        // If clicking on a control block, redirect to the actual gate
        if (type === 'CONTROL') {
            const targetQubit = parseInt(gateEl.dataset.targetQubit);
            const parentGateType = gateEl.dataset.parentGateType || null;
            const gate = this.circuit.gates.find(g =>
                g.qubit === targetQubit &&
                g.column === column &&
                (!parentGateType || g.type === parentGateType)
            );
            if (!gate) return;
            if (gate.type === 'CSWAP') {
                const joint = gate.params && gate.params.jointQubits;
                if (joint && joint.length === 3) {
                    this.showTargetSelectionModal('CSWAP', joint[2], column, { control: joint[0], swapA: joint[1] });
                }
                return;
            }
            const joint = gate.params && gate.params.jointQubits;
            if (joint && joint.length > 1 && this.customGateMeta[gate.type]) {
                const controls = joint.filter((q) => q !== gate.qubit);
                this.showTargetSelectionModal(gate.type, gate.qubit, column, controls);
                return;
            }
            if (['CX', 'CY', 'CZ'].includes(gate.type)) {
                const controls = gate.multiQubits && gate.multiQubits.length > 0
                    ? gate.multiQubits
                    : (gate.target !== null ? [gate.target] : []);
                this.showTargetSelectionModal(gate.type, gate.qubit, column, controls);
            }
            return;
        }

        // If clicking on a swap partner block, redirect to the actual gate
        if (type === 'SWAP_PARTNER') {
            const partnerQubit = parseInt(gateEl.dataset.partnerQubit);
            const gate = this.circuit.gates.find(g =>
                g.qubit === partnerQubit && g.column === column && g.type === 'SWAP'
            );
            if (gate) {
                this.showTargetSelectionModal('SWAP', gate.qubit, column, gate.target);
            }
            return;
        }

        if (type === 'CSWAP_PARTNER') {
            const partnerQubit = parseInt(gateEl.dataset.partnerQubit);
            const gate = this.circuit.gates.find(g =>
                g.qubit === partnerQubit && g.column === column && g.type === 'CSWAP'
            );
            if (gate && gate.params && gate.params.jointQubits && gate.params.jointQubits.length === 3) {
                const [control, swapA, swapB] = gate.params.jointQubits;
                this.showTargetSelectionModal('CSWAP', swapB, column, { control, swapA });
            }
            return;
        }

        if (type === 'JOINT_PARTNER') {
            const anchorQubit = parseInt(gateEl.dataset.anchorQubit, 10);
            const gType = gateEl.dataset.partnerGateType || '';
            const anchorEl = document.querySelector(
                `.gate-on-wire[data-gate-type="${gType}"][data-qubit="${anchorQubit}"][data-column="${column}"]`
            );
            if (anchorEl && anchorEl !== gateEl) this.editGate(anchorEl);
            return;
        }

        // Find the gate
        const gate = this.circuit.gates.find(g =>
            g.qubit === qubit && g.column === column
        );

        if (!gate) return;

        // If it's a parameterized gate or multi-qubit gate, show edit modal
        if (['RX', 'RY', 'RZ'].includes(type)) {
            const currentAngle = gate.params && gate.params.angle ? gate.params.angle : Math.PI / 2;
            this.showParameterModal(type, qubit, column, currentAngle, true);
        } else if (['CX', 'CY', 'CZ'].includes(type)) {
            // Get current controls - could be single or multiple
            const controls = gate.multiQubits && gate.multiQubits.length > 0
                ? gate.multiQubits
                : (gate.target !== null ? [gate.target] : []);
            this.showTargetSelectionModal(type, gate.qubit, column, controls);
        } else if (gate.params && Array.isArray(gate.params.jointQubits) && gate.params.jointQubits.length > 1
            && this.customGateMeta[type]) {
            const controls = gate.params.jointQubits.filter((q) => q !== gate.qubit);
            this.showTargetSelectionModal(type, gate.qubit, column, controls);
        } else if (type === 'SWAP') {
            this.showTargetSelectionModal('SWAP', gate.qubit, column, gate.target);
        } else if (type === 'CSWAP') {
            const joint = gate.params && gate.params.jointQubits;
            if (joint && joint.length === 3) {
                this.showTargetSelectionModal('CSWAP', joint[2], column, { control: joint[0], swapA: joint[1] });
            }
        }
    }

    removeGateFromSlot(gateEl) {
        const qubit = parseInt(gateEl.dataset.qubit);
        const column = parseInt(gateEl.dataset.column);
        const gateType = gateEl.dataset.gateType;

        // If this is a control block, find and remove the actual gate
        if (gateType === 'CONTROL') {
            const targetQubit = parseInt(gateEl.dataset.targetQubit);
            const parentGateType = gateEl.dataset.parentGateType || null;
            const gate = parentGateType
                ? this.circuit.gates.find(g =>
                    g.type === parentGateType && g.qubit === targetQubit && g.column === column
                )
                : null;
            if (gate) {
                this.circuit.removeGate(gate.qubit, column);
            } else {
                this.circuit.removeGate(targetQubit, column);
            }
        } else if (gateType === 'SWAP_PARTNER') {
            // Find and remove the actual SWAP gate
            const partnerQubit = parseInt(gateEl.dataset.partnerQubit);
            this.circuit.removeGate(partnerQubit, column);
        } else if (gateType === 'CSWAP_PARTNER') {
            const partnerQubit = parseInt(gateEl.dataset.partnerQubit);
            this.circuit.removeGate(partnerQubit, column);
        } else if (gateType === 'JOINT_PARTNER') {
            const anchorQubit = parseInt(gateEl.dataset.anchorQubit);
            this.circuit.removeGate(anchorQubit, column);
        } else {
            this.circuit.removeGate(qubit, column);
        }

        // Invalidate state so it gets recomputed without this gate
        this.circuit.state = null;
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
    }

    showParameterModal(gateType, qubit, column, currentAngle = Math.PI / 2, isEdit = false, insertPlan = null) {
        const plan = insertPlan || { shouldShift: false, insertColumn: column };
        const modal = document.getElementById('parameterModal');
        const title = document.getElementById('modalTitle');
        const inputs = document.getElementById('parameterInputs');

        this._anglePicker?.destroy();
        this._anglePicker = null;

        title.textContent = isEdit ? `Edit ${gateType} Parameters` : `Set ${gateType} Parameters`;
        inputs.innerHTML = '';

        const pickerWrap = document.createElement('div');
        pickerWrap.className = 'angle-picker-wrap';
        inputs.appendChild(pickerWrap);

        const angleGroup = document.createElement('div');
        angleGroup.className = 'parameter-group parameter-group--numeric-row';
        angleGroup.innerHTML = `
            <div>
                <label for="angleInput">Angle (radians)</label>
                <input type="number" id="angleInput" value="${currentAngle}" step="0.01" min="0" max="${2 * Math.PI}">
            </div>
            <div>
                <label for="angleDegInput">Angle (degrees)</label>
                <input type="number" id="angleDegInput" value="${(currentAngle * 180 / Math.PI).toFixed(1)}" step="0.1" min="0" max="360">
            </div>
        `;
        inputs.appendChild(angleGroup);

        const angleInput = document.getElementById('angleInput');
        const angleDegInput = document.getElementById('angleDegInput');
        let syncingFields = false;

        const syncFieldsFromRad = (rad) => {
            syncingFields = true;
            angleInput.value = String(parseFloat(normalizeRotationAngle(rad).toFixed(4)));
            angleDegInput.value = String(parseFloat((normalizeRotationAngle(rad) * 180 / Math.PI).toFixed(1)));
            syncingFields = false;
        };

        if (typeof mountAnglePicker === 'function') {
            this._anglePicker = mountAnglePicker(pickerWrap, {
                angleRad: currentAngle,
                gateType,
                onChange: (rad) => syncFieldsFromRad(rad)
            });
        }

        angleInput.addEventListener('input', () => {
            if (syncingFields) return;
            const rad = parseFloat(angleInput.value);
            if (!Number.isFinite(rad)) return;
            const norm = normalizeRotationAngle(rad);
            this._anglePicker?.setAngle(norm, { silent: true });
            syncingFields = true;
            angleDegInput.value = String(parseFloat((norm * 180 / Math.PI).toFixed(1)));
            syncingFields = false;
        });

        angleDegInput.addEventListener('input', () => {
            if (syncingFields) return;
            const deg = parseFloat(angleDegInput.value);
            if (!Number.isFinite(deg)) return;
            const rad = normalizeRotationAngle((deg * Math.PI) / 180);
            this._anglePicker?.setAngle(rad, { silent: true });
            syncingFields = true;
            angleInput.value = String(parseFloat(rad.toFixed(4)));
            syncingFields = false;
        });

        modal.classList.add('active');
        modal.dataset.gateType = gateType;
        modal.dataset.qubit = qubit;
        modal.dataset.column = plan.insertColumn;
        modal.dataset.shouldShift = plan.shouldShift ? '1' : '0';
        modal.dataset.isEdit = isEdit;
        this._restoreShiftPreviewForModal(qubit, plan);
    }

    confirmGateParameters() {
        const modal = document.getElementById('parameterModal');
        const gateType = modal.dataset.gateType;
        const qubit = parseInt(modal.dataset.qubit);
        const column = parseInt(modal.dataset.column);
        const isEdit = modal.dataset.isEdit === 'true';
        const shouldShift = modal.dataset.shouldShift === '1';
        const angle = this._anglePicker
            ? this._anglePicker.getAngle()
            : parseFloat(document.getElementById('angleInput').value);

        if (isEdit) {
            // Update existing gate
            const gate = this.circuit.gates.find(g =>
                g.qubit === qubit && g.column === column
            );
            if (gate) {
                gate.params = { angle };
            }
        } else {
            if (shouldShift) {
                this.circuit.shiftForInsertOnWire(qubit, column);
            }
            this.circuit.addGate(gateType, qubit, column, null, { angle });
        }

        // Invalidate state so it gets recomputed
        this.circuit.state = null;
        this._anglePicker?.destroy();
        this._anglePicker = null;
        modal.classList.remove('active');
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
        this._clearShiftPreview();
    }

    cancelGateParameters() {
        const modal = document.getElementById('parameterModal');
        this._anglePicker?.destroy();
        this._anglePicker = null;
        modal.classList.remove('active');
    }

    refreshExecutionTimeline() {
        this.executionTimeline = this.circuit.buildExecutionTimeline();
    }

    groupGatesForStepDisplay(gates) {
        return GateDisplay.groupGatesForStepDisplay(gates);
    }

    formatGateGroupLabel(group) {
        return GateDisplay.formatGateGroupLabel(group);
    }

    formatGateOperationLabel(gate) {
        return GateDisplay.formatGateGroupLabel(gate ? [gate] : []);
    }

    formatExecutionStepGateLabel(step) {
        return GateDisplay.formatExecutionStepGateLabel(step);
    }

    formatExecutionStepRepeatLabel(step) {
        return GateDisplay.formatExecutionStepRepeatLabel(step);
    }

    formatExecutionStepLabel(step) {
        return GateDisplay.formatExecutionStepLabel(step);
    }

    populateStepGatesElement(stepGatesEl, step) {
        stepGatesEl.innerHTML = '';
        stepGatesEl.className = 'step-item-gates';

        if (!step.gates || step.gates.length === 0) {
            stepGatesEl.textContent = step.label || 'Initial state';
            return;
        }

        const gateLine = document.createElement('div');
        gateLine.className = 'step-item-gate-ops';
        gateLine.textContent = this.formatExecutionStepGateLabel(step);
        stepGatesEl.appendChild(gateLine);

        const repeatLabel = this.formatExecutionStepRepeatLabel(step);
        if (repeatLabel) {
            const repLine = document.createElement('div');
            repLine.className = 'step-item-repeat';
            repLine.textContent = repeatLabel;
            stepGatesEl.appendChild(repLine);
        }
    }

    runCircuit() {
        // Check for errors before running
        if (this.hasCodeErrors()) {
            return; // Don't run if there are errors
        }

        if (this._runningCircuit) return;

        // Apply code scheduling to the visual circuit before execution
        this.syncCodeToCircuit({ suppressAutoRun: true });
        if (this.hasCodeErrors()) return;

        this._runningCircuit = true;
        try {
            this._runCircuitCore();
        } finally {
            this._runningCircuit = false;
        }
    }

    _runCircuitCore() {
        this.stopPlayback();
        this.circuit.state = new QuantumState(this.circuit.numQubits);

        this.refreshExecutionTimeline();

        // Build step states from unrolled execution timeline
        this.stepStates = [];
        const initialState = new QuantumState(this.circuit.numQubits);
        this.stepStates.push({
            state: initialState,
            gates: [],
            column: -1,
            repeatContext: null,
            label: 'Initial state'
        });

        for (const step of this.executionTimeline) {
            step.gates.forEach((gate) => this.circuit.executeGate(gate));

            const stateCopy = new QuantumState(this.circuit.numQubits);
            if (this.circuit.state && this.circuit.state.amplitudes) {
                stateCopy.amplitudes = [...this.circuit.state.amplitudes];
            }
            this.stepStates.push({
                state: stateCopy,
                gates: [...step.gates],
                column: step.column,
                repeatContext: step.repeatContext,
                label: this.formatExecutionStepLabel(step)
            });
        }

        this.currentStepIndex = this.executionTimeline.length > 0
            ? this.executionTimeline.length - 1
            : -1;
        this.currentColumn = this.stepStates.length > 1
            ? this.stepStates[this.stepStates.length - 1].column
            : 0;
        // Keep state vector / Bloch on pre-measurement amplitudes; timeline steps still record collapse.
        this.updateVisualization();
        this.renderStepTimeline();
        this.updateStepInfo();
        this.clearExecutionHighlight();
    }

    resetExecution() {
        this.stopPlayback();
        this.currentColumn = 0;
        this.currentStepIndex = -1;
        this.executionHistory = [];
        this.historyIndex = -1;
        this.stepStates = [];
        this.refreshExecutionTimeline();
        this.circuit.state = new QuantumState(this.circuit.numQubits);
        this.updateVisualization();
        this.renderStepTimeline();
        this.updateStepInfo();
        this.clearExecutionHighlight();
    }

    renderStepTimeline() {
        const timeline = document.getElementById('stepTimeline');
        if (!timeline) return;

        timeline.innerHTML = '';

        if (this.stepStates.length === 0) {
            return;
        }

        this.stepStates.forEach((step, index) => {
            const stepItem = document.createElement('div');
            stepItem.className = 'step-item';
            stepItem.dataset.stepIndex = index;

            const stepNumber = document.createElement('div');
            stepNumber.className = 'step-item-number';
            stepNumber.textContent = index === 0 ? 'Initial' : `Step ${index}`;

            const stepGates = document.createElement('div');
            this.populateStepGatesElement(stepGates, step);

            stepItem.appendChild(stepNumber);
            stepItem.appendChild(stepGates);

            stepItem.addEventListener('click', () => {
                this.jumpToStep(index);
            });

            timeline.appendChild(stepItem);
        });

        // Highlight current step (last one after running)
        if (this.stepStates.length > 0) {
            const lastStep = timeline.children[timeline.children.length - 1];
            if (lastStep) {
                lastStep.classList.add('active');
            }
        }
    }

    jumpToStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.stepStates.length) return;

        const step = this.stepStates[stepIndex];
        if (!step || !step.state) return;

        // Create a copy of the state
        const stateCopy = new QuantumState(step.state.numQubits);
        stateCopy.amplitudes = [...step.state.amplitudes];
        this.circuit.state = stateCopy;
        this.currentColumn = step.column || 0;
        this.currentStepIndex = stepIndex > 0 ? stepIndex - 1 : -1;

        // Update timeline highlighting
        document.querySelectorAll('.step-item').forEach((item, idx) => {
            item.classList.toggle('active', idx === stepIndex);
        });

        this._applyStateToVisualizer(this._computeDisplayStateForStep(stepIndex), { densityStepIndex: stepIndex });
        this.updateStepInfo();
    }

    stepForward() {
        this.stopPlayback();
        this.refreshExecutionTimeline();

        if (this.executionTimeline.length === 0) {
            this.updateStepInfo();
            return;
        }

        if (this.currentStepIndex === undefined || this.currentStepIndex < -1) {
            this.currentStepIndex = -1;
        }

        const nextIndex = this.currentStepIndex + 1;
        if (nextIndex >= this.executionTimeline.length) {
            if (this.loopEnabled) {
                this.circuit.state = new QuantumState(this.circuit.numQubits);
                this.currentStepIndex = -1;
                this.currentColumn = 0;
            } else {
                this.circuit.state = new QuantumState(this.circuit.numQubits);
                this.currentStepIndex = -1;
                this.currentColumn = 0;
            }
            this.executionHistory = [];
            this.historyIndex = -1;
            this.clearExecutionHighlight();
            this._applyStateToVisualizer(this._computeDisplayStateForStep(0), { densityStepIndex: 0 });
            this.updateStepInfo();
            return;
        }

        if (this.historyIndex < this.executionHistory.length - 1) {
            this.executionHistory = this.executionHistory.slice(0, this.historyIndex + 1);
        }

        const stateCopy = new QuantumState(this.circuit.numQubits);
        stateCopy.amplitudes = [...this.circuit.state.amplitudes];
        this.executionHistory.push({
            state: stateCopy,
            column: this.currentColumn,
            stepIndex: this.currentStepIndex
        });
        this.historyIndex = this.executionHistory.length - 1;

        if (this.currentStepIndex === -1 && this.executionHistory.length === 1) {
            this.circuit.state = new QuantumState(this.circuit.numQubits);
        }

        const step = this.executionTimeline[nextIndex];
        this.highlightGates(step.gates);
        step.gates.forEach((gate) => this.circuit.executeGate(gate));
        this.currentStepIndex = nextIndex;
        this.currentColumn = step.column;
        const displayStepIndex = Math.min(nextIndex + 1, this.stepStates.length - 1);
        this._applyStateToVisualizer(this._computeDisplayStateForStep(displayStepIndex), {
            densityStepIndex: displayStepIndex
        });
        this.updateStepInfo();
    }

    stepBack() {
        this.stopPlayback();

        if (this.historyIndex > 0) {
            this.historyIndex--;
            const historyEntry = this.executionHistory[this.historyIndex];
            this.circuit.state = historyEntry.state;
            this.currentColumn = historyEntry.column;
            this.currentStepIndex = historyEntry.stepIndex ?? -1;
            const displayStepIndex = Math.max(0, (historyEntry.stepIndex ?? -1) + 1);
            this._applyStateToVisualizer(this._computeDisplayStateForStep(displayStepIndex), {
                densityStepIndex: displayStepIndex
            });
            this.updateStepInfo();
            this.clearExecutionHighlight();
        } else if (this.historyIndex === 0) {
            this.circuit.state = new QuantumState(this.circuit.numQubits);
            this.currentColumn = 0;
            this.currentStepIndex = -1;
            this.historyIndex = -1;
            this._applyStateToVisualizer(this._computeDisplayStateForStep(0), { densityStepIndex: 0 });
            this.updateStepInfo();
            this.clearExecutionHighlight();
        }
    }

    togglePlayback() {
        if (this.isPlaying) {
            this.stopPlayback();
        } else {
            this.startPlayback();
        }
    }

    startPlayback() {
        this.isPlaying = true;
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) playPauseBtn.textContent = '⏸';

        const interval = 1000 / this.playbackSpeed;
        this.playbackInterval = setInterval(() => {
            this.refreshExecutionTimeline();
            const atEnd = this.currentStepIndex >= this.executionTimeline.length - 1;
            if (!atEnd || this.loopEnabled) {
                this.stepForward();
            } else {
                this.stopPlayback();
            }
        }, interval);
    }

    stopPlayback() {
        this.isPlaying = false;
        const playPauseBtn = document.getElementById('playPauseBtn');
        if (playPauseBtn) playPauseBtn.textContent = '▶';
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
    }

    fastForward() {
        this.stopPlayback();
        while (this.circuit.getGatesAtColumn(this.currentColumn).length > 0) {
            this.stepForward();
        }
    }

    toggleLoop() {
        this.loopEnabled = !this.loopEnabled;
        const btn = document.getElementById('loopBtn');
        if (btn) {
            if (this.loopEnabled) {
                btn.style.background = 'var(--primary-color)';
                btn.style.color = 'white';
            } else {
                btn.style.background = '';
                btn.style.color = '';
            }
        }
    }

    highlightGates(gates) {
        this.clearExecutionHighlight();
        gates.forEach(gate => {
            const gateEl = document.querySelector(
                `.gate-on-wire[data-qubit="${gate.qubit}"][data-column="${gate.column}"]`
            );
            if (gateEl) {
                gateEl.classList.add('executing');
                // Clear highlight after animation
                setTimeout(() => {
                    gateEl.classList.remove('executing');
                }, 500);
            }
        });
    }

    clearExecutionHighlight() {
        document.querySelectorAll('.gate-on-wire.executing').forEach(el => {
            el.classList.remove('executing');
        });
    }

    updateStepInfo() {
        const stepInfoEl = document.getElementById('stepInfo');
        if (!stepInfoEl) return;

        this.refreshExecutionTimeline();
        const total = this.executionTimeline.length;
        const current = Math.max(0, (this.currentStepIndex ?? -1) + 1);
        stepInfoEl.textContent = `Step: ${current}/${total}`;
    }

    updateCircuitInfo() {
        const depthEl = document.getElementById('circuitDepth');
        const gateCountEl = document.getElementById('gateCount');
        if (depthEl) depthEl.textContent = `Depth: ${this.circuit.getDepth()}`;
        if (gateCountEl) gateCountEl.textContent = `Gates: ${this.circuit.getGateCount()}`;
        this.updateStepInfo();
    }

    zoomIn() {
        if (this.zoomLevel < 2) {
            this.zoomLevel = Math.min(2, this.zoomLevel + 0.1);
            this.renderCircuit();
            this.updateZoomDisplay();
        }
    }

    zoomOut() {
        if (this.zoomLevel > 0.3) {
            this.zoomLevel = Math.max(0.3, this.zoomLevel - 0.1);
            this.renderCircuit();
            this.updateZoomDisplay();
        }
    }

    updateZoomDisplay() {
        const zoomLevelEl = document.getElementById('zoomLevel');
        if (zoomLevelEl) {
            zoomLevelEl.textContent = `${Math.round(this.zoomLevel * 100)}%`;
        }
    }

    clearCircuit() {
        this.stopPlayback();
        this.isUpdatingFromCircuit = true;
        this.circuit.clear();
        this.currentColumn = 0;
        this.currentStepIndex = -1;
        this.selectedGate = null;
        this._clearCircuitSelection();
        this.executionHistory = [];
        this.historyIndex = -1;
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
        this.isUpdatingFromCircuit = false;
    }

    /** Re-render and refresh viz after qubit count changes (respects auto-run setting). */
    _applyAfterQubitCountChange() {
        document.getElementById('qubitCount').value = formatQubitCountLabel(this.circuit.numQubits);
        this.renderCircuit();
        this.syncCircuitToCode();
        const settings = this.getSettings();
        if (settings.autoRun) {
            this.runCircuit();
        } else {
            this.circuit.state = null;
            this.updateVisualization();
        }
    }

    addQubit() {
        const settings = this.getSettings();
        const maxQubits = settings.maxQubits || 12;

        if (this.circuit.numQubits >= maxQubits) {
            return; // Don't add if at max
        }

        this.circuit.addQubit();
        this._applyAfterQubitCountChange();
    }

    removeQubit() {
        // Don't allow removing below 1 qubit
        if (this.circuit.numQubits <= 1) {
            return;
        }
        this.circuit.removeQubit();
        this._applyAfterQubitCountChange();
    }

    setQubitCount(count) {
        const settings = this.getSettings();
        const maxQubits = settings.maxQubits || 12;
        // Ensure count is between 1 and maxQubits
        const actualCount = Math.max(1, Math.min(count, maxQubits));

        while (this.circuit.numQubits < actualCount) {
            this.circuit.addQubit();
        }
        while (this.circuit.numQubits > actualCount) {
            this.circuit.removeQubit();
        }
        this._applyAfterQubitCountChange();
    }

    /** @param {QuantumState|null} state - explicit state; omit for pre-measurement unitary preview */
    _applyStateToVisualizer(state, { densityStepIndex } = {}) {
        if (!this.circuit || !state) return;

        const settings = this.getSettings();
        const vizSettings = {
            precision: settings.precision,
            hideNegligibles: settings.hideNegligibles,
            sortBy: settings.sortBy,
            sortOrder: settings.sortOrder,
            measurePreviewQubits: this.circuit.getMeasureQubitIndices?.() ?? []
        };

        if (this.visualizer) {
            this.visualizer.updateVisualization(state, vizSettings);
            this.visualizer.updateStateVector(state, vizSettings);
            this.visualizer.updateMeasurementResults(state, vizSettings);
        }

        if (this.graphVisualizer) {
            this.graphVisualizer.update(state, vizSettings);
        }

        if (this.nmrSimulator && this.nmrInitialized) {
            if (densityStepIndex !== undefined && densityStepIndex !== null) {
                this.nmrSimulator.updateDensityViewState(state, densityStepIndex);
            } else {
                this.nmrSimulator.onCircuitChanged(this.circuit, state);
            }
        }
    }

    _cloneCircuitState(source) {
        const copy = new QuantumState(source.numQubits, this.circuit.useOptimizedGates);
        if (source.amplitudes) {
            copy.amplitudes = [...source.amplitudes];
        }
        return copy;
    }

    /**
     * State for Bloch / state-vector panels at timeline index stepIndex.
     * Replays step gates with preview (MEASURE skipped) so scrubbing never shows a random collapse.
     */
    _computeDisplayStateForStep(stepIndex) {
        if (!this.circuit || stepIndex < 0 || stepIndex >= this.stepStates.length) {
            return new QuantumState(this.circuit?.numQubits ?? 0, this.circuit?.useOptimizedGates);
        }
        if (stepIndex === 0) {
            return new QuantumState(this.circuit.numQubits, this.circuit.useOptimizedGates);
        }

        const saved = this.circuit.state;
        this.circuit.state = new QuantumState(this.circuit.numQubits, this.circuit.useOptimizedGates);
        for (let i = 1; i <= stepIndex; i++) {
            const gates = this.stepStates[i]?.gates;
            if (gates) {
                gates.forEach((gate) => this.circuit.executeGate(gate, { preview: true }));
            }
        }
        const display = this._cloneCircuitState(this.circuit.state);
        this.circuit.state = saved;
        return display;
    }

    _showStepState(stepIndex) {
        if (!this.circuit || stepIndex < 0 || stepIndex >= this.stepStates.length) return;
        const step = this.stepStates[stepIndex];
        if (!step || !step.state) return;
        this.circuit.state = this._cloneCircuitState(step.state);
        this._applyStateToVisualizer(this._computeDisplayStateForStep(stepIndex));
    }

    updateVisualization() {
        if (!this.circuit) return;

        // Live analysis: unitary evolution only — MEASURE is stochastic and was
        // collapsing the displayed state vector (e.g. SWAP test ancilla looked 100% |1⟩).
        this.circuit.simulatePreview();
        this._applyStateToVisualizer(this.circuit.state);
    }

    switchTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.editor-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        const tabBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
        const editorPanel = document.getElementById(`${tab}Editor`);

        if (tabBtn) {
            tabBtn.classList.add('active');
        }
        if (editorPanel) {
            editorPanel.classList.add('active');
        }

        // Control/target buses use slot geometry — re-measure after the panel is visible
        if (tab === 'circuit') {
            requestAnimationFrame(() => {
                this._renderControlConnectors();
            });
        }

        // Initialize NMR simulator when NMR tab is first opened
        if (tab === 'nmr' && !this.nmrInitialized) {
            this.initializeNMRSimulator();
        }

        // Update NMR when switching to that tab
        if (tab === 'nmr' && this.nmrSimulator && this.circuit) {
            this.updateVisualization();
        }

        // Initialize Gate Creator when first opened
        if (tab === 'gateCreator' && !this.gateCreatorInitialized) {
            this.initializeGateCreatorTab();
        }

        // Initialize analysis tab when first opened
        if (tab === 'analysis') {
            if (!this.nmrInitialized) {
                this.initializeNMRSimulator();
            }
            if (!this.analysisInitialized) {
                this.initializeAnalysisTab();
            }
        }

        if (tab === 'analysis' && this.nmrSimulator) {
            if (this.circuit) {
                this.updateVisualization();
            } else {
                this.nmrSimulator.updateDensityMatrix();
            }
            this.nmrSimulator._kickDensityMatrix3DAfterAnalysisShown();
            this.updateAnalysisVisualization(this.nmrSimulator.getAnalysisViewState());
        }

        // Initialize Other Resources tab when first opened
        if (tab === 'resources') {
            if (!this.nmrInitialized) {
                this.initializeNMRSimulator();
            } else if (!this.resourcesInitialized) {
                this.initializeResourcesTab();
            }
        }
    }

    /**
     * Initialize the Gate Creator tab content
     */
    initializeGateCreatorTab() {
        const container = document.getElementById('gateCreatorContainer');
        if (!container) {
            console.warn('Gate Creator container not found');
            return;
        }

        const colorOptions = [
            { id: 'purple', bg: 'linear-gradient(135deg, #a855f7, #9333ea)', glow: 'rgba(168, 85, 247, 0.45)', solid: '#a855f7' },
            { id: 'red', bg: 'linear-gradient(135deg, #ef4444, #dc2626)', glow: 'rgba(239, 68, 68, 0.45)', solid: '#ef4444' },
            { id: 'green', bg: 'linear-gradient(135deg, #22c55e, #16a34a)', glow: 'rgba(34, 197, 94, 0.45)', solid: '#22c55e' },
            { id: 'blue', bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', glow: 'rgba(59, 130, 246, 0.45)', solid: '#3b82f6' },
            { id: 'cyan', bg: 'linear-gradient(135deg, #06b6d4, #0891b2)', glow: 'rgba(6, 182, 212, 0.45)', solid: '#06b6d4' },
            { id: 'orange', bg: 'linear-gradient(135deg, #f97316, #ea580c)', glow: 'rgba(249, 115, 22, 0.45)', solid: '#f97316' },
            { id: 'pink', bg: 'linear-gradient(135deg, #ec4899, #db2777)', glow: 'rgba(236, 72, 153, 0.45)', solid: '#ec4899' },
            { id: 'amber', bg: 'linear-gradient(135deg, #f59e0b, #d97706)', glow: 'rgba(245, 158, 11, 0.45)', solid: '#f59e0b' },
            { id: 'teal', bg: 'linear-gradient(135deg, #14b8a6, #0d9488)', glow: 'rgba(20, 184, 166, 0.45)', solid: '#14b8a6' },
            { id: 'slate', bg: 'linear-gradient(135deg, #64748b, #475569)', glow: 'rgba(100, 116, 139, 0.45)', solid: '#64748b' },
        ];
        let selectedColorId = colorOptions[0].id;

        container.innerHTML = `
        <div class="gc-root">
          <div class="gc-left">
            <div class="gc-section">
              <div class="gc-row">
                <div class="gc-field">
                  <label class="gc-label">Gate name</label>
                  <input id="gcGateName" class="gc-input" placeholder="U1" value="U1" spellcheck="false" autocomplete="off" />
                </div>
                <div class="gc-field">
                  <label class="gc-label">Label</label>
                  <input id="gcGateLabel" class="gc-input gc-input-short" placeholder="U" value="U" maxlength="4" spellcheck="false" autocomplete="off" />
                </div>
                <div class="gc-field gc-field-color">
                  <label class="gc-label">Color</label>
                  <div class="gc-color-trigger" id="gcColorTrigger" tabindex="0" role="button" aria-label="Choose gate color">
                    <div class="gc-color-swatch" id="gcColorSwatch"></div>
                  </div>
                  <div class="gc-color-popup" id="gcColorPopup">
                    <div class="gc-color-grid" id="gcColorGrid"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="gc-section">
              <div class="gc-row gc-matrix-toolbar">
                <div class="gc-field">
                  <label class="gc-label" for="gcMatrixOrder">Register</label>
                  <select id="gcMatrixOrder" class="gc-input gc-select" title="Matrix must be 2^k×2^k (unitary)">
                    <option value="2" selected>1 qubit (2×2)</option>
                    <option value="4">2 qubits (4×4)</option>
                    <option value="8">3 qubits (8×8)</option>
                    <option value="16">4 qubits (16×16)</option>
                  </select>
                </div>
              </div>
              <label class="gc-label">Unitary matrix</label>
              <div class="gc-matrix-wrap">
                <div class="gc-bracket gc-bracket-l" id="gcBracketL"></div>
                <div class="gc-matrix-grid" id="gcMatrixGrid" data-dim="2">
                  <input class="gc-input gc-m" data-r="0" data-c="0" value="1" spellcheck="false" autocomplete="off" />
                  <input class="gc-input gc-m" data-r="0" data-c="1" value="0" spellcheck="false" autocomplete="off" />
                  <input class="gc-input gc-m" data-r="1" data-c="0" value="0" spellcheck="false" autocomplete="off" />
                  <input class="gc-input gc-m" data-r="1" data-c="1" value="1" spellcheck="false" autocomplete="off" />
                </div>
                <div class="gc-bracket gc-bracket-r" id="gcBracketR"></div>
              </div>
              <div class="gc-hint">Entries: <code>sqrt(2)</code> <code>pi</code> <code>e^(ipi/4)</code> <code>sin(pi/4)</code> <code>cos(pi/3)</code> <code>1/sqrt(2)</code> <code>i</code> and arithmetic. For 4×4+, use Qubi <code>LABEL [q0,q1,…]</code> with one index per qubit the gate acts on.</div>
            </div>

            <div class="gc-actions">
              <button id="gcCreateBtn" class="btn btn-primary gc-btn-create">Create Gate</button>
              <div id="gcStatus" class="gc-status"></div>
            </div>

            <div class="gc-section gc-preview-section">
              <label class="gc-label">Live preview</label>
              <div class="gc-tile-preview" id="gcTilePreview">
                <div class="gc-tile" id="gcTile">
                  <span class="gc-tile-sym" id="gcTileSym">U</span>
                </div>
                <span class="gc-tile-name" id="gcTileName">U1</span>
              </div>
            </div>
          </div>

          <div class="gc-right" id="gcBlochColumn">
            <label class="gc-label">Gate effect on |0⟩ and |1⟩</label>
            <div id="gcBlochContainer" class="gc-bloch-3d"></div>
            <div class="gc-bloch-legend">
              <span class="gc-legend-dot gc-legend-0"></span> |0⟩ &rarr; output
              <span class="gc-legend-dot gc-legend-1"></span> |1⟩ &rarr; output
            </div>
          </div>
        </div>`;

        // ---- helpers ----
        const byId = (id) => container.querySelector(`#${id}`);
        const statusEl = byId('gcStatus');

        const setStatus = (msg, kind = 'info', action = null) => {
            if (!statusEl) return;
            statusEl.textContent = '';
            statusEl.className = 'gc-status' + (kind === 'error' ? ' gc-status-err' : kind === 'ok' ? ' gc-status-ok' : '');
            const span = document.createElement('span');
            span.textContent = msg;
            statusEl.appendChild(span);
            if (action) {
                const link = document.createElement('button');
                link.className = 'gc-action-link';
                link.textContent = action.label;
                link.type = 'button';
                link.addEventListener('click', action.fn);
                statusEl.appendChild(link);
            }
        };

        // ---- complex number parsing ----
        // Mini expression evaluator for complex numbers.
        // Supports: numbers, pi, e, i, sqrt(), sin(), cos(), tan(), exp(), e^(...),
        //           +, -, *, /, parentheses, implicit multiply (2pi, 3i, etc.)
        const parseComplex = (raw) => {
            const src = String(raw ?? '').trim();
            if (!src) return null;
            let pos = 0;
            const s = src.replace(/\s+/g, '');
            const len = s.length;

            const peek = () => pos < len ? s[pos] : '';
            const eat = (ch) => { if (s[pos] === ch) { pos++; return true; } return false; };

            const parseExpr = () => {
                let left = parseTerm();
                if (!left) return null;
                while (pos < len) {
                    if (peek() === '+') { pos++; const r = parseTerm(); if (!r) return null; left = { re: left.re + r.re, im: left.im + r.im }; }
                    else if (peek() === '-') { pos++; const r = parseTerm(); if (!r) return null; left = { re: left.re - r.re, im: left.im - r.im }; }
                    else break;
                }
                return left;
            };

            const parseTerm = () => {
                let left = parseUnary();
                if (!left) return null;
                while (pos < len) {
                    if (peek() === '*') { pos++; const r = parseUnary(); if (!r) return null; left = cMul(left, r); }
                    else if (peek() === '/') {
                        pos++;
                        const r = parseUnary();
                        if (!r) return null;
                        const d = r.re * r.re + r.im * r.im;
                        if (d < 1e-30) return null;
                        left = { re: (left.re * r.re + left.im * r.im) / d, im: (left.im * r.re - left.re * r.im) / d };
                    }
                    else {
                        // Implicit multiply: next char starts an atom (digit, letter, '(', '-' before atom)
                        const c = peek();
                        if (c && (c === '(' || c === 'i' || c === 'p' || c === 'e' || c === 's' || c === 'c' || c === 't' || (c >= '0' && c <= '9') || c === '.')) {
                            const r = parseUnary();
                            if (!r) return null;
                            left = cMul(left, r);
                        } else break;
                    }
                }
                return left;
            };

            const cMul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });

            const parseUnary = () => {
                if (peek() === '-') { pos++; const v = parseAtom(); return v ? { re: -v.re, im: -v.im } : null; }
                if (peek() === '+') { pos++; }
                return parseAtom();
            };

            const matchWord = (w) => {
                if (s.substring(pos, pos + w.length).toLowerCase() === w.toLowerCase()) { pos += w.length; return true; }
                return false;
            };

            const parseAtom = () => {
                // Parenthesized expression
                if (peek() === '(') {
                    pos++;
                    const v = parseExpr();
                    if (!v) return null;
                    eat(')');
                    return v;
                }

                // Functions: sqrt, sin, cos, tan, exp
                for (const fn of ['sqrt', 'sin', 'cos', 'tan', 'exp']) {
                    if (s.substring(pos, pos + fn.length).toLowerCase() === fn && s[pos + fn.length] === '(') {
                        pos += fn.length;
                        pos++; // '('
                        const arg = parseExpr();
                        if (!arg) return null;
                        eat(')');
                        return applyFn(fn, arg);
                    }
                }

                // e^(...) — Euler exponential
                if (s[pos] === 'e' && s[pos + 1] === '^') {
                    pos += 2;
                    const arg = parseAtom();
                    if (!arg) return null;
                    return cExp(arg);
                }

                // Constants
                if (matchWord('pi')) return { re: Math.PI, im: 0 };
                if (s[pos] === 'e' && (pos + 1 >= len || !/[a-df-z(^]/i.test(s[pos + 1]))) { pos++; return { re: Math.E, im: 0 }; }
                if (s[pos] === 'i') { pos++; return { re: 0, im: 1 }; }

                // Number literal
                const numMatch = s.substring(pos).match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
                if (numMatch) {
                    pos += numMatch[0].length;
                    return { re: parseFloat(numMatch[0]), im: 0 };
                }

                return null;
            };

            const cExp = (z) => {
                const mag = Math.exp(z.re);
                return { re: mag * Math.cos(z.im), im: mag * Math.sin(z.im) };
            };

            const applyFn = (fn, z) => {
                // For real arguments, use real functions; for complex, extend where straightforward
                if (Math.abs(z.im) < 1e-15) {
                    const x = z.re;
                    switch (fn) {
                        case 'sqrt': return x >= 0 ? { re: Math.sqrt(x), im: 0 } : { re: 0, im: Math.sqrt(-x) };
                        case 'sin': return { re: Math.sin(x), im: 0 };
                        case 'cos': return { re: Math.cos(x), im: 0 };
                        case 'tan': return { re: Math.tan(x), im: 0 };
                        case 'exp': return { re: Math.exp(x), im: 0 };
                    }
                }
                // Complex versions
                switch (fn) {
                    case 'exp': return cExp(z);
                    case 'sqrt': {
                        const r = Math.sqrt(Math.sqrt(z.re * z.re + z.im * z.im));
                        const theta = Math.atan2(z.im, z.re) / 2;
                        return { re: r * Math.cos(theta), im: r * Math.sin(theta) };
                    }
                    case 'sin': {
                        return { re: Math.sin(z.re) * Math.cosh(z.im), im: Math.cos(z.re) * Math.sinh(z.im) };
                    }
                    case 'cos': {
                        return { re: Math.cos(z.re) * Math.cosh(z.im), im: -Math.sin(z.re) * Math.sinh(z.im) };
                    }
                    case 'tan': {
                        const sinZ = applyFn('sin', z);
                        const cosZ = applyFn('cos', z);
                        const d = cosZ.re * cosZ.re + cosZ.im * cosZ.im;
                        if (d < 1e-30) return null;
                        return { re: (sinZ.re * cosZ.re + sinZ.im * cosZ.im) / d, im: (sinZ.im * cosZ.re - sinZ.re * cosZ.im) / d };
                    }
                }
                return null;
            };

            const result = parseExpr();
            if (!result || pos < len) return null;
            return Complex.create(result.re, result.im);
        };
        const conj = (a) => Complex.conj(a);
        const mul = (a, b) => Complex.mul(a, b);
        const add = (a, b) => Complex.add(a, b);

        const isUnitary2x2 = (m, eps = 1e-9) => {
            const [m00, m01, m10, m11] = m;
            const a00 = add(mul(conj(m00), m00), mul(conj(m10), m10));
            const a01 = add(mul(conj(m00), m01), mul(conj(m10), m11));
            const a10 = add(mul(conj(m01), m00), mul(conj(m11), m10));
            const a11 = add(mul(conj(m01), m01), mul(conj(m11), m11));
            const near = (z, re, im = 0) => Math.abs(z.re - re) <= eps && Math.abs(z.im - im) <= eps;
            return near(a00, 1) && near(a11, 1) && near(a01, 0) && near(a10, 0);
        };

        const isUnitaryN = (flat, dim, eps = 1e-6) => {
            const near = (z, re, im = 0) => Math.abs(z.re - re) <= eps && Math.abs(z.im - im) <= eps;
            for (let r = 0; r < dim; r++) {
                for (let c = 0; c < dim; c++) {
                    let sum = Complex.create(0, 0);
                    for (let k = 0; k < dim; k++) {
                        const a = conj(flat[k * dim + r]);
                        const b = flat[k * dim + c];
                        sum = add(sum, mul(a, b));
                    }
                    if (r === c) {
                        if (!near(sum, 1, 0)) return false;
                    } else if (!near(sum, 0, 0)) {
                        return false;
                    }
                }
            }
            return true;
        };

        const getMatrixDim = () => {
            const grid = byId('gcMatrixGrid');
            const d = grid ? parseInt(grid.dataset.dim || '2', 10) : 2;
            return Number.isFinite(d) && d > 0 ? d : 2;
        };

        const readMatrix = () => {
            const dim = getMatrixDim();
            const inputs = Array.from(container.querySelectorAll('.gc-m'));
            const m = new Array(dim * dim);
            m.fill(null);
            for (const inp of inputs) {
                const r = parseInt(inp.dataset.r, 10);
                const c = parseInt(inp.dataset.c, 10);
                const z = parseComplex(inp.value);
                if (!z) return { ok: false, error: `Invalid value at row ${r + 1}, col ${c + 1}` };
                m[r * dim + c] = z;
            }
            return { ok: true, m, dim };
        };

        // Closest unitary via polar decomposition: U = A * (A†A)^{-1/2}
        const makeUnitary2x2 = (m) => {
            const [a, b, c, d] = m;
            // A†A (2x2 Hermitian positive semi-definite)
            const ca = conj(a), cb = conj(b), cc = conj(c), cd = conj(d);
            const p00 = add(mul(ca, a), mul(cc, c));
            const p01 = add(mul(ca, b), mul(cc, d));
            const p10 = add(mul(cb, a), mul(cd, c));
            const p11 = add(mul(cb, b), mul(cd, d));

            // Eigenvalues of 2x2: λ = (tr ± sqrt(tr²-4det)) / 2
            const tr = add(p00, p11);
            const det = add(mul(p00, p11), Complex.scale(mul(p01, p10), -1));
            const disc = add(mul(tr, tr), Complex.scale(det, -4));
            const discAbs = Math.sqrt(Math.max(0, disc.re)); // Hermitian ⇒ disc is real and ≥ 0
            const l1 = Math.max(1e-15, (tr.re + discAbs) / 2);
            const l2 = Math.max(1e-15, (tr.re - discAbs) / 2);

            // (A†A)^{-1/2} = (1/√λ1) |v1><v1| + (1/√λ2) |v2><v2|
            // For 2x2 Hermitian with eigenvalues l1,l2:
            // (A†A)^{-1/2} = (s1+s2)/2 * I  +  (s1-s2)/(2d) * (A†A - (l1+l2)/2 * I)
            // where s1=1/√l1, s2=1/√l2, d = (l1-l2)/2
            const s1 = 1 / Math.sqrt(l1);
            const s2 = 1 / Math.sqrt(l2);

            let inv00, inv01, inv10, inv11;
            if (Math.abs(l1 - l2) < 1e-12) {
                // Degenerate: (A†A)^{-1/2} = s1 * I
                inv00 = Complex.create(s1); inv01 = Complex.create(0);
                inv10 = Complex.create(0);  inv11 = Complex.create(s1);
            } else {
                const halfSum = (s1 + s2) / 2;
                const ratio = (s1 - s2) / (l1 - l2);
                // (A†A) - ((l1+l2)/2)*I
                const halfTrace = (l1 + l2) / 2;
                const q00 = Complex.create(p00.re - halfTrace, p00.im);
                const q01 = Complex.create(p01.re, p01.im);
                const q10 = Complex.create(p10.re, p10.im);
                const q11 = Complex.create(p11.re - halfTrace, p11.im);
                inv00 = Complex.create(halfSum + ratio * q00.re, ratio * q00.im);
                inv01 = Complex.create(ratio * q01.re, ratio * q01.im);
                inv10 = Complex.create(ratio * q10.re, ratio * q10.im);
                inv11 = Complex.create(halfSum + ratio * q11.re, ratio * q11.im);
            }

            // U = A * (A†A)^{-1/2}
            return [
                add(mul(a, inv00), mul(b, inv10)),
                add(mul(a, inv01), mul(b, inv11)),
                add(mul(c, inv00), mul(d, inv10)),
                add(mul(c, inv01), mul(d, inv11)),
            ];
        };

        const writeMatrix = (m) => {
            const dim = getMatrixDim();
            const inputs = Array.from(container.querySelectorAll('.gc-m'));
            const fmt = (z) => {
                const rnd = (n) => { const s = parseFloat(n.toFixed(6)).toString(); return s === '' ? '0' : s; };
                const hasRe = Math.abs(z.re) > 1e-12;
                const hasIm = Math.abs(z.im) > 1e-12;
                if (!hasRe && !hasIm) return '0';
                if (!hasIm) return rnd(z.re);
                if (!hasRe) {
                    if (Math.abs(z.im - 1) < 1e-9) return 'i';
                    if (Math.abs(z.im + 1) < 1e-9) return '-i';
                    return `${rnd(z.im)}i`;
                }
                const sign = z.im > 0 ? '+' : '';
                const imPart = (Math.abs(z.im - 1) < 1e-9) ? 'i' : (Math.abs(z.im + 1) < 1e-9) ? '-i' : `${rnd(z.im)}i`;
                return `${rnd(z.re)}${sign}${imPart}`;
            };
            for (const inp of inputs) {
                const r = parseInt(inp.dataset.r, 10);
                const c = parseInt(inp.dataset.c, 10);
                inp.value = fmt(m[r * dim + c]);
                inp.classList.remove('gc-input-err');
            }
        };

        const rebuildMatrixGrid = (newDim, preserve = false) => {
            const grid = byId('gcMatrixGrid');
            const orderSel = byId('gcMatrixOrder');
            if (!grid) return;
            const dim = newDim || parseInt(orderSel?.value || '2', 10) || 2;
            const prev = preserve ? readMatrix() : null;
            grid.dataset.dim = String(dim);
            grid.innerHTML = '';
            grid.style.gridTemplateColumns = `repeat(${dim}, minmax(48px, 1fr))`;
            const ident = (r, c) => (r === c ? '1' : '0');
            for (let r = 0; r < dim; r++) {
                for (let c = 0; c < dim; c++) {
                    const inp = document.createElement('input');
                    inp.className = 'gc-input gc-m';
                    inp.dataset.r = String(r);
                    inp.dataset.c = String(c);
                    inp.spellcheck = false;
                    inp.autocomplete = 'off';
                    let v = ident(r, c);
                    if (preserve && prev && prev.ok && prev.dim === dim) {
                        const z = prev.m[r * dim + c];
                        if (z) {
                            const fmt0 = (z0) => {
                                const rnd = (n) => parseFloat(n.toFixed(6)).toString();
                                if (Math.abs(z0.im) < 1e-12) return rnd(z0.re);
                                if (Math.abs(z0.re) < 1e-12) return Math.abs(z0.im - 1) < 1e-9 ? 'i' : `${rnd(z0.im)}i`;
                                return `${rnd(z0.re)}${z0.im >= 0 ? '+' : ''}${Math.abs(z0.im - 1) < 1e-9 ? 'i' : `${rnd(z0.im)}i`}`;
                            };
                            v = fmt0(z);
                        }
                    }
                    inp.value = v;
                    grid.appendChild(inp);
                }
            }
            const h = Math.min(520, 56 + dim * 36);
            const bL = byId('gcBracketL');
            const bR = byId('gcBracketR');
            if (bL) bL.style.minHeight = `${h}px`;
            if (bR) bR.style.minHeight = `${h}px`;
            const blochCol = byId('gcBlochColumn');
            if (blochCol) blochCol.style.display = dim === 2 ? '' : 'none';
        };

        const normalizeGateName = (name) => String(name ?? '').trim().toUpperCase();
        const validateGateName = (name) => /^[A-Z][A-Z0-9_]{0,23}$/.test(name);
        const existingBuiltIns = new Set(['H', 'X', 'Y', 'Z', 'S', 'T', 'RX', 'RY', 'RZ', 'CX', 'CY', 'CZ', 'SWAP', 'CSWAP', 'MEASURE', 'REPEAT', 'END', 'I']);
        const getColor = () => colorOptions.find(o => o.id === selectedColorId) || colorOptions[0];

        const validateAll = () => {
            const gateName = normalizeGateName(byId('gcGateName')?.value);
            const label = String(byId('gcGateLabel')?.value ?? '').trim();
            if (!gateName) return { ok: false, error: 'Gate name is required.' };
            if (!validateGateName(gateName)) return { ok: false, error: 'Name: A–Z, 0–9, underscore only.' };
            if (existingBuiltIns.has(gateName)) return { ok: false, error: `"${gateName}" is a built-in gate.` };
            if (!label || label.length > 4 || !/^[A-Z]{1,4}$/.test(label)) return { ok: false, error: 'Label must be 1–4 uppercase letters.' };
            const mat = readMatrix();
            if (!mat.ok) return mat;
            const dim = mat.dim;
            if (dim === 2) {
                if (!isUnitary2x2(mat.m)) return { ok: false, error: 'Matrix is not unitary (U†U ≠ I).' };
            } else if (!isUnitaryN(mat.m, dim)) {
                return { ok: false, error: `Matrix is not unitary (U†U ≠ I) for ${dim}×${dim}.` };
            }
            return { ok: true, gateName, label, matrix: mat.m, dim };
        };

        // ---- color picker ----
        const swatchEl = byId('gcColorSwatch');
        const popupEl = byId('gcColorPopup');
        const gridEl = byId('gcColorGrid');
        const triggerEl = byId('gcColorTrigger');

        const paintSwatch = () => {
            const c = getColor();
            if (swatchEl) swatchEl.style.background = c.bg;
        };
        paintSwatch();

        if (gridEl) {
            for (const opt of colorOptions) {
                const el = document.createElement('div');
                el.className = 'gc-color-option' + (opt.id === selectedColorId ? ' active' : '');
                el.style.background = opt.bg;
                el.dataset.colorId = opt.id;
                el.title = opt.id;
                el.addEventListener('click', () => {
                    selectedColorId = opt.id;
                    paintSwatch();
                    gridEl.querySelectorAll('.gc-color-option').forEach(x => x.classList.toggle('active', x.dataset.colorId === opt.id));
                    if (popupEl) popupEl.classList.remove('open');
                    updateTilePreview();
                    drawBloch();
                });
                gridEl.appendChild(el);
            }
        }
        if (triggerEl && popupEl) {
            triggerEl.addEventListener('click', (e) => {
                e.stopPropagation();
                popupEl.classList.toggle('open');
            });
            document.addEventListener('click', (e) => {
                if (!popupEl.contains(e.target) && !triggerEl.contains(e.target)) {
                    popupEl.classList.remove('open');
                }
            });
        }

        // ---- tile preview ----
        const tileEl = byId('gcTile');
        const tileSymEl = byId('gcTileSym');
        const tileNameEl = byId('gcTileName');

        const updateTilePreview = () => {
            const c = getColor();
            const label = String(byId('gcGateLabel')?.value ?? 'U').trim() || 'U';
            const name = String(byId('gcGateName')?.value ?? 'U1').trim().toUpperCase() || 'U1';
            if (tileSymEl) tileSymEl.textContent = label.slice(0, 4);
            if (tileNameEl) tileNameEl.textContent = name;
            if (tileEl) {
                tileEl.style.background = c.bg;
                tileEl.style.boxShadow = `0 4px 16px ${c.glow}`;
            }
        };
        updateTilePreview();
        const labelInput = byId('gcGateLabel');
        if (labelInput) {
            labelInput.addEventListener('input', () => {
                // Force uppercase letters only
                const cleaned = labelInput.value.replace(/[^A-Za-z]/g, '').toUpperCase();
                if (cleaned !== labelInput.value) labelInput.value = cleaned;
                updateTilePreview();
            });
        }
        byId('gcGateName')?.addEventListener('input', () => { updateTilePreview(); });

        // ---- Three.js Bloch sphere visualization ----
        const blochContainer = byId('gcBlochContainer');
        let gcBlochScene, gcBlochCamera, gcBlochRenderer, gcSphereGroup;
        let gcMarkerGroup; // holds input/output dots
        let gcAnimId = null;
        let gcLoopFn = null;
        let gcDragging = false;
        let gcPrevMouse = { x: 0, y: 0 };
        let gcReinitTimer = null;
        let gcVisAbort = null;

        const gcPixelRatio = () => Math.min(2, window.devicePixelRatio || 1);

        const syncGCBlochTheme = () => {
            if (!gcBlochScene || !window.QubibyteTheme) return;
            const bg = window.QubibyteTheme.createThreeBackground();
            gcBlochScene.background = bg;
            if (gcBlochRenderer) {
                gcBlochRenderer.setClearColor(bg, 1);
            }
        };

        const publishGCBlochGlobals = () => {
            window.gcBlochScene = gcBlochScene || null;
            window.gcBlochRenderer = gcBlochRenderer || null;
        };

        const disposeGCBlochScene = () => {
            if (!gcBlochScene) return;
            gcBlochScene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                const m = obj.material;
                if (m) {
                    if (Array.isArray(m)) m.forEach((mm) => { if (mm.map) mm.map.dispose?.(); mm.dispose?.(); });
                    else {
                        if (m.map) m.map.dispose?.();
                        m.dispose?.();
                    }
                }
            });
            gcBlochScene = null;
            gcBlochCamera = null;
            gcSphereGroup = null;
            gcMarkerGroup = null;
            publishGCBlochGlobals();
        };

        const stopGCBlochLoop = () => {
            if (gcAnimId != null) {
                cancelAnimationFrame(gcAnimId);
                gcAnimId = null;
            }
        };

        const disposeGCBloch = (opts = {}) => {
            const { contextLost = false } = opts;
            stopGCBlochLoop();
            gcLoopFn = null;
            if (!contextLost && gcReinitTimer) {
                clearTimeout(gcReinitTimer);
                gcReinitTimer = null;
            }
            if (gcVisAbort) {
                gcVisAbort.abort();
                gcVisAbort = null;
            }
            if (gcBlochRenderer) {
                const el = gcBlochRenderer.domElement;
                if (gcContextLostHandler) el.removeEventListener('webglcontextlost', gcContextLostHandler);
                if (gcContextRestoredHandler) el.removeEventListener('webglcontextrestored', gcContextRestoredHandler);
                if (el.parentNode) el.parentNode.removeChild(el);
                if (!contextLost) {
                    try { gcBlochRenderer.dispose(); } catch (e) { /* context may already be invalid */ }
                }
                gcBlochRenderer = null;
            }
            disposeGCBlochScene();
        };

        let gcContextLostHandler = null;
        let gcContextRestoredHandler = null;

        const scheduleGCBlochReinit = () => {
            if (gcReinitTimer) return;
            gcReinitTimer = setTimeout(() => {
                gcReinitTimer = null;
                if (!blochContainer || typeof THREE === 'undefined') return;
                disposeGCBloch();
                initGCBloch();
                updateBlochMarkers();
            }, 50);
        };

        const blochFromState = (alpha, beta) => {
            const cab = mul(conj(alpha), beta);
            return { x: 2 * cab.re, y: 2 * cab.im, z: Complex.abs2(alpha) - Complex.abs2(beta) };
        };

        // Bloch→Three.js mapping (same as existing visualizer): X→Z, Y→X, Z→Y
        const blochToThree = (b) => new THREE.Vector3(b.y, b.z, b.x);

        const createTextSprite = (text, color) => {
            const c = document.createElement('canvas');
            const ctx2 = c.getContext('2d');
            c.width = 256; c.height = 128;
            ctx2.font = 'Bold 72px Arial';
            ctx2.fillStyle = color;
            ctx2.textAlign = 'center';
            ctx2.textBaseline = 'middle';
            ctx2.fillText(text, 128, 64);
            const tex = new THREE.CanvasTexture(c);
            const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
            const spr = new THREE.Sprite(mat);
            spr.scale.set(0.7, 0.35, 1);
            return spr;
        };

        const syncGCBlochLoop = () => {
            if (!gcLoopFn || !gcBlochRenderer) return;
            const want = !document.hidden;
            if (want && gcAnimId == null) gcAnimId = requestAnimationFrame(gcLoopFn);
            if (!want && gcAnimId != null) {
                cancelAnimationFrame(gcAnimId);
                gcAnimId = null;
            }
        };

        const initGCBloch = () => {
            if (!blochContainer || typeof THREE === 'undefined') return;
            disposeGCBloch();

            const W = blochContainer.clientWidth || 260;
            const H = blochContainer.clientHeight || 260;

            gcBlochScene = new THREE.Scene();
            gcBlochScene.background = window.QubibyteTheme
                ? window.QubibyteTheme.createThreeBackground()
                : new THREE.Color(0x0f172a);

            gcBlochCamera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
            gcBlochCamera.position.set(2.7, 2.0, 2.7);
            gcBlochCamera.lookAt(0, 0, 0);

            gcBlochRenderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false
            });
            gcBlochRenderer.setSize(W, H);
            gcBlochRenderer.setPixelRatio(gcPixelRatio());
            blochContainer.appendChild(gcBlochRenderer.domElement);

            gcSphereGroup = new THREE.Group();
            gcBlochScene.add(gcSphereGroup);

            // Sphere
            const sGeo = new THREE.SphereGeometry(1, 32, 32);
            gcSphereGroup.add(new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.15 })));
            gcSphereGroup.add(new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({ color: 0x6366f1, wireframe: true, transparent: true, opacity: 0.3 })));

            // Axes (same as main visualizer)
            const aLen = 1.3;
            const mkAxis = (pts, col) => {
                const g = new THREE.BufferGeometry().setFromPoints(pts);
                gcSphereGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, linewidth: 2 })));
            };
            mkAxis([new THREE.Vector3(-aLen, 0, 0), new THREE.Vector3(aLen, 0, 0)], 0x22c55e); // Y-basis
            mkAxis([new THREE.Vector3(0, -aLen, 0), new THREE.Vector3(0, aLen, 0)], 0x3b82f6); // Z-basis
            mkAxis([new THREE.Vector3(0, 0, -aLen), new THREE.Vector3(0, 0, aLen)], 0xef4444);  // X-basis

            // Equator + meridians
            const circlePts = (fn) => { const p = []; for (let i = 0; i <= 64; i++) { const a = (i / 64) * Math.PI * 2; p.push(fn(a)); } return p; };
            const lMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.4 });
            gcSphereGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts(a => new THREE.Vector3(Math.cos(a), 0, Math.sin(a)))), lMat));
            gcSphereGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePts(a => new THREE.Vector3(Math.cos(a), Math.sin(a), 0))), lMat.clone()));

            // Labels
            const labels = [
                { text: '|0⟩', pos: [0, 1.5, 0], color: '#3b82f6' },
                { text: '|1⟩', pos: [0, -1.5, 0], color: '#3b82f6' },
                { text: '|+⟩', pos: [0, 0, 1.5], color: '#ef4444' },
                { text: '|−⟩', pos: [0, 0, -1.5], color: '#ef4444' },
                { text: '|i⟩', pos: [1.5, 0, 0], color: '#22c55e' },
                { text: '|−i⟩', pos: [-1.5, 0, 0], color: '#22c55e' }
            ];
            for (const lb of labels) {
                const sp = createTextSprite(lb.text, lb.color);
                sp.position.set(...lb.pos);
                gcSphereGroup.add(sp);
            }

            // Lights
            gcBlochScene.add(new THREE.AmbientLight(0xffffff, 0.6));
            const dl = new THREE.DirectionalLight(0xffffff, 0.4);
            dl.position.set(5, 5, 5);
            gcBlochScene.add(dl);

            // Marker group for input/output dots
            gcMarkerGroup = new THREE.Group();
            gcSphereGroup.add(gcMarkerGroup);

            // Mouse controls
            const domEl = gcBlochRenderer.domElement;
            domEl.addEventListener('mousedown', (e) => { gcDragging = true; gcPrevMouse = { x: e.clientX, y: e.clientY }; });
            domEl.addEventListener('mousemove', (e) => {
                if (!gcDragging) return;
                gcSphereGroup.rotation.y += (e.clientX - gcPrevMouse.x) * 0.01;
                gcSphereGroup.rotation.x += (e.clientY - gcPrevMouse.y) * 0.01;
                gcPrevMouse = { x: e.clientX, y: e.clientY };
            });
            domEl.addEventListener('mouseup', () => { gcDragging = false; });
            domEl.addEventListener('mouseleave', () => { gcDragging = false; });
            domEl.addEventListener('wheel', (e) => {
                e.preventDefault();
                gcBlochCamera.position.multiplyScalar(1 + (e.deltaY > 0 ? 0.1 : -0.1));
                const d = gcBlochCamera.position.length();
                if (d < 2) gcBlochCamera.position.normalize().multiplyScalar(2);
                else if (d > 10) gcBlochCamera.position.normalize().multiplyScalar(10);
            });

            gcContextLostHandler = (e) => {
                e.preventDefault();
                disposeGCBloch({ contextLost: true });
                scheduleGCBlochReinit();
            };
            domEl.addEventListener('webglcontextlost', gcContextLostHandler, false);

            // Animate with auto-resize; pause rAF while tab is hidden to reduce GPU context churn
            let gcLastW = W, gcLastH = H;
            const loop = () => {
                if (!gcBlochRenderer) return;
                if (document.hidden) {
                    gcAnimId = null;
                    return;
                }
                gcAnimId = requestAnimationFrame(loop);
                const cw = blochContainer.clientWidth;
                const ch = blochContainer.clientHeight;
                if (cw > 0 && ch > 0 && (cw !== gcLastW || ch !== gcLastH)) {
                    gcLastW = cw;
                    gcLastH = ch;
                    gcBlochRenderer.setPixelRatio(gcPixelRatio());
                    gcBlochRenderer.setSize(cw, ch);
                    gcBlochCamera.aspect = cw / ch;
                    gcBlochCamera.updateProjectionMatrix();
                }
                if (cw > 0 && ch > 0) {
                    try {
                        gcBlochRenderer.render(gcBlochScene, gcBlochCamera);
                    } catch (err) {
                        stopGCBlochLoop();
                        scheduleGCBlochReinit();
                    }
                }
            };
            gcLoopFn = loop;
            gcVisAbort = new AbortController();
            document.addEventListener('visibilitychange', syncGCBlochLoop, { signal: gcVisAbort.signal });
            syncGCBlochLoop();
            publishGCBlochGlobals();
        };

        if (!this._gcThemeListener) {
            this._gcThemeListener = () => syncGCBlochTheme();
            window.addEventListener('qubibyte-theme-change', this._gcThemeListener);
        }

        const updateBlochMarkers = () => {
            if (!gcMarkerGroup) return;
            // Clear previous markers
            while (gcMarkerGroup.children.length) gcMarkerGroup.remove(gcMarkerGroup.children[0]);

            const mat = readMatrix();
            if (!mat.ok || mat.dim !== 2) return;
            const [m00, m01, m10, m11] = mat.m;

            const inputStates = [
                { alpha: Complex.create(1), beta: Complex.create(0), color: 0x60a5fa },
                { alpha: Complex.create(0), beta: Complex.create(1), color: 0xf472b6 },
            ];

            for (const st of inputStates) {
                const outAlpha = add(mul(m00, st.alpha), mul(m01, st.beta));
                const outBeta = add(mul(m10, st.alpha), mul(m11, st.beta));
                const inB = blochFromState(st.alpha, st.beta);
                const outB = blochFromState(outAlpha, outBeta);
                const pIn = blochToThree(inB);
                const pOut = blochToThree(outB);

                // Input: wireframe sphere (hollow)
                const inGeo = new THREE.SphereGeometry(0.06, 12, 12);
                const inMat = new THREE.MeshBasicMaterial({ color: st.color, wireframe: true, transparent: true, opacity: 0.9 });
                const inMesh = new THREE.Mesh(inGeo, inMat);
                inMesh.position.copy(pIn);
                gcMarkerGroup.add(inMesh);

                // Output: solid sphere + glow
                const outGeo = new THREE.SphereGeometry(0.08, 16, 16);
                const outMat = new THREE.MeshBasicMaterial({ color: st.color });
                const outMesh = new THREE.Mesh(outGeo, outMat);
                outMesh.position.copy(pOut);
                gcMarkerGroup.add(outMesh);

                const glowGeo = new THREE.SphereGeometry(0.12, 16, 16);
                const glowMat = new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.3 });
                const glowMesh = new THREE.Mesh(glowGeo, glowMat);
                glowMesh.position.copy(pOut);
                gcMarkerGroup.add(glowMesh);

                // Dashed arc from input to output
                const mid = new THREE.Vector3().addVectors(pIn, pOut).multiplyScalar(0.5);
                mid.normalize().multiplyScalar(1.15); // bulge outward on sphere surface
                const curve = new THREE.QuadraticBezierCurve3(pIn, mid, pOut);
                const pts = curve.getPoints(32);
                const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
                const lineMat = new THREE.LineDashedMaterial({ color: st.color, dashSize: 0.06, gapSize: 0.04, transparent: true, opacity: 0.7 });
                const line = new THREE.Line(lineGeo, lineMat);
                line.computeLineDistances();
                gcMarkerGroup.add(line);
            }
        };

        initGCBloch();
        updateBlochMarkers();

        // Redraw on matrix input change (delegated — grid is rebuilt when register size changes)
        container.addEventListener('input', (e) => {
            if (!e.target.classList.contains('gc-m')) return;
            updateBlochMarkers();
            const mat = readMatrix();
            if (!mat.ok) {
                e.target.classList.add('gc-input-err');
                return;
            }
            const unitaryOk = mat.dim === 2 ? isUnitary2x2(mat.m) : isUnitaryN(mat.m, mat.dim);
            if (unitaryOk) {
                setStatus('', 'info');
                container.querySelectorAll('.gc-m').forEach(x => x.classList.remove('gc-input-err'));
            } else if (mat.dim === 2) {
                setStatus('Not unitary. ', 'error', {
                    label: 'Make unitary',
                    fn: () => {
                        const cur = readMatrix();
                        if (!cur.ok || cur.dim !== 2) return;
                        const [a, b, c, d] = cur.m;
                        const det = add(mul(a, d), Complex.scale(mul(b, c), -1));
                        const detMag = Complex.abs(det);
                        if (detMag > 1e-12) {
                            const scale = 1 / Math.sqrt(detMag);
                            const scaled = cur.m.map(z => Complex.scale(z, scale));
                            if (isUnitary2x2(scaled)) {
                                writeMatrix(scaled);
                                updateBlochMarkers();
                                setStatus('Scaled to unitary (uniform)', 'ok');
                                return;
                            }
                        }
                        const fixed = makeUnitary2x2(cur.m);
                        if (!isUnitary2x2(fixed)) { setStatus('Could not unitarize this matrix', 'error'); return; }
                        writeMatrix(fixed);
                        updateBlochMarkers();
                        setStatus('Corrected to nearest unitary', 'ok');
                    }
                });
            } else {
                setStatus(`Not unitary (${mat.dim}×${mat.dim}). Adjust entries so U†U = I.`, 'error');
                e.target.classList.add('gc-input-err');
            }
        });

        byId('gcMatrixOrder')?.addEventListener('change', () => {
            const v = parseInt(byId('gcMatrixOrder')?.value || '2', 10);
            rebuildMatrixGrid(v, false);
            updateBlochMarkers();
            setStatus('', 'info');
        });

        // ---- palette helpers ----
        const ensureCustomCategory = () => {
            const palette = document.querySelector('.gate-palette');
            if (!palette) return null;
            let category = palette.querySelector('.gate-category[data-category="custom"]');
            if (!category) {
                category = document.createElement('div');
                category.className = 'gate-category';
                category.dataset.category = 'custom';
                category.innerHTML = `<h3 class="category-title">Custom Gates</h3><div class="gate-list" data-gate-list="custom"></div>`;
                palette.insertBefore(category, palette.firstChild);
            }
            return category.querySelector('.gate-list[data-gate-list="custom"]');
        };

        const addGateToPalette = (gateKey, label, displayName, color) => {
            const list = ensureCustomCategory();
            if (!list) return;
            const prev = list.querySelector(`.gate-item[data-gate="${gateKey}"]`);
            if (prev) prev.remove();
            const item = document.createElement('div');
            item.className = 'gate-item custom-gate';
            item.dataset.gate = gateKey;
            item.draggable = true;
            this._setGateItemDraggable(item);
            item.style.setProperty('--gate-custom-bg', color.bg);
            item.style.setProperty('--gate-custom-glow', color.glow);
            item.innerHTML = `<span class="gate-symbol"><span class="gate-symbol-label">${label}</span></span><span class="gate-name" aria-hidden="true">${displayName}</span><button class="gate-info-icon" data-gate="${gateKey}" type="button" title="Gate Information">ℹ</button>`;
            item.setAttribute('aria-label', displayName);
            const symLabel = item.querySelector('.gate-symbol-label');
            if (symLabel) fitGateLabel(symLabel, label);
            list.appendChild(item);
        };

        // ---- create ----
        const fmtComplex = (z) => {
            const rnd = (n) => { const s = n.toPrecision(15).replace(/\.?0+$/, ''); return s === '' || s === '-' ? '0' : s; };
            const re = z.re, im = z.im;
            const hasRe = Math.abs(re) > 1e-15;
            const hasIm = Math.abs(im) > 1e-15;
            if (!hasRe && !hasIm) return '0';
            if (!hasIm) return rnd(re);
            if (!hasRe) return (Math.abs(im - 1) < 1e-12) ? 'i' : (Math.abs(im + 1) < 1e-12) ? '-i' : `${rnd(im)}i`;
            const sign = im > 0 ? '+' : '';
            const imPart = (Math.abs(im - 1) < 1e-12) ? 'i' : (Math.abs(im + 1) < 1e-12) ? '-i' : `${rnd(im)}i`;
            return `${rnd(re)}${sign}${imPart}`;
        };

        const readMatrixRaw = () => {
            const dim = getMatrixDim();
            const raw = new Array(dim * dim).fill('0');
            const inputs = Array.from(container.querySelectorAll('.gc-m'));
            for (const inp of inputs) {
                const r = parseInt(inp.dataset.r, 10);
                const c = parseInt(inp.dataset.c, 10);
                raw[r * dim + c] = inp.value.trim() || '0';
            }
            return { raw, dim };
        };

        const buildDefineLine = (label, gateName, colorId) => {
            const { raw, dim } = readMatrixRaw();
            const rows = [];
            for (let r = 0; r < dim; r++) {
                const cells = [];
                for (let c = 0; c < dim; c++) cells.push(raw[r * dim + c]);
                rows.push(cells.join(' '));
            }
            let line = `#define ${label} [${rows.join('; ')}]`;
            if (gateName) line += ` "${gateName}"`;
            if (colorId) line += ` "${colorId}"`;
            return line;
        };

        byId('gcCreateBtn')?.addEventListener('click', () => {
            const v = validateAll();
            if (!v.ok) { setStatus(v.error, 'error'); return; }
            const color = getColor();
            GateMatrices[v.label] = v.matrix;
            this.customGateMeta[v.label] = { label: v.label, colorBg: color.bg, colorGlow: color.glow, displayName: v.gateName };
            addGateToPalette(v.label, v.label, v.gateName, color);

            const mainFile = (this.qubiFiles || []).find(f => f.id === 'main');
            if (mainFile) {
                const defineLine = buildDefineLine(v.label, v.gateName, selectedColorId);
                if (typeof this._persistActiveQubiEditorToFile === 'function') {
                    this._persistActiveQubiEditorToFile();
                }
                const defRegex = new RegExp(`^#define\\s+${v.label}\\s+\\[.*?\\].*$`, 'im');
                mainFile.code = mainFile.code.replace(defRegex, '').replace(/^\n/, '');
                mainFile.code = defineLine + '\n' + mainFile.code;
                if (this.activeQubiFileId === 'main') {
                    if (typeof this._loadActiveQubiFileIntoEditor === 'function') {
                        this._loadActiveQubiFileIntoEditor({ preserveUndo: true });
                    }
                }
            }

            setStatus(`Gate "${v.label}" created`, 'ok');
        });

        this.gateCreatorInitialized = true;
    }

    /**
     * Initialize the Data Analysis tab
     */
    initializeAnalysisTab() {
        if (this.analysisInitialized) return;

        const analysisContainer = document.getElementById('analysisContainer');
        if (!analysisContainer) {
            console.warn('Analysis container not found');
            return;
        }

        if (!this.nmrSimulator) {
            console.warn('NMR simulator required for Data Analysis tab');
            return;
        }

        this.nmrSimulator.renderDataAnalysisContent('analysisContainer');

        this.analysisBlochViz = new QubitVisualizer('analysis-qubitVisualization', {
            stateVectorElId: 'analysis-stateVector',
            measurementResultsElId: 'analysis-measurementResults'
        });
        this.analysisBarGraph = new ProbabilityGraphs('analysis-barChart', {
            forcedView: 'bar',
            hideViewTabs: true
        });
        this.analysisPieGraph = new ProbabilityGraphs('analysis-pieChart', {
            forcedView: 'pie',
            hideViewTabs: true
        });

        this.nmrSimulator.setAnalysisViewCallback((state) => {
            this.updateAnalysisVisualization(state);
        });

        this.analysisInitialized = true;
        this.updateAnalysisVisualization(this.circuit?.state);
    }

    updateAnalysisVisualization(quantumState) {
        if (!this.analysisInitialized || !quantumState) return;

        const settings = this.getSettings();
        const vizSettings = {
            precision: settings.precision,
            hideNegligibles: settings.hideNegligibles,
            sortBy: settings.sortBy,
            sortOrder: settings.sortOrder
        };

        if (this.analysisBlochViz) {
            this.analysisBlochViz.updateVisualization(quantumState, vizSettings);
            this.analysisBlochViz.updateStateVector(quantumState, vizSettings);
            this.analysisBlochViz.updateMeasurementResults(quantumState, vizSettings);
        }
        if (this.analysisBarGraph) {
            this.analysisBarGraph.update(quantumState, vizSettings);
        }
        if (this.analysisPieGraph) {
            this.analysisPieGraph.update(quantumState, vizSettings);
        }
    }

    /**
     * Initialize the Other Resources tab content
     */
    initializeResourcesTab() {
        if (this.resourcesInitialized) return;

        const resourcesContainer = document.getElementById('resourcesContainer');
        if (!resourcesContainer) {
            console.warn('Resources container not found');
            return;
        }

        if (!this.nmrSimulator) {
            console.warn('NMR simulator required for Other Resources tab');
            return;
        }
        this.nmrSimulator.renderOtherResourcesContent('resourcesContainer');
        this.resourcesInitialized = true;
    }

    /**
     * Initialize the NMR Simulator UI
     */
    initializeNMRSimulator() {
        const nmrContainer = document.getElementById('nmrSimulatorContainer');
        if (!nmrContainer) {
            console.warn('NMR simulator container not found');
            return;
        }

        try {
            // Check if NMRSimulatorUI is available
            if (typeof NMRSimulatorUI === 'undefined') {
                console.error('NMRSimulatorUI class not loaded');
                nmrContainer.innerHTML = `
                    <div class="nmr-error">
                        <p>NMR Analysis failed to load. Please refresh the page.</p>
                    </div>
                `;
                return;
            }

            this.nmrSimulator = new NMRSimulatorUI('nmrSimulatorContainer');
            this.nmrInitialized = true;

            // Other Resources DOM can be built early; Data Analysis waits until first open
            // so the 3D density mount has real layout (hidden panels are 0×0).
            if (!this.resourcesInitialized) {
                this.initializeResourcesTab();
            }

            // Sync current circuit state
            if (this.circuit && this.circuit.state) {
                this.nmrSimulator.onCircuitChanged(this.circuit, this.circuit.state);
            }

            console.log('NMR Simulator initialized successfully');
        } catch (error) {
            console.error('Failed to initialize NMR Simulator:', error);
            nmrContainer.innerHTML = `
                <div class="nmr-error">
                    <p>Error initializing NMR Analysis: ${error.message}</p>
                </div>
            `;
        }
    }

    /**
     * Update NMR simulator with current state
     */
    updateNMRSimulator() {
        if (this.nmrSimulator && this.circuit) {
            this.nmrSimulator.onCircuitChanged(this.circuit, this.circuit.state);
        }
    }

    switchVizTab(tab) {
        // Only target tabs and panels within the first viz-region (Probabilities/State Vector)
        const vizRegion1 = document.querySelector('.viz-region-1');
        if (!vizRegion1) return;

        vizRegion1.querySelectorAll('.viz-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        vizRegion1.querySelectorAll('.viz-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        const tabBtn = vizRegion1.querySelector(`.viz-tab-btn[data-viz-tab="${tab}"]`);
        const panel = document.getElementById(`${tab}Panel`);

        if (tabBtn) {
            tabBtn.classList.add('active');
        }
        if (panel) {
            panel.classList.add('active');
        }
    }

    toggleVisualizationSection(shouldToggle = true) {
        const vizSection = document.getElementById('visualizationSection');
        if (!vizSection) return;

        const isCollapsed = vizSection.classList.contains('collapsed');

        if (shouldToggle) {
            // Toggle the state
            if (isCollapsed) {
                vizSection.classList.remove('collapsed');
                localStorage.setItem('vizSectionCollapsed', 'false');

                // Wait for CSS transition to complete, then force re-render Bloch sphere
                // This fixes the stretching issue when expanding from hidden state
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        // Force complete re-render of Bloch sphere with correct dimensions
                        if (this.visualizer) {
                            this.visualizer.forceRerender();
                        }
                        // Also update probability graphs
                        if (this.graphManager && this.quantumState) {
                            this.graphManager.update(this.quantumState);
                        }
                    });
                }, 350); // Wait for CSS transition (0.3s) plus buffer
            } else {
                vizSection.classList.add('collapsed');
                localStorage.setItem('vizSectionCollapsed', 'true');
            }
        } else {
            // Just set to collapsed state
            if (!isCollapsed) {
                vizSection.classList.add('collapsed');
                localStorage.setItem('vizSectionCollapsed', 'true');
            }
        }
    }

    handleCodeChange() {
        // Keep the active tab's content in sync with textarea
        if (typeof this._persistActiveQubiEditorToFile === 'function') {
            this._persistActiveQubiEditorToFile();
        }

        const editor = document.getElementById('qubiCode');
        if (editor) {
            this._syncSchedulingSettingFromCode(editor.value);
        }

        if (this.qubiHistory && this.activeQubiFileId && editor) {
            this.qubiHistory.scheduleRecord(this.activeQubiFileId, editor.value);
        }

        this.qubiUndo?.scheduleCodeSnapshot();

        const skipSync = this._skipDebouncedCodeToCircuitSync;
        this._skipDebouncedCodeToCircuitSync = false;

        // Debounce code changes to avoid too frequent updates
        clearTimeout(this.codeChangeDebounceTimer);
        this.codeChangeDebounceTimer = setTimeout(() => {
            if (skipSync) return;
            this.syncCodeToCircuit();
        }, this.codeChangeDebounceDelay);

        // Errors and Fix-with-QubiAI UI update via debounced syntax validation (qubiErrorStateChanged)
    }

    _readSchedulingFromCode(code) {
        if (typeof qubiExtractCodeSettings === 'function') {
            return qubiExtractCodeSettings(code).scheduling;
        }
        return null;
    }

    _syncSchedulingSettingFromCode(code, { persist = true } = {}) {
        const fromCode = this._readSchedulingFromCode(code);
        const effective = fromCode ?? 'default';

        const settings = this.getSettings();
        if (settings.codeGateParallelism === effective) return effective;

        settings.codeGateParallelism = effective;
        if (persist) {
            localStorage.setItem('quantumSimulatorSettings', JSON.stringify(settings));
        }
        return effective;
    }

    _schedulingExecutionMode(settingOrFromCode) {
        if (typeof qubiSchedulingExecutionMode === 'function') {
            return qubiSchedulingExecutionMode(settingOrFromCode);
        }
        if (settingOrFromCode === 'default' || settingOrFromCode == null) return 'always';
        return settingOrFromCode;
    }

    _focusQubiEditorAfterSchedulingLine(text) {
        const editor = document.getElementById('qubiCode');
        if (!editor) return;
        const value = String(text ?? editor.value ?? '');
        if (!/^#settings\s+Scheduling\s+"[^"]+"\n$/i.test(value)) return;

        const pos = value.length;
        editor.focus({ preventScroll: true });
        try {
            editor.setSelectionRange(pos, pos);
        } catch {
            /* ignore */
        }
        if (this.syntaxHighlighter) {
            this.syntaxHighlighter.updateHighlight();
            this.syntaxHighlighter.updateLineNumbers();
            this.syntaxHighlighter.syncScroll?.();
        }
    }

    /** On load / save: sync #settings Scheduling line with stored settings (omit when default). */
    _ensureSchedulingDirectiveInEditor() {
        const editor = document.getElementById('qubiCode');
        if (!editor || typeof qubiApplySchedulingToCode !== 'function') return;

        const { scheduling } = typeof qubiExtractCodeSettings === 'function'
            ? qubiExtractCodeSettings(editor.value)
            : { scheduling: null };

        const setting = this.getSettings().codeGateParallelism || 'default';

        if (setting !== 'default' && scheduling != null) {
            this._syncSchedulingSettingFromCode(editor.value);
        }

        const updated = qubiApplySchedulingToCode(editor.value, setting);
        if (updated === editor.value) return;

        this.setEditorCode(updated, { preserveUndo: false, adjustQubits: false });
        this._focusQubiEditorAfterSchedulingLine(updated);
        if (typeof this._persistActiveQubiEditorToFile === 'function') {
            this._persistActiveQubiEditorToFile();
        }
    }

    _applySchedulingSettingToEditor(mode) {
        const editor = document.getElementById('qubiCode');
        if (!editor || typeof qubiApplySchedulingToCode !== 'function') return;

        const updated = qubiApplySchedulingToCode(editor.value, mode);
        if (updated === editor.value) return;

        this.setEditorCode(updated, { preserveUndo: false, adjustQubits: false });
        this._focusQubiEditorAfterSchedulingLine(updated);
        if (typeof this._persistActiveQubiEditorToFile === 'function') {
            this._persistActiveQubiEditorToFile();
        }
    }

    syncCodeToCircuit(opts = {}) {
        if (this.isUpdatingFromCircuit) return; // Prevent circular updates

        const rawCode = document.getElementById('qubiCode').value;
        this._syncSchedulingSettingFromCode(rawCode);
        const extracted = typeof qubiExtractCodeSettings === 'function'
            ? qubiExtractCodeSettings(rawCode)
            : { scheduling: null, code: rawCode };
        const code = extracted.code;
        const errorEl = document.getElementById('qubiErrors');

        if (this.syntaxHighlighter && !opts.skipValidation) {
            this.syntaxHighlighter.validateLines();
        }

        // Check for errors first
        const hasErrors = this.hasCodeErrors();
        if (hasErrors) {
            return; // Don't update circuit if there are errors
        }

        try {
            this.isUpdatingFromCode = true;
            const resolveImport = (filename) => {
                const want = String(filename ?? '').trim().toLowerCase();
                if (!want) return null;
                const hit = (this.qubiFiles || []).find(f => String(f.name || '').trim().toLowerCase() === want);
                return hit ? String(hit.code || '') : null;
            };

            const hasDefineDirective = /^\s*#define\b/im.test(rawCode);
            const customList = document.querySelector('.gate-list[data-gate-list="custom"]');
            if (hasDefineDirective && customList) {
                customList.innerHTML = '';
            }

            const activeDefines = new Set();

            const onDefineGate = hasDefineDirective ? (gateName, displayName, colorId) => {
                try {
                    const t = String(gateName).toUpperCase();
                    activeDefines.add(t);

                    if (this.syntaxHighlighter && this.syntaxHighlighter.validGates) {
                        this.syntaxHighlighter.validGates.add(t);
                    }

                    const resolvedColor = (colorId && this.defineColorMap[colorId])
                        ? this.defineColorMap[colorId]
                        : (this.customGateMeta[t]?.colorBg ? { bg: this.customGateMeta[t].colorBg, glow: this.customGateMeta[t].colorGlow } : this.defaultCustomColor);

                    const existingMeta = this.customGateMeta[t];
                    const finalDisplayName = displayName || existingMeta?.displayName || t;

                    this.customGateMeta[t] = {
                        label: t,
                        colorBg: resolvedColor.bg,
                        colorGlow: resolvedColor.glow,
                        displayName: finalDisplayName
                    };

                    const palette = document.querySelector('.gate-palette');
                    if (palette) {
                        let category = palette.querySelector('.gate-category[data-category="custom"]');
                        if (!category) {
                            category = document.createElement('div');
                            category.className = 'gate-category';
                            category.dataset.category = 'custom';
                            category.innerHTML = `<h3 class="category-title">Custom Gates</h3><div class="gate-list" data-gate-list="custom"></div>`;
                            palette.insertBefore(category, palette.firstChild);
                        }
                        const list = category.querySelector('.gate-list[data-gate-list="custom"]');
                        if (list) {
                            const prev = list.querySelector(`.gate-item[data-gate="${t}"]`);
                            if (prev) prev.remove();
                            const item = document.createElement('div');
                            item.className = 'gate-item custom-gate';
                            item.dataset.gate = t;
                            item.draggable = true;
                            this._setGateItemDraggable(item);
                            item.style.setProperty('--gate-custom-bg', resolvedColor.bg);
                            item.style.setProperty('--gate-custom-glow', resolvedColor.glow);
                            const symLabelText = t.slice(0, 4);
                            item.innerHTML = `<span class="gate-symbol"><span class="gate-symbol-label">${symLabelText}</span></span><span class="gate-name" aria-hidden="true">${finalDisplayName}</span><button class="gate-info-icon" data-gate="${t}" type="button" title="Gate Information">ℹ</button>`;
                            item.setAttribute('aria-label', finalDisplayName);
                            const symLabel = item.querySelector('.gate-symbol-label');
                            if (symLabel) fitGateLabel(symLabel, symLabelText);
                            list.appendChild(item);
                        }
                    }
                } catch { /* ignore */ }
            } : undefined;

            this.qubiExecutor.execute(rawCode, {
                maxQubits: this.getSettings().maxQubits || 12,
                codeGateParallelism: extracted.scheduling
                    ?? this._schedulingExecutionMode(this.getSettings().codeGateParallelism),
                resolveImport,
                onDefineGate,
            });

            if (hasDefineDirective && activeDefines.size === 0) {
                const cat = document.querySelector('.gate-category[data-category="custom"]');
                if (cat) cat.remove();
            }

            if (this.syntaxHighlighter && hasDefineDirective) {
                this.syntaxHighlighter.debouncedValidation?.();
            }

            document.getElementById('qubitCount').value = formatQubitCountLabel(this.circuit.numQubits);

            this.renderCircuit();
            errorEl.textContent = '';
            errorEl.classList.remove('has-error');

            if (opts.layoutOnly) {
                return;
            }

            this.updateVisualization();
            this.resetExecution();

            const settings = this.getSettings();
            if (settings.autoRun && !opts.suppressAutoRun) {
                this._runCircuitCore();
            }
        } catch (error) {
            // Route runtime/preprocess errors through the line-number hover system
            if (this.syntaxHighlighter) {
                const msg = error.message || String(error);
                const lines = code.split('\n');
                let matched = false;
                // Try to find the offending line by matching directive name or gate name in the error
                const defineRef = msg.match(/^#define\s+(\S+)/i);
                const importRef = msg.match(/^#(?:import|include)\s+(\S+)/i);
                if (defineRef) {
                    const name = defineRef[1].replace(/:$/, '');
                    for (let i = 0; i < lines.length; i++) {
                        if (new RegExp(`^\\s*#define\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lines[i])) {
                            this.syntaxHighlighter.lineErrors.set(i, msg);
                            matched = true;
                            break;
                        }
                    }
                } else if (importRef) {
                    const file = importRef[1].replace(/:$/, '');
                    for (let i = 0; i < lines.length; i++) {
                        if (new RegExp(`^\\s*#(?:import|include)\\s+${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(lines[i])) {
                            this.syntaxHighlighter.lineErrors.set(i, msg);
                            matched = true;
                            break;
                        }
                    }
                }
                if (!matched && error.qubiLine != null) {
                    this.syntaxHighlighter.lineErrors.set(error.qubiLine, msg);
                    matched = true;
                }
                if (!matched) {
                    // Attach to the last non-empty line as fallback
                    for (let i = lines.length - 1; i >= 0; i--) {
                        if (lines[i].trim()) { this.syntaxHighlighter.lineErrors.set(i, msg); break; }
                    }
                }
                this.syntaxHighlighter.updateLineNumbers();
                this.syntaxHighlighter.updateHighlightImmediate();
            }
            errorEl.textContent = '';
            errorEl.classList.remove('has-error');
        } finally {
            this.isUpdatingFromCode = false;
        }
    }

    syncCircuitToCode() {
        if (this.isUpdatingFromCode) return; // Prevent circular updates

        const existingCode = document.getElementById('qubiCode').value;

        // Preserve #define and #import / #include lines — they aren't part of the circuit gate list
        const existingLines = existingCode.split('\n');
        const preprocessorLines = [];
        const codeWithoutPreprocessor = [];
        for (const line of existingLines) {
            if (/^\s*#(define|import|include|settings)\b/i.test(line)) {
                preprocessorLines.push(line);
            } else {
                codeWithoutPreprocessor.push(line);
            }
        }

        const generated = this.qubiExecutor.generateCode(this.circuit, codeWithoutPreprocessor.join('\n'));

        const finalCode = preprocessorLines.length > 0
            ? preprocessorLines.join('\n') + '\n' + generated
            : generated;

        this.setEditorCode(finalCode, { preserveUndo: false, adjustQubits: false, focus: false });

        this.updateErrorState();
        this.qubiUndo?.recordSnapshot();
        this._recordQubiVersionSnapshot({ kind: 'edit', label: 'Circuit edit' });
    }

    hasCodeErrors() {
        if (!this.syntaxHighlighter) {
            // Fallback: check if error display is showing
            const errorEl = document.getElementById('qubiErrors');
            return errorEl && errorEl.classList.contains('has-error');
        }
        return this.syntaxHighlighter.lineErrors && this.syntaxHighlighter.lineErrors.size > 0;
    }

    updateErrorState() {
        const runBtn = document.getElementById('runBtn');
        const hasErrors = this.hasCodeErrors();
        const fixBtn = document.getElementById('fixWithQubiAiBtn');

        if (runBtn) {
            if (hasErrors) {
                runBtn.disabled = true;
                runBtn.classList.add('has-error');
                runBtn.title = 'Fix errors in Qubi code before running circuit';
            } else {
                runBtn.disabled = false;
                runBtn.classList.remove('has-error');
                runBtn.title = 'Run Circuit';
            }
        }

        if (fixBtn) {
            fixBtn.style.display = hasErrors ? '' : 'none';
            fixBtn.disabled = !hasErrors;
            fixBtn.title = hasErrors ? 'Prefill QubiAI with error details so you can generate a fix' : '';
        }
    }

    getFirstCodeError() {
        if (!this.syntaxHighlighter || !this.syntaxHighlighter.lineErrors) return null;
        let bestLine = null;
        let bestMsg = null;
        for (const [line, msg] of this.syntaxHighlighter.lineErrors.entries()) {
            if (bestLine == null || line < bestLine) {
                bestLine = line;
                bestMsg = msg;
            }
        }
        if (bestLine == null || !bestMsg) return null;
        return { line: bestLine, message: String(bestMsg) };
    }

    prefillQubiAiForFix() {
        const err = this.getFirstCodeError();
        if (!err) return;

        const input = document.getElementById('qubiAiInput');
        const btn = document.getElementById('qubiAiBtn');
        const charcount = document.getElementById('qubiAiCharcount');
        const editor = document.getElementById('qubiCode');
        if (!input || !btn || !editor) return;

        const MAX = parseInt(input.getAttribute('maxlength') || '300', 10) || 300;
        const codeLines = (editor.value || '').split(/\r?\n/);
        const snippetStart = Math.max(0, err.line);
        const snippet = codeLines.slice(snippetStart).join('\n');

        let prompt =
            `Fix this Qubi code error.\n` +
            `Error: line ${err.line + 1} — ${err.message}\n` +
            `Code (from that line):\n` +
            snippet;

        if (prompt.length > MAX) {
            prompt = prompt.slice(0, MAX - 1);
        }

        input.value = prompt;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus({ preventScroll: false });

        // Nudge the user to hit Generate.
        btn.classList.add('attention');
        window.setTimeout(() => btn.classList.remove('attention'), 2600);
        if (charcount) {
            const len = input.value.length;
            charcount.textContent = `${len} / ${MAX}`;
            charcount.classList.toggle('at-limit', len >= MAX);
        }
    }

    async saveQubiFile() {
        const code = document.getElementById('qubiCode').value;
        if (!code.trim()) {
            return;
        }

        const active = this.qubiFiles.find(f => f.id === this.activeQubiFileId) || { name: 'circuit.qubi' };
        const suggestedName = active.name || 'circuit.qubi';

        // Try using the File System Access API for save dialog
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName,
                    types: [{
                        description: 'QUBI File',
                        accept: { 'text/plain': ['.qubi'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(code);
                await writable.close();
            } catch (err) {
                // User cancelled the save dialog
                if (err.name !== 'AbortError') {
                    console.error('Save failed:', err);
                }
            }
        } else {
            // Fallback for browsers that don't support File System Access API
            const blob = new Blob([code], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = suggestedName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    loadQubiFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (typeof this._persistActiveQubiEditorToFile === 'function') {
                this._persistActiveQubiEditorToFile();
            }

            const loadedCode = String(e.target.result || '');
            const fileName = file.name ? String(file.name) : 'imported.qubi';
            const prevActiveId = this.activeQubiFileId;
            this.qubiUndo?.flushPending(prevActiveId);

            const existing = this.qubiFiles.find(f => f.name.toLowerCase() === fileName.toLowerCase());
            let targetFile;
            if (existing) {
                targetFile = existing;
            } else {
                const id = `file_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
                targetFile = { id, name: fileName, code: '' };
                this.qubiFiles.push(targetFile);
            }

            this.activeQubiFileId = targetFile.id;

            if (typeof this._renderQubiTabs === 'function') {
                this._renderQubiTabs();
            }

            // Show the tab's pre-load content first so undo captures the right "before" state.
            this.setEditorCode(targetFile.code, { preserveUndo: false, adjustQubits: false, focus: false });
            this.qubiUndo?.beginExternalChange();

            targetFile.code = loadedCode;
            this.setEditorCode(loadedCode, { preserveUndo: false, adjustQubits: true, focus: false });
            this.syncCodeToCircuit();
            if (typeof this._persistActiveQubiEditorToFile === 'function') {
                this._persistActiveQubiEditorToFile();
            }
            this.qubiUndo?.finishExternalChange();

            this._recordQubiVersionSnapshot({
                kind: 'load',
                label: 'Loaded from file',
                force: true
            });

            const errorEl = document.getElementById('qubiErrors');
            errorEl.textContent = '';
            errorEl.classList.remove('has-error');
        };
        reader.onerror = () => {
            this.showAlert(['Error reading file. Please try again.']);
        };
        reader.readAsText(file);

        // Reset the input so the same file can be loaded again
        event.target.value = '';
    }

    _mergeLoadedQubiFiles(loadedFiles, { activateName = null } = {}) {
        if (!Array.isArray(loadedFiles) || loadedFiles.length === 0) return;

        if (typeof this._persistActiveQubiEditorToFile === 'function') {
            this._persistActiveQubiEditorToFile();
        }

        const prevActiveId = this.activeQubiFileId;
        this.qubiUndo?.flushPending(prevActiveId);

        const byNameLower = new Map((this.qubiFiles || []).map(f => [String(f.name || '').toLowerCase(), f]));
        const merged = [];

        for (const lf of loadedFiles) {
            const name = String(lf.name || '').trim() || 'imported.qubi';
            const code = String(lf.code || '');
            const key = name.toLowerCase();
            const existing = byNameLower.get(key);
            if (existing) {
                const beforeCode = String(existing.code || '');
                existing.code = code;
                merged.push({ file: existing, beforeCode, afterCode: code });
                this.qubiHistory?.recordImmediate(existing.id, code, {
                    kind: 'load',
                    label: 'Loaded from archive',
                    force: true
                });
                continue;
            }
            const id = `file_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
            const created = { id, name, code };
            this.qubiFiles.push(created);
            merged.push({ file: created, beforeCode: '', afterCode: code });
            this.qubiHistory?.ensureFile(id, code);
            byNameLower.set(key, created);
        }

        let activate = null;
        if (activateName) {
            activate = (this.qubiFiles || []).find(f => String(f.name || '').toLowerCase() === String(activateName).toLowerCase());
        }
        if (!activate) {
            activate = (this.qubiFiles || []).find(f => String(f.name || '').toLowerCase() === 'main.qubi') || (this.qubiFiles || [])[0];
        }
        if (activate) this.activeQubiFileId = activate.id;

        if (typeof this._renderQubiTabs === 'function') this._renderQubiTabs();

        const activeMerge = merged.find((m) => m.file.id === this.activeQubiFileId);
        if (activeMerge) {
            this.setEditorCode(activeMerge.beforeCode, { preserveUndo: false, adjustQubits: false, focus: false });
            this.qubiUndo?.beginExternalChange();
            this.setEditorCode(activeMerge.afterCode, { preserveUndo: false, adjustQubits: true, focus: false });
            this.syncCodeToCircuit();
            if (typeof this._persistActiveQubiEditorToFile === 'function') {
                this._persistActiveQubiEditorToFile();
            }
            this.qubiUndo?.finishExternalChange();
        } else if (typeof this._loadActiveQubiFileIntoEditor === 'function') {
            this._loadActiveQubiFileIntoEditor({ preserveUndo: false });
            this.syncCodeToCircuit();
        }

        for (const { file, beforeCode, afterCode } of merged) {
            if (file.id === this.activeQubiFileId) continue;
            this.qubiUndo?.recordExternalChangeForFile(file.id, beforeCode, afterCode);
        }

        this.qubiUndo?.updateControls();
    }

    async saveQubiZip() {
        // Persist current editor contents into the active file first.
        if (typeof this._persistActiveQubiEditorToFile === 'function') this._persistActiveQubiEditorToFile();

        const files = (this.qubiFiles || []).filter(f => f && f.name);
        if (!files.length) return;

        const JSZipLib = (typeof window !== 'undefined' && window.JSZip) ? window.JSZip : null;
        if (!JSZipLib) {
            this.showAlert(['Zip support is not available (JSZip not loaded).']);
            return;
        }

        const zip = new JSZipLib();
        const safeName = (n) => {
            let s = String(n || '').trim() || 'file.qubi';
            s = s.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            if (!/\.qubi$/i.test(s)) s += '.qubi';
            return s;
        };

        const used = new Set();
        for (const f of files) {
            let n = safeName(f.name);
            const stem = n.replace(/\.qubi$/i, '');
            if (used.has(n.toLowerCase())) {
                for (let i = 2; i < 200; i++) {
                    const cand = `${stem}${i}.qubi`;
                    if (!used.has(cand.toLowerCase())) { n = cand; break; }
                }
            }
            used.add(n.toLowerCase());
            zip.file(n, String(f.code || ''));
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const suggested = `qubi-project-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;

        // Try File System Access API, else classic download.
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggested,
                    types: [{ description: 'Zip archive', accept: { 'application/zip': ['.zip'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            } catch (err) {
                // Cancel means do nothing (no fallback download).
                if (err && err.name === 'AbortError') return;
                console.error('Zip save failed:', err);
            }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = suggested;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Write all open .qubi tabs into a user-chosen folder (Chromium File System Access API).
     */
    async saveQubiFolder() {
        if (typeof this._persistActiveQubiEditorToFile === 'function') this._persistActiveQubiEditorToFile();

        const files = (this.qubiFiles || []).filter(f => f && f.name);
        if (!files.length) return;

        if (!('showDirectoryPicker' in window)) {
            this.showAlert([
                'Saving to a folder is not supported in this browser.',
                'Use "As zip (.zip)" to export all tabs instead.'
            ]);
            return;
        }

        const safeName = (n) => {
            let s = String(n || '').trim() || 'file.qubi';
            s = s.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
            if (!/\.qubi$/i.test(s)) s += '.qubi';
            return s;
        };

        const used = new Set();
        const entries = [];
        for (const f of files) {
            let n = safeName(f.name);
            const stem = n.replace(/\.qubi$/i, '');
            if (used.has(n.toLowerCase())) {
                for (let i = 2; i < 200; i++) {
                    const cand = `${stem}${i}.qubi`;
                    if (!used.has(cand.toLowerCase())) { n = cand; break; }
                }
            }
            used.add(n.toLowerCase());
            entries.push({ name: n, code: String(f.code || '') });
        }

        try {
            const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            for (const { name, code } of entries) {
                const fh = await dirHandle.getFileHandle(name, { create: true });
                const writable = await fh.createWritable();
                await writable.write(code);
                await writable.close();
            }
        } catch (err) {
            if (err && err.name === 'AbortError') return;
            console.error('Save folder failed:', err);
            this.showAlert(['Could not save to that folder. Check permissions or try "As zip (.zip)".']);
        }
    }

    async loadQubiFolder() {
        // Prefer modern directory picker if available.
        if ('showDirectoryPicker' in window) {
            try {
                const dir = await window.showDirectoryPicker();
                const loaded = [];
                for await (const entry of dir.values()) {
                    if (!entry || entry.kind !== 'file') continue;
                    if (!/\.qubi$/i.test(entry.name)) continue;
                    const file = await entry.getFile();
                    const code = await file.text();
                    loaded.push({ name: entry.name, code });
                }
                this._mergeLoadedQubiFiles(loaded);
                return;
            } catch (err) {
                // Cancelled or not permitted, fall back to input.
                if (err && err.name !== 'AbortError') console.warn('Folder picker failed:', err);
            }
        }

        const input = document.getElementById('qubiFolderInput');
        if (input) input.click();
    }

    loadQubiFolderFromInput(event) {
        const files = Array.from(event?.target?.files || []);
        if (!files.length) return;

        const loaded = [];
        let pending = files.length;

        const done = () => {
            pending--;
            if (pending <= 0) {
                // Prefer main.qubi if present in the folder.
                const hasMain = loaded.some(f => String(f.name || '').toLowerCase() === 'main.qubi');
                this._mergeLoadedQubiFiles(loaded, { activateName: hasMain ? 'main.qubi' : null });
                event.target.value = '';
            }
        };

        for (const file of files) {
            if (!file || !/\.qubi$/i.test(file.name)) { done(); continue; }
            const reader = new FileReader();
            reader.onload = (e) => {
                loaded.push({ name: file.name, code: String(e?.target?.result || '') });
                done();
            };
            reader.onerror = () => {
                done();
            };
            reader.readAsText(file);
        }
    }

    async loadQubiZipFromInput(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;

        try {
            const JSZipLib = (typeof window !== 'undefined' && window.JSZip) ? window.JSZip : null;
            if (!JSZipLib) {
                this.showAlert(['Zip support is not available (JSZip not loaded).']);
                return;
            }

            const buf = await file.arrayBuffer();
            const zip = await JSZipLib.loadAsync(buf);
            const loaded = [];

            const names = Object.keys(zip.files || {});
            for (const name of names) {
                const entry = zip.files[name];
                if (!entry || entry.dir) continue;
                if (!/\.qubi$/i.test(name)) continue;
                // Only keep leaf name (folder structure is not represented as tabs right now).
                const leaf = String(name).split('/').pop() || name;
                const text = await entry.async('text');
                loaded.push({ name: leaf, code: String(text || '') });
            }

            const hasMain = loaded.some(f => String(f.name || '').toLowerCase() === 'main.qubi');
            this._mergeLoadedQubiFiles(loaded, { activateName: hasMain ? 'main.qubi' : null });
        } catch (err) {
            console.error('Zip load failed:', err);
            this.showAlert(['Could not load zip. Make sure it contains .qubi files.']);
        } finally {
            // Reset so same zip can be loaded again.
            event.target.value = '';
        }
    }

    showAlgorithmsModal() {
        const modal = document.getElementById('algorithmsModal');
        const list = document.getElementById('algorithmsList');
        const paramsDiv = document.getElementById('algorithmParams');
        const detailDiv = document.getElementById('algorithmDetail');
        const commentsCheckbox = document.getElementById('includeCommentsCheckbox');

        list.innerHTML = '';
        paramsDiv.style.display = 'none';
        if (detailDiv) detailDiv.style.display = 'none';
        if (commentsCheckbox) commentsCheckbox.checked = true;

        if (commentsCheckbox && !commentsCheckbox._qubiPreviewBound) {
            commentsCheckbox._qubiPreviewBound = true;
            commentsCheckbox.addEventListener('change', () => {
                const d = document.getElementById('algorithmDetail');
                if (d && d.style.display !== 'none') {
                    this.updateAlgorithmCodePreview();
                }
            });
        }

        // Setup search
        const searchInput = document.getElementById('algoSearchInput');
        if (searchInput) {
            searchInput.value = '';
            searchInput.oninput = () => this._filterAlgorithmsList(searchInput.value);
        }

        this._buildAlgorithmsList('');
        modal.classList.add('active');
    }

    _buildAlgorithmsList(filter) {
        const list = document.getElementById('algorithmsList');
        list.innerHTML = '';

        const filterLower = filter.toLowerCase().trim();

        // Group algorithms by category
        const categories = {};
        Object.entries(QuantumAlgorithms).forEach(([key, algo]) => {
            // Filter check
            if (filterLower) {
                const searchable = `${algo.name} ${algo.description} ${algo.category || ''} ${algo.icon || ''}`.toLowerCase();
                if (!searchable.includes(filterLower)) return;
            }
            const cat = algo.category || 'Other';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ key, algo });
        });

        const categoryOrder = ['Entanglement', 'Algorithm', 'Communication', 'Concept', 'Error Correction'];
        const categoryIcons = {
            'Entanglement': 'link',
            'Communication': 'satellite_dish',
            'Algorithm': 'gear',
            'Concept': 'lightbulb',
            'Error Correction': 'shield'
        };
        const iconHtml = (key, wrapClass) => (
            typeof simIconHtml === 'function'
                ? simIconHtml(key, { wrapClass })
                : ''
        );

        let totalResults = 0;
        categoryOrder.forEach(catName => {
            if (!categories[catName]) return;
            totalResults += categories[catName].length;
            const section = document.createElement('div');
            section.className = 'algo-category-section';
            section.innerHTML = `<div class="algo-category-header">${iconHtml(categoryIcons[catName] || 'box', 'sim-icon-wrap sim-icon-wrap--algo-cat algo-category-icon')}<span>${catName}</span></div>`;
            const grid = document.createElement('div');
            grid.className = 'algo-category-grid';

            categories[catName].forEach(({ key, algo }) => {
                const qubitsDisplay = algo.qubitRange || algo.qubits;
                const item = document.createElement('div');
                item.className = 'algorithm-item';
                item.dataset.algoKey = key;
                item.innerHTML = `
                    <div class="algo-item-icon">${iconHtml(algo.icon || 'atom', 'sim-icon-wrap sim-icon-wrap--algo-item')}</div>
                    <div class="algo-item-content">
                        <h4>${algo.name}</h4>
                        <p>${algo.description}</p>
                        <div class="algo-item-meta">
                            <span class="algo-qubits">${qubitsDisplay} qubits</span>
                            ${algo.complexity ? `<span class="algo-complexity">${algo.complexity}</span>` : ''}
                        </div>
                    </div>
                `;
                item.addEventListener('click', () => {
                    list.querySelectorAll('.algorithm-item.selected').forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                    this.showAlgorithmDetail(key, algo);
                });
                grid.appendChild(item);
            });
            section.appendChild(grid);
            list.appendChild(section);
        });

        if (totalResults === 0 && filterLower) {
            const emptyIcon = typeof simIconHtml === 'function'
                ? simIconHtml('magnifying_glass', { wrapClass: 'sim-icon-wrap sim-icon-wrap--algo-empty' })
                : '';
            list.innerHTML = `<div class="algo-no-results">${emptyIcon}<p>No algorithms match "${filter}"</p></div>`;
        }
    }

    _filterAlgorithmsList(filter) {
        const detailDiv = document.getElementById('algorithmDetail');
        if (detailDiv) detailDiv.style.display = 'none';
        this._buildAlgorithmsList(filter);
    }

    showAlgorithmDetail(key, algo) {
        let detailDiv = document.getElementById('algorithmDetail');
        if (!detailDiv) {
            detailDiv = document.createElement('div');
            detailDiv.id = 'algorithmDetail';
            detailDiv.className = 'algorithm-detail';
            const list = document.getElementById('algorithmsList');
            list.parentNode.insertBefore(detailDiv, list.nextSibling);
        }
        detailDiv.style.display = 'block';

        const settings = this.getSettings();
        const maxQubits = settings.maxQubits || 12;

        const qubitsDisplay = algo.qubitRange || algo.qubits;

        let insightsHtml = '';
        if (algo.keyInsights && algo.keyInsights.length > 0) {
            insightsHtml = `<div class="algo-insights"><h5>Key Insights</h5><ul>${algo.keyInsights.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
        }

        let paramsHtml = '';
        if (algo.parameterizable && algo.parameters) {
            paramsHtml = '<div class="algo-params-section"><h5>Parameters</h5>';
            algo.parameters.forEach(param => {
                let effectiveMax = param.max;
                if (param.key === 'numQubits') {
                    effectiveMax = Math.min(param.max || maxQubits, maxQubits);
                } else if (param.key === 'numInputs') {
                    effectiveMax = Math.min(param.max || maxQubits - 1, maxQubits - 1);
                }
                paramsHtml += `<div class="algo-param-group">`;
                paramsHtml += `<label for="param_${param.key}">${param.name}</label>`;
                if (param.type === 'select' && param.options) {
                    paramsHtml += `<select id="param_${param.key}" class="algo-param-select">`;
                    param.options.forEach(opt => {
                        paramsHtml += `<option value="${opt.value}" ${opt.value === param.default ? 'selected' : ''}>${opt.label}</option>`;
                    });
                    paramsHtml += `</select>`;
                } else if (param.type === 'number') {
                    const val = Math.min(param.default, effectiveMax || param.default);
                    paramsHtml += `<input type="number" id="param_${param.key}" value="${val}" ${param.min !== undefined ? `min="${param.min}"` : ''} ${effectiveMax !== undefined ? `max="${effectiveMax}"` : ''} class="algo-param-input">`;
                } else {
                    paramsHtml += `<input type="text" id="param_${param.key}" value="${param.default}" class="algo-param-input">`;
                }
                paramsHtml += `</div>`;
            });
            paramsHtml += '</div>';
        }

        const detailIcon = typeof simIconHtml === 'function'
            ? simIconHtml(algo.icon || 'atom', { wrapClass: 'sim-icon-wrap sim-icon-wrap--algo-detail' })
            : '';

        detailDiv.innerHTML = `
            <div class="algo-detail-header">
                <span class="algo-detail-icon">${detailIcon}</span>
                <div>
                    <h4>${algo.name}</h4>
                    <span class="algo-detail-category">${algo.category || 'General'}</span>
                </div>
            </div>
            <div class="algo-detail-stats">
                <div class="algo-stat"><span class="algo-stat-label">Qubits</span><span class="algo-stat-value">${qubitsDisplay}</span></div>
                ${algo.complexity ? `<div class="algo-stat"><span class="algo-stat-label">Complexity</span><span class="algo-stat-value">${algo.complexity}</span></div>` : ''}
            </div>
            ${paramsHtml}
            <div class="algo-code-preview-section" id="algoCodePreviewSection">
                <label class="checkbox-label algo-preview-toggle">
                    <input type="checkbox" id="algoShowCodePreview" checked>
                    <span>Show Qubi preview before loading</span>
                </label>
                <pre class="algo-code-preview-pre" id="algoCodePreviewPre" role="region" aria-label="Generated Qubi code preview"></pre>
                <p class="algo-preview-note" id="algoPreviewNote" role="status"></p>
            </div>
            <div class="algo-detail-actions">
                <button class="btn btn-primary algo-load-btn" id="algoLoadBtn">Load into editor</button>
            </div>
            <p class="algo-detail-description">${algo.longDescription || algo.description}</p>
            ${insightsHtml}
        `;

        detailDiv.dataset.algorithmKey = key;
        document.getElementById('algoLoadBtn').addEventListener('click', () => {
            this.confirmAlgorithmLoad();
        });

        const showPreviewCb = document.getElementById('algoShowCodePreview');
        if (showPreviewCb) {
            showPreviewCb.addEventListener('change', () => this.updateAlgorithmCodePreview());
        }
        if (algo.parameterizable && algo.parameters) {
            algo.parameters.forEach(param => {
                const el = document.getElementById(`param_${param.key}`);
                if (el) {
                    el.addEventListener('input', () => this.updateAlgorithmCodePreview());
                    el.addEventListener('change', () => this.updateAlgorithmCodePreview());
                }
            });
        }
        this.updateAlgorithmCodePreview();
    }

    updateAlgorithmCodePreview() {
        const detailDiv = document.getElementById('algorithmDetail');
        const pre = document.getElementById('algoCodePreviewPre');
        const note = document.getElementById('algoPreviewNote');
        const showCb = document.getElementById('algoShowCodePreview');
        if (!detailDiv || !pre || !note || !showCb) return;

        const algoKey = detailDiv.dataset.algorithmKey;
        if (!algoKey || !QuantumAlgorithms[algoKey]) return;

        const algo = QuantumAlgorithms[algoKey];
        const settings = this.getSettings();
        const maxQubits = settings.maxQubits || 12;
        const commentsCheckbox = document.getElementById('includeCommentsCheckbox');
        const withComments = commentsCheckbox ? commentsCheckbox.checked : false;

        if (!showCb.checked) {
            pre.style.display = 'none';
            pre.classList.remove('preview-error', 'qubi-syntax-preview');
            pre.innerHTML = '';
            note.textContent = '';
            return;
        }
        pre.style.display = 'block';

        const params = {};
        if (algo.parameterizable && algo.parameters) {
            algo.parameters.forEach(param => {
                const input = document.getElementById(`param_${param.key}`);
                if (!input) {
                    params[param.key] = param.default;
                    return;
                }
                if (param.type === 'number') {
                    params[param.key] = parseInt(input.value, 10) || param.default;
                } else {
                    params[param.key] = input.value || param.default;
                }
            });
        }

        const validationErrors = validateQuantumAlgorithmParams(algoKey, params, maxQubits);
        if (validationErrors.length > 0) {
            pre.classList.remove('qubi-syntax-preview');
            pre.innerHTML = '';
            pre.textContent = validationErrors.join('\n');
            pre.classList.add('preview-error');
            note.textContent = 'Fix parameters to update preview.';
            return;
        }

        const result = computeQuantumAlgorithmCode(algoKey, params, withComments);
        if (result.error) {
            pre.classList.remove('qubi-syntax-preview');
            pre.innerHTML = '';
            pre.textContent = result.error;
            pre.classList.add('preview-error');
            note.textContent = '';
            return;
        }
        if (result.qubits > maxQubits) {
            pre.classList.remove('qubi-syntax-preview');
            pre.innerHTML = '';
            pre.textContent = `This example needs ${result.qubits} qubits; your limit is ${maxQubits} (Settings).`;
            pre.classList.add('preview-error');
            note.textContent = '';
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
        note.textContent = `${result.qubits} qubit${result.qubits === 1 ? '' : 's'} · ready to load`;
    }

    showAlgorithmParams(algo) {
        // Now handled by showAlgorithmDetail
        const key = Object.keys(QuantumAlgorithms).find(k => QuantumAlgorithms[k] === algo);
        this.showAlgorithmDetail(key, algo);
    }

    validateAlgorithmParams(algoKey, params) {
        const settings = this.getSettings();
        const maxQubits = settings.maxQubits || 12;
        return validateQuantumAlgorithmParams(algoKey, params, maxQubits);
    }

    confirmAlgorithmLoad() {
        const detailDiv = document.getElementById('algorithmDetail');
        const algoKey = detailDiv ? detailDiv.dataset.algorithmKey : null;
        if (!algoKey) return;

        const algo = QuantumAlgorithms[algoKey];
        const commentsCheckbox = document.getElementById('includeCommentsCheckbox');
        const withComments = commentsCheckbox ? commentsCheckbox.checked : false;
        const settings = this.getSettings();
        const maxQubits = settings.maxQubits || 12;

        const params = {};
        if (algo.parameterizable && algo.parameters) {
            algo.parameters.forEach(param => {
                const input = document.getElementById(`param_${param.key}`);
                if (!input) {
                    params[param.key] = param.default;
                    return;
                }
                if (param.type === 'number') {
                    params[param.key] = parseInt(input.value, 10) || param.default;
                } else {
                    params[param.key] = input.value || param.default;
                }
            });
        }

        const validationErrors = this.validateAlgorithmParams(algoKey, params);
        if (validationErrors.length > 0) {
            this.showAlert(validationErrors);
            return;
        }

        const result = computeQuantumAlgorithmCode(algoKey, params, withComments);
        if (result.error) {
            this.showAlert([result.error]);
            return;
        }
        if (result.qubits > maxQubits) {
            this.showAlert([`This algorithm requires ${result.qubits} qubits, but your max qubit limit is ${maxQubits}. You can increase this in Settings.`]);
            return;
        }

        this.loadAlgorithm(
            { code: result.code, qubits: result.qubits },
            false,
            { label: `Loaded ${algo.name}` }
        );

        document.getElementById('algorithmsModal').classList.remove('active');
        if (detailDiv) detailDiv.style.display = 'none';
    }

    loadAlgorithm(algo, checkComments = true, historyMeta = {}) {
        // Determine which code to load
        let codeToLoad = algo.code;
        if (checkComments) {
            const commentsCheckbox = document.getElementById('includeCommentsCheckbox');
            const withComments = commentsCheckbox ? commentsCheckbox.checked : false;
            if (withComments && algo.codeWithComments) {
                codeToLoad = algo.codeWithComments;
            }
        }

        this.qubiUndo?.beginExternalChange();

        this.setEditorCode(codeToLoad, { preserveUndo: false, adjustQubits: true, focus: false });

        // Sync code to circuit (this will execute the code)
        this.syncCodeToCircuit();
        if (typeof this._persistActiveQubiEditorToFile === 'function') {
            this._persistActiveQubiEditorToFile();
        }
        this.qubiUndo?.finishExternalChange();
        this._recordQubiVersionSnapshot({
            kind: 'load',
            label: historyMeta.label || 'Loaded example',
            force: true
        });
    }

    showAlert(messages) {
        const container = document.querySelector('.algo-detail-actions');
        if (!container) return;

        const existing = container.querySelector('.sim-inline-alert');
        if (existing) existing.remove();

        const msgArray = Array.isArray(messages) ? messages : [messages];
        const el = document.createElement('div');
        el.className = 'sim-inline-alert';
        el.innerHTML = msgArray.map(m => `<p class="sim-inline-alert-msg">⚠ ${m}</p>`).join('');
        container.appendChild(el);

        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        const content = document.getElementById('settingsContent');

        const settings = this.getSettings();

        content.innerHTML = `
            <div class="settings-section">
                <h4 class="settings-section-title">Display</h4>
                <div class="settings-grid">
                    <div class="setting-item">
                        <label for="setting_precision">Decimal Places</label>
                        <input type="number" id="setting_precision" value="${settings.precision}" min="0" max="12" class="input-number">
                        <span class="setting-hint">0-12 places for probabilities</span>
                    </div>
                    <div class="setting-item">
                        <label for="setting_maxQubits">Max Qubits</label>
                        <input type="number" id="setting_maxQubits" value="${settings.maxQubits}" min="2" max="20" class="input-number">
                        <span class="setting-hint">Circuit qubit limit</span>
                    </div>
                </div>
            </div>
            
            <div class="settings-section">
                <h4 class="settings-section-title">Results Sorting</h4>
                <div class="settings-grid">
                    <div class="setting-item">
                        <label for="setting_sortBy">Order By</label>
                        <select id="setting_sortBy" class="input-select">
                            <option value="probability" ${settings.sortBy === 'probability' ? 'selected' : ''}>Probability</option>
                            <option value="label" ${settings.sortBy === 'label' ? 'selected' : ''}>Label (|00⟩, |01⟩...)</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <label for="setting_sortOrder">Direction</label>
                        <select id="setting_sortOrder" class="input-select">
                            <option value="desc" ${settings.sortOrder === 'desc' ? 'selected' : ''}>Descending ↓</option>
                            <option value="asc" ${settings.sortOrder === 'asc' ? 'selected' : ''}>Ascending ↑</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="settings-section">
                <h4 class="settings-section-title">Behavior</h4>
                <div class="settings-toggles">
                    <label class="toggle-item">
                        <input type="checkbox" id="setting_hideNegligibles" ${settings.hideNegligibles ? 'checked' : ''}>
                        <span class="toggle-label">Hide negligible probabilities</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="setting_autoRun" ${settings.autoRun ? 'checked' : ''}>
                        <span class="toggle-label">Auto-run circuit after changes</span>
                    </label>
                    <label class="toggle-item">
                        <input type="checkbox" id="setting_showGateParams" ${settings.showGateParams ? 'checked' : ''}>
                        <span class="toggle-label">Show gate parameters on circuit</span>
                    </label>
                </div>
                <div class="settings-grid" style="margin-top: 1rem;">
                    <div class="setting-item">
                        <label for="setting_codeGateParallelism">Code gate scheduling</label>
                        <select id="setting_codeGateParallelism" class="input-select">
                            <option value="default" ${settings.codeGateParallelism === 'default' ? 'selected' : ''}>Default (always, no #settings line)</option>
                            <option value="always" ${settings.codeGateParallelism === 'always' ? 'selected' : ''}>Always (maximum parallelism)</option>
                            <option value="compressed" ${settings.codeGateParallelism === 'compressed' ? 'selected' : ''}>Compressed (per-wire backfill)</option>
                            <option value="same_gate" ${settings.codeGateParallelism === 'same_gate' ? 'selected' : ''}>Same gate type</option>
                            <option value="same_gate_continuous" ${settings.codeGateParallelism === 'same_gate_continuous' ? 'selected' : ''}>Same gate type (continuous only)</option>
                            <option value="same_line" ${settings.codeGateParallelism === 'same_line' ? 'selected' : ''}>Same line only</option>
                            <option value="never" ${settings.codeGateParallelism === 'never' ? 'selected' : ''}>Never (sequential)</option>
                        </select>
                        <span class="setting-hint">Default uses always scheduling without a <code>#settings</code> line. Other modes add <code>#settings Scheduling "…"</code> to your Qubi file.</span>
                    </div>
                </div>
            </div>
            
            <div class="settings-section">
                <h4 class="settings-section-title">Performance</h4>
                <div class="settings-toggles">
                    <label class="toggle-item">
                        <input type="checkbox" id="setting_useOptimizedGates" ${settings.useOptimizedGates ? 'checked' : ''}>
                        <span class="toggle-label">Use optimized gate implementations</span>
                    </label>
                    <span class="setting-hint" style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 1.5rem;">
                        When enabled, uses gate-specific algorithms (direct state swaps, phase flips, etc.) for faster constant factors. 
                        When disabled, uses grouped matrix multiplication (works with any gate matrix, may be slower).
                    </span>
                </div>
            </div>
        `;

        modal.classList.add('active');
    }

    _normalizeSchedulingSetting(value) {
        if (typeof qubiNormalizeSchedulingSetting === 'function') {
            return qubiNormalizeSchedulingSetting(value);
        }
        return 'default';
    }

    getSettings() {
        const stored = localStorage.getItem('quantumSimulatorSettings');
        if (stored) {
            const parsed = JSON.parse(stored);
            // Ensure new settings have defaults
            return {
                maxQubits: parsed.maxQubits ?? 12,
                autoRun: parsed.autoRun ?? false,
                showGateParams: parsed.showGateParams ?? true,
                precision: parsed.precision ?? 2,
                hideNegligibles: parsed.hideNegligibles ?? true,
                sortBy: parsed.sortBy ?? 'probability',
                sortOrder: parsed.sortOrder ?? 'desc',
                useOptimizedGates: parsed.useOptimizedGates ?? true,
                codeGateParallelism: this._normalizeSchedulingSetting(parsed.codeGateParallelism)
            };
        }
        return {
            maxQubits: 12,
            autoRun: false,
            showGateParams: true,
            precision: 2,
            hideNegligibles: true,
            sortBy: 'probability',
            sortOrder: 'desc',
            useOptimizedGates: true,
            codeGateParallelism: 'default'
        };
    }

    saveSettings() {
        const settings = {
            maxQubits: parseInt(document.getElementById('setting_maxQubits').value) || 12,
            autoRun: document.getElementById('setting_autoRun').checked,
            showGateParams: document.getElementById('setting_showGateParams').checked,
            precision: Math.min(12, Math.max(0, parseInt(document.getElementById('setting_precision').value) || 2)),
            hideNegligibles: document.getElementById('setting_hideNegligibles').checked,
            sortBy: document.getElementById('setting_sortBy').value,
            sortOrder: document.getElementById('setting_sortOrder').value,
            useOptimizedGates: document.getElementById('setting_useOptimizedGates').checked,
            codeGateParallelism: this._normalizeSchedulingSetting(
                document.getElementById('setting_codeGateParallelism').value
            )
        };

        localStorage.setItem('quantumSimulatorSettings', JSON.stringify(settings));
        document.getElementById('settingsModal').classList.remove('active');

        if (document.getElementById('qubiCode')) {
            this._applySchedulingSettingToEditor(settings.codeGateParallelism);
        }

        // Apply max qubits limit
        if (this.circuit.numQubits > settings.maxQubits) {
            this.setQubitCount(settings.maxQubits);
        }

        // Update qubit input max attribute
        this.updateQubitInputMax();

        // Apply optimization setting to circuit
        this.circuit.setOptimization(settings.useOptimizedGates);

        // Re-layout circuit from Qubi code when scheduling preference changed
        if (document.getElementById('qubiCode')) {
            this.syncCodeToCircuit({ suppressAutoRun: false });
        } else {
            this.updateVisualization();
        }
    }

    showGateInfo(gateType) {
        const modal = document.getElementById('gateInfoModal');
        const title = document.getElementById('gateInfoTitle');
        const content = document.getElementById('gateInfoContent');

        const customMeta = this.customGateMeta[gateType];
        const customK = this.getCustomGateWireCount(gateType);
        let info = getGateInfo(gateType);
        if (customMeta && typeof GateMatrices !== 'undefined' && GateMatrices[gateType]) {
            const flat = GateMatrices[gateType];
            const dim = Math.round(Math.sqrt(flat.length));
            const rows = [];
            for (let r = 0; r < dim; r++) {
                const row = [];
                for (let c = 0; c < dim; c++) {
                    const z = flat[r * dim + c];
                    if (z && typeof z === 'object' && ('re' in z || 'im' in z)) {
                        const re = z.re ?? 0;
                        const im = z.im ?? 0;
                        if (Math.abs(im) < 1e-12) row.push(re);
                        else if (Math.abs(re) < 1e-12) row.push(im === 1 ? 'i' : im === -1 ? '-i' : `${im}i`);
                        else row.push(`${re}${im >= 0 ? '+' : ''}${im}i`);
                    } else {
                        row.push(String(z));
                    }
                }
                rows.push(row);
            }
            info = {
                name: customMeta.displayName || gateType,
                matrix: rows,
                description: customK > 1
                    ? `${customK}-qubit custom unitary. Drop on the target wire, then select ${customK - 1} control wire(s).`
                    : 'Single-qubit custom unitary defined via #define.',
                category: customK > 1 ? 'Multi Qubit (Custom)' : 'Single Qubit (Custom)'
            };
        }
        title.textContent = info.name;

        const isControlFlow = gateType === 'REPEAT' || gateType === 'END';
        const isFixedMultiGate = gateType === 'SWAP' || gateType === 'CSWAP';
        const isMultiGate = ['CX', 'CY', 'CZ'].includes(gateType) || customK > 1;
        const defaultQubits = gateType === 'CSWAP' ? 3
            : (gateType === 'SWAP' ? 2
                : (customK > 1 ? customK : (isMultiGate ? 2 : 1)));

        const matrixContainerId = 'gateInfoMatrixContainer';

        let matrixSection = '';
        if (!isControlFlow && info.matrix != null) {
            const matrixHtml = typeof info.matrix === 'string'
                ? `<div class="matrix-text">${info.matrix}</div>`
                : formatMatrix(getMatrixForQubits(gateType, defaultQubits));
            matrixSection = `
                <h4>Matrix Representation:</h4>
                <div id="${matrixContainerId}" class="matrix">${matrixHtml}</div>
            `;
        }

        let qubitSlider = '';
        if (isMultiGate && !customMeta && !isFixedMultiGate) {
            qubitSlider = `
                <div class="parameter-group">
                    <label for="gateInfoQubits">Display with qubits (2-3):</label>
                    <input type="range" id="gateInfoQubits" min="2" max="3" step="1" value="${defaultQubits}">
                    <span id="gateInfoQubitsValue">${defaultQubits}</span>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="gate-info-content">
                <p><strong>Category:</strong> ${info.category}</p>
                <p class="description">${info.description}</p>
                ${qubitSlider}
                ${matrixSection}
            </div>
        `;

        if (isMultiGate && !customMeta && !isFixedMultiGate) {
            const slider = document.getElementById('gateInfoQubits');
            const valueLabel = document.getElementById('gateInfoQubitsValue');
            slider.addEventListener('input', () => {
                const currentQubits = parseInt(slider.value);
                valueLabel.textContent = currentQubits;
                const matrix = getMatrixForQubits(gateType, currentQubits);
                const matrixHtmlUpdated = typeof matrix === 'string' ? `<div class="matrix-text">${matrix}</div>` : formatMatrix(matrix);
                const container = document.getElementById(matrixContainerId);
                if (container) container.innerHTML = matrixHtmlUpdated;
            });
        }

        modal.classList.add('active');
    }

    showExportModal() {
        const modal = document.getElementById('exportModal');
        this.showFormatSelection();
        modal.classList.add('active');
    }

    closeExportModal() {
        const modal = document.getElementById('exportModal');
        modal.classList.remove('active');
        this.currentExportFormat = null;
    }

    showFormatSelection() {
        document.getElementById('exportFormatSelection').style.display = 'block';
        document.getElementById('exportPreviewView').style.display = 'none';
        this.currentExportFormat = null;
    }

    async showExportPreview(format) {
        this.currentExportFormat = format;

        // Switch views
        document.getElementById('exportFormatSelection').style.display = 'none';
        document.getElementById('exportPreviewView').style.display = 'flex';

        // Update title
        const formatTitles = { png: 'PNG Preview', svg: 'SVG Preview', pdf: 'PDF Preview' };
        document.getElementById('exportFormatTitle').textContent = formatTitles[format];

        // Generate preview
        await this.updateExportPreview();
    }

    async updateExportPreview() {
        if (!this.currentExportFormat) return;

        const previewImage = document.getElementById('exportPreviewImage');
        const previewLoading = document.getElementById('exportPreviewLoading');

        previewImage.style.display = 'none';
        previewLoading.style.display = 'flex';

        try {
            const dataUrl = await this.generatePreviewDataUrl();
            previewImage.src = dataUrl;
            previewImage.style.display = 'block';
            previewLoading.style.display = 'none';
        } catch (error) {
            console.error('Preview generation failed:', error);
            previewLoading.textContent = 'Preview failed to load';
        }
    }

    async generatePreviewDataUrl() {
        const canvas = document.getElementById('circuitCanvas');
        const circuitEditor = document.getElementById('circuitEditor');
        const includeBackground = document.getElementById('exportIncludeBackground').checked;
        const highRes = document.getElementById('exportHighRes').checked;

        // Temporarily make circuit builder visible if it's hidden
        const wasHidden = !circuitEditor.classList.contains('active');
        if (wasHidden) {
            circuitEditor.style.display = 'flex';
            circuitEditor.style.position = 'absolute';
            circuitEditor.style.left = '-9999px';
            circuitEditor.style.visibility = 'visible';
        }

        const computedStyle = getComputedStyle(document.documentElement);
        const bgColor = includeBackground ? computedStyle.getPropertyValue('--background').trim() || '#0a0a1a' : null;

        const options = {
            scale: highRes ? 2 : 1,
            backgroundColor: bgColor,
            useCORS: true,
            logging: false,
            allowTaint: true
        };

        const renderedCanvas = await html2canvas(canvas, options);
        const dataUrl = renderedCanvas.toDataURL('image/png');

        // Restore original state
        if (wasHidden) {
            circuitEditor.style.display = '';
            circuitEditor.style.position = '';
            circuitEditor.style.left = '';
            circuitEditor.style.visibility = '';
        }

        return dataUrl;
    }

    async confirmExport() {
        if (!this.currentExportFormat) return;

        const format = this.currentExportFormat;

        try {
            if (format === 'png') {
                await this.exportAsPng();
            } else if (format === 'svg') {
                await this.exportAsSvg();
            } else if (format === 'pdf') {
                await this.exportAsPdf();
            }
        } catch (error) {
            console.error('Export failed:', error);
        }

        // Close modal after export (regardless of success/failure)
        this.closeExportModal();
    }

    async exportAsPng() {
        const canvas = document.getElementById('circuitCanvas');
        const circuitEditor = document.getElementById('circuitEditor');
        const includeBackground = document.getElementById('exportIncludeBackground').checked;
        const highRes = document.getElementById('exportHighRes').checked;

        // Temporarily make circuit builder visible if it's hidden
        const wasHidden = !circuitEditor.classList.contains('active');
        if (wasHidden) {
            circuitEditor.style.display = 'flex';
            circuitEditor.style.position = 'absolute';
            circuitEditor.style.left = '-9999px';
            circuitEditor.style.visibility = 'visible';
        }

        const computedStyle = getComputedStyle(document.documentElement);
        const bgColor = includeBackground ? computedStyle.getPropertyValue('--background').trim() || '#0a0a1a' : null;

        const options = {
            scale: highRes ? 2 : 1,
            backgroundColor: bgColor,
            useCORS: true,
            logging: false,
            allowTaint: true
        };

        const renderedCanvas = await html2canvas(canvas, options);
        const blob = await new Promise(resolve => renderedCanvas.toBlob(resolve, 'image/png'));

        // Restore original state
        if (wasHidden) {
            circuitEditor.style.display = '';
            circuitEditor.style.position = '';
            circuitEditor.style.left = '';
            circuitEditor.style.visibility = '';
        }

        if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
                suggestedName: `quantum-circuit-${Date.now()}.png`,
                types: [{
                    description: 'PNG Image',
                    accept: { 'image/png': ['.png'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
        } else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `quantum-circuit-${Date.now()}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        }
    }

    async exportAsSvg() {
        const canvas = document.getElementById('circuitCanvas');
        const includeBackground = document.getElementById('exportIncludeBackground').checked;

        const width = canvas.scrollWidth;
        const height = canvas.scrollHeight;

        const computedStyle = getComputedStyle(document.documentElement);
        const bgColor = computedStyle.getPropertyValue('--background').trim() || '#0a0a1a';
        const primaryColor = computedStyle.getPropertyValue('--primary-color').trim() || '#6366f1';
        const textSecondary = computedStyle.getPropertyValue('--text-secondary').trim() || '#94a3b8';

        let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
        <style>
            .qubit-label { font-family: system-ui, sans-serif; font-size: 14px; font-weight: 600; fill: ${textSecondary}; }
            .gate-box { rx: 8; ry: 8; }
            .gate-text { font-family: system-ui, sans-serif; font-size: 14px; font-weight: 600; fill: white; text-anchor: middle; dominant-baseline: central; }
        </style>
    </defs>`;

        if (includeBackground) {
            svgContent += `\n    <rect width="100%" height="100%" fill="${bgColor}"/>`;
        }

        const labelWidth = 60;
        const gateWidth = 50;
        const gateHeight = 50;
        const columnSpacing = 60;
        const rowHeight = 68;
        const padding = 32;

        const gateColors = {
            'H': '#8b5cf6',
            'X': '#ef4444', 'CX': '#ef4444', 'RX': '#ef4444',
            'Y': '#22c55e', 'CY': '#22c55e', 'RY': '#22c55e',
            'Z': '#3b82f6', 'CZ': '#3b82f6', 'RZ': '#3b82f6',
            'S': '#f59e0b', 'T': '#f59e0b',
            'SWAP': '#f97316',
            'CSWAP': '#f97316',
            'MEASURE': '#64748b'
        };

        for (let i = 0; i < this.circuit.numQubits; i++) {
            const y = padding + (i * rowHeight) + rowHeight / 2;
            const wireStart = padding + labelWidth;
            const wireEnd = width - padding;

            svgContent += `\n    <line x1="${wireStart}" y1="${y}" x2="${wireEnd}" y2="${y}" stroke="${primaryColor}" stroke-width="2" opacity="0.6"/>`;
            svgContent += `\n    <text x="${padding + labelWidth / 2}" y="${y}" class="qubit-label" text-anchor="middle" dominant-baseline="central">q[${i}]</text>`;
        }

        this.circuit.gates.forEach(gate => {
            const { type, qubit, column, target, multiQubits } = gate;
            const x = padding + labelWidth + (column * columnSpacing);
            const y = padding + (qubit * rowHeight) + rowHeight / 2;
            const color = gateColors[type] || primaryColor;

            const symbols = {
                'H': 'H', 'X': 'X', 'Y': 'Y', 'Z': 'Z',
                'S': 'S', 'T': 'T',
                'RX': 'RX', 'RY': 'RY', 'RZ': 'RZ',
                'CX': 'X', 'CY': 'Y', 'CZ': 'Z', 'SWAP': '⇄', 'CSWAP': 'CS',
                'MEASURE': 'M'
            };
            const symbol = symbols[type] || type;

            svgContent += `\n    <rect x="${x}" y="${y - gateHeight / 2}" width="${gateWidth}" height="${gateHeight}" class="gate-box" fill="${color}" stroke="${color}" stroke-width="2"/>`;
            svgContent += `\n    <text x="${x + gateWidth / 2}" y="${y}" class="gate-text">${symbol}</text>`;

            let controlQubits = [];
            if (['CX', 'CY', 'CZ'].includes(type)) {
                if (multiQubits && multiQubits.length > 0) {
                    controlQubits = multiQubits;
                } else if (target !== null && target !== undefined) {
                    controlQubits = [target];
                }
            }

            controlQubits.forEach(controlQubit => {
                const controlY = padding + (controlQubit * rowHeight) + rowHeight / 2;
                const lineY1 = Math.min(y, controlY);
                const lineY2 = Math.max(y, controlY);
                svgContent += `\n    <line x1="${x + gateWidth / 2}" y1="${lineY1}" x2="${x + gateWidth / 2}" y2="${lineY2}" stroke="${color}" stroke-width="2"/>`;
                svgContent += `\n    <circle cx="${x + gateWidth / 2}" cy="${controlY}" r="8" fill="${color}"/>`;
            });

            if (type === 'SWAP' && target !== null && target !== undefined) {
                const targetY = padding + (target * rowHeight) + rowHeight / 2;
                const lineY1 = Math.min(y, targetY);
                const lineY2 = Math.max(y, targetY);
                svgContent += `\n    <line x1="${x + gateWidth / 2}" y1="${lineY1}" x2="${x + gateWidth / 2}" y2="${lineY2}" stroke="${color}" stroke-width="2"/>`;
                svgContent += `\n    <rect x="${x}" y="${targetY - gateHeight / 2}" width="${gateWidth}" height="${gateHeight}" class="gate-box" fill="${color}" stroke="${color}" stroke-width="2"/>`;
                svgContent += `\n    <text x="${x + gateWidth / 2}" y="${targetY}" class="gate-text">⇄</text>`;
            }
        });

        this.circuit.controlFlow.forEach(cf => {
            const { type, column, params } = cf;
            const x = padding + labelWidth + (column * columnSpacing);
            const blockHeight = this.circuit.numQubits * rowHeight - 8;
            const blockY = padding;

            const cfColor = type === 'REPEAT' ? '#a855f7' : '#ef4444';
            const symbol = type === 'REPEAT' ? '↻' : '⊣';
            const label = type === 'REPEAT' ? `×${params.count}` : (params.endingLabel || '');

            svgContent += `\n    <rect x="${x}" y="${blockY}" width="${gateWidth}" height="${blockHeight}" rx="8" ry="8" fill="${cfColor}" opacity="0.9"/>`;
            svgContent += `\n    <text x="${x + gateWidth / 2}" y="${blockY + blockHeight / 2 - 10}" class="gate-text" font-size="20">${symbol}</text>`;
            if (label) {
                svgContent += `\n    <text x="${x + gateWidth / 2}" y="${blockY + blockHeight / 2 + 15}" class="gate-text" font-size="12">${label}</text>`;
            }
        });

        svgContent += '\n</svg>';

        const blob = new Blob([svgContent], { type: 'image/svg+xml' });

        if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
                suggestedName: `quantum-circuit-${Date.now()}.svg`,
                types: [{
                    description: 'SVG Image',
                    accept: { 'image/svg+xml': ['.svg'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
        } else {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `quantum-circuit-${Date.now()}.svg`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
        }
    }

    async exportAsPdf() {
        const canvas = document.getElementById('circuitCanvas');
        const circuitEditor = document.getElementById('circuitEditor');
        const includeBackground = document.getElementById('exportIncludeBackground').checked;
        const highRes = document.getElementById('exportHighRes').checked;

        // Temporarily make circuit builder visible if it's hidden
        const wasHidden = !circuitEditor.classList.contains('active');
        if (wasHidden) {
            circuitEditor.style.display = 'flex';
            circuitEditor.style.position = 'absolute';
            circuitEditor.style.left = '-9999px';
            circuitEditor.style.visibility = 'visible';
        }

        const computedStyle = getComputedStyle(document.documentElement);
        const bgColor = includeBackground ? computedStyle.getPropertyValue('--background').trim() || '#0a0a1a' : '#ffffff';

        const options = {
            scale: highRes ? 2 : 1,
            backgroundColor: bgColor,
            useCORS: true,
            logging: false,
            allowTaint: true
        };

        const renderedCanvas = await html2canvas(canvas, options);

        // Restore original state
        if (wasHidden) {
            circuitEditor.style.display = '';
            circuitEditor.style.position = '';
            circuitEditor.style.left = '';
            circuitEditor.style.visibility = '';
        }

        const imgWidth = renderedCanvas.width;
        const imgHeight = renderedCanvas.height;

        const { jsPDF } = window.jspdf;

        const orientation = imgWidth > imgHeight ? 'landscape' : 'portrait';
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'px',
            format: [imgWidth, imgHeight]
        });

        const imgData = renderedCanvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

        const pdfBlob = pdf.output('blob');

        if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
                suggestedName: `quantum-circuit-${Date.now()}.pdf`,
                types: [{
                    description: 'PDF Document',
                    accept: { 'application/pdf': ['.pdf'] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(pdfBlob);
            await writable.close();
        } else {
            pdf.save(`quantum-circuit-${Date.now()}.pdf`);
        }
    }
}

// Initialize the UI when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.circuitUI = new CircuitUI();
});


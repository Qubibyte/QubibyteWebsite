// UI Interaction Handlers

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
        this.gateCreatorInitialized = false;

        this.qubiExecutor = new QubiExecutor(this.circuit);
        this.selectedGate = null;
        this.draggedGate = null;
        this.customGateMeta = {}; // gateType -> { label, colorBg, colorGlow, displayName }
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
        this.zoomLevel = 1; // Zoom level for circuit view

        // Initialize syntax highlighter for Qubi editor
        this.syntaxHighlighter = new QubiSyntaxHighlighter('qubiCode', 'codeHighlight', 'lineNumbers');
        this.qubiFiles = []; // [{ id, name, code }]
        this.activeQubiFileId = null;

        // Bidirectional sync state
        this.isUpdatingFromCircuit = false;
        this.isUpdatingFromCode = false;
        this.codeChangeDebounceTimer = null;
        this.codeChangeDebounceDelay = 500; // ms to wait before syncing code changes to circuit

        this.initializeEventListeners();
        this.initDesktopPanelResize();
        this.updateQubitInputMax();
        this.renderCircuit();
        this.updateVisualization();

        // Initialize error state
        this.updateErrorState();

        this.applyPendingSessionQubiLoad();

        this.initializeQubiTabs();
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
            if (tab.querySelector('input.qubi-tab-rename')) return;

            const currentStem = String(file.name || '').replace(/\.qubi$/i, '');
            const nameSpan = tab.querySelector('.qubi-tab-name');
            if (!nameSpan) return;

            const input = document.createElement('input');
            input.className = 'qubi-tab-rename';
            input.type = 'text';
            input.value = currentStem;
            input.setAttribute('aria-label', 'Rename Qubi file');
            input.autocomplete = 'off';
            input.spellcheck = false;

            // Replace span with input
            nameSpan.replaceWith(input);
            input.focus({ preventScroll: true });
            try { input.setSelectionRange(0, input.value.length); } catch { /* ignore */ }

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
                            this.qubiFiles.splice(idx, 1);
                            if (this.activeQubiFileId === f.id) {
                                this.activeQubiFileId = 'main';
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
                    this._persistActiveQubiEditorToFile();
                    this.activeQubiFileId = f.id;
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
            // Initialize circuit to match new (empty) file deterministically
            this.syncCodeToCircuit();
            render();
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
        if (needed > maxQubits && this.syntaxHighlighter) {
            const msg = `References qubit ${needed - 1}, but max qubit limit is ${maxQubits}. Increase in Settings.`;
            const codeLines = (document.getElementById('qubiCode')?.value || '').split('\n');
            let tagged = false;
            for (let i = 0; i < codeLines.length; i++) {
                const nums = codeLines[i].match(/\d+/g);
                if (nums && nums.some(n => parseInt(n, 10) >= maxQubits)) {
                    this.syntaxHighlighter.lineErrors.set(i, msg);
                    tagged = true;
                    break;
                }
            }
            if (!tagged && codeLines.length > 0) {
                this.syntaxHighlighter.lineErrors.set(0, msg);
            }
            this.syntaxHighlighter.updateLineNumbers();
        }
    }

    setEditorCode(code, { preserveUndo = false, adjustQubits = false } = {}) {
        const text = code == null ? '' : String(code);
        this.isUpdatingFromCircuit = true;
        if (this.syntaxHighlighter) {
            this.syntaxHighlighter.setCode(text, { preserveUndo });
        } else {
            const editor = document.getElementById('qubiCode');
            if (editor) {
                if (preserveUndo) {
                    editor.focus({ preventScroll: true });
                    try {
                        editor.setSelectionRange(0, editor.value.length);
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
                        if (typeof editor.setRangeText === 'function') {
                            editor.setRangeText(text, 0, editor.value.length, 'end');
                        } else {
                            editor.value = text;
                        }
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

    initDesktopPanelResize() {
        const desktopMq = window.matchMedia('(min-width: 769px)');
        const leftHandle = document.getElementById('leftPanelResize');
        const rightHandle = document.getElementById('rightPanelResize');
        const sidebar = document.querySelector('.main-content > aside.sidebar');
        const codeSidebar = document.querySelector('.main-content > aside.code-sidebar');
        if (!leftHandle || !rightHandle || !sidebar || !codeSidebar) return;

        try {
            localStorage.removeItem('simSidebarWidth');
            localStorage.removeItem('simCodeSidebarWidth');
        } catch {
            /* ignore */
        }

        const HANDLE_TOTAL = 12;
        const minCenter = 280;
        const minSidebar = 180;
        const minCode = 240;

        const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

        const readW = (el) => {
            const r = el.getBoundingClientRect().width;
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
            if (!desktopMq.matches) return;
            if (!sidebar.style.width && !codeSidebar.style.width) return;
            const sw = readW(sidebar) || 260;
            const cw = readW(codeSidebar) || 400;
            const { s, c } = jointClamp(sw, cw);
            sidebar.style.width = `${Math.round(s)}px`;
            codeSidebar.style.width = `${Math.round(c)}px`;
        });

        const attach = (handle, which) => {
            handle.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || !desktopMq.matches) return;
                e.preventDefault();
                const startX = e.clientX;
                const startSidebar = readW(sidebar) || 260;
                const startCode = readW(codeSidebar) || 400;
                handle.classList.add('is-dragging');

                const onMove = (ev) => {
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
                };

                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    handle.classList.remove('is-dragging');
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    const { s, c } = jointClamp(readW(sidebar) || startSidebar, readW(codeSidebar) || startCode);
                    sidebar.style.width = `${Math.round(s)}px`;
                    codeSidebar.style.width = `${Math.round(c)}px`;
                    window.dispatchEvent(new Event('resize'));
                };

                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        };

        attach(leftHandle, 'left');
        attach(rightHandle, 'code');

        const resetPanelWidthsToDefault = (e) => {
            if (!desktopMq.matches) return;
            e.preventDefault();
            sidebar.style.width = '';
            codeSidebar.style.width = '';
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
                e.dataTransfer.effectAllowed = 'copy';
                const ghost = document.createElement('div');
                ghost.style.cssText = 'width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-weight:700;font-size:0.8rem;color:#fff;opacity:0.85;position:absolute;left:-9999px;';
                const sym = item.querySelector('.gate-symbol');
                ghost.style.background = sym ? getComputedStyle(sym).background : 'var(--primary-color)';
                ghost.textContent = item.dataset.gate === 'SWAP' ? '⇄' : (item.dataset.gate === 'MEASURE' ? 'M' : item.dataset.gate);
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 18, 18);
                setTimeout(() => ghost.remove(), 0);
            });

            gatePalette.addEventListener('click', (e) => {
                const item = e.target.closest('.gate-item');
                if (!item) return;
                if (e.target.closest('.gate-info-icon')) return;
                const gate = item.dataset.gate;
                if (this.selectedGate === gate) {
                    this.selectedGate = null;
                    document.querySelectorAll('.gate-item').forEach(el => el.classList.remove('gate-selected'));
                } else {
                    this.selectedGate = gate;
                    document.querySelectorAll('.gate-item').forEach(el => el.classList.remove('gate-selected'));
                    item.classList.add('gate-selected');
                }
                this._updateSlotReadyState();
            });
        }

        // Circuit controls
        document.getElementById('runBtn').addEventListener('click', () => this.runCircuit());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearCircuit());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetExecution());
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
                e.target.value = `${validNum} Qubits`;
                if (validNum !== num) {
                    this.setQubitCount(validNum);
                }
            } else {
                // If no valid number, restore current qubit count
                e.target.value = `${this.circuit.numQubits} Qubits`;
            }
        });

        // Allow typing numbers, but format on blur
        document.getElementById('qubitCount').addEventListener('input', (e) => {
            // Allow typing, but we'll format on blur
        });

        // Zoom controls
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const resetZoomBtn = document.getElementById('resetZoomBtn');
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.zoomOut());
        if (resetZoomBtn) resetZoomBtn.addEventListener('click', () => this.resetZoom());

        // Tab switching
        // Tab switching for Circuit Builder / NMR Simulator
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Tab switching for Measurement Results / State Vector (only in region 1)
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

        // Algorithms
        document.getElementById('algorithmsBtn').addEventListener('click', () => this.showAlgorithmsModal());
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

        // Gate info from palette
        document.querySelectorAll('.gate-info-icon').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const gateType = e.target.dataset.gate;
                this.showGateInfo(gateType);
            });
        });

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
            if (e.target.classList.contains('gate-on-wire') || e.target.closest('.gate-on-wire')) {
                const gateEl = e.target.classList.contains('gate-on-wire') ? e.target : e.target.closest('.gate-on-wire');
                this.editGate(gateEl);
            } else if (this.selectedGate) {
                const slot = e.target.classList.contains('gate-slot') ? e.target : e.target.closest('.gate-slot');
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

        // Drag over circuit
        document.getElementById('circuitCanvas').addEventListener('dragover', (e) => {
            e.preventDefault();
            const slot = e.target.closest('.gate-slot');
            if (slot) {
                slot.classList.add('drag-over');
            }
        });

        document.getElementById('circuitCanvas').addEventListener('dragleave', (e) => {
            const slot = e.target.closest('.gate-slot');
            if (slot) {
                slot.classList.remove('drag-over');
            }
        });

        document.getElementById('circuitCanvas').addEventListener('drop', (e) => {
            e.preventDefault();
            const slot = e.target.closest('.gate-slot');
            if (slot && this.draggedGate) {
                this.placeGateOnSlot(slot, this.draggedGate);
                this.draggedGate = null;
            }
            document.querySelectorAll('.drag-over').forEach(el => {
                el.classList.remove('drag-over');
            });
        });
    }

    /** Toggle visual cue on empty gate slots when a gate is selected */
    _updateSlotReadyState() {
        const slots = document.querySelectorAll('.gate-slot');
        if (this.selectedGate) {
            slots.forEach(slot => {
                // Only highlight empty slots
                if (!slot.querySelector('.gate-on-wire')) {
                    slot.classList.add('slot-ready');
                }
            });
        } else {
            slots.forEach(slot => slot.classList.remove('slot-ready'));
        }
    }

    renderCircuit() {
        const canvas = document.getElementById('circuitCanvas');
        const canvasWrapper = canvas.parentElement;
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

        // Place existing gates
        this.circuit.gates.forEach(gate => {
            this.renderGate(gate);
        });

        // Place control flow blocks (REPEAT/END)
        this.circuit.controlFlow.forEach(cf => {
            this.renderControlFlow(cf);
        });

        this.updateCircuitInfo();
        this._updateSlotReadyState();
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
            block.title = `REPEAT ${params.count} times - Click to edit, right-click to delete`;

            const label = document.createElement('div');
            label.className = 'control-flow-label';
            label.textContent = `×${params.count}`;
            block.appendChild(symbol);
            block.appendChild(label);
        } else if (type === 'END') {
            symbol.textContent = '⊣';
            block.title = params.endingLabel ? `END ${params.endingLabel}` : 'END - Right-click to delete';
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
            // Ignore click if delete btn was clicked (though propagation stopped above, safety)
            if (e.target.closest('.gate-delete-btn')) return;

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
            'CX': 'X', 'CY': 'Y', 'CZ': 'Z', 'SWAP': '⇄',
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
            'MEASURE': 'gate-measure-family'
        };

        const meta = this.customGateMeta[type];
        const symbolText = meta?.label || symbols[type] || type;
        gateEl.textContent = symbolText;
        gateEl.title = `Click to edit, right-click to delete`;
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
        // Make the gate text a span so it sits alongside the delete btn
        const textSpan = document.createElement('span');
        textSpan.textContent = symbolText;
        gateEl.textContent = '';
        gateEl.appendChild(textSpan);
        gateEl.appendChild(deleteBtn);

        // Show parameters if present (rotation angle)
        if (params && params.angle !== undefined) {
            gateEl.classList.add('has-params');
            gateEl.dataset.params = `θ=${(params.angle * 180 / Math.PI).toFixed(1)}°`;
        }

        // Add gate to slot first
        slot.appendChild(gateEl);

        // Handle controlled gates - render control blocks AFTER placing target gate
        let controlQubits = [];
        if (['CX', 'CY', 'CZ'].includes(type) && multiQubits && multiQubits.length > 0) {
            // Multi-controlled gate: multiQubits are controls, qubit is target
            controlQubits = multiQubits;
        } else if (['CX', 'CY', 'CZ'].includes(type) && target !== null && target !== undefined) {
            // Single control: target property is the control, qubit is the target
            controlQubits = [target];
        }

        if (controlQubits.length > 0) {
            this.renderControlBlocks(controlQubits, qubit, column, type);
        }

        // Handle SWAP - render swap partner block
        if (type === 'SWAP' && target !== null && target !== undefined) {
            this.renderSwapPartner(target, qubit, column);
        }

        const joint = params && Array.isArray(params.jointQubits) ? params.jointQubits : null;
        if (joint && joint.length > 1) {
            for (const qq of joint) {
                if (qq === qubit) continue;
                this.renderJointPartner(qq, qubit, column, type);
            }
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
    }

    renderSwapPartner(partnerQubit, originalQubit, column) {
        const partnerSlot = document.querySelector(`.gate-slot[data-qubit="${partnerQubit}"][data-column="${column}"]`);
        if (!partnerSlot) {
            console.warn(`Swap partner slot not found for qubit ${partnerQubit}, column ${column}`);
            return;
        }

        // Clear the slot
        partnerSlot.innerHTML = '';

        // Create the swap partner block
        const swapBlock = document.createElement('div');
        swapBlock.className = 'gate-on-wire swap-block gate-swap-family';
        swapBlock.dataset.gateType = 'SWAP_PARTNER';
        swapBlock.dataset.qubit = partnerQubit;
        swapBlock.dataset.column = column;
        swapBlock.dataset.partnerQubit = originalQubit;
        swapBlock.title = `SWAP with q[${originalQubit}]`;

        // Create inner content
        const symbol = document.createElement('span');
        symbol.className = 'swap-symbol';
        symbol.textContent = '⇄';

        const arrow = document.createElement('span');
        arrow.className = 'swap-arrow';
        arrow.textContent = `↔q${originalQubit}`;

        swapBlock.appendChild(symbol);
        swapBlock.appendChild(arrow);

        partnerSlot.appendChild(swapBlock);

        // Update original gate to show partner
        const originalSlot = document.querySelector(`.gate-slot[data-qubit="${originalQubit}"][data-column="${column}"]`);
        if (originalSlot && originalSlot.firstChild) {
            const originalGate = originalSlot.firstChild;
            originalGate.classList.add('has-params');
            originalGate.dataset.params = `↔q${partnerQubit}`;
        }
    }

    renderControlBlocks(controlQubits, targetQubit, column, gateType = 'CX') {
        // Gate family mapping for control blocks
        const gateFamily = {
            'CX': 'gate-x-family',
            'CY': 'gate-y-family',
            'CZ': 'gate-z-family'
        };
        const familyClass = gateFamily[gateType] || '';

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
            controlBlock.className = 'gate-on-wire control-block';
            if (familyClass) {
                controlBlock.classList.add(familyClass);
            }
            controlBlock.dataset.gateType = 'CONTROL';
            controlBlock.dataset.qubit = controlQubit;
            controlBlock.dataset.column = column;
            controlBlock.dataset.targetQubit = targetQubit;
            controlBlock.title = `Control for ${gateType} on q[${targetQubit}]`;

            // Create inner content
            const label = document.createElement('span');
            label.className = 'control-label';
            label.textContent = 'C';

            const arrow = document.createElement('span');
            arrow.className = 'control-arrow';
            arrow.textContent = `→q${targetQubit}`;

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

        // Check if control flow (REPEAT/END)
        if (type === 'REPEAT') {
            // Don't allow placing REPEAT at a column that has gates
            const gatesAtColumn = this.circuit.getGatesAtColumn(column);
            if (gatesAtColumn.length > 0) {
                return; // Silently fail - column is occupied
            }
            this.showRepeatModal(column);
            return;
        }

        if (type === 'END') {
            // Don't allow placing END at a column that has gates
            const gatesAtColumn = this.circuit.getGatesAtColumn(column);
            if (gatesAtColumn.length > 0) {
                return; // Silently fail - column is occupied
            }
            this.placeEndBlock(column);
            return;
        }

        // Don't allow placing gates at a column that has control flow
        const cfAtColumn = this.circuit.getControlFlowAtColumn(column);
        if (cfAtColumn) {
            return; // Silently fail - column has control flow
        }

        // Check if gate requires parameters
        if (['RX', 'RY', 'RZ'].includes(type)) {
            this.showParameterModal(type, qubit, column);
            return;
        }

        // Check if multi-qubit gate
        // When dragging onto a qubit, that qubit is the TARGET
        // We need to select the CONTROL qubit
        if (['CX', 'CY', 'CZ', 'SWAP'].includes(type)) {
            this.showTargetSelectionModal(type, qubit, column);
            return;
        }

        // Multi-qubit custom unitary: place on consecutive wires starting at drop target
        if (typeof GateMatrices !== 'undefined' && GateMatrices[type]) {
            const mat = GateMatrices[type];
            const dim = Math.round(Math.sqrt(mat.length));
            if (dim > 1 && dim * dim === mat.length && (dim & (dim - 1)) === 0) {
                const k = Math.round(Math.log2(dim));
                if (k > 1) {
                    const qs = [];
                    for (let j = 0; j < k; j++) {
                        if (qubit + j >= this.circuit.numQubits) return;
                        qs.push(qubit + j);
                    }
                    const gatesAt = this.circuit.getGatesAtColumn(column);
                    const touches = (g, w) => {
                        const jt = g.params && g.params.jointQubits;
                        if (Array.isArray(jt) && jt.includes(w)) return true;
                        if (g.qubit === w) return true;
                        if (g.target !== null && g.target !== undefined && g.target === w) return true;
                        if (g.multiQubits && g.multiQubits.includes(w)) return true;
                        return false;
                    };
                    for (const qq of qs) {
                        if (gatesAt.some(g => touches(g, qq))) return;
                    }
                    this.circuit.addGate(type, qubit, column, null, { jointQubits: qs });
                    this.circuit.state = null;
                    this.renderCircuit();
                    this.updateVisualization();
                    this.syncCircuitToCode();
                    return;
                }
            }
        }

        // Single qubit gate
        this.circuit.addGate(type, qubit, column);
        // Invalidate state so it gets recomputed with the new gate
        this.circuit.state = null;
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
    }

    showRepeatModal(column, currentCount = 2, isEdit = false) {
        const modal = document.getElementById('repeatModal');
        const title = document.getElementById('repeatModalTitle');
        const input = document.getElementById('repeatCountInput');

        title.textContent = isEdit ? 'Edit Repeat Count' : 'Set Repeat Count';
        input.value = currentCount;

        modal.classList.add('active');
        modal.dataset.column = column;
        modal.dataset.isEdit = isEdit;

        input.focus();
        input.select();
    }

    confirmRepeat() {
        const modal = document.getElementById('repeatModal');
        const input = document.getElementById('repeatCountInput');
        const column = parseInt(modal.dataset.column);
        const isEdit = modal.dataset.isEdit === 'true';
        const count = parseInt(input.value) || 2;

        if (isEdit) {
            // Update existing REPEAT
            const cf = this.circuit.controlFlow.find(c => c.column === column && c.type === 'REPEAT');
            if (cf) {
                cf.params.count = count;

                // Also update the matching END block's label
                const matchingEnd = this.circuit.controlFlow.find(c =>
                    c.type === 'END' && c.params.matchedRepeatColumn === column
                );
                if (matchingEnd) {
                    matchingEnd.params.endingLabel = `REPEAT ${count}`;
                }
                this.syncCircuitToCode();
            }
        } else {
            this.circuit.addControlFlow('REPEAT', column, { count });
        }

        modal.classList.remove('active');
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
    }

    cancelRepeat() {
        document.getElementById('repeatModal').classList.remove('active');
    }

    placeEndBlock(column) {
        // Find the most recent unmatched REPEAT before this column
        const repeats = this.circuit.controlFlow
            .filter(cf => cf.type === 'REPEAT' && cf.column < column)
            .sort((a, b) => b.column - a.column); // Most recent first

        const ends = this.circuit.controlFlow
            .filter(cf => cf.type === 'END' && cf.column < column);

        // Find unmatched repeat
        let unmatchedRepeat = null;
        for (const repeat of repeats) {
            const matchingEnd = ends.find(e =>
                e.column > repeat.column &&
                e.params.matchedRepeatColumn === repeat.column
            );
            if (!matchingEnd) {
                unmatchedRepeat = repeat;
                break;
            }
        }

        const endingType = unmatchedRepeat ? 'REPEAT' : null;
        const endingLabel = unmatchedRepeat ? `REPEAT ${unmatchedRepeat.params.count}` : '';

        this.circuit.addControlFlow('END', column, {
            endingType,
            endingLabel,
            matchedRepeatColumn: unmatchedRepeat ? unmatchedRepeat.column : null
        });

        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
    }

    showTargetSelectionModal(gateType, targetQubit, column, currentControls = null) {
        const modal = document.getElementById('targetModal');
        const title = document.getElementById('targetModalTitle');
        const list = document.getElementById('targetQubitList');

        // SWAP only allows single selection, controlled gates allow multiple
        const allowMultiple = gateType !== 'SWAP';
        const labelText = gateType === 'SWAP'
            ? `Select Qubit to Swap with q[${targetQubit}]`
            : `Select Control Qubit(s) for ${gateType}`;

        title.textContent = labelText;
        list.innerHTML = '';

        // Add hint for multi-select
        if (allowMultiple) {
            const hint = document.createElement('div');
            hint.className = 'selection-hint';
            hint.textContent = 'Click to select/deselect multiple control qubits';
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
        modal.dataset.column = column;
        modal.dataset.isEdit = currentControls !== null;
        modal.dataset.allowMultiple = allowMultiple;
    }

    confirmTargetSelection() {
        const modal = document.getElementById('targetModal');
        const selectedItems = document.querySelectorAll('.target-qubit-item.selected');
        const isEdit = modal.dataset.isEdit === 'true';
        const gateType = modal.dataset.gateType;
        const allowMultiple = modal.dataset.allowMultiple === 'true';

        if (selectedItems.length > 0) {
            const targetQubit = parseInt(modal.dataset.targetQubit);
            const column = parseInt(modal.dataset.column);

            // Get selected control qubits
            const controlQubits = Array.from(selectedItems).map(item => parseInt(item.dataset.control));

            if (isEdit) {
                // Update existing gate
                const gate = this.circuit.gates.find(g =>
                    g.qubit === targetQubit && g.column === column
                );
                if (gate) {
                    if (allowMultiple && controlQubits.length > 1) {
                        // Store multiple controls in multiQubits
                        gate.target = null;
                        gate.multiQubits = controlQubits;
                    } else {
                        // Single control
                        gate.target = controlQubits[0];
                        gate.multiQubits = null;
                    }
                }
            } else {
                // Add new gate
                if (allowMultiple && controlQubits.length > 1) {
                    // Multiple controls - store in multiQubits
                    this.circuit.addGate(gateType, targetQubit, column, null, {}, controlQubits);
                } else {
                    // Single control
                    this.circuit.addGate(gateType, targetQubit, column, controlQubits[0]);
                }
            }

            // Invalidate state so it gets recomputed
            this.circuit.state = null;
            this.renderCircuit();
            this.updateVisualization();
            this.syncCircuitToCode();
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
            const gate = this.circuit.gates.find(g =>
                g.qubit === targetQubit && g.column === column
            );
            if (gate && ['CX', 'CY', 'CZ'].includes(gate.type)) {
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
        } else if (type === 'SWAP') {
            this.showTargetSelectionModal('SWAP', gate.qubit, column, gate.target);
        }
    }

    removeGateFromSlot(gateEl) {
        const qubit = parseInt(gateEl.dataset.qubit);
        const column = parseInt(gateEl.dataset.column);
        const gateType = gateEl.dataset.gateType;

        // If this is a control block, find and remove the actual gate
        if (gateType === 'CONTROL') {
            const targetQubit = parseInt(gateEl.dataset.targetQubit);
            this.circuit.removeGate(targetQubit, column);
        } else if (gateType === 'SWAP_PARTNER') {
            // Find and remove the actual SWAP gate
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

    showParameterModal(gateType, qubit, column, currentAngle = Math.PI / 2, isEdit = false) {
        const modal = document.getElementById('parameterModal');
        const title = document.getElementById('modalTitle');
        const inputs = document.getElementById('parameterInputs');

        title.textContent = isEdit ? `Edit ${gateType} Parameters` : `Set ${gateType} Parameters`;
        inputs.innerHTML = '';

        const angleGroup = document.createElement('div');
        angleGroup.className = 'parameter-group';
        angleGroup.innerHTML = `
            <label for="angleInput">Angle (radians):</label>
            <input type="number" id="angleInput" value="${currentAngle}" step="0.1" min="0" max="${2 * Math.PI}">
            <label for="angleDegInput" style="margin-top: 0.5rem;">Angle (degrees):</label>
            <input type="number" id="angleDegInput" value="${currentAngle * 180 / Math.PI}" step="1" min="0" max="360">
        `;
        inputs.appendChild(angleGroup);

        // Sync degree and radian inputs
        document.getElementById('angleInput').addEventListener('input', (e) => {
            document.getElementById('angleDegInput').value = (parseFloat(e.target.value) * 180 / Math.PI).toFixed(1);
        });
        document.getElementById('angleDegInput').addEventListener('input', (e) => {
            document.getElementById('angleInput').value = (parseFloat(e.target.value) * Math.PI / 180).toFixed(4);
        });

        modal.classList.add('active');
        modal.dataset.gateType = gateType;
        modal.dataset.qubit = qubit;
        modal.dataset.column = column;
        modal.dataset.isEdit = isEdit;
    }

    confirmGateParameters() {
        const modal = document.getElementById('parameterModal');
        const gateType = modal.dataset.gateType;
        const qubit = parseInt(modal.dataset.qubit);
        const column = parseInt(modal.dataset.column);
        const isEdit = modal.dataset.isEdit === 'true';
        const angle = parseFloat(document.getElementById('angleInput').value);

        if (isEdit) {
            // Update existing gate
            const gate = this.circuit.gates.find(g =>
                g.qubit === qubit && g.column === column
            );
            if (gate) {
                gate.params = { angle };
            }
        } else {
            this.circuit.addGate(gateType, qubit, column, null, { angle });
        }

        // Invalidate state so it gets recomputed
        this.circuit.state = null;
        modal.classList.remove('active');
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
    }

    cancelGateParameters() {
        const modal = document.getElementById('parameterModal');
        modal.classList.remove('active');
    }

    runCircuit() {
        // Check for errors before running
        if (this.hasCodeErrors()) {
            return; // Don't run if there are errors
        }

        this.stopPlayback();
        this.circuit.state = new QuantumState(this.circuit.numQubits);

        // Build step states
        this.stepStates = [];
        const initialState = new QuantumState(this.circuit.numQubits);
        this.stepStates.push({
            state: initialState,
            gates: [],
            column: -1
        });

        // Get the execution sequence (respects REPEAT blocks)
        const executionSequence = this.circuit.buildExecutionSequence();

        // Group the execution sequence by original column for step display
        // But execute in the order returned (which handles repeats)
        let stepIndex = 0;
        let currentGates = [];

        for (let i = 0; i < executionSequence.length; i++) {
            const gate = executionSequence[i];
            this.circuit.executeGate(gate);
            currentGates.push(gate);

            // Check if next gate is at a different column or this is the last gate
            const nextGate = executionSequence[i + 1];
            if (!nextGate || nextGate.column !== gate.column) {
                // Save state after this batch
                const stateCopy = new QuantumState(this.circuit.numQubits);
                if (this.circuit.state && this.circuit.state.amplitudes) {
                    stateCopy.amplitudes = [...this.circuit.state.amplitudes];
                }
                this.stepStates.push({
                    state: stateCopy,
                    gates: [...currentGates],
                    column: gate.column,
                    stepIndex: stepIndex++
                });
                currentGates = [];
            }
        }

        // Update to final state
        this.currentColumn = this.stepStates.length > 1 ? this.stepStates[this.stepStates.length - 1].column : 0;
        this.updateVisualization();
        this.renderStepTimeline();
        this.updateStepInfo();
        this.clearExecutionHighlight();
    }

    resetExecution() {
        this.stopPlayback();
        this.currentColumn = 0;
        this.executionHistory = [];
        this.historyIndex = -1;
        this.stepStates = [];
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
            stepGates.className = 'step-item-gates';
            if (step.gates && step.gates.length > 0) {
                const gateNames = step.gates.map(g => g.type || 'Unknown').join(', ');
                stepGates.textContent = gateNames;
            } else {
                stepGates.textContent = 'Initial state';
            }

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

        // Update timeline highlighting
        document.querySelectorAll('.step-item').forEach((item, idx) => {
            item.classList.toggle('active', idx === stepIndex);
        });

        this.updateVisualization();
        this.updateStepInfo();
    }

    stepForward() {
        this.stopPlayback();

        // Save current state to history
        if (this.historyIndex < this.executionHistory.length - 1) {
            // If we're in the middle of history, truncate
            this.executionHistory = this.executionHistory.slice(0, this.historyIndex + 1);
        }

        // Save state before step
        const stateCopy = new QuantumState(this.circuit.numQubits);
        stateCopy.amplitudes = [...this.circuit.state.amplitudes];
        this.executionHistory.push({
            state: stateCopy,
            column: this.currentColumn
        });
        this.historyIndex = this.executionHistory.length - 1;

        // Reset if we're at the beginning
        if (this.currentColumn === 0 && this.executionHistory.length === 1) {
            this.circuit.state = new QuantumState(this.circuit.numQubits);
        }

        // Execute one column at a time
        const nextColumn = this.currentColumn;
        const gatesAtColumn = this.circuit.getGatesAtColumn(nextColumn);

        if (gatesAtColumn.length > 0) {
            // Highlight gates being executed
            this.highlightGates(gatesAtColumn);

            gatesAtColumn.forEach(gate => {
                this.circuit.executeGate(gate);
            });
            this.currentColumn++;
            this.updateVisualization();
        } else {
            // At end - loop if enabled, otherwise reset
            if (this.loopEnabled) {
                this.currentColumn = 0;
                this.circuit.state = new QuantumState(this.circuit.numQubits);
            } else {
                this.currentColumn = 0;
                this.circuit.state = new QuantumState(this.circuit.numQubits);
            }
            this.clearExecutionHighlight();
        }

        this.updateStepInfo();
    }

    stepBack() {
        this.stopPlayback();

        if (this.historyIndex > 0) {
            this.historyIndex--;
            const historyEntry = this.executionHistory[this.historyIndex];
            this.circuit.state = historyEntry.state;
            this.currentColumn = historyEntry.column;
            this.updateVisualization();
            this.updateStepInfo();
            this.clearExecutionHighlight();
        } else if (this.historyIndex === 0) {
            // Go back to initial state
            this.circuit.state = new QuantumState(this.circuit.numQubits);
            this.currentColumn = 0;
            this.historyIndex = -1;
            this.updateVisualization();
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
            const gatesAtColumn = this.circuit.getGatesAtColumn(this.currentColumn);
            if (gatesAtColumn.length > 0 || this.loopEnabled) {
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

        // Total steps is the number of unique columns with gates
        const totalColumns = this.stepStates.length > 0 ? this.stepStates.length - 1 : this.circuit.maxColumn;

        // Find current step index in timeline
        let currentStep = 0;
        if (this.stepStates.length > 0) {
            for (let i = 0; i < this.stepStates.length; i++) {
                if (this.stepStates[i].column >= this.currentColumn) {
                    currentStep = i;
                    break;
                }
                currentStep = i;
            }
        }

        stepInfoEl.textContent = `Step: ${currentStep}/${totalColumns}`;
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

    resetZoom() {
        this.zoomLevel = 1;
        this.renderCircuit();
        this.updateZoomDisplay();
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
        this.selectedGate = null;
        this.executionHistory = [];
        this.historyIndex = -1;
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
        this.isUpdatingFromCircuit = false;
    }

    addQubit() {
        const settings = this.getSettings();
        const maxQubits = settings.maxQubits || 12;

        if (this.circuit.numQubits >= maxQubits) {
            return; // Don't add if at max
        }

        this.circuit.addQubit();
        document.getElementById('qubitCount').value = `${this.circuit.numQubits} Qubits`;
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
    }

    removeQubit() {
        // Don't allow removing below 1 qubit
        if (this.circuit.numQubits <= 1) {
            return;
        }
        this.circuit.removeQubit();
        document.getElementById('qubitCount').value = `${this.circuit.numQubits} Qubits`;
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
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
        document.getElementById('qubitCount').value = `${this.circuit.numQubits} Qubits`;
        this.renderCircuit();
        this.updateVisualization();
        this.syncCircuitToCode();
    }

    updateVisualization() {
        if (!this.circuit) return;

        // Auto-compute circuit state if it doesn't exist
        // This allows real-time updates when gates are added (before clicking Run)
        if (!this.circuit.state) {
            this.circuit.state = new QuantumState(this.circuit.numQubits, this.circuit.useOptimizedGates);
            // Execute all gates in sequence to compute current state
            const executionSequence = this.circuit.buildExecutionSequence();
            for (const gate of executionSequence) {
                this.circuit.executeGate(gate);
            }
        }

        const settings = this.getSettings();
        const vizSettings = {
            precision: settings.precision,
            hideNegligibles: settings.hideNegligibles,
            sortBy: settings.sortBy,
            sortOrder: settings.sortOrder
        };

        if (this.visualizer) {
            this.visualizer.updateVisualization(this.circuit.state, vizSettings);
            this.visualizer.updateStateVector(this.circuit.state, vizSettings);
            this.visualizer.updateMeasurementResults(this.circuit.state, vizSettings);
        }

        if (this.graphVisualizer) {
            this.graphVisualizer.update(this.circuit.state, vizSettings);
        }

        // Update NMR simulator if it's been initialized
        if (this.nmrSimulator && this.nmrInitialized) {
            this.nmrSimulator.onCircuitChanged(this.circuit, this.circuit.state);
        }
    }

    updateCircuitInfo() {
        const depthEl = document.getElementById('circuitDepth');
        const gateCountEl = document.getElementById('gateCount');
        if (depthEl) depthEl.textContent = `Depth: ${this.circuit.getDepth()}`;
        if (gateCountEl) gateCountEl.textContent = `Gates: ${this.circuit.getGateCount()}`;
        this.updateStepInfo();
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

        // Initialize NMR simulator when NMR tab is first opened
        if (tab === 'nmr' && !this.nmrInitialized) {
            this.initializeNMRSimulator();
        }

        // Update NMR when switching to that tab
        if (tab === 'nmr' && this.nmrSimulator) {
            this.nmrSimulator.onCircuitChanged(this.circuit, this.circuit.state);
        }

        // Initialize Gate Creator when first opened
        if (tab === 'gateCreator' && !this.gateCreatorInitialized) {
            this.initializeGateCreatorTab();
        }

        // Initialize resources tab when first opened
        if (tab === 'resources' && !this.resourcesInitialized) {
            this.initializeResourcesTab();
        }

        // Update resources when switching to that tab
        if (tab === 'resources' && this.nmrSimulator) {
            this.nmrSimulator.updateDensityMatrix();
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
        const existingBuiltIns = new Set(['H', 'X', 'Y', 'Z', 'S', 'T', 'RX', 'RY', 'RZ', 'CX', 'CY', 'CZ', 'SWAP', 'MEASURE', 'REPEAT', 'END', 'I']);
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
        };

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
            item.style.setProperty('--gate-custom-bg', color.bg);
            item.style.setProperty('--gate-custom-glow', color.glow);
            item.innerHTML = `<span class="gate-symbol">${label}</span><span class="gate-name">${displayName}</span>`;
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
     * Initialize the Resources tab content
     */
    initializeResourcesTab() {
        const resourcesContainer = document.getElementById('resourcesContainer');
        if (!resourcesContainer) {
            console.warn('Resources container not found');
            return;
        }

        // If NMR simulator exists, use it to render resources
        if (this.nmrSimulator) {
            this.nmrSimulator.renderResourcesContent('resourcesContainer');
            this.resourcesInitialized = true;
        } else {
            // Initialize NMR simulator first if needed
            this.initializeNMRSimulator();
            if (this.nmrSimulator) {
                this.nmrSimulator.renderResourcesContent('resourcesContainer');
                this.resourcesInitialized = true;
            }
        }
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
                        <p>NMR Simulator failed to load. Please refresh the page.</p>
                    </div>
                `;
                return;
            }

            this.nmrSimulator = new NMRSimulatorUI('nmrSimulatorContainer');
            this.nmrInitialized = true;

            // Sync current circuit state
            if (this.circuit && this.circuit.state) {
                this.nmrSimulator.onCircuitChanged(this.circuit, this.circuit.state);
            }

            console.log('NMR Simulator initialized successfully');
        } catch (error) {
            console.error('Failed to initialize NMR Simulator:', error);
            nmrContainer.innerHTML = `
                <div class="nmr-error">
                    <p>Error initializing NMR Simulator: ${error.message}</p>
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
        // Only target tabs and panels within the first viz-region (Measurement/State Vector)
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

        // Debounce code changes to avoid too frequent updates
        clearTimeout(this.codeChangeDebounceTimer);
        this.codeChangeDebounceTimer = setTimeout(() => {
            this.syncCodeToCircuit();
        }, this.codeChangeDebounceDelay);

        // Update error state immediately
        this.updateErrorState();
    }

    syncCodeToCircuit() {
        if (this.isUpdatingFromCircuit) return; // Prevent circular updates

        const code = document.getElementById('qubiCode').value;
        const errorEl = document.getElementById('qubiErrors');

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

            // Clear the custom gates palette before re-parsing defines
            const customList = document.querySelector('.gate-list[data-gate-list="custom"]');
            if (customList) customList.innerHTML = '';

            const activeDefines = new Set();

            this.qubiExecutor.execute(code, {
                resolveImport,
                onDefineGate: (gateName, displayName, colorId) => {
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

                        // Add to palette
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
                                item.style.setProperty('--gate-custom-bg', resolvedColor.bg);
                                item.style.setProperty('--gate-custom-glow', resolvedColor.glow);
                                item.innerHTML = `<span class="gate-symbol">${t.slice(0, 4)}</span><span class="gate-name">${finalDisplayName}</span>`;
                                list.appendChild(item);
                            }
                        }
                    } catch { /* ignore */ }
                }
            });

            // Remove the custom category entirely if no defines were found
            if (activeDefines.size === 0) {
                const cat = document.querySelector('.gate-category[data-category="custom"]');
                if (cat) cat.remove();
            }

            // Trigger re-validation now that new gates are registered
            if (this.syntaxHighlighter) this.syntaxHighlighter.debouncedValidation?.();

            // Update qubit count display to match circuit
            document.getElementById('qubitCount').value = `${this.circuit.numQubits} Qubits`;

            this.renderCircuit();
            this.updateVisualization();
            this.resetExecution();
            errorEl.textContent = '';
            errorEl.classList.remove('has-error');

            // Auto-run if enabled
            const settings = this.getSettings();
            if (settings.autoRun) {
                this.runCircuit();
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
            if (/^\s*#(define|import|include)\b/i.test(line)) {
                preprocessorLines.push(line);
            } else {
                codeWithoutPreprocessor.push(line);
            }
        }

        const generated = this.qubiExecutor.generateCode(this.circuit, codeWithoutPreprocessor.join('\n'));

        const finalCode = preprocessorLines.length > 0
            ? preprocessorLines.join('\n') + '\n' + generated
            : generated;

        this.setEditorCode(finalCode, { preserveUndo: false, adjustQubits: false });

        this.updateErrorState();
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
        const toolbar = fixBtn ? fixBtn.closest('.editor-toolbar') : null;

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

        if (toolbar) {
            toolbar.classList.toggle('qubi-fix-hidden', !hasErrors);
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
        const statusEl = document.getElementById('qubiAiStatus');
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
        if (statusEl) {
            statusEl.textContent = 'Ready? Press Generate';
            statusEl.className = 'qubi-ai-status';
        }
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
            // Persist current editor into its tab before overwriting/adding.
            if (typeof this._persistActiveQubiEditorToFile === 'function') {
                this._persistActiveQubiEditorToFile();
            }

            const code = e.target.result;
            const fileName = file.name ? String(file.name) : 'imported.qubi';
            // Load into a new tab (or replace existing tab with same name)
            const existing = this.qubiFiles.find(f => f.name.toLowerCase() === fileName.toLowerCase());
            if (existing) {
                existing.code = String(code || '');
                this.activeQubiFileId = existing.id;
            } else {
                const id = `file_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
                this.qubiFiles.push({ id, name: fileName, code: String(code || '') });
                this.activeQubiFileId = id;
            }

            // Refresh tab strip immediately so the new/activated name shows right away.
            if (typeof this._renderQubiTabs === 'function') {
                this._renderQubiTabs();
            }

            if (typeof this._loadActiveQubiFileIntoEditor === 'function') {
                this._loadActiveQubiFileIntoEditor({ preserveUndo: true });
            } else {
                this.setEditorCode(code, { preserveUndo: true, adjustQubits: true });
            }

            // Sync code to circuit
            this.syncCodeToCircuit();

            // Clear any previous errors
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

        // Persist current tab before applying.
        if (typeof this._persistActiveQubiEditorToFile === 'function') {
            this._persistActiveQubiEditorToFile();
        }

        // Keep main around always.
        const byNameLower = new Map((this.qubiFiles || []).map(f => [String(f.name || '').toLowerCase(), f]));
        for (const lf of loadedFiles) {
            const name = String(lf.name || '').trim() || 'imported.qubi';
            const code = String(lf.code || '');
            const key = name.toLowerCase();
            const existing = byNameLower.get(key);
            if (existing) {
                existing.code = code;
                continue;
            }
            const id = `file_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
            this.qubiFiles.push({ id, name, code });
            byNameLower.set(key, this.qubiFiles[this.qubiFiles.length - 1]);
        }

        // Decide active file.
        let activate = null;
        if (activateName) {
            activate = (this.qubiFiles || []).find(f => String(f.name || '').toLowerCase() === String(activateName).toLowerCase());
        }
        if (!activate) {
            activate = (this.qubiFiles || []).find(f => String(f.name || '').toLowerCase() === 'main.qubi') || (this.qubiFiles || [])[0];
        }
        if (activate) this.activeQubiFileId = activate.id;

        if (typeof this._renderQubiTabs === 'function') this._renderQubiTabs();

        if (typeof this._loadActiveQubiFileIntoEditor === 'function') {
            this._loadActiveQubiFileIntoEditor({ preserveUndo: true });
        }
        this.syncCodeToCircuit();
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

        // Focus search after modal opens
        if (searchInput) setTimeout(() => searchInput.focus(), 100);
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

        const categoryOrder = ['Entanglement', 'Communication', 'Algorithm', 'Concept', 'Error Correction'];
        const categoryIcons = {
            'Entanglement': '🔗', 'Communication': '📡', 'Algorithm': '⚙️',
            'Concept': '💡', 'Error Correction': '🛡️'
        };

        let totalResults = 0;
        categoryOrder.forEach(catName => {
            if (!categories[catName]) return;
            totalResults += categories[catName].length;
            const section = document.createElement('div');
            section.className = 'algo-category-section';
            section.innerHTML = `<div class="algo-category-header"><span class="algo-category-icon">${categoryIcons[catName] || '📦'}</span><span>${catName}</span></div>`;
            const grid = document.createElement('div');
            grid.className = 'algo-category-grid';

            categories[catName].forEach(({ key, algo }) => {
                const qubitsDisplay = algo.qubitRange || algo.qubits;
                const item = document.createElement('div');
                item.className = 'algorithm-item';
                item.dataset.algoKey = key;
                item.innerHTML = `
                    <div class="algo-item-icon">${algo.icon || '⚛️'}</div>
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
            list.innerHTML = `<div class="algo-no-results"><span>🔍</span><p>No algorithms match "${filter}"</p></div>`;
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

        detailDiv.innerHTML = `
            <div class="algo-detail-header">
                <span class="algo-detail-icon">${algo.icon || '⚛️'}</span>
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

        this.loadAlgorithm({ code: result.code, qubits: result.qubits }, false);

        document.getElementById('algorithmsModal').classList.remove('active');
        if (detailDiv) detailDiv.style.display = 'none';
    }

    loadAlgorithm(algo, checkComments = true) {
        // Determine which code to load
        let codeToLoad = algo.code;
        if (checkComments) {
            const commentsCheckbox = document.getElementById('includeCommentsCheckbox');
            const withComments = commentsCheckbox ? commentsCheckbox.checked : false;
            if (withComments && algo.codeWithComments) {
                codeToLoad = algo.codeWithComments;
            }
        }

        // Load into Qubi editor; preserve undo and infer required qubits from code.
        this.setEditorCode(codeToLoad, { preserveUndo: true, adjustQubits: true });

        // Sync code to circuit (this will execute the code)
        this.syncCodeToCircuit();
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
                useOptimizedGates: parsed.useOptimizedGates ?? true
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
            useOptimizedGates: true
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
            useOptimizedGates: document.getElementById('setting_useOptimizedGates').checked
        };

        localStorage.setItem('quantumSimulatorSettings', JSON.stringify(settings));
        document.getElementById('settingsModal').classList.remove('active');

        // Apply max qubits limit
        if (this.circuit.numQubits > settings.maxQubits) {
            this.setQubitCount(settings.maxQubits);
        }

        // Update qubit input max attribute
        this.updateQubitInputMax();

        // Apply optimization setting to circuit
        this.circuit.setOptimization(settings.useOptimizedGates);

        // Update visualization with new settings
        this.updateVisualization();
    }

    showGateInfo(gateType) {
        const modal = document.getElementById('gateInfoModal');
        const title = document.getElementById('gateInfoTitle');
        const content = document.getElementById('gateInfoContent');

        const info = getGateInfo(gateType);
        title.textContent = info.name;

        // Default qubits for display
        const isMultiGate = ['CX', 'CY', 'CZ', 'SWAP'].includes(gateType);
        // SWAP is fixed to 2-qubit display; others allow 2-3
        const defaultQubits = isMultiGate ? 2 : 1;
        let currentQubits = defaultQubits;

        const matrixContainerId = 'gateInfoMatrixContainer';

        const matrixHtml = typeof info.matrix === 'string'
            ? `<div class="matrix-text">${info.matrix}</div>`
            : formatMatrix(getMatrixForQubits(gateType, defaultQubits));

        let qubitSlider = '';
        if (isMultiGate) {
            qubitSlider = `
                <div class="parameter-group">
                    <label for="gateInfoQubits">Display with qubits (2-3):</label>
                    <input type="range" id="gateInfoQubits" min="2" max="${gateType === 'SWAP' ? 2 : 3}" step="1" value="${defaultQubits}">
                    <span id="gateInfoQubitsValue">${defaultQubits}</span>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="gate-info-content">
                <p><strong>Category:</strong> ${info.category}</p>
                <p class="description">${info.description}</p>
                ${qubitSlider}
                <h4>Matrix Representation:</h4>
                <div id="${matrixContainerId}" class="matrix">${matrixHtml}</div>
            </div>
        `;

        if (isMultiGate) {
            const slider = document.getElementById('gateInfoQubits');
            const valueLabel = document.getElementById('gateInfoQubitsValue');
            slider.addEventListener('input', () => {
                currentQubits = parseInt(slider.value);
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
        const bgColor = includeBackground ? computedStyle.getPropertyValue('--background').trim() || '#0f172a' : null;

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
        const bgColor = includeBackground ? computedStyle.getPropertyValue('--background').trim() || '#0f172a' : null;

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
        const bgColor = computedStyle.getPropertyValue('--background').trim() || '#0f172a';
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
            'SWAP': '#ec4899',
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
                'CX': 'X', 'CY': 'Y', 'CZ': 'Z', 'SWAP': '⇄',
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
        const bgColor = includeBackground ? computedStyle.getPropertyValue('--background').trim() || '#0f172a' : '#ffffff';

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


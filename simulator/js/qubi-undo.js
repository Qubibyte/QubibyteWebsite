/**
 * Per-file undo/redo for the Qubi editor and circuit builder (Ctrl+Z / Ctrl+Y).
 * Snapshots store editor code; applying a snapshot re-parses the circuit for sync.
 */
(function (g) {
    const MAX_ENTRIES = 80;
    const CODE_MERGE_MS = 700;

    class QubiUndoManager {
        /** @param {{ ui?: object }} [opts] */
        constructor(opts = {}) {
            this.ui = opts.ui || null;
            /** @type {Map<string, { entries: { code: string }[], index: number }>} */
            this._stacks = new Map();
            this._codeSnapshotTimer = 0;
            this._bound = false;
        }

        _currentFileId() {
            return this.ui?.activeQubiFileId || 'main';
        }

        _getEditorCode() {
            const editor = document.getElementById('qubiCode');
            return editor ? String(editor.value || '') : '';
        }

        _codeForFile(fileId) {
            if (fileId === this._currentFileId()) return this._getEditorCode();
            const file = (this.ui?.qubiFiles || []).find((f) => f.id === fileId);
            return file ? String(file.code || '') : '';
        }

        _getStack(fileId = this._currentFileId()) {
            if (!this._stacks.has(fileId)) {
                this._stacks.set(fileId, {
                    entries: [{ code: this._codeForFile(fileId) }],
                    index: 0
                });
            }
            return this._stacks.get(fileId);
        }

        _shouldSkip() {
            const ui = this.ui;
            if (!ui) return true;
            if (ui._undoApplying) return true;
            if (ui._historyApplying) return true;
            if (ui.isUpdatingFromCircuit) return true;
            if (ui.isUpdatingFromCode) return true;
            return false;
        }

        _clearCodeTimer() {
            if (this._codeSnapshotTimer) {
                clearTimeout(this._codeSnapshotTimer);
                this._codeSnapshotTimer = 0;
            }
        }

        reset(fileId, code) {
            if (!fileId) return;
            const text = String(code ?? '');
            this._stacks.set(fileId, { entries: [{ code: text }], index: 0 });
            if (fileId === this._currentFileId()) this._clearCodeTimer();
            this._updateButtons();
        }

        /** Debounced snapshot while typing in the Qubi editor. */
        scheduleCodeSnapshot() {
            if (this._shouldSkip()) return;
            this._clearCodeTimer();
            this._codeSnapshotTimer = setTimeout(() => {
                this._codeSnapshotTimer = 0;
                this.recordSnapshot();
            }, CODE_MERGE_MS);
        }

        /** Flush a pending typing snapshot (e.g. before tab switch). */
        flushPending(fileId = this._currentFileId()) {
            if (this._shouldSkip()) return;
            if (!this._codeSnapshotTimer) return;
            this._clearCodeTimer();
            const stack = this._getStack(fileId);
            const code = this._codeForFile(fileId);
            if (stack.entries[stack.index]?.code !== code) {
                this._push(fileId, code);
            }
        }

        /** Record the current editor state (circuit edits, immediate code snapshots). */
        recordSnapshot() {
            if (this._shouldSkip()) return;
            this._clearCodeTimer();
            this._push(this._currentFileId(), this._getEditorCode());
        }

        /** Capture editor state before a programmatic replacement (e.g. loading an example). */
        beginExternalChange() {
            if (this._shouldSkip()) return;
            this._clearCodeTimer();
            this.flushPending();
            this._push(this._currentFileId(), this._getEditorCode());
        }

        /** Commit editor state after a programmatic replacement so Ctrl+Z can restore the prior version. */
        finishExternalChange() {
            if (this._shouldSkip()) return;
            this._clearCodeTimer();
            this._push(this._currentFileId(), this._getEditorCode());
        }

        /** Record a before/after pair for a tab that is not currently in the editor. */
        recordExternalChangeForFile(fileId, beforeCode, afterCode) {
            if (this._shouldSkip() || !fileId) return;
            this._clearCodeTimer();
            this.flushPending(fileId);
            this._push(fileId, String(beforeCode ?? ''));
            this._push(fileId, String(afterCode ?? ''));
        }

        _push(fileId, code) {
            const stack = this._getStack(fileId);
            const current = stack.entries[stack.index];
            if (current && current.code === code) {
                if (fileId === this._currentFileId()) this._updateButtons();
                return;
            }

            if (stack.index < stack.entries.length - 1) {
                stack.entries = stack.entries.slice(0, stack.index + 1);
            }

            stack.entries.push({ code });
            if (stack.entries.length > MAX_ENTRIES) {
                stack.entries.shift();
            } else {
                stack.index++;
            }

            if (fileId === this._currentFileId()) this._updateButtons();
        }

        canUndo(fileId = this._currentFileId()) {
            return this._getStack(fileId).index > 0;
        }

        canRedo(fileId = this._currentFileId()) {
            const stack = this._getStack(fileId);
            return stack.index < stack.entries.length - 1;
        }

        undo() {
            if (!this.canUndo()) return false;
            const stack = this._getStack();
            stack.index--;
            this._apply(stack.entries[stack.index].code);
            return true;
        }

        redo() {
            if (!this.canRedo()) return false;
            const stack = this._getStack();
            stack.index++;
            this._apply(stack.entries[stack.index].code);
            return true;
        }

        _apply(code) {
            const ui = this.ui;
            if (!ui) return;

            ui._undoApplying = true;
            try {
                ui.setEditorCode(code, { preserveUndo: false, adjustQubits: true, focus: false });
                if (typeof ui._persistActiveQubiEditorToFile === 'function') {
                    ui._persistActiveQubiEditorToFile();
                }
                ui.syncCodeToCircuit({ suppressAutoRun: false });
            } finally {
                ui._undoApplying = false;
            }
            this._updateButtons();
        }

        onTabSwitch(fromFileId, toFileId) {
            if (fromFileId) this.flushPending(fromFileId);
            this._getStack(toFileId);
            this._updateButtons();
        }

        removeFile(fileId) {
            if (!fileId) return;
            this._stacks.delete(fileId);
        }

        _shouldHandleShortcut(e) {
            if (!e.ctrlKey && !e.metaKey) return false;

            const target = e.target;
            if (!(target instanceof Element)) return false;

            if (target.closest('.modal.active, .qubi-history-modal.active')) {
                if (!target.closest('#qubiCode')) return false;
            }

            if (target.id === 'qubiCode') return true;

            if (target.closest('input, textarea, select')) return false;

            if (document.body.classList.contains('is-placed-gate-drag')) return true;

            return !!target.closest(
                '.circuit-area, .circuit-canvas, .circuit-canvas-wrapper, .sidebar, .code-panel, .app-container'
            );
        }

        _handleShortcut(e) {
            if (!this._shouldHandleShortcut(e)) return;

            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
                return;
            }
            if (key === 'y' || (key === 'z' && e.shiftKey)) {
                e.preventDefault();
                this.redo();
            }
        }

        updateControls() {
            this._updateButtons();
        }

        bindUi() {
            if (this._bound) return;
            this._bound = true;

            document.getElementById('circuitUndoBtn')?.addEventListener('click', () => this.undo());
            document.getElementById('circuitRedoBtn')?.addEventListener('click', () => this.redo());

            document.addEventListener('keydown', (e) => this._handleShortcut(e), true);

            this._updateButtons();
        }

        _updateButtons() {
            const undoBtn = document.getElementById('circuitUndoBtn');
            const redoBtn = document.getElementById('circuitRedoBtn');
            if (!undoBtn || !redoBtn) return;

            const canUndo = this.canUndo();
            const canRedo = this.canRedo();

            undoBtn.disabled = !canUndo;
            redoBtn.disabled = !canRedo;
            undoBtn.setAttribute('aria-disabled', canUndo ? 'false' : 'true');
            redoBtn.setAttribute('aria-disabled', canRedo ? 'false' : 'true');
        }
    }

    g.QubiUndoManager = QubiUndoManager;
})(typeof globalThis !== 'undefined' ? globalThis : window);

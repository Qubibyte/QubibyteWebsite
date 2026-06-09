/**
 * Per-file version history for the Qubi code editor (local snapshots + line diffs).
 */
(function (g) {
    const STORAGE_KEY = 'qubiEditorHistoryV1';
    const MAX_VERSIONS = 60;
    const MAX_LOST = 24;
    const DEBOUNCE_MS = 2000;

    function escapeHtml(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function uid(prefix = 'v') {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function lineCount(code) {
        if (code == null || code === '') return 0;
        return String(code).split('\n').length;
    }

    /** @returns {{ type: 'same'|'add'|'remove', line: string }[]} */
    function diffLines(before, after) {
        const a = before === '' ? [] : String(before).split('\n');
        const b = after === '' ? [] : String(after).split('\n');
        const n = a.length;
        const m = b.length;

        if (n === 0 && m === 0) return [];
        if (n === 0) return b.map((line) => ({ type: 'add', line }));
        if (m === 0) return a.map((line) => ({ type: 'remove', line }));

        const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                dp[i][j] = a[i] === b[j]
                    ? dp[i + 1][j + 1] + 1
                    : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }

        const ops = [];
        let i = 0;
        let j = 0;
        while (i < n || j < m) {
            if (i < n && j < m && a[i] === b[j]) {
                ops.push({ type: 'same', line: a[i] });
                i++;
                j++;
            } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
                ops.push({ type: 'add', line: b[j] });
                j++;
            } else {
                ops.push({ type: 'remove', line: a[i] });
                i++;
            }
        }
        return ops;
    }

    function diffStats(ops) {
        let added = 0;
        let removed = 0;
        for (const op of ops) {
            if (op.type === 'add') added++;
            else if (op.type === 'remove') removed++;
        }
        return { added, removed };
    }

    /** 0-based line indices in `after` that changed vs `before`. */
    function getChangedLineIndices(before, after) {
        const ops = diffLines(before, after);
        const indices = [];
        let afterIdx = 0;
        for (const op of ops) {
            if (op.type === 'add') {
                indices.push(afterIdx);
                afterIdx++;
            } else if (op.type === 'same') {
                afterIdx++;
            }
        }
        return indices;
    }

    function formatRelativeTime(ts) {
        const diff = Date.now() - ts;
        if (diff < 45_000) return 'just now';
        if (diff < 90_000) return '1 min ago';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
        const d = new Date(ts);
        return d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function defaultLabel(kind, index) {
        if (index === 0) return 'Initial version';
        if (kind === 'load') return 'Loaded from file';
        if (kind === 'revert') return 'Reverted';
        if (kind === 'branch') return 'Branched copy';
        if (kind === 'ai') return 'QubiAI generation';
        return 'Edit';
    }

    class QubiFileHistory {
        /** @param {{ ui?: object }} [opts] */
        constructor(opts = {}) {
            this.ui = opts.ui || null;
            this._store = this._loadStore();
            this._debounceTimers = new Map();
            this._selectedVersionId = null;
            this._modal = null;
            this._bound = false;
            this._renamingVersionId = null;
            this._entrySelectTimer = 0;
        }

        _loadStore() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        if (!parsed.files) parsed.files = {};
                        if (!Array.isArray(parsed.lostAndFound)) parsed.lostAndFound = [];
                        return parsed;
                    }
                }
            } catch {
                /* ignore */
            }
            return { files: {}, lostAndFound: [] };
        }

        _saveStore() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this._store));
            } catch {
                this._trimAllFiles(30);
                while (this._store.lostAndFound.length > 12) {
                    this._store.lostAndFound.shift();
                }
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._store));
                } catch {
                    /* give up silently */
                }
            }
        }

        _trimAllFiles(max) {
            for (const fileId of Object.keys(this._store.files)) {
                this._trimFile(fileId, max);
            }
        }

        _trimFile(fileId, max = MAX_VERSIONS) {
            const rec = this._store.files[fileId];
            if (!rec || !Array.isArray(rec.versions)) return;
            while (rec.versions.length > max) {
                rec.versions.shift();
            }
            if (rec.versions.length) {
                rec.headId = rec.versions[rec.versions.length - 1].id;
            }
        }

        _getFileRecord(fileId, create = false) {
            if (!fileId) return null;
            if (!this._store.files[fileId]) {
                if (!create) return null;
                this._store.files[fileId] = {
                    headId: null,
                    versions: [],
                    branchFrom: null,
                    fileName: null
                };
            }
            return this._store.files[fileId];
        }

        _shouldSkipRecord() {
            const ui = this.ui;
            if (!ui) return false;
            if (ui._historyApplying) return true;
            if (ui._undoApplying) return true;
            if (ui.isUpdatingFromCircuit) return true;
            if (ui.isUpdatingFromCode) return true;
            return false;
        }

        /** Move histories for tabs that no longer exist (e.g. after refresh). */
        reconcileOrphanedHistories(activeFileIds) {
            const active = new Set(activeFileIds || []);
            for (const fileId of Object.keys(this._store.files)) {
                if (active.has(fileId)) continue;
                const rec = this._store.files[fileId];
                if (!rec?.versions?.length) {
                    delete this._store.files[fileId];
                    continue;
                }
                this._archiveRecord(fileId, rec, rec.fileName || fileId, 'orphaned');
            }
            this._saveStore();
        }

        _archiveRecord(fileId, rec, fileName, reason) {
            if (!rec?.versions?.length) return;
            this._store.lostAndFound.push({
                id: uid('lf'),
                fileId,
                fileName: fileName || 'untitled.qubi',
                archivedAt: Date.now(),
                reason,
                headId: rec.headId,
                versions: rec.versions,
                branchFrom: rec.branchFrom || null
            });
            while (this._store.lostAndFound.length > MAX_LOST) {
                this._store.lostAndFound.shift();
            }
            delete this._store.files[fileId];
        }

        /** Archive history when a tab is closed (non-main). */
        archiveFile(fileId, fileName, reason = 'tab_closed') {
            if (!fileId || fileId === 'main') return;
            const rec = this._store.files[fileId];
            if (!rec) return;
            rec.fileName = fileName || rec.fileName;
            this._archiveRecord(fileId, rec, fileName, reason);
            this._saveStore();
        }

        /** @deprecated use archiveFile */
        purgeFile(fileId) {
            this.archiveFile(fileId, null, 'tab_closed');
        }

        getLostAndFound() {
            return (this._store.lostAndFound || []).slice().reverse();
        }

        dismissLostAndFound(lfId) {
            const idx = this._store.lostAndFound.findIndex((x) => x.id === lfId);
            if (idx >= 0) {
                this._store.lostAndFound.splice(idx, 1);
                this._saveStore();
            }
        }

        importFromLostAndFound(lfId) {
            const ui = this.ui;
            if (!ui) return false;
            const idx = this._store.lostAndFound.findIndex((x) => x.id === lfId);
            if (idx < 0) return false;
            const entry = this._store.lostAndFound[idx];
            const head = entry.versions.find((v) => v.id === entry.headId) ||
                entry.versions[entry.versions.length - 1];
            const code = head ? head.code : '';

            if (typeof ui._persistActiveQubiEditorToFile === 'function') {
                ui._persistActiveQubiEditorToFile();
            }

            const existing = new Set((ui.qubiFiles || []).map((f) => f.name.toLowerCase()));
            let name = entry.fileName || 'recovered.qubi';
            if (existing.has(name.toLowerCase())) {
                const stem = name.replace(/\.qubi$/i, '');
                for (let i = 2; i < 200; i++) {
                    const candidate = `${stem} (${i}).qubi`;
                    if (!existing.has(candidate.toLowerCase())) {
                        name = candidate;
                        break;
                    }
                }
            }

            const newId = `file_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
            ui.qubiFiles.push({ id: newId, name, code });
            ui.activeQubiFileId = newId;

            this._store.files[newId] = {
                headId: entry.headId,
                versions: entry.versions.map((v) => ({ ...v })),
                branchFrom: entry.branchFrom,
                fileName: name
            };
            this._store.lostAndFound.splice(idx, 1);
            this._saveStore();

            if (typeof ui._renderQubiTabs === 'function') ui._renderQubiTabs();
            if (typeof ui._loadActiveQubiFileIntoEditor === 'function') {
                ui._loadActiveQubiFileIntoEditor({ preserveUndo: false });
            }
            if (typeof ui.syncCodeToCircuit === 'function') ui.syncCodeToCircuit();
            ui.qubiUndo?.reset(newId, code);

            this._hideLostPanel();
            this._renderModalContents();
            return true;
        }

        clearFileHistory(fileId) {
            const ui = this.ui;
            if (!fileId) return;
            const editor = document.getElementById('qubiCode');
            const file = (ui?.qubiFiles || []).find((f) => f.id === fileId);
            const code = editor && ui?.activeQubiFileId === fileId
                ? String(editor.value || '')
                : String(file?.code || '');

            delete this._store.files[fileId];
            this._getFileRecord(fileId, true);
            const rec = this._store.files[fileId];
            rec.fileName = file?.name || rec.fileName;
            rec.versions = [];
            rec.headId = null;
            rec.branchFrom = null;
            this._pushVersion(fileId, code, {
                kind: 'initial',
                label: 'Initial version',
                force: true
            });
            this._selectedVersionId = rec.headId;
            this._saveStore();
            ui?.qubiUndo?.reset(fileId, code);
            this._renderModalContents();
        }

        renameVersion(fileId, versionId, newLabel) {
            const rec = this._getFileRecord(fileId);
            if (!rec) return;
            const version = rec.versions.find((v) => v.id === versionId);
            if (!version) return;
            const label = String(newLabel ?? '').trim();
            if (!label) return;
            version.label = label.slice(0, 80);
            this._saveStore();
            this._renamingVersionId = null;
            this._renderModalContents();
        }

        ensureFile(fileId, code, meta = {}) {
            const rec = this._getFileRecord(fileId, true);
            const ui = this.ui;
            const file = (ui?.qubiFiles || []).find((f) => f.id === fileId);
            if (file?.name) rec.fileName = file.name;
            if (!rec.versions.length) {
                this._pushVersion(fileId, String(code ?? ''), {
                    kind: meta.kind || 'initial',
                    label: meta.label || 'Initial version',
                    force: true
                });
            }
        }

        seedBranch(newFileId, code, { fromFileId, fromFileName, fromVersionId, fromLabel } = {}) {
            const rec = this._getFileRecord(newFileId, true);
            rec.branchFrom = {
                fileId: fromFileId,
                fileName: fromFileName,
                versionId: fromVersionId,
                label: fromLabel
            };
            rec.versions = [];
            rec.headId = null;
            this._pushVersion(newFileId, String(code ?? ''), {
                kind: 'branch',
                label: fromFileName ? `Branched from ${fromFileName}` : 'Branched copy',
                force: true
            });
        }

        scheduleRecord(fileId, code) {
            if (!fileId || this._shouldSkipRecord()) return;
            clearTimeout(this._debounceTimers.get(fileId));
            this._debounceTimers.set(
                fileId,
                setTimeout(() => {
                    this._debounceTimers.delete(fileId);
                    this.recordImmediate(fileId, code, { kind: 'edit' });
                }, DEBOUNCE_MS)
            );
        }

        flushPending(fileId, code) {
            if (!fileId) return;
            if (this._debounceTimers.has(fileId)) {
                clearTimeout(this._debounceTimers.get(fileId));
                this._debounceTimers.delete(fileId);
                this.recordImmediate(fileId, code, { kind: 'edit' });
            }
        }

        recordImmediate(fileId, code, meta = {}) {
            if (!fileId) return;
            if (!meta.force && this._shouldSkipRecord()) return;
            this._pushVersion(fileId, String(code ?? ''), meta);
        }

        _pushVersion(fileId, code, meta = {}) {
            const rec = this._getFileRecord(fileId, true);
            const ui = this.ui;
            const file = (ui?.qubiFiles || []).find((f) => f.id === fileId);
            if (file?.name) rec.fileName = file.name;

            const last = rec.versions[rec.versions.length - 1];
            if (last && last.code === code && !meta.force) return;

            const version = {
                id: uid(),
                parentId: last ? last.id : null,
                ts: Date.now(),
                code,
                kind: meta.kind || 'edit',
                label: meta.label || defaultLabel(meta.kind, rec.versions.length)
            };

            const parentCode = last ? last.code : '';
            const stats = diffStats(diffLines(parentCode, code));
            version.added = stats.added;
            version.removed = stats.removed;
            version.lines = lineCount(code);

            rec.versions.push(version);
            rec.headId = version.id;
            this._trimFile(fileId);
            this._saveStore();

            if (this._modal?.classList.contains('active') && ui?.activeQubiFileId === fileId) {
                if (this._renamingVersionId) return;
                this._renderModalContents();
            }
        }

        getVersions(fileId) {
            const rec = this._getFileRecord(fileId);
            if (!rec) return [];
            return rec.versions.slice();
        }

        getVersion(fileId, versionId) {
            return this.getVersions(fileId).find((v) => v.id === versionId) || null;
        }

        _getCurrentEditorCode() {
            const ui = this.ui;
            if (ui && typeof ui._persistActiveQubiEditorToFile === 'function') {
                ui._persistActiveQubiEditorToFile();
            }
            const fileId = ui?.activeQubiFileId;
            const editor = document.getElementById('qubiCode');
            if (editor && fileId) {
                return String(editor.value || '');
            }
            const file = (ui?.qubiFiles || []).find((f) => f.id === fileId);
            return file ? String(file.code || '') : '';
        }

        _editorMatchesVersion(version) {
            if (!version) return false;
            return this._getCurrentEditorCode() === String(version.code ?? '');
        }

        bindUi() {
            if (this._bound) return;
            this._bound = true;

            const btn = document.getElementById('qubiHistoryBtn');
            const modal = document.getElementById('qubiHistoryModal');
            if (!btn || !modal) return;

            this._modal = modal;

            btn.addEventListener('click', () => this.openModal());
            document.getElementById('qubiHistoryCloseBtn')?.addEventListener('click', () => this.closeModal());
            document.getElementById('qubiHistoryBackdrop')?.addEventListener('click', () => this.closeModal());
            document.getElementById('qubiHistoryRevertBtn')?.addEventListener('click', () => this._revertSelected());
            document.getElementById('qubiHistoryBranchBtn')?.addEventListener('click', () => this._branchSelected());
            document.getElementById('qubiHistoryClearBtn')?.addEventListener('click', () => this._showClearConfirm());
            document.getElementById('qubiHistoryLostFoundBtn')?.addEventListener('click', () => this._showLostPanel());
            document.getElementById('qubiHistoryLostCloseBtn')?.addEventListener('click', () => this._hideLostPanel());
            document.getElementById('qubiHistoryConfirmCancelBtn')?.addEventListener('click', () => this._hideClearConfirm());
            document.getElementById('qubiHistoryConfirmOkBtn')?.addEventListener('click', () => this._confirmClearHistory());
            document.getElementById('qubiHistoryConfirmPanel')?.addEventListener('click', (e) => {
                if (e.target.id === 'qubiHistoryConfirmPanel') this._hideClearConfirm();
            });

            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const confirmPanel = document.getElementById('qubiHistoryConfirmPanel');
                    if (confirmPanel && !confirmPanel.hidden) {
                        this._hideClearConfirm();
                        return;
                    }
                    const panel = document.getElementById('qubiHistoryLostPanel');
                    if (panel && !panel.hidden) {
                        this._hideLostPanel();
                    } else {
                        this.closeModal();
                    }
                }
            });
        }

        openModal() {
            if (!this._modal || !this.ui) return;
            if (typeof this.ui._persistActiveQubiEditorToFile === 'function') {
                this.ui._persistActiveQubiEditorToFile();
            }
            const fileId = this.ui.activeQubiFileId;
            const editor = document.getElementById('qubiCode');
            if (fileId && editor) {
                this.ensureFile(fileId, editor.value);
            }

            const versions = this.getVersions(fileId);
            this._selectedVersionId = versions.length ? versions[versions.length - 1].id : null;
            this._renamingVersionId = null;
            this._hideClearConfirm();
            this._hideLostPanel();

            this._modal.classList.add('active');
            this._modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('qubi-history-open');
            this._renderModalContents();
        }

        closeModal() {
            if (!this._modal) return;
            this._hideClearConfirm();
            this._hideLostPanel();
            this._modal.classList.remove('active');
            this._modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('qubi-history-open');
            this._renamingVersionId = null;
        }

        _showClearConfirm() {
            const ui = this.ui;
            if (!ui?.activeQubiFileId) return;

            const panel = document.getElementById('qubiHistoryConfirmPanel');
            const messageEl = document.getElementById('qubiHistoryConfirmMessage');
            if (!panel || !messageEl) return;

            const file = (ui.qubiFiles || []).find((f) => f.id === ui.activeQubiFileId);
            const name = file?.name || 'this file';
            const rec = this._getFileRecord(ui.activeQubiFileId);
            const count = rec?.versions?.length || 0;

            messageEl.innerHTML =
                `All <strong>${count}</strong> saved snapshot${count === 1 ? '' : 's'} for ` +
                `<code class="qubi-history-confirm-filename">${escapeHtml(name)}</code> will be permanently removed. ` +
                `Your current editor content will stay as a single new starting snapshot.`;

            this._hideLostPanel();
            panel.hidden = false;

            const cancelBtn = document.getElementById('qubiHistoryConfirmCancelBtn');
            requestAnimationFrame(() => cancelBtn?.focus({ preventScroll: true }));
        }

        _hideClearConfirm() {
            const panel = document.getElementById('qubiHistoryConfirmPanel');
            if (panel) panel.hidden = true;
        }

        _confirmClearHistory() {
            const ui = this.ui;
            if (!ui?.activeQubiFileId) return;
            this._hideClearConfirm();
            this.clearFileHistory(ui.activeQubiFileId);
        }

        _showLostPanel() {
            const panel = document.getElementById('qubiHistoryLostPanel');
            if (!panel) return;
            this._hideClearConfirm();
            panel.hidden = false;
            this._renderLostList();
        }

        _hideLostPanel() {
            const panel = document.getElementById('qubiHistoryLostPanel');
            if (panel) panel.hidden = true;
        }

        _renderLostList() {
            const list = document.getElementById('qubiHistoryLostList');
            if (!list) return;
            const items = this.getLostAndFound();
            if (!items.length) {
                list.innerHTML = '<div class="qubi-history-lost-empty">Nothing in Lost &amp; Found right now.</div>';
                return;
            }

            list.innerHTML = items.map((entry) => {
                const count = entry.versions?.length || 0;
                const head = entry.versions?.find((v) => v.id === entry.headId) ||
                    entry.versions?.[entry.versions.length - 1];
                const lines = head ? (head.lines ?? lineCount(head.code)) : 0;
                const reason = entry.reason === 'tab_closed' ? 'Tab closed' : 'Page refresh';
                return (
                    `<article class="qubi-history-lost-item" data-lf-id="${escapeHtml(entry.id)}">` +
                    `<div class="qubi-history-lost-item-main">` +
                    `<span class="qubi-history-lost-item-name">${escapeHtml(entry.fileName)}</span>` +
                    `<span class="qubi-history-lost-item-meta">${escapeHtml(reason)} · ${count} version${count === 1 ? '' : 's'} · ${lines} line${lines === 1 ? '' : 's'} · ${escapeHtml(formatRelativeTime(entry.archivedAt))}</span>` +
                    `</div>` +
                    `<div class="qubi-history-lost-item-actions">` +
                    `<button type="button" class="btn btn-primary btn-small qubi-history-lost-import" data-lf-id="${escapeHtml(entry.id)}">Import</button>` +
                    `<button type="button" class="btn btn-secondary btn-small qubi-history-lost-dismiss" data-lf-id="${escapeHtml(entry.id)}">Dismiss</button>` +
                    `</div></article>`
                );
            }).join('');

            list.querySelectorAll('.qubi-history-lost-import').forEach((btn) => {
                btn.addEventListener('click', () => this.importFromLostAndFound(btn.dataset.lfId));
            });
            list.querySelectorAll('.qubi-history-lost-dismiss').forEach((btn) => {
                btn.addEventListener('click', () => {
                    this.dismissLostAndFound(btn.dataset.lfId);
                    this._renderLostList();
                });
            });
        }

        _renderModalContents() {
            const ui = this.ui;
            if (!ui || !this._modal) return;

            const fileId = ui.activeQubiFileId;
            const file = (ui.qubiFiles || []).find((f) => f.id === fileId);
            const rec = this._getFileRecord(fileId);
            if (rec && file?.name) rec.fileName = file.name;

            const versions = rec ? rec.versions.slice().reverse() : [];
            const headId = rec?.headId;

            const titleEl = document.getElementById('qubiHistoryFileName');
            if (titleEl) titleEl.textContent = file?.name || 'Untitled';

            const branchEl = document.getElementById('qubiHistoryBranchMeta');
            if (branchEl) {
                if (rec?.branchFrom?.fileName) {
                    branchEl.textContent = `Branched from ${rec.branchFrom.fileName}`;
                    branchEl.hidden = false;
                } else {
                    branchEl.textContent = '';
                    branchEl.hidden = true;
                }
            }

            const lostBtn = document.getElementById('qubiHistoryLostFoundBtn');
            if (lostBtn) {
                const n = this.getLostAndFound().length;
                lostBtn.textContent = n ? `Lost & Found (${n})` : 'Lost & Found';
            }

            const timeline = document.getElementById('qubiHistoryTimeline');
            const diffPane = document.getElementById('qubiHistoryDiff');
            const emptyEl = document.getElementById('qubiHistoryEmpty');
            if (!timeline || !diffPane) return;

            if (!versions.length) {
                timeline.innerHTML = '';
                diffPane.innerHTML = '';
                if (emptyEl) emptyEl.hidden = false;
                this._updateActionButtons(null, headId);
                return;
            }
            if (emptyEl) emptyEl.hidden = true;

            if (!this._selectedVersionId || !versions.some((v) => v.id === this._selectedVersionId)) {
                this._selectedVersionId = versions[0].id;
            }

            const skipTimelineRebuild = !!this._renamingVersionId;

            if (!skipTimelineRebuild) {
            timeline.innerHTML = versions.map((v) => {
                const isHead = v.id === headId;
                const isSelected = v.id === this._selectedVersionId;
                const lines = v.lines ?? lineCount(v.code);
                const stats = v.added || v.removed
                    ? `<span class="qubi-history-stat qubi-history-stat--add">+${v.added || 0}</span>` +
                      `<span class="qubi-history-stat qubi-history-stat--del">−${v.removed || 0}</span>`
                    : '<span class="qubi-history-stat qubi-history-stat--same">±0</span>';
                return (
                    `<button type="button" class="qubi-history-entry${isSelected ? ' is-selected' : ''}" ` +
                    `data-version-id="${escapeHtml(v.id)}" aria-pressed="${isSelected ? 'true' : 'false'}" ` +
                    `title="Double-click to rename">` +
                    `<span class="qubi-history-entry-top">` +
                    `<span class="qubi-history-entry-label" data-version-id="${escapeHtml(v.id)}">${escapeHtml(v.label)}</span>` +
                    `${isHead ? '<span class="qubi-history-head-badge">HEAD</span>' : ''}` +
                    `</span>` +
                    `<span class="qubi-history-entry-meta">` +
                    `<span class="qubi-history-entry-time">${escapeHtml(formatRelativeTime(v.ts))}</span>` +
                    `<span class="qubi-history-entry-stats">${stats}<span class="qubi-history-line-count">${lines} line${lines === 1 ? '' : 's'}</span></span>` +
                    `</span>` +
                    `</button>`
                );
            }).join('');

            timeline.querySelectorAll('.qubi-history-entry').forEach((btn) => {
                btn.addEventListener('click', (e) => {
                    if (this._renamingVersionId) return;
                    if (e.detail > 1) return;
                    clearTimeout(this._entrySelectTimer);
                    const versionId = btn.dataset.versionId;
                    this._entrySelectTimer = setTimeout(() => {
                        this._entrySelectTimer = 0;
                        if (this._renamingVersionId) return;
                        this._selectedVersionId = versionId;
                        this._renderModalContents();
                    }, 280);
                });
                btn.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearTimeout(this._entrySelectTimer);
                    this._entrySelectTimer = 0;
                    const versionId = btn.dataset.versionId;
                    this._selectedVersionId = versionId;
                    const v = versions.find((x) => x.id === versionId);
                    const labelEl = btn.querySelector('.qubi-history-entry-label');
                    if (labelEl && v) this._startVersionRename(fileId, versionId, labelEl, v.label);
                });
            });
            }

            const selected = versions.find((v) => v.id === this._selectedVersionId) || versions[0];
            const parent = selected.parentId
                ? rec.versions.find((v) => v.id === selected.parentId)
                : null;
            const parentCode = parent ? parent.code : '';
            diffPane.innerHTML = this._renderFullCodeHtml(parentCode, selected.code, selected);
            this._scrollToFirstChange(diffPane, parentCode, selected.code);

            this._updateActionButtons(selected, headId);
        }

        _startVersionRename(fileId, versionId, labelEl, currentLabel) {
            if (this._renamingVersionId) return;
            clearTimeout(this._entrySelectTimer);
            this._entrySelectTimer = 0;
            this._renamingVersionId = versionId;

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'qubi-history-rename-input';
            input.value = currentLabel || '';
            input.maxLength = 80;
            input.setAttribute('aria-label', 'Version name');

            labelEl.replaceWith(input);
            input.focus({ preventScroll: true });
            try {
                input.select();
            } catch {
                /* ignore */
            }

            let committed = false;
            const commit = () => {
                if (committed) return;
                committed = true;
                this.renameVersion(fileId, versionId, input.value);
            };
            const cancel = () => {
                if (committed) return;
                committed = true;
                this._renamingVersionId = null;
                this._renderModalContents();
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
        }

        _updateActionButtons(selected, headId) {
            const revertBtn = document.getElementById('qubiHistoryRevertBtn');
            const branchBtn = document.getElementById('qubiHistoryBranchBtn');
            if (!revertBtn || !branchBtn) return;

            const canAct = !!selected;
            const atVersion = this._editorMatchesVersion(selected);
            revertBtn.disabled = !canAct || atVersion;
            branchBtn.disabled = !canAct;
            if (!canAct) {
                revertBtn.title = 'Replace current file with this version';
            } else if (atVersion) {
                revertBtn.title = 'Editor already matches this version';
            } else if (selected.id === headId) {
                revertBtn.title = 'Restore editor to the latest saved snapshot (HEAD)';
            } else {
                revertBtn.title = 'Replace current file with this version';
            }
        }

        _renderFullCodeHtml(before, after, version) {
            const stats = diffStats(diffLines(before, after));
            const lines = String(after || '').split('\n');
            const totalLines = lines.length;
            const changed = new Set(getChangedLineIndices(before, after));
            const firstChange = changed.size ? Math.min(...changed) : -1;

            let codeBody = '<div class="qubi-history-code-scroll" id="qubiHistoryCodeScroll"><div class="qubi-history-code-lines">';
            if (!lines.length || (lines.length === 1 && lines[0] === '')) {
                codeBody += '<div class="qubi-history-code-line is-empty"><span class="qubi-history-code-line-num"></span><span class="qubi-history-code-line-text qubi-history-diff-empty">Empty file</span></div>';
            } else {
                lines.forEach((line, idx) => {
                    const isChanged = changed.has(idx);
                    const isFirst = idx === firstChange;
                    codeBody +=
                        `<div class="qubi-history-code-line${isChanged ? ' is-changed' : ''}${isFirst ? ' is-first-change' : ''}" data-line="${idx}">` +
                        `<span class="qubi-history-code-line-num">${idx + 1}</span>` +
                        `<span class="qubi-history-code-line-text">${escapeHtml(line) || ' '}</span>` +
                        `</div>`;
                });
            }
            codeBody += '</div></div>';

            const changeHint = changed.size
                ? `<span class="qubi-history-diff-jump-hint">${changed.size} changed line${changed.size === 1 ? '' : 's'} highlighted</span>`
                : '<span class="qubi-history-diff-jump-hint">No changes vs previous version</span>';

            return (
                `<div class="qubi-history-diff-header">` +
                `<div class="qubi-history-diff-title">${escapeHtml(version.label)}</div>` +
                `<div class="qubi-history-diff-summary">` +
                `<span class="qubi-history-stat qubi-history-stat--add">+${stats.added}</span>` +
                `<span class="qubi-history-stat qubi-history-stat--del">−${stats.removed}</span>` +
                `<span class="qubi-history-diff-lines-count">${totalLines} line${totalLines === 1 ? '' : 's'} total</span>` +
                changeHint +
                `</div></div>${codeBody}`
            );
        }

        _scrollToFirstChange(diffPane, before, after) {
            const changed = getChangedLineIndices(before, after);
            if (!changed.length) return;

            const firstIdx = Math.min(...changed);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const scrollEl = diffPane.querySelector('#qubiHistoryCodeScroll');
                    const lineEl = diffPane.querySelector(`.qubi-history-code-line[data-line="${firstIdx}"]`);
                    if (!scrollEl || !lineEl) return;
                    const targetTop = lineEl.offsetTop - scrollEl.clientHeight / 2 + lineEl.offsetHeight / 2;
                    scrollEl.scrollTop = Math.max(0, targetTop);
                });
            });
        }

        _revertSelected() {
            const ui = this.ui;
            if (!ui) return;
            const fileId = ui.activeQubiFileId;
            const version = this.getVersion(fileId, this._selectedVersionId);
            if (!version) return;

            if (this._editorMatchesVersion(version)) return;

            const rec = this._getFileRecord(fileId);
            const isHeadSnapshot = rec && version.id === rec.headId;

            ui._historyApplying = true;
            try {
                if (typeof ui.setEditorCode === 'function') {
                    ui.setEditorCode(version.code, { preserveUndo: false, adjustQubits: true });
                }
                if (typeof ui._persistActiveQubiEditorToFile === 'function') {
                    ui._persistActiveQubiEditorToFile();
                }
                if (typeof ui.syncCodeToCircuit === 'function') {
                    ui.syncCodeToCircuit();
                }
                if (!isHeadSnapshot) {
                    this.recordImmediate(fileId, version.code, {
                        kind: 'revert',
                        label: `Reverted to ${formatRelativeTime(version.ts)}`,
                        force: true
                    });
                }
            } finally {
                ui._historyApplying = false;
            }

            ui.qubiUndo?.reset(fileId, version.code);
            this._renderModalContents();
        }

        _branchSelected() {
            const ui = this.ui;
            if (!ui) return;
            const fileId = ui.activeQubiFileId;
            const version = this.getVersion(fileId, this._selectedVersionId);
            if (!version) return;

            const sourceFile = (ui.qubiFiles || []).find((f) => f.id === fileId);
            const sourceName = sourceFile?.name || 'file';

            if (typeof ui._persistActiveQubiEditorToFile === 'function') {
                ui._persistActiveQubiEditorToFile();
            }

            const stem = String(sourceName).replace(/\.qubi$/i, '');
            const baseName = `${stem}-branch.qubi`;
            const existing = new Set((ui.qubiFiles || []).map((f) => f.name.toLowerCase()));
            let name = baseName;
            if (existing.has(name.toLowerCase())) {
                for (let i = 2; i < 200; i++) {
                    const candidate = `${stem}-branch${i}.qubi`;
                    if (!existing.has(candidate.toLowerCase())) {
                        name = candidate;
                        break;
                    }
                }
            }

            const newId = `file_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
            ui.qubiFiles.push({ id: newId, name, code: version.code });
            ui.activeQubiFileId = newId;

            this.seedBranch(newId, version.code, {
                fromFileId: fileId,
                fromFileName: sourceName,
                fromVersionId: version.id,
                fromLabel: version.label
            });
            const newRec = this._getFileRecord(newId, true);
            if (newRec) newRec.fileName = name;

            if (typeof ui._renderQubiTabs === 'function') ui._renderQubiTabs();
            if (typeof ui._loadActiveQubiFileIntoEditor === 'function') {
                ui._loadActiveQubiFileIntoEditor({ preserveUndo: false });
            }
            if (typeof ui.syncCodeToCircuit === 'function') ui.syncCodeToCircuit();
            ui.qubiUndo?.reset(newId, version.code);

            this.closeModal();
        }
    }

    g.QubiFileHistory = QubiFileHistory;
})(typeof globalThis !== 'undefined' ? globalThis : window);

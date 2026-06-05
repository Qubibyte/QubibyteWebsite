/**
 * NMR Simulator UI Components
 * Clean, compact interface for NMR quantum computing simulation
 */

class NMRSimulatorUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`NMR Simulator container '${containerId}' not found`);
            return;
        }

        this.nmrEngine = new NMRPhysicsEngine();
        this.circuit = null;
        this.quantumState = null;
        this.selectedSample = 'chloroform';

        // Spectrum state
        this.spectrumZoom = 1.0;
        this.spectrumPanX = 0;
        this.spectrumDragging = false;
        this.spectrumLastX = 0;

        // Fullscreen state
        this.fullscreenElement = null;

        /** @type {'3d'|'table'} */
        this.densityMatrixViewMode = '3d';
        this.densityMatrixTableHeatmap = true;
        this._densityTableRenderToken = 0;
        this._densityTableRenderAf = null;
        this._densityTableZoomMax = 16;
        this._densityTableZoomMin = 0.15;
        this._densityFitPadding = 0.92;
        this.density3dMount = null;
        this.density3dScene = null;
        this.density3dCamera = null;
        this.density3dRenderer = null;
        this.density3dContent = null;
        this.density3dBarMeshes = [];
        this.density3dAnimId = null;
        this.density3dResizeObserver = null;
        this._density3dMountWatchRo = null;
        this._density3dRetryAf = null;
        this._density3dDragging = false;
        this._density3dPointer = { x: 0, y: 0 };
        this._density3dOrbit = { yaw: 0, pitch: 0.68, radius: 12 };
        this._density3dTarget = null;
        this._density3dRaycaster = null;
        this._density3dMouse = null;
        this._density3dHoverMesh = null;
        this._density3dHoverInstance = -1;
        this._density3dInstancedMesh = null;
        this._density3dBarInstances = [];
        this._density3dMaxMag = 1;
        this._density3dBuiltDim = null;
        this._density3dBuiltNumQubits = null;
        this._density3dAbortToken = 0;
        this._density3dPaused = false;
        this._density3dPending = null;
        this._density3dRecoverScheduled = false;
        this._density3dMaxInstances = 12000;
        this._density3dUpdateGen = 0;
        this._density3dCoalesceAf = null;
        this._density3dPendingPreserveCamera = false;
        this._density3dRebuilding = false;
        this._density3dBuildTarget = null;
        this._density3dLastSize = { w: 0, h: 0 };

        /** Density matrix step-through playback (Resources panel) */
        this._densityStepStates = [];
        this._densityViewOverride = null;
        this._densityStepIndex = 0;
        this._densityPlaying = false;
        this._densityPlaybackTimer = null;
        this._densityPlaybackSpeed = 1;
        this._densityPlaybackBaseMs = 1000;
        this._densityPlaybackLoop = false;
        this.analysisVizTab = 'density';

        this.buildUI();
        this.nmrEngine.setSample(this.selectedSample);
        this._bindThemeChange();
        this.updateAllVisualizations();
    }

    /** Read simulator theme tokens for canvas drawing. */
    getNmrThemeColors() {
        const style = getComputedStyle(document.documentElement);
        const pick = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
        const accent = pick('--primary-color', '#6B5FC7');
        return {
            textPrimary: pick('--text-primary', '#f1f5f9'),
            textSecondary: pick('--text-secondary', '#94a3b8'),
            textMuted: pick('--text-muted', '#64748b'),
            bgOuter: pick('--background', '#0a0a1a'),
            bgPlot: pick('--surface', '#141428'),
            bgElevated: pick('--surface-light', '#1e1e3a'),
            border: pick('--border-color', 'rgba(255, 255, 255, 0.1)'),
            accent,
            accentText: pick('--nmr-accent-text', accent),
            accentSoft: pick('--secondary-color', '#AB6FAF'),
            highlight: pick('--nmr-highlight', '#fbbf24'),
            negative: pick('--nmr-negative', '#ef4444'),
            plotBorder: pick('--surface-lighter', '#334155'),
            grid: pick('--chart-grid-color', 'rgba(255, 255, 255, 0.06)'),
            legendBg: pick('--chart-legend-bg', pick('--chart-tooltip-bg', 'rgba(10, 10, 26, 0.95)')),
            warning: pick('--warning', '#f59e0b')
        };
    }

    _hexToRgb(color) {
        const c = (color || '').trim();
        if (c.startsWith('#')) {
            let h = c.slice(1);
            if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
            const num = parseInt(h, 16);
            return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
        }
        const m = c.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
        if (m) return { r: +m[1], g: +m[2], b: +m[3] };
        return { r: 107, g: 95, b: 199 };
    }

    _colorAlpha(color, alpha) {
        const { r, g, b } = this._hexToRgb(color);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    _bindThemeChange() {
        if (this._onThemeChange) return;
        this._onThemeChange = () => {
            clearTimeout(this._themeRefreshTimer);
            this._themeRefreshTimer = setTimeout(() => {
                this.updateMolecule();
                this.updateSpectrum();
                this._applyDensityMatrix3DBackground();
                this.updateDensityMatrix();
            }, 50);
        };
        window.addEventListener('qubibyte-theme-change', this._onThemeChange);
    }

    buildUI() {
        this.container.innerHTML = '';
        this.container.className = 'nmr-container';

        // Two-column layout: controls left, visualizations right
        this.container.innerHTML = `
            <div class="nmr-layout">
                <div class="nmr-sidebar">
                    <div class="nmr-panel" id="nmr-sample-panel">
                        <div class="nmr-panel-header">Sample</div>
                        <select class="nmr-select" id="nmr-sample-select"></select>
                        <div class="nmr-sample-info" id="nmr-sample-info"></div>
                        <div class="nmr-nuclei-list" id="nmr-nuclei-list"></div>
                    </div>
                    
                    <div class="nmr-panel" id="nmr-field-panel">
                        <div class="nmr-panel-header">Magnetic Fields</div>
                        <div class="nmr-field-row">
                            <label>B₀</label>
                            <input type="range" id="nmr-b0-slider" min="0" max="100" value="32">
                            <input type="number" id="nmr-b0-input" value="1.0" min="0.1" max="10" step="0.01">
                            <span class="nmr-unit">T</span>
                        </div>
                        <div class="nmr-field-row">
                            <label>B₁</label>
                            <input type="range" id="nmr-b1-slider" min="1" max="100" value="50">
                            <input type="number" id="nmr-b1-input" value="50" min="1" max="100" step="1">
                            <span class="nmr-unit">mT</span>
                        </div>
                    </div>
                    
                    <div class="nmr-panel" id="nmr-relax-panel">
                        <div class="nmr-panel-header">Relaxation</div>
                        <div class="nmr-field-row">
                            <label>T₁</label>
                            <input type="number" id="nmr-t1-input" value="2.0" min="0.1" max="30" step="0.1">
                            <span class="nmr-unit">s</span>
                        </div>
                        <div class="nmr-field-row">
                            <label>T₂</label>
                            <input type="number" id="nmr-t2-input" value="1.0" min="0.01" max="10" step="0.01">
                            <span class="nmr-unit">s</span>
                        </div>
                    </div>
                    
                    <div class="nmr-panel" id="nmr-pulse-shape-panel">
                        <div class="nmr-panel-header">RF Pulse</div>
                        <div class="nmr-field-row">
                            <label>Shape</label>
                            <select id="nmr-pulse-shape" class="nmr-select-inline">
                                <option value="square">Square</option>
                                <option value="gaussian">Gaussian</option>
                                <option value="sinc">Sinc</option>
                            </select>
                        </div>
                        <div class="nmr-field-row">
                            <label>Phase</label>
                            <select id="nmr-pulse-phase" class="nmr-select-inline">
                                <option value="0">0° (X)</option>
                                <option value="90">90° (Y)</option>
                                <option value="180">180° (-X)</option>
                                <option value="270">270° (-Y)</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="nmr-main">
                    <div class="nmr-viz-row">
                        <div class="nmr-panel nmr-molecule-panel" id="nmr-molecule-panel">
                            <div class="nmr-panel-header">
                                <span>Molecular Structure</span>
                                <button id="nmr-molecule-fullscreen" class="nmr-btn-sm nmr-fullscreen-btn" title="Fullscreen">⛶</button>
                            </div>
                            <canvas id="nmr-molecule-canvas"></canvas>
                        </div>
                        <div class="nmr-panel nmr-pulse-panel">
                            <div class="nmr-panel-header">Pulse Sequence</div>
                            <div class="nmr-pulse-container" id="nmr-pulse-container"></div>
                        </div>
                    </div>
                    
                    <div class="nmr-panel nmr-spectrum-panel" id="nmr-spectrum-panel">
                        <div class="nmr-panel-header">
                            <span>NMR Spectrum</span>
                            <div class="nmr-spectrum-tools">
                                <select id="nmr-spectrum-mode" class="nmr-select-sm">
                                    <option value="ppm">ppm</option>
                                    <option value="freq">Hz</option>
                                </select>
                                <button id="nmr-zoom-in" class="nmr-btn-sm">+</button>
                                <button id="nmr-zoom-out" class="nmr-btn-sm">−</button>
                                <button id="nmr-zoom-reset" class="nmr-btn-sm">Reset</button>
                                <button id="nmr-spectrum-fullscreen" class="nmr-btn-sm nmr-fullscreen-btn" title="Fullscreen">⛶</button>
                            </div>
                        </div>
                        <div class="nmr-spectrum-container">
                            <canvas id="nmr-spectrum-canvas"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.populateSampleSelect();
        this.attachEventListeners();
    }

    populateSampleSelect() {
        const select = document.getElementById('nmr-sample-select');
        if (!select) return;

        // Sort samples by qubit count (ascending), then by nucleus commonality
        const sortedSamples = Object.entries(NMRSamples)
            .sort((a, b) => {
                // Primary sort: qubit count
                const qubitDiff = a[1].nuclei.length - b[1].nuclei.length;
                if (qubitDiff !== 0) return qubitDiff;

                // Secondary sort: nucleus commonality (lower rarity score = more common)
                return this.getSampleRarityScore(a[1]) - this.getSampleRarityScore(b[1]);
            });

        sortedSamples.forEach(([key, sample]) => {
            const option = document.createElement('option');
            option.value = key;
            // Only add qubit count if not already in the name (matches (XQ) or (XQ: patterns)
            const name = sample.name;
            const hasQubitCount = /\(\d+Q[:\)]/.test(name);
            option.textContent = hasQubitCount ? name : `${name} (${sample.nuclei.length}Q)`;
            if (key === this.selectedSample) option.selected = true;
            select.appendChild(option);
        });
    }

    /**
     * Calculate a rarity score for a sample based on its nuclei.
     * Lower score = more common nuclei (should appear first).
     */
    getSampleRarityScore(sample) {
        // Nucleus commonality ranking (lower = more common/preferred)
        const rarityRank = {
            '1H': 1,   // Proton - most common, used in almost all NMR
            '19F': 2,   // Fluorine - very sensitive, 100% abundant
            '31P': 3,   // Phosphorus - common in biochem
            '13C': 4,   // Carbon - very common
            '15N': 5,   // Nitrogen - common in biochem
            '29Si': 6,  // Silicon - fairly common
            '11B': 7,   // Boron - less common
            '2H': 8,   // Deuterium - specialized
            // All spin-1/2 heavy metals are uncommon
            '77Se': 10,
            '119Sn': 11,
            '117Sn': 11,
            '115Sn': 11,
            '129Xe': 12,
            '125Te': 12,
            '123Te': 12,
            '195Pt': 15,
            '199Hg': 15,
            '207Pb': 15,
            '203Tl': 15,
            '205Tl': 15,
        };

        // Sum rarity scores for all nuclei in the sample
        let totalScore = 0;
        for (const nucleus of sample.nuclei) {
            const element = nucleus.element;
            totalScore += rarityRank[element] || 20; // Unknown nuclei get high score
        }
        return totalScore;
    }

    attachEventListeners() {
        // Sample selection
        document.getElementById('nmr-sample-select')?.addEventListener('change', (e) => {
            this.selectedSample = e.target.value;
            this.nmrEngine.setSample(this.selectedSample);
            this.spectrumZoom = 1.0;
            this.spectrumPanX = 0;
            // Re-apply current quantum state to the new sample
            if (this.quantumState) {
                this.nmrEngine.updateFromQuantumState(this.quantumState);
            }
            this.updateAllVisualizations();
        });

        // B0 field with exponential scaling
        const b0Slider = document.getElementById('nmr-b0-slider');
        const b0Input = document.getElementById('nmr-b0-input');
        if (b0Slider && b0Input) {
            const sliderToB0 = (s) => 0.1 + Math.pow(s / 100, 2) * 9.9;
            const b0ToSlider = (b) => Math.sqrt((b - 0.1) / 9.9) * 100;

            b0Slider.addEventListener('input', (e) => {
                const b0 = sliderToB0(parseFloat(e.target.value));
                b0Input.value = b0.toFixed(2);
                this.nmrEngine.B0 = b0;
                this.updateNucleiList();
                this.updateSpectrum();
            });

            b0Input.addEventListener('change', (e) => {
                let b0 = Math.max(0.1, Math.min(10, parseFloat(e.target.value) || 7.05));
                e.target.value = b0.toFixed(2);
                b0Slider.value = b0ToSlider(b0);
                this.nmrEngine.B0 = b0;
                this.updateNucleiList();
                this.updateSpectrum();
            });
        }

        // B1 field (in mT)
        const b1Slider = document.getElementById('nmr-b1-slider');
        const b1Input = document.getElementById('nmr-b1-input');
        if (b1Slider && b1Input) {
            b1Slider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                b1Input.value = val;
                this.nmrEngine.B1 = val * 1e-3;  // Convert mT to T
            });
            b1Input.addEventListener('change', (e) => {
                let val = Math.max(1, Math.min(100, parseFloat(e.target.value) || 50));
                e.target.value = val;
                b1Slider.value = val;
                this.nmrEngine.B1 = val * 1e-3;  // Convert mT to T
            });
        }

        // Relaxation
        document.getElementById('nmr-t1-input')?.addEventListener('change', (e) => {
            const val = Math.max(0.1, parseFloat(e.target.value) || 2.0);
            e.target.value = val;
            this.nmrEngine.T1 = this.nmrEngine.T1.map(() => val);
            this.updateSpectrum();
        });

        document.getElementById('nmr-t2-input')?.addEventListener('change', (e) => {
            const val = Math.max(0.01, parseFloat(e.target.value) || 1.0);
            e.target.value = val;
            this.nmrEngine.T2 = this.nmrEngine.T2.map(() => val);
            this.updateSpectrum();
        });

        // RF Pulse parameters
        document.getElementById('nmr-pulse-shape')?.addEventListener('change', (e) => {
            this.nmrEngine.pulseShape = e.target.value;
        });

        document.getElementById('nmr-pulse-phase')?.addEventListener('change', (e) => {
            this.nmrEngine.rfPhase = parseInt(e.target.value);
        });

        // Spectrum controls
        document.getElementById('nmr-spectrum-mode')?.addEventListener('change', () => {
            this.spectrumZoom = 1.0;
            this.spectrumPanX = 0;
            // Clear any empty data points that might cause issues
            if (this.spectrumData) {
                this.spectrumData.dataPoints = [];
            }
            this.updateSpectrum();
        });

        document.getElementById('nmr-zoom-in')?.addEventListener('click', () => {
            this.spectrumZoom = Math.min(10, this.spectrumZoom * 1.5);
            this.updateSpectrum();
        });

        document.getElementById('nmr-zoom-out')?.addEventListener('click', () => {
            this.spectrumZoom = Math.max(0.5, this.spectrumZoom / 1.5);
            this.updateSpectrum();
        });

        document.getElementById('nmr-zoom-reset')?.addEventListener('click', () => {
            this.spectrumZoom = 1.0;
            this.spectrumPanX = 0;
            this.updateSpectrum();
        });

        // Spectrum pan/zoom with mouse
        const specCanvas = document.getElementById('nmr-spectrum-canvas');
        if (specCanvas) {
            specCanvas.addEventListener('mousedown', (e) => {
                this.spectrumDragging = true;
                this.spectrumLastX = e.clientX;
            });
            specCanvas.addEventListener('mousemove', (e) => {
                if (this.spectrumDragging) {
                    this.spectrumPanX += (e.clientX - this.spectrumLastX) / this.spectrumZoom;
                    this.spectrumLastX = e.clientX;
                    this.updateSpectrum();
                }
            });
            specCanvas.addEventListener('mouseup', () => this.spectrumDragging = false);
            specCanvas.addEventListener('mouseleave', () => this.spectrumDragging = false);
            specCanvas.addEventListener('wheel', (e) => {
                e.preventDefault();

                // Calculate cursor position relative to canvas
                const rect = specCanvas.getBoundingClientRect();
                const cursorX = e.clientX - rect.left;

                // Get current view parameters
                const marginLeft = 55;
                const marginRight = 20;
                const plotWidth = specCanvas.width - marginLeft - marginRight;

                // Only zoom if cursor is within plot area
                if (cursorX >= marginLeft && cursorX <= marginLeft + plotWidth) {
                    // Calculate cursor position as fraction of plot width (0 to 1)
                    const cursorFraction = (cursorX - marginLeft) / plotWidth;

                    // Store old zoom
                    const oldZoom = this.spectrumZoom;

                    // Apply new zoom
                    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                    this.spectrumZoom = Math.max(0.5, Math.min(10, this.spectrumZoom * zoomFactor));

                    // Adjust pan to keep the cursor position stable
                    // The idea: the point under cursor should stay in the same place
                    if (oldZoom !== this.spectrumZoom) {
                        const zoomRatio = this.spectrumZoom / oldZoom;
                        // Adjust pan so cursor position stays put
                        // Pan is in data units, so we need to convert cursor position
                        const cursorOffset = (cursorFraction - 0.5) * plotWidth;
                        this.spectrumPanX = this.spectrumPanX * zoomRatio + cursorOffset * (1 - zoomRatio) / this.spectrumZoom;
                    }
                } else {
                    // Cursor outside plot - just zoom from center
                    this.spectrumZoom = Math.max(0.5, Math.min(10, this.spectrumZoom * (e.deltaY > 0 ? 0.9 : 1.1)));
                }

                this.updateSpectrum();
            });

            // Click handler for peak info
            specCanvas.addEventListener('click', (e) => {
                if (this.spectrumDragging) return; // Don't show popup if dragging
                this.handleSpectrumClick(e);
            });
        }

        // Fullscreen handlers
        document.getElementById('nmr-spectrum-fullscreen')?.addEventListener('click', () => {
            this.toggleFullscreen('nmr-spectrum-panel');
        });

        document.getElementById('nmr-molecule-fullscreen')?.addEventListener('click', () => {
            this.toggleFullscreen('nmr-molecule-panel');
        });

        // ESC to exit fullscreen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.fullscreenElement) {
                this.exitFullscreen();
            }
        });
    }

    toggleFullscreen(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (this.fullscreenElement === element) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen(element);
        }
    }

    enterFullscreen(element) {
        if (this.fullscreenElement) {
            this.exitFullscreen();
        }

        this.fullscreenElement = element;
        element.classList.add('nmr-fullscreen');

        // Transform the fullscreen button into a close button
        const fullscreenBtn = element.querySelector('.nmr-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '✕';
            fullscreenBtn.title = 'Exit Fullscreen';
            fullscreenBtn.classList.add('nmr-close-mode');
        }

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'nmr-fullscreen-overlay';
        overlay.className = 'nmr-fullscreen-overlay';
        overlay.addEventListener('click', () => this.exitFullscreen());
        document.body.appendChild(overlay);

        // Update visualizations for new size
        requestAnimationFrame(() => {
            if (element.id === 'nmr-spectrum-panel') {
                this.updateSpectrum();
            } else if (element.id === 'nmr-molecule-panel') {
                this.updateMolecule();
            } else if (element.id === 'nmr-density-table-panel') {
                this._syncDensityTableFullscreenLayout();
            }
        });
    }

    exitFullscreen() {
        if (!this.fullscreenElement) return;

        this.fullscreenElement.classList.remove('nmr-fullscreen');

        // Transform close button back to fullscreen button
        const fullscreenBtn = this.fullscreenElement.querySelector('.nmr-fullscreen-btn');
        if (fullscreenBtn) {
            fullscreenBtn.innerHTML = '⛶';
            fullscreenBtn.title = 'Fullscreen';
            fullscreenBtn.classList.remove('nmr-close-mode');
        }

        const overlay = document.getElementById('nmr-fullscreen-overlay');
        if (overlay) overlay.remove();

        const element = this.fullscreenElement;
        this.fullscreenElement = null;

        // Update visualizations for normal size
        requestAnimationFrame(() => {
            if (element.id === 'nmr-spectrum-panel') {
                this.updateSpectrum();
            } else if (element.id === 'nmr-molecule-panel') {
                this.updateMolecule();
            } else if (element.id === 'nmr-density-table-panel') {
                this._syncDensityTableFullscreenLayout();
            }
        });
    }

    _syncDensityTableFullscreenLayout() {
        document.querySelectorAll('.nmr-density-canvas-wrap[data-density-zoom]').forEach((wrap) => {
            this._scheduleDensityTableRefit(wrap, false);
        });
    }

    _densityMatrixLabelColWidth(numQubits) {
        return Math.max(52, numQubits * 8 + 22);
    }

    _densityMatrixLabelRowHeight() {
        return 22;
    }

    _createDensityMatrixViewShell(dim, numQubits, maxMag, heatmap, { withAxisLabels = true, purity = null } = {}) {
        const wrap = document.createElement('div');
        wrap.className = 'nmr-density-canvas-wrap';
        wrap.dataset.densityZoom = '1';
        if (!withAxisLabels) wrap.classList.add('nmr-density-matrix-frame--has-table');

        wrap.innerHTML = `
            <div class="nmr-density-matrix-toolbar">
                <div class="nmr-density-zoom-controls">
                    <button type="button" class="nmr-btn-sm" data-density-zoom="out" title="Zoom out">−</button>
                    <span class="nmr-density-zoom-pct">100%</span>
                    <button type="button" class="nmr-btn-sm" data-density-zoom="in" title="Zoom in">+</button>
                    <button type="button" class="nmr-btn-sm" data-density-zoom="fit" title="Fit matrix to frame">Fit</button>
                </div>
            </div>
            <div class="nmr-density-matrix-viewport">
                <div class="nmr-density-matrix-stage">
                    <div class="nmr-density-matrix-labeled">
                        <div class="nmr-density-matrix-cols" aria-hidden="true"></div>
                        <div class="nmr-density-matrix-rows" aria-hidden="true"></div>
                        <div class="nmr-density-matrix-cells"></div>
                    </div>
                </div>
            </div>
            ${this._densityCanvasLegendHtml(maxMag, heatmap, purity)}
        `;

        wrap._zoomState = {
            dim,
            numQubits,
            factor: 1,
            panX: 0,
            panY: 0,
            fitScale: 1,
            maxMag,
            heatmap,
            withAxisLabels
        };

        const tip = document.createElement('div');
        tip.className = 'nmr-density-canvas-tooltip';
        tip.hidden = true;
        wrap.appendChild(tip);

        return wrap;
    }

    _densityMatrixLabelIndicesForScale(dim, cellScale) {
        const minLabelPx = 40;
        const maxCount = Math.max(6, Math.floor((dim * cellScale) / minLabelPx));
        return this._densityLabelIndices(dim, Math.min(dim, maxCount));
    }

    _updateDensityMatrixAxisLabels(wrap, cellScale) {
        const state = wrap._zoomState;
        if (!state?.withAxisLabels) return;

        const { dim, numQubits } = state;
        const cols = wrap.querySelector('.nmr-density-matrix-cols');
        const rows = wrap.querySelector('.nmr-density-matrix-rows');
        if (!cols || !rows) return;

        const labelW = state.labelW;
        const labelH = state.labelH;
        const fontSize = Math.max(9, Math.min(13, cellScale * 0.82));
        const indices = this._densityMatrixLabelIndicesForScale(dim, cellScale);

        cols.style.width = `${dim * cellScale}px`;
        cols.style.height = `${labelH}px`;
        cols.innerHTML = indices.map((j) =>
            `<span class="nmr-density-axis-label nmr-density-axis-label--col" style="left:${(j + 0.5) * cellScale}px;font-size:${fontSize}px">${this._formatBasisKet(j, numQubits)}</span>`
        ).join('');

        rows.style.width = `${labelW}px`;
        rows.style.height = `${dim * cellScale}px`;
        rows.innerHTML = indices.map((i) =>
            `<span class="nmr-density-axis-label nmr-density-axis-label--row" style="top:${(i + 0.5) * cellScale}px;font-size:${fontSize}px">${this._formatBasisBra(i, numQubits)}</span>`
        ).join('');
    }

    _densityTableFallbackCellPx(dim) {
        if (dim <= 4) return 28;
        if (dim <= 16) return 32;
        if (dim <= 64) return 36;
        return 8;
    }

    /** Unscaled matrix + axis label footprint used to compute fit-to-viewport scale. */
    _measureDensityContentBaseSize(wrap, state) {
        const labelW = state.withAxisLabels ? (state.labelW ?? this._densityMatrixLabelColWidth(state.numQubits)) : 0;
        const labelH = state.withAxisLabels ? (state.labelH ?? this._densityMatrixLabelRowHeight()) : 0;
        const cellGuess = this._densityTableFallbackCellPx(state.dim);
        const canvas = wrap.querySelector('.nmr-density-canvas');
        const tableScroll = wrap.querySelector('.nmr-density-scroll');

        if (canvas) {
            return {
                contentW: labelW + state.dim,
                contentH: labelH + state.dim
            };
        }

        if (tableScroll) {
            const table = tableScroll.querySelector('table');
            const prevTransform = tableScroll.style.transform;
            tableScroll.style.transform = 'none';
            const tw = Math.max(
                table?.offsetWidth || 0,
                table?.scrollWidth || 0,
                state.dim * cellGuess + 48
            );
            const th = Math.max(
                table?.offsetHeight || 0,
                table?.scrollHeight || 0,
                state.dim * cellGuess + 28
            );
            tableScroll.style.transform = prevTransform;
            return { contentW: tw, contentH: th };
        }

        return {
            contentW: state.dim * cellGuess + labelW,
            contentH: state.dim * cellGuess + labelH
        };
    }

    _getDensityRenderedSize(wrap) {
        const labeled = wrap.querySelector('.nmr-density-matrix-labeled');
        if (!labeled) return { w: 0, h: 0 };
        return { w: labeled.offsetWidth, h: labeled.offsetHeight };
    }

    _densityViewportCanPan(wrap) {
        const viewport = wrap.querySelector('.nmr-density-matrix-viewport');
        if (!viewport) return false;
        const { w, h } = this._getDensityRenderedSize(wrap);
        const vw = viewport.clientWidth;
        const vh = viewport.clientHeight;
        return w > vw + 2 || h > vh + 2;
    }

    _clampDensityTablePan(wrap) {
        const state = wrap._zoomState;
        const viewport = wrap.querySelector('.nmr-density-matrix-viewport');
        if (!state || !viewport) return;

        const vw = viewport.clientWidth;
        const vh = viewport.clientHeight;
        const { w: contentW, h: contentH } = this._getDensityRenderedSize(wrap);

        if (contentW <= vw) state.panX = (vw - contentW) / 2;
        else state.panX = Math.min(0, Math.max(vw - contentW, state.panX));

        if (contentH <= vh) state.panY = (vh - contentH) / 2;
        else state.panY = Math.min(0, Math.max(vh - contentH, state.panY));
    }

    _applyDensityTableZoom(wrap) {
        const state = wrap._zoomState;
        if (!state) return;

        const labeled = wrap.querySelector('.nmr-density-matrix-labeled');
        const stage = wrap.querySelector('.nmr-density-matrix-stage');
        const canvas = wrap.querySelector('.nmr-density-canvas');
        const tableScroll = wrap.querySelector('.nmr-density-scroll');
        const pct = wrap.querySelector('.nmr-density-zoom-pct');
        if (!labeled || !stage) return;

        const scale = state.fitScale * state.factor;
        const labelW = state.withAxisLabels ? state.labelW : 0;
        const labelH = state.withAxisLabels ? state.labelH : 0;

        labeled.style.setProperty('--dm-label-w', `${labelW}px`);
        labeled.style.setProperty('--dm-label-h', `${labelH}px`);

        if (canvas) {
            const px = state.dim * scale;
            canvas.style.width = `${px}px`;
            canvas.style.height = `${px}px`;
            this._updateDensityMatrixAxisLabels(wrap, scale);
            labeled.style.width = `${labelW + px}px`;
            labeled.style.height = `${labelH + px}px`;
        } else if (tableScroll) {
            const table = tableScroll.querySelector('table');
            const tw = table?.offsetWidth || state.dim * 28;
            const th = table?.offsetHeight || state.dim * 22;
            tableScroll.style.width = `${tw}px`;
            tableScroll.style.height = `${th}px`;
            tableScroll.style.transform = `scale(${scale})`;
            tableScroll.style.transformOrigin = '0 0';
            labeled.style.width = `${tw * scale}px`;
            labeled.style.height = `${th * scale}px`;
        }

        stage.style.transform = `translate(${state.panX}px, ${state.panY}px)`;
        if (pct) pct.textContent = `${Math.round(state.factor * 100)}%`;

        const viewport = wrap.querySelector('.nmr-density-matrix-viewport');
        if (viewport) viewport.classList.toggle('can-pan', this._densityViewportCanPan(wrap));
    }

    _scheduleDensityTableRefit(wrap, resetPan = true) {
        requestAnimationFrame(() => {
            this._refitDensityTableZoom(wrap, resetPan);
            requestAnimationFrame(() => {
                this._refitDensityTableZoom(wrap, false);
                requestAnimationFrame(() => this._refitDensityTableZoom(wrap, false));
            });
        });
    }

    _refitDensityTableZoom(wrap, resetPan = false) {
        const state = wrap._zoomState;
        const viewport = wrap.querySelector('.nmr-density-matrix-viewport');
        if (!state || !viewport) return;

        if (resetPan) {
            state.factor = 1;
            state.panX = 0;
            state.panY = 0;
        }

        state.labelW = state.withAxisLabels ? this._densityMatrixLabelColWidth(state.numQubits) : 0;
        state.labelH = state.withAxisLabels ? this._densityMatrixLabelRowHeight() : 0;

        const { contentW, contentH } = this._measureDensityContentBaseSize(wrap, state);
        const vw = Math.max(viewport.clientWidth, 1) * this._densityFitPadding;
        const vh = Math.max(viewport.clientHeight, 1) * this._densityFitPadding;
        state.fitScale = Math.min(vw / Math.max(contentW, 1), vh / Math.max(contentH, 1));

        this._applyDensityTableZoom(wrap);
        this._clampDensityTablePan(wrap);
        this._applyDensityTableZoom(wrap);
    }

    _initDensityMatrixZoomInteraction(wrap, rho, dim, numQubits) {
        if (wrap._zoomBound) return;
        wrap._zoomBound = true;

        const viewport = wrap.querySelector('.nmr-density-matrix-viewport');
        const canvas = wrap.querySelector('.nmr-density-canvas');
        const tip = wrap.querySelector('.nmr-density-canvas-tooltip');

        wrap.querySelectorAll('[data-density-zoom]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const state = wrap._zoomState;
                if (!state) return;
                const action = btn.dataset.densityZoom;
                if (action === 'in') {
                    state.factor = Math.min(this._densityTableZoomMax, state.factor * 1.25);
                } else if (action === 'out') {
                    state.factor = Math.max(this._densityTableZoomMin, state.factor / 1.25);
                } else if (action === 'fit') {
                    this._refitDensityTableZoom(wrap, true);
                    return;
                }
                this._applyDensityTableZoom(wrap);
                this._clampDensityTablePan(wrap);
                this._applyDensityTableZoom(wrap);
            });
        });

        if (canvas && tip && rho) {
            this._bindDensityMatrixCanvasHover(canvas, wrap, tip, rho, dim, numQubits);
        }

        let dragging = false;
        let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };

        viewport?.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            const state = wrap._zoomState;
            if (!state || !this._densityViewportCanPan(wrap)) return;
            dragging = true;
            dragStart = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
            viewport.setPointerCapture(e.pointerId);
            viewport.classList.add('is-dragging');
        });

        viewport?.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const state = wrap._zoomState;
            state.panX = dragStart.panX + (e.clientX - dragStart.x);
            state.panY = dragStart.panY + (e.clientY - dragStart.y);
            this._clampDensityTablePan(wrap);
            this._applyDensityTableZoom(wrap);
        });

        const endDrag = (e) => {
            if (!dragging) return;
            dragging = false;
            viewport?.classList.remove('is-dragging');
            try { viewport?.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        };
        viewport?.addEventListener('pointerup', endDrag);
        viewport?.addEventListener('pointercancel', endDrag);

        viewport?.addEventListener('wheel', (e) => {
            e.preventDefault();
            const state = wrap._zoomState;
            if (!state) return;
            const panGesture = e.shiftKey || (this._densityViewportCanPan(wrap) && Math.abs(e.deltaX) > Math.abs(e.deltaY));
            if (panGesture) {
                if (!this._densityViewportCanPan(wrap)) return;
                state.panX -= e.deltaX;
                state.panY -= e.deltaY;
                this._clampDensityTablePan(wrap);
                this._applyDensityTableZoom(wrap);
                return;
            }
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            state.factor = Math.max(
                this._densityTableZoomMin,
                Math.min(this._densityTableZoomMax, state.factor * factor)
            );
            this._applyDensityTableZoom(wrap);
            this._clampDensityTablePan(wrap);
            this._applyDensityTableZoom(wrap);
        }, { passive: false });

        if (wrap._zoomResizeObserver) wrap._zoomResizeObserver.disconnect();
        wrap._zoomResizeObserver = new ResizeObserver(() => {
            this._refitDensityTableZoom(wrap, false);
        });
        wrap._zoomResizeObserver.observe(viewport);
    }

    _getDensityTableHost() {
        return document.getElementById('nmr-density-table-host');
    }

    _cancelDensityTableRender() {
        this._densityTableRenderToken += 1;
        if (this._densityTableRenderAf) {
            cancelAnimationFrame(this._densityTableRenderAf);
            this._densityTableRenderAf = null;
        }
    }

    handleSpectrumClick(e) {
        if (!this.spectrumData || !this.spectrumData.dataPoints.length) return;

        const canvas = e.target;
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Check if click is within plot area
        const { marginLeft, marginTop, plotWidth, plotHeight } = this.spectrumData;
        if (clickX < marginLeft || clickX > marginLeft + plotWidth ||
            clickY < marginTop || clickY > marginTop + plotHeight) {
            this.hidePeakPopup();
            return;
        }

        // Find closest peak - use larger detection radius for easier clicking
        let closestPeak = null;
        let closestDist = 40; // Increased max distance in pixels for easier clicking

        this.spectrumData.dataPoints.forEach(peak => {
            const dist = Math.abs(peak.x - clickX);
            if (dist < closestDist) {
                closestDist = dist;
                closestPeak = peak;
            }
        });

        if (closestPeak) {
            this.showPeakPopup(closestPeak, e.clientX, e.clientY);
        } else {
            this.hidePeakPopup();
        }
    }

    showPeakPopup(peak, x, y) {
        // Remove existing popup
        this.hidePeakPopup();

        const popup = document.createElement('div');
        popup.id = 'nmr-peak-popup';
        popup.className = 'nmr-peak-popup';

        const freqMHz = (peak.freq / 1e6).toFixed(4);
        const ppmVal = peak.ppm.toFixed(2);
        const intensityPct = (peak.intensity * 100).toFixed(1);

        popup.innerHTML = `
            <div class="nmr-popup-header">
                <span class="nmr-popup-nucleus">${peak.nucleus}</span>
                <span class="nmr-popup-element">${peak.element}</span>
                <button class="nmr-popup-close" onclick="document.getElementById('nmr-peak-popup')?.remove()">✕</button>
            </div>
            <div class="nmr-popup-body">
                <div class="nmr-popup-row">
                    <span class="nmr-popup-label">Chemical Shift:</span>
                    <span class="nmr-popup-value">${ppmVal} ppm</span>
                </div>
                <div class="nmr-popup-row">
                    <span class="nmr-popup-label">Frequency:</span>
                    <span class="nmr-popup-value">${freqMHz} MHz</span>
                </div>
                <div class="nmr-popup-row">
                    <span class="nmr-popup-label">Relative Intensity:</span>
                    <span class="nmr-popup-value">${intensityPct}%</span>
                </div>
                <div class="nmr-popup-row">
                    <span class="nmr-popup-label">Pattern:</span>
                    <span class="nmr-popup-value">${peak.type || 'singlet'}</span>
                </div>
                ${peak.environment ? `
                <div class="nmr-popup-env">
                    <span class="nmr-popup-label">Environment:</span>
                    <span class="nmr-popup-desc">${peak.environment}</span>
                </div>` : ''}
            </div>
        `;

        // Position popup
        popup.style.left = `${x + 10}px`;
        popup.style.top = `${y - 10}px`;

        document.body.appendChild(popup);

        // Adjust if off screen
        const popupRect = popup.getBoundingClientRect();
        if (popupRect.right > window.innerWidth) {
            popup.style.left = `${x - popupRect.width - 10}px`;
        }
        if (popupRect.bottom > window.innerHeight) {
            popup.style.top = `${y - popupRect.height - 10}px`;
        }

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', this.hidePeakPopupOnClickOutside, { once: true });
        }, 100);
    }

    hidePeakPopupOnClickOutside = (e) => {
        const popup = document.getElementById('nmr-peak-popup');
        if (popup && !popup.contains(e.target)) {
            popup.remove();
        }
    }

    hidePeakPopup() {
        const popup = document.getElementById('nmr-peak-popup');
        if (popup) popup.remove();
    }

    updateAllVisualizations() {
        this.updateSampleInfo();
        this.updateNucleiList();
        this.updateMolecule();
        this.updateSpectrum();
        this.updatePulseSequence();
    }

    updateSampleInfo() {
        const infoEl = document.getElementById('nmr-sample-info');
        if (!infoEl || !this.nmrEngine.sample) return;

        const sample = this.nmrEngine.sample;
        infoEl.innerHTML = `
            <div class="nmr-formula">${sample.formula || ''}</div>
            <div class="nmr-desc">${sample.description || ''}</div>
        `;
    }

    updateNucleiList() {
        const listEl = document.getElementById('nmr-nuclei-list');
        if (!listEl || !this.nmrEngine.sample) return;

        const nuclei = this.nmrEngine.getNucleiInfo();
        const b0 = this.nmrEngine.B0;

        let html = `<div class="nmr-nuclei-header">B₀ = ${b0.toFixed(2)} T</div>`;
        html += '<table class="nmr-nuclei-table"><thead><tr><th>Q</th><th>Nucleus</th><th>δ ppm</th><th>ω MHz</th></tr></thead><tbody>';

        // Iterate over nuclei using the actual sample nuclei array to ensure correct indexing
        for (let i = 0; i < this.nmrEngine.sample.nuclei.length; i++) {
            const n = nuclei[i]; // Get the mapped info from getNucleiInfo()
            // Make qubit number clickable to focus on that peak
            html += `<tr class="nmr-nuclei-row" data-qubit="${i}" title="Click to focus on Q${i} peak">
                <td class="nmr-qubit-focus">${i}</td>
                <td><span class="nmr-badge">${n.element}</span></td>
                <td>${(n.chemicalShift || 0).toFixed(1)}</td>
                <td>${(n.larmorFreq / 1e6).toFixed(2)}</td>
            </tr>`;
        }

        html += '</tbody></table>';

        // J-couplings list
        const jc = this.nmrEngine.sample.jCouplings || [];
        if (jc.length > 0) {
            html += '<div class="nmr-jc-section">';
            html += `<div class="nmr-jc-header">J-Couplings (${jc.length})</div>`;
            html += '<div class="nmr-jc-list">';
            jc.forEach(c => {
                html += `<div class="nmr-jc-item">Q${c.nuclei[0]}↔Q${c.nuclei[1]}: ${c.J.toFixed(1)} Hz</div>`;
            });
            html += '</div></div>';
        }

        listEl.innerHTML = html;

        // Add click handlers to qubit rows
        listEl.querySelectorAll('.nmr-nuclei-row').forEach(row => {
            row.addEventListener('click', () => {
                const qubitIndex = parseInt(row.dataset.qubit);
                this.focusOnQubitPeak(qubitIndex);
            });
        });
    }

    /**
     * Focus the spectrum view on a specific qubit's peak
     * Zooms in and pans to center on that qubit's chemical shift
     */
    focusOnQubitPeak(qubitIndex) {
        if (!this.nmrEngine.sample || qubitIndex >= this.nmrEngine.sample.nuclei.length) return;

        const nucleus = this.nmrEngine.sample.nuclei[qubitIndex];
        const chemicalShift = nucleus.chemicalShift || 0;

        // Get mode (ppm or frequency)
        const mode = document.getElementById('nmr-spectrum-mode')?.value || 'ppm';

        // Set zoom level to focus on peak (moderate zoom)
        this.spectrumZoom = 3.0;

        // Calculate pan to center on this peak
        // In ppm mode, we need to calculate the offset to center on chemicalShift
        if (mode === 'ppm') {
            // Get all chemical shifts to determine the data range
            const shifts = this.nmrEngine.sample.nuclei.map(n => n.chemicalShift || 0);
            const minShift = Math.min(...shifts);
            const maxShift = Math.max(...shifts);
            const center = (minShift + maxShift) / 2;

            // Pan offset to center on target chemical shift
            // Pan is in display units, positive moves view right (shows lower ppm)
            this.spectrumPanX = (center - chemicalShift) * 20;  // Scale factor for sensitivity
        } else {
            // Frequency mode - similar logic
            const freq = this.nmrEngine.getLarmorFrequency(qubitIndex);
            const freqs = this.nmrEngine.sample.nuclei.map((_, i) => this.nmrEngine.getLarmorFrequency(i));
            const minFreq = Math.min(...freqs);
            const maxFreq = Math.max(...freqs);
            const center = (minFreq + maxFreq) / 2;

            // Pan in Hz units (same as data values) with appropriate scale
            this.spectrumPanX = (freq - center) * 0.0001;
        }

        this.updateSpectrum();

        // Highlight the focused row briefly
        const rows = document.querySelectorAll('.nmr-nuclei-row');
        rows.forEach(r => r.classList.remove('nmr-focused'));
        const targetRow = document.querySelector(`.nmr-nuclei-row[data-qubit="${qubitIndex}"]`);
        if (targetRow) {
            targetRow.classList.add('nmr-focused');
            setTimeout(() => targetRow.classList.remove('nmr-focused'), 1500);
        }
    }

    updateMolecule() {
        const canvas = document.getElementById('nmr-molecule-canvas');
        if (!canvas || !this.nmrEngine.sample?.structure) return;

        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const isFullscreen = container.closest('.nmr-fullscreen');

        canvas.width = rect.width;
        canvas.height = isFullscreen ? rect.height - 40 : 160;

        const structure = this.nmrEngine.sample.structure;
        const atoms = structure.atoms || [];
        const bonds = structure.bonds || [];
        const theme = this.getNmrThemeColors();

        // Background with subtle gradient
        const bgGradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
        );
        bgGradient.addColorStop(0, theme.bgElevated);
        bgGradient.addColorStop(1, theme.bgOuter);
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (atoms.length === 0) {
            ctx.fillStyle = theme.textMuted;
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No structure data', canvas.width / 2, canvas.height / 2);
            return;
        }

        // Calculate bounds and scale
        const xs = atoms.map(a => a.x);
        const ys = atoms.map(a => a.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const maxScale = isFullscreen ? 4.0 : 1.8;
        const padding = isFullscreen ? 150 : 50;
        const scale = Math.min(
            (canvas.width - padding) / (maxX - minX || 100),
            (canvas.height - padding) / (maxY - minY || 100),
            maxScale
        );
        const offsetX = canvas.width / 2 - (minX + maxX) / 2 * scale;
        const offsetY = canvas.height / 2 - (minY + maxY) / 2 * scale;

        const transform = (x, y) => ({ x: x * scale + offsetX, y: y * scale + offsetY });

        // Element colors with better contrast
        const colors = {
            'H': '#e0e0e0', '1H': '#e0e0e0',
            'C': '#505050', '13C': '#606060',
            'N': '#4a9eff', '15N': '#6ab0ff',
            'O': '#ff4444', '17O': '#ff6666',
            'F': '#10b981', '19F': '#34d399',
            'Cl': '#84cc16',
            'Br': '#b45309',
            'I': '#8b5cf6',
            'P': '#fb923c', '31P': '#fdba74',
            'S': '#fbbf24',
            'Fe': '#d97706',
            'Si': '#94a3b8', '29Si': '#a8b8c8',
            'B': '#f97316', '11B': '#fb923c'
        };

        const elementRadius = {
            'H': 0.6, '1H': 0.6,
            'C': 1.0, '13C': 1.0,
            'N': 0.9, '15N': 0.9,
            'O': 0.85, '17O': 0.85,
            'F': 0.75, '19F': 0.75,
            'Cl': 1.1, 'Br': 1.2, 'I': 1.4,
            'P': 1.2, '31P': 1.2,
            'S': 1.15, 'Fe': 1.3,
            'Si': 1.15, '29Si': 1.15,
            'B': 0.9, '11B': 0.9
        };

        // Draw bonds first
        const bondWidthMultiplier = isFullscreen ? 1.8 : 1;
        bonds.forEach(bond => {
            const [i, j, bondType] = bond;
            const a1 = transform(atoms[i].x, atoms[i].y);
            const a2 = transform(atoms[j].x, atoms[j].y);

            const dx = a2.x - a1.x;
            const dy = a2.y - a1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const perpDist = (isFullscreen ? 5 : 3);
            const perpX = -dy / len * perpDist;
            const perpY = dx / len * perpDist;

            ctx.lineCap = 'round';

            if (bondType === 'double') {
                ctx.strokeStyle = theme.textMuted;
                ctx.lineWidth = 2.5 * bondWidthMultiplier;
                ctx.beginPath();
                ctx.moveTo(a1.x + perpX, a1.y + perpY);
                ctx.lineTo(a2.x + perpX, a2.y + perpY);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(a1.x - perpX, a1.y - perpY);
                ctx.lineTo(a2.x - perpX, a2.y - perpY);
                ctx.stroke();
            } else if (bondType === 'triple') {
                ctx.strokeStyle = theme.textMuted;
                ctx.lineWidth = 2 * bondWidthMultiplier;
                ctx.beginPath();
                ctx.moveTo(a1.x, a1.y);
                ctx.lineTo(a2.x, a2.y);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(a1.x + perpX * 1.5, a1.y + perpY * 1.5);
                ctx.lineTo(a2.x + perpX * 1.5, a2.y + perpY * 1.5);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(a1.x - perpX * 1.5, a1.y - perpY * 1.5);
                ctx.lineTo(a2.x - perpX * 1.5, a2.y - perpY * 1.5);
                ctx.stroke();
            } else {
                ctx.strokeStyle = theme.textMuted;
                ctx.lineWidth = 3 * bondWidthMultiplier;
                ctx.beginPath();
                ctx.moveTo(a1.x, a1.y);
                ctx.lineTo(a2.x, a2.y);
                ctx.stroke();
            }
        });

        // Draw J-coupling connections between qubits
        const jc = this.nmrEngine.sample.jCouplings || [];
        const qubitAtoms = atoms.filter(a => a.qubit !== undefined);
        ctx.setLineDash(isFullscreen ? [6, 6] : [4, 4]);
        ctx.lineWidth = isFullscreen ? 2.5 : 1.5;
        jc.forEach(c => {
            const a1 = qubitAtoms.find(a => a.qubit === c.nuclei[0]);
            const a2 = qubitAtoms.find(a => a.qubit === c.nuclei[1]);
            if (a1 && a2) {
                const p1 = transform(a1.x, a1.y);
                const p2 = transform(a2.x, a2.y);

                // Gradient for J-coupling line
                const grad = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
                grad.addColorStop(0, this._colorAlpha(theme.accent, 0.8));
                grad.addColorStop(0.5, this._colorAlpha(theme.accent, 0.4));
                grad.addColorStop(1, this._colorAlpha(theme.accent, 0.8));
                ctx.strokeStyle = grad;

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        });
        ctx.setLineDash([]);

        // Draw atoms with glow effects
        atoms.forEach((atom, i) => {
            const pos = transform(atom.x, atom.y);
            const isQubit = atom.qubit !== undefined;
            const baseR = (elementRadius[atom.element] || 1.0) * (isFullscreen ? 22 : 11);
            const r = isQubit ? baseR * 1.2 : baseR;

            // Glow for qubit atoms
            if (isQubit) {
                const glowSize = isFullscreen ? 20 : 12;
                const glowGradient = ctx.createRadialGradient(pos.x, pos.y, r, pos.x, pos.y, r + glowSize);
                glowGradient.addColorStop(0, this._colorAlpha(theme.highlight, 0.5));
                glowGradient.addColorStop(0.5, this._colorAlpha(theme.highlight, 0.2));
                glowGradient.addColorStop(1, this._colorAlpha(theme.highlight, 0));
                ctx.fillStyle = glowGradient;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r + glowSize, 0, Math.PI * 2);
                ctx.fill();
            }

            // Atom sphere with gradient
            const atomGradient = ctx.createRadialGradient(
                pos.x - r * 0.3, pos.y - r * 0.3, 0,
                pos.x, pos.y, r * 1.2
            );
            const baseColor = colors[atom.element] || '#9ca3af';
            atomGradient.addColorStop(0, this.lightenColor(baseColor, 40));
            atomGradient.addColorStop(0.5, baseColor);
            atomGradient.addColorStop(1, this.darkenColor(baseColor, 30));

            ctx.fillStyle = atomGradient;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
            ctx.fill();

            // Qubit ring
            if (isQubit) {
                ctx.strokeStyle = theme.highlight;
                ctx.lineWidth = isFullscreen ? 4 : 2.5;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, r + (isFullscreen ? 4 : 2), 0, Math.PI * 2);
                ctx.stroke();
            }

            // Element label
            const label = atom.element.replace(/[0-9]/g, '');
            ctx.fillStyle = this.getContrastColor(baseColor);
            ctx.font = `${isQubit ? 'bold ' : ''}${isFullscreen ? (isQubit ? 18 : 15) : (isQubit ? 11 : 9)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, pos.x, pos.y);

            // Qubit label
            if (isQubit) {
                ctx.fillStyle = theme.highlight;
                ctx.font = `bold ${isFullscreen ? 14 : 9}px sans-serif`;
                ctx.fillText(`Q${atom.qubit}`, pos.x, pos.y + r + (isFullscreen ? 16 : 10));
            }
        });

        // Sample name
        ctx.fillStyle = theme.textMuted;
        ctx.font = `${isFullscreen ? 14 : 10}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(this.nmrEngine.sample.formula || '', isFullscreen ? 15 : 8, canvas.height - (isFullscreen ? 15 : 8));

        // Legend in fullscreen mode
        if (isFullscreen) {
            this.drawMoleculeLegend(ctx, canvas.width, canvas.height);
        }
    }

    drawMoleculeLegend(ctx, width, height) {
        const theme = this.getNmrThemeColors();
        const legendX = width - 200;
        const legendY = 50;
        const legendWidth = 180;
        const legendHeight = 220;

        // Background
        ctx.fillStyle = theme.legendBg;
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

        // Title
        ctx.fillStyle = theme.textPrimary;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Legend', legendX + 10, legendY + 25);

        let y = legendY + 50;
        const lineHeight = 28;
        const iconSize = 16;
        const textStart = legendX + 35;

        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';

        // Qubit atoms
        ctx.fillStyle = theme.highlight;
        ctx.beginPath();
        ctx.arc(legendX + 20, y, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = theme.highlight;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(legendX + 20, y, iconSize / 2 + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = theme.textSecondary;
        ctx.fillText('Qubit atoms (Q0, Q1, ...)', textStart, y + 5);
        y += lineHeight;

        // Regular atoms
        ctx.fillStyle = theme.textMuted;
        ctx.beginPath();
        ctx.arc(legendX + 20, y, iconSize / 2 * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = theme.textSecondary;
        ctx.fillText('Non-qubit atoms', textStart, y + 5);
        y += lineHeight;

        // Bonds
        ctx.strokeStyle = theme.textMuted;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(legendX + 12, y);
        ctx.lineTo(legendX + 28, y);
        ctx.stroke();
        ctx.fillStyle = theme.textSecondary;
        ctx.fillText('Covalent bonds', textStart, y + 5);
        y += lineHeight;

        // Double bonds
        ctx.strokeStyle = theme.textMuted;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(legendX + 12, y - 3);
        ctx.lineTo(legendX + 28, y - 3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(legendX + 12, y + 3);
        ctx.lineTo(legendX + 28, y + 3);
        ctx.stroke();
        ctx.fillStyle = theme.textSecondary;
        ctx.fillText('Double bonds', textStart, y + 5);
        y += lineHeight;

        // J-coupling
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = this._colorAlpha(theme.accent, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX + 12, y);
        ctx.lineTo(legendX + 28, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = theme.textSecondary;
        ctx.fillText('J-coupling (dashed)', textStart, y + 5);
        y += lineHeight;

        // Qubit labels
        ctx.fillStyle = theme.highlight;
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('Q0', legendX + 20, y + 5);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = theme.textSecondary;
        ctx.fillText('Qubit labels', textStart, y + 5);
    }

    // Helper color functions
    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `rgb(${R},${G},${B})`;
    }

    darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `rgb(${R},${G},${B})`;
    }

    getContrastColor(hex) {
        const num = parseInt(hex.replace('#', ''), 16);
        const R = (num >> 16);
        const G = ((num >> 8) & 0x00FF);
        const B = (num & 0x0000FF);
        const luminance = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
        return luminance > 0.5 ? this.getNmrThemeColors().bgOuter : this.getNmrThemeColors().textPrimary;
    }

    updateSpectrum() {
        const canvas = document.getElementById('nmr-spectrum-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const theme = this.getNmrThemeColors();
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Use full container size
        const isFullscreen = container.closest('.nmr-fullscreen');
        canvas.width = rect.width;
        canvas.height = isFullscreen ? rect.height - 40 : Math.max(180, rect.height);

        const width = canvas.width;
        const height = canvas.height;

        // Margins for axes
        const marginLeft = 55;
        const marginRight = 20;
        const marginTop = 30;
        const marginBottom = 45;

        const plotWidth = width - marginLeft - marginRight;
        const plotHeight = height - marginTop - marginBottom;
        const baseline = marginTop + plotHeight;

        // Background
        ctx.fillStyle = theme.bgOuter;
        ctx.fillRect(0, 0, width, height);

        // Plot area background
        ctx.fillStyle = theme.bgPlot;
        ctx.fillRect(marginLeft, marginTop, plotWidth, plotHeight);

        const peaks = this.nmrEngine.getExpectedPeaks();
        const mode = document.getElementById('nmr-spectrum-mode')?.value || 'ppm';

        // Get data range
        let dataPoints = [];
        if (peaks.length > 0) {
            if (mode === 'ppm') {
                dataPoints = peaks.map(p => {
                    const nucleus = this.nmrEngine.sample.nuclei.find(n => n.label === p.nucleus);
                    return { ...p, val: nucleus?.chemicalShift || 0 };
                });
            } else {
                dataPoints = peaks.map(p => ({ ...p, val: p.freq }));
            }
        }

        const vals = dataPoints.map(d => d.val);
        const minVal = vals.length ? Math.min(...vals) : 0;
        const maxVal = vals.length ? Math.max(...vals) : (mode === 'ppm' ? 10 : 50e6);
        const spread = (maxVal - minVal) || (mode === 'ppm' ? 10 : 50e6);
        const padding = Math.max(spread * 0.15, mode === 'ppm' ? 0.5 : spread * 0.05);

        // Apply zoom and pan
        const range = (spread + 2 * padding) / this.spectrumZoom;
        // Pan scale: ppm mode uses small values, Hz mode uses Hz values (already scaled)
        const panScale = mode === 'ppm' ? 0.05 : 1.0;
        const center = (minVal + maxVal) / 2 + this.spectrumPanX * panScale;
        const viewMin = center - range / 2;
        const viewMax = center + range / 2;

        // Calculate nice tick marks
        const getTickInterval = (range, maxTicks) => {
            const rawInterval = range / maxTicks;
            const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
            const normalized = rawInterval / magnitude;
            let interval;
            if (normalized <= 1) interval = magnitude;
            else if (normalized <= 2) interval = 2 * magnitude;
            else if (normalized <= 5) interval = 5 * magnitude;
            else interval = 10 * magnitude;
            return interval;
        };

        const tickInterval = getTickInterval(viewMax - viewMin, 8);
        const firstTick = Math.ceil(viewMin / tickInterval) * tickInterval;

        // Draw grid lines
        ctx.strokeStyle = theme.grid;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);

        // Vertical grid (x-axis ticks)
        for (let v = firstTick; v <= viewMax; v += tickInterval) {
            const x = mode === 'ppm'
                ? marginLeft + ((viewMax - v) / (viewMax - viewMin)) * plotWidth
                : marginLeft + ((v - viewMin) / (viewMax - viewMin)) * plotWidth;
            if (x >= marginLeft && x <= marginLeft + plotWidth) {
                ctx.beginPath();
                ctx.moveTo(x, marginTop);
                ctx.lineTo(x, baseline);
                ctx.stroke();
            }
        }

        // Horizontal grid (intensity)
        const intensityTicks = 4;
        for (let i = 1; i < intensityTicks; i++) {
            const y = marginTop + (plotHeight * i / intensityTicks);
            ctx.beginPath();
            ctx.moveTo(marginLeft, y);
            ctx.lineTo(marginLeft + plotWidth, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // Store spectrum data for click detection
        this.spectrumData = {
            marginLeft, marginTop, plotWidth, plotHeight, baseline,
            viewMin, viewMax, mode, dataPoints: []
        };

        // Draw spectrum line
        if (peaks.length > 0) {
            const avgT2 = this.nmrEngine.T2.reduce((a, b) => a + b, 0) / this.nmrEngine.T2.length;
            const lw = (mode === 'ppm' ? 0.08 : 3) / this.spectrumZoom;

            // Check for negative intensities (inverted peaks from X gate, etc.)
            const intensities = dataPoints.map(d => d.intensity);
            const hasNegative = intensities.some(i => i < 0);
            const hasPositive = intensities.some(i => i > 0);

            // Use maximum ABSOLUTE intensity for scaling
            const maxAbsI = Math.max(...intensities.map(i => Math.abs(i)), 0.1);

            // Adjust baseline position if we have both positive and negative peaks
            let dynamicBaseline = baseline;
            let halfHeight = (plotHeight - 10) / 2;
            if (hasNegative && hasPositive) {
                // Center baseline for mixed signals
                dynamicBaseline = marginTop + plotHeight / 2;
                halfHeight = (plotHeight - 20) / 2;
            } else if (hasNegative && !hasPositive) {
                // All negative - baseline at top
                dynamicBaseline = marginTop + 20;
                halfHeight = plotHeight - 30;
            }
            // else: all positive - keep baseline at bottom (default)

            // Draw baseline reference line
            ctx.strokeStyle = theme.textMuted;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(marginLeft, dynamicBaseline);
            ctx.lineTo(marginLeft + plotWidth, dynamicBaseline);
            ctx.stroke();
            ctx.setLineDash([]);

            // Gradient for positive peaks (upward, blue)
            const gradientPos = ctx.createLinearGradient(0, dynamicBaseline - halfHeight, 0, dynamicBaseline);
            gradientPos.addColorStop(0, this._colorAlpha(theme.accent, 0.4));
            gradientPos.addColorStop(0.5, this._colorAlpha(theme.accent, 0.2));
            gradientPos.addColorStop(1, this._colorAlpha(theme.accent, 0.05));

            // Gradient for negative peaks (downward, red/orange - inverted signal)
            const gradientNeg = ctx.createLinearGradient(0, dynamicBaseline, 0, dynamicBaseline + halfHeight);
            gradientNeg.addColorStop(0, this._colorAlpha(theme.negative, 0.05));
            gradientNeg.addColorStop(0.5, this._colorAlpha(theme.negative, 0.2));
            gradientNeg.addColorStop(1, this._colorAlpha(theme.negative, 0.4));

            // First pass: fill positive regions
            ctx.beginPath();
            ctx.moveTo(marginLeft, dynamicBaseline);

            for (let px = 0; px <= plotWidth; px++) {
                const v = mode === 'ppm'
                    ? viewMax - (px / plotWidth) * (viewMax - viewMin)
                    : viewMin + (px / plotWidth) * (viewMax - viewMin);

                let intensity = 0;
                dataPoints.forEach(d => {
                    const delta = v - d.val;
                    intensity += d.intensity * (lw * lw) / (delta * delta + lw * lw);
                });

                // Scale intensity, preserving sign
                const scaledIntensity = Math.min(1.0, Math.max(-1.0,
                    (intensity / maxAbsI) * Math.min(this.spectrumZoom, 3)));

                // Only draw positive part in this pass
                const posIntensity = Math.max(0, scaledIntensity);
                const y = dynamicBaseline - posIntensity * halfHeight;
                ctx.lineTo(marginLeft + px, y);
            }

            ctx.lineTo(marginLeft + plotWidth, dynamicBaseline);
            ctx.closePath();
            ctx.fillStyle = gradientPos;
            ctx.fill();

            // Second pass: fill negative regions (if any)
            if (hasNegative) {
                ctx.beginPath();
                ctx.moveTo(marginLeft, dynamicBaseline);

                for (let px = 0; px <= plotWidth; px++) {
                    const v = mode === 'ppm'
                        ? viewMax - (px / plotWidth) * (viewMax - viewMin)
                        : viewMin + (px / plotWidth) * (viewMax - viewMin);

                    let intensity = 0;
                    dataPoints.forEach(d => {
                        const delta = v - d.val;
                        intensity += d.intensity * (lw * lw) / (delta * delta + lw * lw);
                    });

                    const scaledIntensity = Math.min(1.0, Math.max(-1.0,
                        (intensity / maxAbsI) * Math.min(this.spectrumZoom, 3)));

                    // Only draw negative part
                    const negIntensity = Math.min(0, scaledIntensity);
                    const y = dynamicBaseline - negIntensity * halfHeight;  // Negative goes down
                    ctx.lineTo(marginLeft + px, y);
                }

                ctx.lineTo(marginLeft + plotWidth, dynamicBaseline);
                ctx.closePath();
                ctx.fillStyle = gradientNeg;
                ctx.fill();
            }

            // Draw spectrum line on top (both positive and negative)
            ctx.beginPath();
            for (let px = 0; px <= plotWidth; px++) {
                const v = mode === 'ppm'
                    ? viewMax - (px / plotWidth) * (viewMax - viewMin)
                    : viewMin + (px / plotWidth) * (viewMax - viewMin);

                let intensity = 0;
                dataPoints.forEach(d => {
                    const delta = v - d.val;
                    intensity += d.intensity * (lw * lw) / (delta * delta + lw * lw);
                });

                const scaledIntensity = Math.min(1.0, Math.max(-1.0,
                    (intensity / maxAbsI) * Math.min(this.spectrumZoom, 3)));
                const y = dynamicBaseline - scaledIntensity * halfHeight;

                if (px === 0) ctx.moveTo(marginLeft + px, y);
                else ctx.lineTo(marginLeft + px, y);
            }
            // Use different color based on whether signal is predominantly positive or negative
            ctx.strokeStyle = hasNegative && !hasPositive ? theme.negative : theme.accent;
            ctx.lineWidth = 2.0;  // Thicker line to prevent sub-pixel rendering glitches
            ctx.stroke();

            // Store peak positions for click detection and draw labels
            ctx.fillStyle = theme.accentText;
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';

            const labeled = [];
            dataPoints.forEach(d => {
                const x = mode === 'ppm'
                    ? marginLeft + ((viewMax - d.val) / (viewMax - viewMin)) * plotWidth
                    : marginLeft + ((d.val - viewMin) / (viewMax - viewMin)) * plotWidth;

                // Store for click detection
                const nucleus = this.nmrEngine.sample.nuclei.find(n => n.label === d.nucleus);
                this.spectrumData.dataPoints.push({
                    x, nucleus: d.nucleus, element: d.element,
                    ppm: nucleus?.chemicalShift || d.val,
                    freq: d.freq,
                    intensity: d.intensity,
                    type: d.type,
                    environment: d.environment || nucleus?.environment || ''
                });

                if (x > marginLeft + 20 && x < marginLeft + plotWidth - 20 && !labeled.some(lx => Math.abs(lx - x) < 30)) {
                    ctx.fillText(d.nucleus, x, marginTop - 8);
                    // Draw tick mark
                    ctx.strokeStyle = theme.textMuted;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x, marginTop - 3);
                    ctx.lineTo(x, marginTop + 5);
                    ctx.stroke();
                    labeled.push(x);
                }
            });
        } else {
            ctx.fillStyle = theme.textMuted;
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No peaks to display', width / 2, height / 2);
        }

        // Draw frame/border for plot area
        ctx.strokeStyle = theme.plotBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(marginLeft, marginTop, plotWidth, plotHeight);

        // X-axis labels
        ctx.fillStyle = theme.textSecondary;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';

        for (let v = firstTick; v <= viewMax; v += tickInterval) {
            const x = mode === 'ppm'
                ? marginLeft + ((viewMax - v) / (viewMax - viewMin)) * plotWidth
                : marginLeft + ((v - viewMin) / (viewMax - viewMin)) * plotWidth;
            if (x >= marginLeft + 15 && x <= marginLeft + plotWidth - 15) {
                const label = mode === 'ppm' ? v.toFixed(1) : (v / 1e6).toFixed(3);
                ctx.fillText(label, x, baseline + 18);

                // Tick marks
                ctx.strokeStyle = theme.textMuted;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, baseline);
                ctx.lineTo(x, baseline + 5);
                ctx.stroke();
            }
        }

        // X-axis title
        ctx.fillStyle = theme.textMuted;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(mode === 'ppm' ? 'Chemical Shift (ppm)' : 'Frequency (MHz)', marginLeft + plotWidth / 2, height - 8);

        // Y-axis label
        ctx.save();
        ctx.translate(15, marginTop + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = theme.textMuted;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Intensity', 0, 0);
        ctx.restore();

        // Y-axis ticks - check for negative peaks to adjust labels
        const peakIntensities = peaks.map(p => p.intensity);
        const hasNegativePeaks = peakIntensities.some(i => i < 0);
        const hasPositivePeaks = peakIntensities.some(i => i > 0);

        ctx.fillStyle = theme.textMuted;
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'right';

        if (hasNegativePeaks && hasPositivePeaks) {
            // Mixed positive/negative: show -100% to +100% scale
            const centerY = marginTop + plotHeight / 2;
            const halfTicks = Math.floor(intensityTicks / 2);

            // Draw center (0%) line label
            ctx.fillText('0%', marginLeft - 8, centerY + 3);
            ctx.strokeStyle = theme.textMuted;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(marginLeft - 4, centerY);
            ctx.lineTo(marginLeft, centerY);
            ctx.stroke();

            // Positive ticks (upward)
            for (let i = 1; i <= halfTicks; i++) {
                const y = centerY - (plotHeight / 2) * (i / halfTicks);
                const val = (i / halfTicks * 100).toFixed(0);
                ctx.fillText('+' + val + '%', marginLeft - 8, y + 3);
                ctx.beginPath();
                ctx.moveTo(marginLeft - 4, y);
                ctx.lineTo(marginLeft, y);
                ctx.stroke();
            }

            // Negative ticks (downward)
            for (let i = 1; i <= halfTicks; i++) {
                const y = centerY + (plotHeight / 2) * (i / halfTicks);
                const val = (i / halfTicks * 100).toFixed(0);
                ctx.fillStyle = theme.negative;
                ctx.fillText('-' + val + '%', marginLeft - 8, y + 3);
                ctx.fillStyle = theme.textMuted;
                ctx.beginPath();
                ctx.moveTo(marginLeft - 4, y);
                ctx.lineTo(marginLeft, y);
                ctx.stroke();
            }
        } else if (hasNegativePeaks && !hasPositivePeaks) {
            // All negative: show 0% at top to -100% at bottom
            for (let i = 0; i <= intensityTicks; i++) {
                const y = marginTop + (plotHeight * i / intensityTicks);
                const val = (i / intensityTicks * 100).toFixed(0);
                ctx.fillStyle = i === 0 ? theme.textMuted : theme.negative;
                ctx.fillText(i === 0 ? '0%' : '-' + val + '%', marginLeft - 8, y + 3);
                ctx.fillStyle = theme.textMuted;

                ctx.strokeStyle = theme.textMuted;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(marginLeft - 4, y);
                ctx.lineTo(marginLeft, y);
                ctx.stroke();
            }
        } else {
            // All positive (default): show 0% at bottom to 100% at top
            for (let i = 0; i <= intensityTicks; i++) {
                const y = baseline - (plotHeight * i / intensityTicks);
                const val = (i / intensityTicks * 100).toFixed(0);
                ctx.fillText(val + '%', marginLeft - 8, y + 3);

                ctx.strokeStyle = theme.textMuted;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(marginLeft - 4, y);
                ctx.lineTo(marginLeft, y);
                ctx.stroke();
            }
        }

        // Info overlay
        ctx.fillStyle = theme.textSecondary;
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';

        const b0Text = `B₀ = ${this.nmrEngine.B0.toFixed(2)} T`;
        ctx.fillText(b0Text, marginLeft + plotWidth - 5, marginTop + 15);

        if (this.spectrumZoom !== 1.0) {
            ctx.fillStyle = theme.accent;
            ctx.fillText(`${this.spectrumZoom.toFixed(1)}× zoom`, marginLeft + plotWidth - 5, marginTop + 28);
        }
    }

    updatePulseSequence() {
        const container = document.getElementById('nmr-pulse-container');
        if (!container) return;

        const hasGates = this.circuit && this.circuit.gates && this.circuit.gates.length > 0;
        const controlFlow = this.circuit?.controlFlow || [];
        const hasControlFlow = controlFlow.length > 0;

        if (!hasGates && !hasControlFlow) {
            container.innerHTML = '<div class="nmr-pulse-empty">Add gates to circuit</div>';
            return;
        }

        // Map gates to pulses with column info preserved
        const pulses = hasGates ? this.nmrEngine.mapGatesToPulses(this.circuit.gates) : [];

        // Build a column-based timeline that includes both pulses and control flow
        // Find the maximum column used
        const gateColumns = this.circuit?.gates?.map(g => g.column) || [];
        const cfColumns = controlFlow.map(cf => cf.column);
        const allColumns = [...gateColumns, ...cfColumns];
        const maxColumn = allColumns.length > 0 ? Math.max(...allColumns) : 0;

        // Create a map of control flow by column
        const cfByColumn = {};
        controlFlow.forEach(cf => {
            if (!cfByColumn[cf.column]) cfByColumn[cf.column] = [];
            cfByColumn[cf.column].push(cf);
        });

        // Create a map of pulses by column and qubit
        const pulsesByColumnAndQubit = {};
        pulses.forEach(p => {
            const col = p.column !== undefined ? p.column : 0;
            const key = `${col}-${p.qubit}`;
            if (!pulsesByColumnAndQubit[key]) pulsesByColumnAndQubit[key] = [];
            pulsesByColumnAndQubit[key].push(p);
        });

        let html = '<div class="nmr-pulse-diagram">';

        // Render each qubit channel
        for (let q = 0; q < this.nmrEngine.numQubits; q++) {
            const nucleus = this.nmrEngine.sample?.nuclei[q];

            html += `<div class="nmr-pulse-channel">
                <div class="nmr-pulse-label">${nucleus?.label || 'Q' + q}</div>
                <div class="nmr-pulse-timeline">`;

            // Process each column in order
            for (let col = 0; col <= maxColumn; col++) {
                // Check for control flow at this column (only render once, on first qubit row)
                const cfAtCol = cfByColumn[col] || [];

                // Render REPEAT blocks spanning all qubits
                cfAtCol.forEach(cf => {
                    if (cf.type === 'REPEAT') {
                        const count = cf.params?.count || 2;
                        html += `<div class="nmr-pulse-cf nmr-pulse-repeat" title="REPEAT ×${count}">
                            <span class="nmr-cf-symbol">↻</span>
                            ${q === 0 ? `<span class="nmr-cf-label">×${count}</span>` : ''}
                        </div>`;
                    } else if (cf.type === 'END') {
                        const endLabel = cf.params?.endingLabel || '';
                        html += `<div class="nmr-pulse-cf nmr-pulse-end" title="END ${endLabel}">
                            <span class="nmr-cf-symbol">⊣</span>
                        </div>`;
                    }
                });

                // Get pulses at this column for this qubit
                const key = `${col}-${q}`;
                const pulsesAtCol = pulsesByColumnAndQubit[key] || [];

                if (pulsesAtCol.length > 0) {
                    pulsesAtCol.forEach((p, pIdx) => {
                        // Color based on rotation angle
                        let cls = 'nmr-pulse-90';
                        if (p.flipAngle && Math.abs(p.flipAngle - Math.PI) < 0.1) cls = 'nmr-pulse-180';
                        else if (p.flipAngle && p.flipAngle < Math.PI / 4) cls = 'nmr-pulse-small';

                        const phaseRad = p.phase || 0;
                        const phaseDeg = (phaseRad * 180 / Math.PI) % 360;
                        const phaseLabel = phaseDeg === 0 ? 'x' : phaseDeg === 90 ? 'y' : phaseDeg === 180 ? '-x' : phaseDeg === 270 ? '-y' : `${phaseDeg.toFixed(0)}°`;
                        const angleDeg = p.flipAngle ? (p.flipAngle * 180 / Math.PI).toFixed(0) : '90';
                        const tooltip = `${p.gate || p.description} (${angleDeg}°${phaseLabel})`;

                        // Store pulse data as JSON for click handler
                        const pulseData = JSON.stringify({
                            gate: p.gate || '',
                            description: p.description || '',
                            frequency: p.frequency,
                            duration: p.duration,
                            flipAngle: p.flipAngle,
                            phase: p.phase,
                            qubit: p.qubit,
                            type: p.type
                        });

                        html += `<div class="nmr-pulse-block ${cls} nmr-pulse-clickable" title="${tooltip}" data-pulse='${pulseData.replace(/'/g, '&apos;')}'>
                            <div class="nmr-pulse-bar"></div>
                            <span class="nmr-pulse-name">${p.gate || ''}</span>
                        </div>`;
                    });
                } else if (cfAtCol.length === 0) {
                    // Empty column - add a delay line
                    const hasAnyPulseAtCol = Object.keys(pulsesByColumnAndQubit).some(k => k.startsWith(`${col}-`));
                    if (hasAnyPulseAtCol) {
                        html += '<div class="nmr-pulse-delay"></div>';
                    }
                }
            }

            html += '</div></div>';
        }
        html += '</div>';

        // Add J-coupling evolution indicators for multi-qubit gates
        const multiQubitPulses = pulses.filter(p => p.type === 'j-coupling' || p.type === 'delay');
        if (multiQubitPulses.length > 0) {
            html += '<div class="nmr-jc-evol">';
            multiQubitPulses.forEach(p => {
                html += `<span class="nmr-jc-gate" title="${p.description}">${p.gate}</span>`;
            });
            html += '</div>';
        }

        container.innerHTML = html;

        // Add click handlers to pulse blocks
        container.querySelectorAll('.nmr-pulse-clickable').forEach(block => {
            block.addEventListener('click', (e) => {
                e.stopPropagation();
                const pulseData = JSON.parse(block.dataset.pulse);
                this.showPulsePopup(pulseData, e.clientX, e.clientY);
            });
        });
    }

    showPulsePopup(pulse, x, y) {
        // Remove existing popup
        this.hidePulsePopup();

        const popup = document.createElement('div');
        popup.id = 'nmr-pulse-popup';
        popup.className = 'nmr-peak-popup';

        const freqMHz = pulse.frequency ? (pulse.frequency / 1e6).toFixed(4) : 'N/A';
        const durationMs = pulse.duration ? (pulse.duration * 1000).toFixed(2) : 'N/A';
        const angleDeg = pulse.flipAngle ? (pulse.flipAngle * 180 / Math.PI).toFixed(1) : 'N/A';
        const phaseDeg = pulse.phase !== undefined ? ((pulse.phase * 180 / Math.PI) % 360).toFixed(0) : 'N/A';
        const phaseLabel = phaseDeg === '0' ? 'x' : phaseDeg === '90' ? 'y' : phaseDeg === '180' ? '-x' : phaseDeg === '270' ? '-y' : `${phaseDeg}°`;

        popup.innerHTML = `
            <div class="nmr-popup-header">
                <span class="nmr-popup-nucleus">${pulse.gate || 'Pulse'}</span>
                <span class="nmr-popup-element">${pulse.type || 'rf'}</span>
                <button class="nmr-popup-close" onclick="document.getElementById('nmr-pulse-popup')?.remove()">✕</button>
            </div>
            <div class="nmr-popup-body">
                ${pulse.frequency ? `
                <div class="nmr-popup-row">
                    <span class="nmr-popup-label">Frequency:</span>
                    <span class="nmr-popup-value">${freqMHz} MHz</span>
                </div>` : ''}
                <div class="nmr-popup-row">
                    <span class="nmr-popup-label">Duration:</span>
                    <span class="nmr-popup-value">${durationMs} ms</span>
                </div>
                ${pulse.flipAngle ? `
                <div class="nmr-popup-row">
                    <span class="nmr-popup-label">Flip Angle:</span>
                    <span class="nmr-popup-value">${angleDeg}°</span>
                </div>` : ''}
                ${pulse.phase !== undefined ? `
                <div class="nmr-popup-row">
                    <span class="nmr-popup-label">Phase:</span>
                    <span class="nmr-popup-value">${phaseLabel}</span>
                </div>` : ''}
                ${pulse.qubit !== undefined ? `
                <div class="nmr-popup-row">
                    <span class="nmr-popup-label">Qubit:</span>
                    <span class="nmr-popup-value">Q${pulse.qubit}</span>
                </div>` : ''}
                ${pulse.description ? `
                <div class="nmr-popup-env">
                    <span class="nmr-popup-label">Description:</span>
                    <span class="nmr-popup-desc">${pulse.description}</span>
                </div>` : ''}
            </div>
        `;

        // Position popup
        popup.style.left = `${x + 10}px`;
        popup.style.top = `${y - 10}px`;

        document.body.appendChild(popup);

        // Adjust if off screen
        const popupRect = popup.getBoundingClientRect();
        if (popupRect.right > window.innerWidth) {
            popup.style.left = `${x - popupRect.width - 10}px`;
        }
        if (popupRect.bottom > window.innerHeight) {
            popup.style.top = `${y - popupRect.height - 10}px`;
        }

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', this.hidePulsePopupOnClickOutside, { once: true });
        }, 100);
    }

    hidePulsePopupOnClickOutside = (e) => {
        const popup = document.getElementById('nmr-pulse-popup');
        if (popup && !popup.contains(e.target)) {
            popup.remove();
        }
    }

    hidePulsePopup() {
        const popup = document.getElementById('nmr-pulse-popup');
        if (popup) popup.remove();
    }

    setCircuit(circuit) {
        this.circuit = circuit;
        if (circuit && circuit.numQubits !== this.nmrEngine.numQubits) {
            // Find the best matching sample for the new qubit count
            this.autoSelectSampleForQubitCount(circuit.numQubits);
        }
    }

    autoSelectSampleForQubitCount(numQubits) {
        // Find samples with exact qubit count match
        const exactMatches = Object.entries(NMRSamples)
            .filter(([key, sample]) => sample.nuclei.length === numQubits && key !== 'custom')
            .sort((a, b) => this.getSampleRarityScore(a[1]) - this.getSampleRarityScore(b[1]));

        if (exactMatches.length > 0) {
            // Use the most common exact match (lowest rarity score)
            const [sampleKey] = exactMatches[0];
            this.selectedSample = sampleKey;
            this.nmrEngine.setSample(sampleKey);
        } else {
            // No exact match, find the closest one (prefer samples with fewer qubits, then by commonality)
            const allSamples = Object.entries(NMRSamples)
                .filter(([key]) => key !== 'custom')
                .sort((a, b) => {
                    const diffA = Math.abs(a[1].nuclei.length - numQubits);
                    const diffB = Math.abs(b[1].nuclei.length - numQubits);
                    if (diffA !== diffB) return diffA - diffB;
                    // If same difference, prefer more common nuclei
                    return this.getSampleRarityScore(a[1]) - this.getSampleRarityScore(b[1]);
                });

            if (allSamples.length > 0) {
                const [sampleKey] = allSamples[0];
                this.selectedSample = sampleKey;
                this.nmrEngine.setSample(sampleKey);
            } else {
                // Fallback to creating a custom sample
                this.nmrEngine.createCustomSample(numQubits);
            }
        }

        // Update the dropdown to reflect the new selection
        const select = document.getElementById('nmr-sample-select');
        if (select) {
            select.value = this.selectedSample;
        }

        this.updateAllVisualizations();
    }

    updateFromQuantumState(quantumState) {
        if (!quantumState) return;
        this.quantumState = quantumState;
        this._densityViewOverride = null;
        this._rebuildDensityStepStates();
        this._densityStepIndex = Math.max(0, this._densityStepStates.length - 1);
        this._stopDensityPlayback();
        this._renderDensityStepTimeline();
        this._updateDensityStepUI();
        this._syncDensityMatrixFromViewState();
        this.updateSpectrum();
        this._notifyAnalysisViewUpdate();
    }

    /**
     * Update ρ display from a specific |ψ⟩ (e.g. pre-measurement preview) without rebuilding the step list.
     */
    updateDensityViewState(quantumState, stepIndex = null) {
        if (!quantumState) return;
        this.quantumState = quantumState;
        this._densityViewOverride = quantumState;
        if (this._densityStepStates.length > 0 && stepIndex !== null && stepIndex !== undefined) {
            this._densityStepIndex = Math.max(0, Math.min(stepIndex, this._densityStepStates.length - 1));
            this._renderDensityStepTimeline();
            this._updateDensityStepUI();
        }
        this._syncDensityMatrixFromViewState({ preserveCamera: true });
        this._notifyAnalysisViewUpdate();
    }

    setAnalysisViewCallback(callback) {
        this._analysisViewCallback = typeof callback === 'function' ? callback : null;
    }

    _notifyAnalysisViewUpdate() {
        if (typeof this._analysisViewCallback === 'function') {
            this._analysisViewCallback(this._getDensityViewQuantumState());
        }
    }

    _syncDensityMatrixFromViewState({ preserveCamera = false } = {}) {
        const qs = this._getDensityViewQuantumState();
        if (!qs) return;
        this.nmrEngine.updateFromQuantumState(qs);
        this.updateDensityMatrix({ preserveCamera });
    }

    _cloneQuantumState(qs) {
        if (!qs) return null;
        const copy = new QuantumState(qs.numQubits);
        if (qs.amplitudes) {
            copy.amplitudes = [...qs.amplitudes];
        }
        return copy;
    }

    _rebuildDensityStepStates() {
        if (!this.circuit?.buildExecutionTimeline) {
            this._densityStepStates = [];
            return;
        }

        const savedState = this.circuit.state;
        this.circuit.state = new QuantumState(this.circuit.numQubits);
        const timeline = this.circuit.buildExecutionTimeline();
        const states = [{
            state: this._cloneQuantumState(this.circuit.state),
            gates: [],
            column: -1,
            repeatContext: null,
            label: 'Initial |ρ⟩'
        }];

        for (const step of timeline) {
            step.gates.forEach((gate) => this.circuit.executeGate(gate, { preview: true }));
            states.push({
                state: this._cloneQuantumState(this.circuit.state),
                gates: [...step.gates],
                column: step.column,
                repeatContext: step.repeatContext,
                label: this._formatDensityStepLabel(step)
            });
        }

        this.circuit.state = savedState;
        this._densityStepStates = states;
    }

    _gateDisplay() {
        return typeof GateDisplay !== 'undefined' ? GateDisplay : null;
    }

    _formatDensityStepGateLabel(step) {
        const gd = this._gateDisplay();
        if (gd) return gd.formatExecutionStepGateLabel(step);
        if (!step?.gates?.length) return null;
        return step.gates.map((g) => g.type || '?').join(', ');
    }

    _formatDensityStepRepeatLabel(step) {
        const gd = this._gateDisplay();
        if (gd) return gd.formatExecutionStepRepeatLabel(step);
        if (!step?.repeatContext?.length) return null;
        return step.repeatContext.map((r) => `REP ${r.iteration} of ${r.total}`).join(' · ');
    }

    _formatDensityStepLabel(step) {
        const gd = this._gateDisplay();
        if (gd) return gd.formatExecutionStepLabel(step);
        return this._formatDensityStepGateLabel(step) || '—';
    }

    _getDensityViewQuantumState() {
        if (this._densityViewOverride) {
            return this._densityViewOverride;
        }
        if (this._densityStepStates.length > 0) {
            const step = this._densityStepStates[this._densityStepIndex];
            if (step?.state) return step.state;
        }
        return this.quantumState;
    }

    getAnalysisViewState() {
        return this._getDensityViewQuantumState();
    }

    _applyDensityStep(index) {
        if (!this._densityStepStates.length) return;
        const clamped = Math.max(0, Math.min(index, this._densityStepStates.length - 1));
        this._densityStepIndex = clamped;
        this._densityViewOverride = null;
        this._renderDensityStepTimeline();
        this._updateDensityStepUI();
        this._syncDensityMatrixFromViewState({ preserveCamera: true });
        this._notifyAnalysisViewUpdate();
    }

    _densityStepForward() {
        this._stopDensityPlayback();
        if (!this._densityStepStates.length) return;
        if (this._densityStepIndex < this._densityStepStates.length - 1) {
            this._applyDensityStep(this._densityStepIndex + 1);
        } else if (this._densityPlaybackLoop) {
            this._applyDensityStep(0);
        }
    }

    _densityStepBack() {
        this._stopDensityPlayback();
        if (!this._densityStepStates.length) return;
        if (this._densityStepIndex > 0) {
            this._applyDensityStep(this._densityStepIndex - 1);
        } else if (this._densityPlaybackLoop) {
            this._applyDensityStep(this._densityStepStates.length - 1);
        }
    }

    _densityPlaybackIntervalMs() {
        const speed = Math.abs(this._densityPlaybackSpeed) || 0.25;
        return this._densityPlaybackBaseMs / speed;
    }

    _toggleDensityPlayback() {
        if (this._densityPlaying) {
            this._stopDensityPlayback();
        } else {
            this._startDensityPlayback();
        }
    }

    _densityStepIconHtml(kind) {
        const icons = {
            prev: '<svg class="nmr-step-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11 3L6 8l5 5V3z" fill="currentColor"/></svg>',
            next: '<svg class="nmr-step-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l5 5-5 5V3z" fill="currentColor"/></svg>',
            play: '<svg class="nmr-step-icon nmr-step-icon--play" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.35"/><path d="M7.1 5.4v5.2l4.1-2.6-4.1-2.6z" fill="currentColor"/></svg>',
            pause: '<svg class="nmr-step-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="5.2" y="4.5" width="2.1" height="7" rx="0.45" fill="currentColor"/><rect x="8.7" y="4.5" width="2.1" height="7" rx="0.45" fill="currentColor"/></svg>'
        };
        return icons[kind] || '';
    }

    _setDensityPlayButtonState(playing) {
        const playBtn = document.getElementById('nmr-density-step-play');
        if (!playBtn) return;
        playBtn.innerHTML = this._densityStepIconHtml(playing ? 'pause' : 'play');
        playBtn.classList.toggle('is-playing', playing);
        playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
        playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        playBtn.title = playing ? 'Pause' : 'Play / pause';
    }

    _startDensityPlayback() {
        if (!this._densityStepStates.length) return;
        this._stopDensityPlayback();
        this._densityPlaying = true;
        this._setDensityPlayButtonState(true);

        const tick = () => {
            if (!this._densityPlaying) return;
            const dir = this._densityPlaybackSpeed >= 0 ? 1 : -1;
            const next = this._densityStepIndex + dir;
            if (next < 0 || next >= this._densityStepStates.length) {
                if (this._densityPlaybackLoop) {
                    this._applyDensityStep(dir > 0 ? 0 : this._densityStepStates.length - 1);
                } else {
                    this._stopDensityPlayback();
                    return;
                }
            } else {
                this._applyDensityStep(next);
            }
            this._densityPlaybackTimer = setTimeout(tick, this._densityPlaybackIntervalMs());
        };

        this._densityPlaybackTimer = setTimeout(tick, this._densityPlaybackIntervalMs());
    }

    _stopDensityPlayback() {
        this._densityPlaying = false;
        if (this._densityPlaybackTimer) {
            clearTimeout(this._densityPlaybackTimer);
            this._densityPlaybackTimer = null;
        }
        this._setDensityPlayButtonState(false);
    }

    _adjustDensityPlaybackSpeed(factor) {
        const sign = this._densityPlaybackSpeed < 0 ? -1 : 1;
        let next = Math.abs(this._densityPlaybackSpeed) * factor;
        next = Math.max(0.25, Math.min(8, next));
        this._densityPlaybackSpeed = sign * next;
        this._updateDensityStepUI();
        if (this._densityPlaying) {
            this._startDensityPlayback();
        }
    }

    _reverseDensityPlaybackSpeed() {
        if (this._densityPlaybackSpeed === 0) {
            this._densityPlaybackSpeed = -1;
        } else {
            this._densityPlaybackSpeed *= -1;
        }
        this._updateDensityStepUI();
        if (this._densityPlaying) {
            this._startDensityPlayback();
        }
    }

    _renderDensityStepTimeline() {
        const timeline = document.getElementById('nmr-density-step-timeline');
        if (!timeline) return;

        timeline.innerHTML = '';
        if (!this._densityStepStates.length) {
            timeline.innerHTML = '<div class="nmr-density-step-empty">Run circuit to step through ρ evolution</div>';
            return;
        }

        this._densityStepStates.forEach((step, index) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'nmr-density-step-item';
            item.dataset.stepIndex = String(index);
            if (index === this._densityStepIndex) item.classList.add('active');

            const num = document.createElement('span');
            num.className = 'nmr-density-step-item-num';
            num.textContent = index === 0 ? '|ρ⟩₀' : `Step ${index}`;

            const gates = document.createElement('span');
            gates.className = 'nmr-density-step-item-gates';
            const gateLabel = this._formatDensityStepGateLabel(step);
            const repeatLabel = this._formatDensityStepRepeatLabel(step);
            gates.appendChild(document.createTextNode(gateLabel || step.label || 'Initial |ρ⟩'));
            if (repeatLabel) {
                gates.appendChild(document.createElement('br'));
                const rep = document.createElement('span');
                rep.className = 'nmr-density-step-item-repeat';
                rep.textContent = repeatLabel;
                gates.appendChild(rep);
            }

            item.appendChild(num);
            item.appendChild(gates);
            item.addEventListener('click', () => {
                this._stopDensityPlayback();
                this._applyDensityStep(index);
            });
            timeline.appendChild(item);
        });

        const active = timeline.querySelector('.nmr-density-step-item.active');
        if (active) {
            active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        }
    }

    _updateDensityStepUI() {
        const counter = document.getElementById('nmr-density-step-counter');
        const label = document.getElementById('nmr-density-step-label');
        const speedEl = document.getElementById('nmr-density-step-speed');
        const stepper = document.getElementById('analysis-stepper');
        const total = this._densityStepStates.length;
        const current = total > 0 ? this._densityStepIndex + 1 : 0;

        if (counter) counter.textContent = total > 0 ? `${current} / ${total}` : '—';
        if (label) {
            const step = this._densityStepStates[this._densityStepIndex];
            label.textContent = step
                ? (this._formatDensityStepGateLabel(step) || step.label || 'Initial |ρ⟩')
                : 'No circuit steps';
        }
        if (speedEl) {
            const abs = Math.abs(this._densityPlaybackSpeed);
            const formatted = Number.isInteger(abs) ? abs : abs.toFixed(2).replace(/\.?0+$/, '');
            speedEl.textContent = `${this._densityPlaybackSpeed < 0 ? '−' : ''}${formatted}×`;
            speedEl.classList.toggle('is-reverse', this._densityPlaybackSpeed < 0);
        }
        if (stepper) {
            stepper.classList.toggle('is-empty', total === 0);
        }

        const prevBtn = document.getElementById('nmr-density-step-prev');
        const nextBtn = document.getElementById('nmr-density-step-next');
        const playBtn = document.getElementById('nmr-density-step-play');
        const disabled = total === 0;
        if (prevBtn) prevBtn.disabled = disabled;
        if (nextBtn) nextBtn.disabled = disabled;
        if (playBtn) playBtn.disabled = disabled;
    }

    _bindDensityStepControls() {
        const prevBtn = document.getElementById('nmr-density-step-prev');
        const nextBtn = document.getElementById('nmr-density-step-next');
        const playBtn = document.getElementById('nmr-density-step-play');
        const stepper = document.getElementById('analysis-stepper');

        if (prevBtn && !prevBtn._bound) {
            prevBtn._bound = true;
            prevBtn.addEventListener('click', () => this._densityStepBack());
        }
        if (nextBtn && !nextBtn._bound) {
            nextBtn._bound = true;
            nextBtn.addEventListener('click', () => this._densityStepForward());
        }
        if (playBtn && !playBtn._bound) {
            playBtn._bound = true;
            playBtn.addEventListener('click', () => this._toggleDensityPlayback());
        }
        if (stepper && !stepper._bound) {
            stepper._bound = true;
            stepper.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-density-speed]');
                if (!btn) return;
                const action = btn.dataset.densitySpeed;
                if (action === 'slower') this._adjustDensityPlaybackSpeed(0.5);
                else if (action === 'faster') this._adjustDensityPlaybackSpeed(2);
                else if (action === 'reverse') this._reverseDensityPlaybackSpeed();
                else if (action === 'loop') {
                    this._densityPlaybackLoop = !this._densityPlaybackLoop;
                    btn.classList.toggle('active', this._densityPlaybackLoop);
                    btn.setAttribute('aria-pressed', this._densityPlaybackLoop ? 'true' : 'false');
                }
            });
        }
    }

    onCircuitChanged(circuit, quantumState) {
        this.setCircuit(circuit);
        this.updateFromQuantumState(quantumState);
        this.updatePulseSequence();
        requestAnimationFrame(() => {
            this.updateMolecule();
            this.updateSpectrum();
        });
    }

    _lerpRgb(a, b, t) {
        return {
            r: Math.round(a.r + (b.r - a.r) * t),
            g: Math.round(a.g + (b.g - a.g) * t),
            b: Math.round(a.b + (b.b - a.b) * t)
        };
    }

    /** Boost small |ρ| so large matrices remain readable (gamma compression). */
    _densityVisualT(mag, maxMag) {
        if (mag <= 1e-12 || maxMag <= 1e-12) return 0;
        return Math.min(1, Math.pow(mag / maxMag, 0.32));
    }

    _prepareDensityMatrixForView() {
        const engine = this.nmrEngine;
        if (!engine) return null;

        const qs = this._getDensityViewQuantumState();
        if (qs?.amplitudes?.length) {
            if (engine.numQubits !== qs.numQubits) {
                engine.createCustomSample(qs.numQubits);
            }
            engine.updateFromQuantumState(qs);
        } else {
            const dim = Math.pow(2, engine.numQubits);
            const rho = engine.densityMatrix;
            if (!rho || rho.length !== dim || rho[0]?.length !== dim) {
                engine.initializeDensityMatrix();
            }
        }

        return engine.densityMatrix;
    }

    _buildDensityMatrixTableHTML(rho, dim, numQubits, heatmap, maxMag) {
        const colors = this.getNmrThemeColors();
        let html = '<div class="nmr-density-scroll"><table class="nmr-density-table">';
        html += '<tr><th></th>';
        for (let j = 0; j < dim; j++) {
            html += `<th>|${j.toString(2).padStart(numQubits, '0')}⟩</th>`;
        }
        html += '</tr>';

        for (let i = 0; i < dim; i++) {
            html += `<tr><th>⟨${i.toString(2).padStart(numQubits, '0')}|</th>`;
            for (let j = 0; j < dim; j++) {
                const e = rho[i]?.[j];
                const stats = this._densityEntryStats(e);
                const val = stats.mag < 0.001 ? '0' : (e?.re ?? 0).toFixed(2);
                const bg = heatmap ? this._densityHeatCss(stats.mag, maxMag, colors) : 'transparent';
                const cls = heatmap ? ' class="nmr-density-cell--heat"' : '';
                html += `<td${cls} style="background:${bg}">${val}</td>`;
            }
            html += '</tr>';
        }
        html += '</table></div>';
        return html;
    }

    _computeDensityMaxMag(rho, dim) {
        let maxMag = 0;
        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                maxMag = Math.max(maxMag, this._densityEntryStats(rho[i]?.[j]).mag);
            }
        }
        return maxMag < 1e-9 ? 1 : maxMag;
    }

    _densityHeatCss(mag, maxMag, colors) {
        const t = this._densityVisualT(mag, maxMag);
        if (t <= 0) return 'transparent';
        return this._colorAlpha(colors.accent, 0.18 + t * 0.82);
    }

    _densityHeatRgb(mag, maxMag, colors) {
        const t = this._densityVisualT(mag, maxMag);
        const bg = this._hexToRgb(colors.bgOuter || colors.bgPlot);
        if (t <= 0) return bg;
        const accent = this._hexToRgb(colors.accent);
        const alpha = 0.18 + t * 0.82;
        return this._lerpRgb(bg, accent, alpha);
    }

    _densityValuesCanvasRgb(mag, maxMag, colors) {
        const t = this._densityVisualT(mag, maxMag);
        if (t <= 0) return this._hexToRgb(colors.bgOuter);
        const v = Math.round(48 + t * 207);
        return { r: v, g: v, b: v };
    }

    _computeDensityPurity(rho, dim) {
        let trRho2 = 0;
        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                let re = 0;
                let im = 0;
                for (let k = 0; k < dim; k++) {
                    const a = rho[i]?.[k];
                    const b = rho[k]?.[j];
                    if (!a || !b) continue;
                    const prod = Complex.mul(a, b);
                    re += prod.re;
                    im += prod.im;
                }
                if (i === j) {
                    trRho2 += re;
                }
            }
        }
        return Math.max(0, Math.min(1, trRho2));
    }

    _densityCanvasLegendHtml(maxMag, heatmap, purity = null) {
        const mode = heatmap ? 'Heatmap · |ρ| amplitude' : 'Values · magnitude (hover for Re/Im)';
        const purityStr = purity !== null && Number.isFinite(purity)
            ? `<span class="nmr-density-canvas-legend-purity">Tr(ρ²) = ${purity.toFixed(4)} · pure state = 1</span>`
            : '';
        return `<div class="nmr-density-canvas-meta">
            <span class="nmr-density-canvas-legend-label">${mode}</span>
            <span class="nmr-density-canvas-legend-max">max |ρ| = ${maxMag.toFixed(4)}</span>
            ${purityStr}
            <span class="nmr-density-canvas-legend-hint">Scroll to zoom · drag or Shift+scroll to pan when larger than view</span>
        </div>`;
    }

    _densityTableUseCanvas(dim) {
        return dim > 64;
    }

    _renderDensityMatrixTable(host, rho, dim, numQubits) {
        if (!host) return;
        this._cancelDensityTableRender();
        const token = this._densityTableRenderToken;
        const heatmap = this.densityMatrixTableHeatmap;
        const maxMag = this._computeDensityMaxMag(rho, dim);
        const purity = this._computeDensityPurity(rho, dim);
        const useCanvas = this._densityTableUseCanvas(dim);
        const wrap = this._createDensityMatrixViewShell(dim, numQubits, maxMag, heatmap, {
            withAxisLabels: useCanvas,
            purity
        });
        if (dim <= 16) wrap.classList.add('nmr-density-wrap--compact');

        host.innerHTML = '';
        host.appendChild(wrap);

        if (useCanvas) {
            const cells = wrap.querySelector('.nmr-density-matrix-cells');
            if (cells) {
                cells.innerHTML = '<p class="nmr-density-canvas-loading nmr-note">Rendering matrix…</p>';
            }
            this._scheduleDensityMatrixCanvas(wrap, rho, dim, numQubits, heatmap, maxMag, token);
            return;
        }

        const cells = wrap.querySelector('.nmr-density-matrix-cells');
        if (cells) {
            cells.innerHTML = this._buildDensityMatrixTableHTML(rho, dim, numQubits, heatmap, maxMag);
        }
        this._initDensityMatrixZoomInteraction(wrap, null, dim, numQubits);
        this._scheduleDensityTableRefit(wrap, true);
    }

    _scheduleDensityMatrixCanvas(wrap, rho, dim, numQubits, heatmap, maxMag, token) {
        if (!wrap) return;
        this._densityTableRenderAf = requestAnimationFrame(() => {
            this._densityTableRenderAf = null;
            if (token !== this._densityTableRenderToken || !wrap.isConnected) return;
            try {
                this._mountDensityMatrixCanvas(wrap, rho, dim, numQubits, heatmap, maxMag, token);
            } catch (err) {
                console.error('Density matrix canvas render failed:', err);
                wrap.innerHTML = '<p class="nmr-note">Failed to render matrix view.</p>';
            }
        });
    }

    _mountDensityMatrixCanvas(wrap, rho, dim, numQubits, heatmap, maxMag, token) {
        if (!wrap?.isConnected || token !== this._densityTableRenderToken) return;

        const colors = this.getNmrThemeColors();
        const canvas = document.createElement('canvas');
        canvas.className = 'nmr-density-canvas';
        canvas.width = dim;
        canvas.height = dim;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
            wrap.innerHTML = '<p class="nmr-note">Canvas not available in this browser.</p>';
            return;
        }

        let img;
        try {
            img = ctx.createImageData(dim, dim);
        } catch (err) {
            console.error('createImageData failed:', err);
            wrap.innerHTML = `<p class="nmr-note">Matrix too large for canvas (${dim}×${dim}).</p>`;
            return;
        }

        const px = img.data;
        const rowsPerChunk = Math.max(4, Math.min(64, Math.floor(8192 / Math.max(dim, 1))));
        let row = 0;

        const finish = () => {
            if (token !== this._densityTableRenderToken || !wrap.isConnected) return;
            ctx.putImageData(img, 0, 0);

            const cells = wrap.querySelector('.nmr-density-matrix-cells');
            if (cells) {
                cells.innerHTML = '';
                cells.appendChild(canvas);
            } else {
                wrap.innerHTML = '';
                wrap.appendChild(canvas);
            }

            this._initDensityMatrixZoomInteraction(wrap, rho, dim, numQubits);
            this._scheduleDensityTableRefit(wrap, true);
            requestAnimationFrame(() => {
                if (document.getElementById('nmr-density-table-panel')?.classList.contains('nmr-fullscreen')) {
                    this._syncDensityTableFullscreenLayout();
                }
            });
        };

        const processChunk = () => {
            if (token !== this._densityTableRenderToken || !wrap.isConnected) return;
            const end = Math.min(row + rowsPerChunk, dim);
            for (let i = row; i < end; i++) {
                const rhoRow = rho[i];
                for (let j = 0; j < dim; j++) {
                    const stats = this._densityEntryStats(rhoRow?.[j]);
                    const off = (i * dim + j) * 4;
                    const rgb = heatmap
                        ? this._densityHeatRgb(stats.mag, maxMag, colors)
                        : this._densityValuesCanvasRgb(stats.mag, maxMag, colors);
                    px[off] = rgb.r;
                    px[off + 1] = rgb.g;
                    px[off + 2] = rgb.b;
                    px[off + 3] = 255;
                }
            }
            row = end;
            if (row < dim) {
                this._densityTableRenderAf = requestAnimationFrame(processChunk);
            } else {
                finish();
            }
        };

        processChunk();
    }

    _bindDensityMatrixCanvasHover(canvas, wrap, tip, rho, dim, numQubits) {
        const show = (clientX, clientY) => {
            const rect = canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const j = Math.floor(((clientX - rect.left) / rect.width) * dim);
            const i = Math.floor(((clientY - rect.top) / rect.height) * dim);
            if (i < 0 || j < 0 || i >= dim || j >= dim) {
                tip.hidden = true;
                return;
            }
            const e = rho[i]?.[j];
            const stats = this._densityEntryStats(e);
            const reStr = Math.abs(stats.re) < 1e-4 && Math.abs(stats.im) < 1e-4 ? '0' : stats.re.toFixed(4);
            const imStr = Math.abs(stats.im) < 1e-4 ? '0' : stats.im.toFixed(4);
            tip.innerHTML = `
                <div class="nmr-density-tip-title">${this._formatBasisBra(i, numQubits)} ρ ${this._formatBasisKet(j, numQubits)}</div>
                <div><span>|ρ|</span> <strong>${stats.mag.toFixed(4)}</strong></div>
                <div><span>Phase</span> <strong>${stats.phaseDeg.toFixed(1)}°</strong></div>
                <div><span>Re</span> <strong>${reStr}</strong> · <span>Im</span> <strong>${imStr}</strong></div>
            `;
            tip.hidden = false;
            const wrapRect = wrap.getBoundingClientRect();
            const x = clientX - wrapRect.left + 12;
            const y = clientY - wrapRect.top + 12;
            tip.style.left = `${Math.min(x, wrapRect.width - 200)}px`;
            tip.style.top = `${Math.min(y, wrapRect.height - 90)}px`;
        };

        canvas.addEventListener('mousemove', (e) => show(e.clientX, e.clientY));
        canvas.addEventListener('mouseleave', () => { tip.hidden = true; });
    }

    _updateDensityTableOptionsVisibility() {
        const opts = document.getElementById('nmr-density-table-options');
        if (opts) opts.classList.toggle('visible', this.densityMatrixViewMode === 'table');
    }

    _syncDensityHeatmapToggleUI() {
        const toggle = document.getElementById('nmr-density-heatmap-toggle');
        if (!toggle) return;
        toggle.querySelectorAll('[data-density-heatmap]').forEach((btn) => {
            const on = (btn.dataset.densityHeatmap === '1') === this.densityMatrixTableHeatmap;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    _bindDensityMatrixHeatmapToggle() {
        const toggle = document.getElementById('nmr-density-heatmap-toggle');
        if (!toggle || toggle._bound) return;
        toggle._bound = true;
        toggle.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-density-heatmap]');
            if (!btn) return;
            this.densityMatrixTableHeatmap = btn.dataset.densityHeatmap === '1';
            this._syncDensityHeatmapToggleUI();
            this.updateDensityMatrix();
        });
    }

    _bindDensityMatrixViewToggle() {
        const toggle = document.getElementById('nmr-density-view-toggle');
        if (!toggle || toggle._bound) return;
        toggle._bound = true;
        toggle.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-density-view]');
            if (!btn) return;
            const mode = btn.dataset.densityView;
            if (mode !== '3d' && mode !== 'table') return;
            this._setDensityMatrixView(mode);
        });
    }

    _setDensityMatrixView(mode) {
        if (this.densityMatrixViewMode === mode) return;
        this.densityMatrixViewMode = mode;
        if (mode === 'table') {
            this._pauseDensityMatrix3D();
        } else {
            this._cancelDensityTableRender();
            if (this.fullscreenElement?.id === 'nmr-density-table-panel') {
                this.exitFullscreen();
            }
        }

        const panel3d = document.getElementById('nmr-density-3d-panel');
        const hostTable = document.getElementById('nmr-density-table-wrap');
        const toggle = document.getElementById('nmr-density-view-toggle');
        if (panel3d) panel3d.classList.toggle('active', mode === '3d');
        if (hostTable) hostTable.classList.toggle('active', mode === 'table');
        if (toggle) {
            toggle.querySelectorAll('[data-density-view]').forEach((btn) => {
                const on = btn.dataset.densityView === mode;
                btn.classList.toggle('active', on);
                btn.setAttribute('aria-selected', on ? 'true' : 'false');
            });
        }
        this._updateDensityTableOptionsVisibility();
        if (mode === '3d') {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this._resumeDensityMatrix3D({ preserveCamera: true });
                });
            });
        } else {
            this.updateDensityMatrix();
        }
    }

    _formatBasisKet(j, numQubits) {
        return `|${j.toString(2).padStart(numQubits, '0')}⟩`;
    }

    _formatBasisBra(i, numQubits) {
        return `⟨${i.toString(2).padStart(numQubits, '0')}|`;
    }

    _densityEntryStats(e) {
        const re = e.re || 0;
        const im = e.im || 0;
        const mag = Math.sqrt(re * re + im * im);
        const phase = Math.atan2(im, re);
        const phaseDeg = (phase * 180) / Math.PI;
        return { re, im, mag, phase, phaseDeg };
    }

    _bumpDensity3DUpdateGen() {
        this._density3dUpdateGen += 1;
        if (this._density3dRetryAf) {
            cancelAnimationFrame(this._density3dRetryAf);
            this._density3dRetryAf = null;
        }
        return this._density3dUpdateGen;
    }

    _isDensity3DUpdateCurrent(gen) {
        return gen === this._density3dUpdateGen;
    }

    /** Coalesce rapid ρ updates (paste, auto-run, step scrub) into one 3D rebuild. */
    _queueDensityMatrix3DUpdate({ preserveCamera = false } = {}) {
        this._density3dPendingPreserveCamera = this._density3dPendingPreserveCamera || preserveCamera;
        if (this._density3dCoalesceAf) {
            cancelAnimationFrame(this._density3dCoalesceAf);
        }
        this._density3dCoalesceAf = requestAnimationFrame(() => {
            this._density3dCoalesceAf = null;
            this._flushDensityMatrix3DUpdate();
        });
    }

    _flushDensityMatrix3DUpdate() {
        if (this._density3dPaused || !this._isDensity3DViewModeOn()) return;

        const preserveCamera = this._density3dPendingPreserveCamera;
        this._density3dPendingPreserveCamera = false;

        const rho = this._prepareDensityMatrixForView();
        if (!rho || !this.nmrEngine?.densityMatrix) {
            this._bumpDensity3DUpdateGen();
            this._setDensityMatrix3DPanelState('empty', 'Run circuit to view density matrix');
            return;
        }

        const dim = Math.pow(2, this.nmrEngine.numQubits);
        const numQubits = this.nmrEngine.numQubits;
        const gen = this._bumpDensity3DUpdateGen();
        this._density3dPending = { rho, dim, numQubits, preserveCamera };

        if (this._isDensity3DRenderable()) {
            this._applyDensityMatrix3DNow(rho, dim, numQubits, { preserveCamera, updateGen: gen });
        } else {
            this._whenDensity3DMountReady(() => {
                if (!this._isDensity3DUpdateCurrent(gen)) return;
                this._applyDensityMatrix3DNow(rho, dim, numQubits, { preserveCamera, updateGen: gen });
            });
            this._armDensity3DMountWatch();
        }
    }

    _applyDensityMatrix3DNow(rho, dim, numQubits, { preserveCamera = false, updateGen = null } = {}) {
        const gen = updateGen ?? this._density3dUpdateGen;
        if (!this._isDensity3DUpdateCurrent(gen)) return;

        if (!this._ensureDensityMatrix3D()) {
            this._scheduleDensityMatrix3DUpdate(rho, dim, numQubits, { preserveCamera, updateGen: gen });
            return;
        }

        this.density3dMount = document.getElementById('nmr-density-3d-mount');
        this._attachDensityMatrix3DResizeObserver();
        this._startDensityMatrix3DLoop();

        if (this._tryUpdateDensityMatrix3DInPlace(rho, dim, numQubits, { preserveCamera, updateGen: gen })) {
            this._setDensityMatrix3DPanelState('ready');
            return;
        }
        if (!this._rebuildDensityMatrix3D(rho, dim, numQubits, { preserveCamera, updateGen: gen })) {
            return;
        }
        if (!this._isDensity3DUpdateCurrent(gen)) return;
        this._setDensityMatrix3DPanelState('ready');
    }

    _resizeDensityMatrix3DIfNeeded() {
        if (!this.density3dMount || !this.density3dRenderer || !this.density3dCamera) return false;
        const w = this.density3dMount.clientWidth;
        const h = this.density3dMount.clientHeight;
        const last = this._density3dLastSize;
        if (w < 8 || h < 8) {
            return last.w >= 8 && last.h >= 8;
        }
        if (last.w !== w || last.h !== h) {
            this.density3dCamera.aspect = w / h;
            this.density3dCamera.updateProjectionMatrix();
            this.density3dRenderer.setSize(w, h, false);
            this._density3dLastSize = { w, h };
        }
        return true;
    }

    /** Synchronous paint — used during swaps so the canvas never shows a cleared frame. */
    _renderDensityMatrix3DImmediate() {
        if (!this.density3dRenderer || !this.density3dScene || !this.density3dCamera) return false;
        if (!this._resizeDensityMatrix3DIfNeeded()) return false;
        this.density3dRenderer.render(this.density3dScene, this.density3dCamera);
        return true;
    }

    _computeDensityMatrix3DEntries(rho, dim, numQubits) {
        let maxMag = 0;
        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                maxMag = Math.max(maxMag, this._densityEntryStats(rho[i][j]).mag);
            }
        }
        if (maxMag < 1e-9) maxMag = 1;
        const colors = this.getNmrThemeColors();
        const entries = this._collectDensityBarEntries(rho, dim, maxMag, numQubits, colors);
        return { maxMag, colors, entries, layout: this._densityLayoutParams(dim) };
    }

    _tryUpdateDensityMatrix3DInPlace(rho, dim, numQubits, { preserveCamera = false, updateGen = null } = {}) {
        const gen = updateGen ?? this._density3dUpdateGen;
        if (!this._isDensity3DUpdateCurrent(gen)) return false;
        if (this._density3dBuiltDim !== dim || this._density3dBuiltNumQubits !== numQubits) return false;
        if (!this.density3dScene || !this.density3dContent || !this.density3dRenderer) return false;

        const { maxMag, entries, layout } = this._computeDensityMatrix3DEntries(rho, dim, numQubits);
        const useInstanced = entries.length > 256 || dim > 32;

        if (useInstanced) {
            if (!this._density3dInstancedMesh) return false;
            return this._updateDensityInstancedInPlace(entries, layout, maxMag, gen);
        }

        if (!this.density3dBarMeshes.length || this._density3dInstancedMesh) return false;
        if (entries.length !== this.density3dBarMeshes.length) return false;

        const { spacing, heightUnits, minBarH } = layout;
        for (let n = 0; n < entries.length; n++) {
            const e = entries[n];
            const mesh = this.density3dBarMeshes[n];
            if (!mesh) return false;
            const h = Math.max(minBarH, (e.mag / maxMag) * heightUnits);
            mesh.scale.y = h;
            const { x, z } = this._densityGridXZ(e.row, e.col, dim, spacing);
            mesh.position.set(x, h * 0.5, z);
            if (mesh.material?.color) mesh.material.color.copy(e.color);
            if (mesh.material?.emissive) mesh.material.emissive.copy(e.color).multiplyScalar(0.12);
            mesh.userData = {
                row: e.row,
                col: e.col,
                re: e.re,
                im: e.im,
                mag: e.mag,
                phaseDeg: e.phaseDeg,
                ket: e.ket,
                bra: e.bra
            };
        }

        this._density3dMaxMag = maxMag;
        this._density3dBarInstances = entries;
        this._updateDensityMatrix3DCameraFromOrbit();
        if (!this._isDensity3DUpdateCurrent(gen)) return false;
        this._renderDensityMatrix3DImmediate();
        return true;
    }

    _updateDensityInstancedInPlace(entries, layout, maxMag, gen) {
        const mesh = this._density3dInstancedMesh;
        if (!mesh || typeof THREE === 'undefined') return false;

        let list = entries;
        const maxN = this._density3dMaxInstances;
        if (list.length > maxN) {
            list = [...list].sort((a, b) => b.mag - a.mag).slice(0, maxN);
        }
        if (list.length > mesh.count) return false;

        const { spacing, barFoot, heightUnits, minBarH, dim } = layout;
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();

        for (let n = 0; n < list.length; n++) {
            const e = list[n];
            const h = Math.max(minBarH, (e.mag / maxMag) * heightUnits);
            const { x, z } = this._densityGridXZ(e.row, e.col, dim, spacing);
            position.set(x, h * 0.5, z);
            scale.set(barFoot, h, barFoot);
            matrix.compose(position, new THREE.Quaternion(), scale);
            mesh.setMatrixAt(n, matrix);
            mesh.setColorAt(n, e.color);
        }

        mesh.count = list.length;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        this._density3dMaxMag = maxMag;
        this._density3dBarInstances = list;
        this._updateDensityMatrix3DCameraFromOrbit();
        if (!this._isDensity3DUpdateCurrent(gen)) return false;
        this._renderDensityMatrix3DImmediate();
        return true;
    }

    _getDensity3DContentGroup() {
        return this._density3dBuildTarget || this.density3dContent;
    }

    /** Stop 3D render loop while the table view is shown — keeps WebGL context alive. */
    _pauseDensityMatrix3D() {
        this._density3dPaused = true;
        if (this._density3dRetryAf) {
            cancelAnimationFrame(this._density3dRetryAf);
            this._density3dRetryAf = null;
        }
        if (this.density3dAnimId) {
            cancelAnimationFrame(this.density3dAnimId);
            this.density3dAnimId = null;
        }
        if (this.density3dResizeObserver) {
            this.density3dResizeObserver.disconnect();
            this.density3dResizeObserver = null;
        }
    }

    _startDensityMatrix3DLoop() {
        if (this.density3dAnimId) return;
        const loop = () => {
            this.density3dAnimId = requestAnimationFrame(loop);
            if (this._density3dRebuilding || this._density3dPaused || !this._isDensity3DRenderable()) return;
            this._safeRenderDensity3D();
        };
        loop();
    }

    _attachDensityMatrix3DResizeObserver() {
        if (this.density3dResizeObserver) return;
        const mount = this.density3dMount || document.getElementById('nmr-density-3d-mount');
        if (!mount) return;
        const frame = mount.closest('.nmr-density-3d-frame');
        this.density3dResizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                if (this._density3dRebuilding || this._density3dPaused || !this._isDensity3DRenderable()) return;
                this._safeRenderDensity3D();
            });
        });
        this.density3dResizeObserver.observe(frame || mount);
    }

    /** Restore 3D view after switching back from the 2D table (or un-hiding the panel). */
    _resumeDensityMatrix3D({ preserveCamera = true } = {}) {
        this._density3dPaused = false;
        if (!this._isDensity3DViewModeOn()) return;
        this._disarmDensity3DMountWatch();
        this._queueDensityMatrix3DUpdate({ preserveCamera });
    }

    _disposeDensityMatrix3D() {
        this._disarmDensity3DMountWatch();
        if (this._density3dCoalesceAf) {
            cancelAnimationFrame(this._density3dCoalesceAf);
            this._density3dCoalesceAf = null;
        }
        this._density3dPendingPreserveCamera = false;
        this._density3dAbortToken += 1;
        if (this._density3dRetryAf) {
            cancelAnimationFrame(this._density3dRetryAf);
            this._density3dRetryAf = null;
        }
        if (this.density3dAnimId) {
            cancelAnimationFrame(this.density3dAnimId);
            this.density3dAnimId = null;
        }
        if (this.density3dResizeObserver) {
            this.density3dResizeObserver.disconnect();
            this.density3dResizeObserver = null;
        }
        if (this.density3dRenderer) {
            const el = this.density3dRenderer.domElement;
            if (el?._density3dHandlers) {
                for (const entry of el._density3dHandlers) {
                    const evt = entry[0];
                    const fn = entry[1];
                    const opts = entry[2];
                    el.removeEventListener(evt, fn, opts);
                }
                delete el._density3dHandlers;
            }
            if (el?._density3dGlHandlers) {
                for (const entry of el._density3dGlHandlers) {
                    el.removeEventListener(entry[0], entry[1], entry[2]);
                }
                delete el._density3dGlHandlers;
            }
            if (el?.parentNode) el.parentNode.removeChild(el);
            this.density3dRenderer.dispose();
            this.density3dRenderer = null;
        }
        this.density3dBarMeshes = [];
        this._density3dBarInstances = [];
        this._density3dInstancedMesh = null;
        this._density3dHoverInstance = -1;
        if (this.density3dContent) {
            this._disposeDensity3DObject(this.density3dContent);
        }
        if (this.density3dScene) {
            this._disposeThreeSceneBackground(this.density3dScene);
        }
        this.density3dScene = null;
        this.density3dCamera = null;
        this.density3dContent = null;
        this.density3dMount = null;
        this._density3dHoverMesh = null;
        this._density3dTarget = null;
        this._density3dBuiltDim = null;
        this._density3dBuiltNumQubits = null;
        this._hideDensityMatrixTooltip();
    }

    _disposeThreeSceneBackground(scene) {
        if (!scene?.background) return;
        const bg = scene.background;
        if (bg.isTexture) bg.dispose();
        scene.background = null;
    }

    /** 3D vs table toggle is on; parent analysis panel may still be hidden. */
    _isDensity3DViewModeOn() {
        const panel = document.getElementById('nmr-density-3d-panel');
        return Boolean(panel?.classList.contains('active'));
    }

    _isDensity3DPanelVisible() {
        if (!this._isDensity3DViewModeOn()) return false;
        const panel = document.getElementById('nmr-density-3d-panel');
        const analysisPanel = panel?.closest('.analysis-panel');
        if (analysisPanel && !analysisPanel.classList.contains('active')) return false;
        const editorPanel = panel?.closest('.editor-panel');
        if (editorPanel && !editorPanel.classList.contains('active')) return false;
        const mount = document.getElementById('nmr-density-3d-mount');
        return Boolean(mount?.isConnected);
    }

    _disarmDensity3DMountWatch() {
        if (this._density3dMountWatchRo) {
            this._density3dMountWatchRo.disconnect();
            this._density3dMountWatchRo = null;
        }
    }

    /** ResizeObserver fallback when rAF polling ends before the analysis panel has layout. */
    _armDensity3DMountWatch() {
        if (this._density3dMountWatchRo || this._density3dPaused || !this._isDensity3DViewModeOn()) return;
        const mount = document.getElementById('nmr-density-3d-mount');
        if (!mount?.isConnected) return;

        const tryBoot = () => {
            if (this._density3dPaused || !this._isDensity3DViewModeOn()) return;
            if (!this._isDensity3DPanelVisible()) return;
            if (mount.clientWidth < 8 || mount.clientHeight < 8) return;
            this._disarmDensity3DMountWatch();
            this._resumeDensityMatrix3D({ preserveCamera: true });
        };

        this._density3dMountWatchRo = new ResizeObserver(() => {
            requestAnimationFrame(tryBoot);
        });
        this._density3dMountWatchRo.observe(mount);
        const frame = mount.closest('.nmr-density-3d-frame');
        if (frame && frame !== mount) this._density3dMountWatchRo.observe(frame);
        const editor = mount.closest('.editor-panel');
        if (editor) this._density3dMountWatchRo.observe(editor);
        requestAnimationFrame(tryBoot);
    }

    /** Called when the Data Analysis editor tab becomes visible (after layout). */
    _kickDensityMatrix3DAfterAnalysisShown() {
        if (this.densityMatrixViewMode !== '3d') return;
        const boot = () => {
            if (!this._isDensity3DViewModeOn()) return;
            if (this._isDensity3DRenderable()) {
                this._resumeDensityMatrix3D({ preserveCamera: true });
            } else {
                this._whenDensity3DMountReady(() => {
                    this._resumeDensityMatrix3D({ preserveCamera: true });
                });
                this._armDensity3DMountWatch();
            }
        };
        requestAnimationFrame(() => requestAnimationFrame(boot));
    }

    /** After the Data Analysis editor tab is shown, mount has non-zero layout. */
    _whenDensity3DMountReady(callback, maxAttempts = 240) {
        let attempts = 0;
        const tick = () => {
            if (!this._isDensity3DViewModeOn()) return;
            const mount = document.getElementById('nmr-density-3d-mount');
            if (
                mount?.isConnected &&
                this._isDensity3DPanelVisible() &&
                mount.clientWidth >= 8 &&
                mount.clientHeight >= 8
            ) {
                callback();
                return;
            }
            attempts += 1;
            if (attempts < maxAttempts) {
                requestAnimationFrame(tick);
            } else {
                this._armDensity3DMountWatch();
            }
        };
        requestAnimationFrame(tick);
    }

    _isDensity3DRenderable() {
        if (!this._isDensity3DPanelVisible()) return false;
        const mount = this.density3dMount || document.getElementById('nmr-density-3d-mount');
        if (!mount?.isConnected) return false;
        return mount.clientWidth >= 8 && mount.clientHeight >= 8;
    }

    _density3DContextIsLost() {
        const gl = this.density3dRenderer?.getContext?.();
        return Boolean(gl && typeof gl.isContextLost === 'function' && gl.isContextLost());
    }

    _requestDensity3DRecover() {
        if (this._density3dRecoverScheduled) return;
        this._density3dRecoverScheduled = true;
        requestAnimationFrame(() => {
            this._density3dRecoverScheduled = false;
            if (!this._isDensity3DViewModeOn()) return;
            if (this._density3DContextIsLost()) {
                this._disposeDensityMatrix3D();
            }
            this._queueDensityMatrix3DUpdate({ preserveCamera: true });
        });
    }

    _applyDensityMatrix3DBackground() {
        if (!this.density3dScene || typeof THREE === 'undefined') return;
        const colors = this.getNmrThemeColors();
        const plotClear = new THREE.Color(colors.bgPlot);
        const panel = document.querySelector('.nmr-res-density') || this.density3dMount;
        const bg = window.QubibyteTheme?.createThreeBackgroundFromElement
            ? window.QubibyteTheme.createThreeBackgroundFromElement(panel)
            : plotClear;
        const oldBg = this.density3dScene.background;
        this.density3dScene.background = bg;
        if (oldBg?.isTexture && oldBg !== bg) {
            oldBg.dispose();
        }
        if (this.density3dRenderer) {
            const clear = bg.isColor ? bg : plotClear;
            this.density3dRenderer.setClearColor(clear, 1);
        }
    }

    _collectDensityBarEntries(rho, dim, maxMag, numQubits, colors) {
        const relThreshold = dim > 256 ? 1e-4 : dim > 64 ? 1e-6 : 0;
        const magCutoff = Math.max(maxMag * relThreshold, 1e-10);
        const entries = [];

        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                const e = rho[i][j];
                const stats = this._densityEntryStats(e);
                if (stats.mag < magCutoff) continue;
                const { color } = this._barColorForEntry(e, colors, maxMag);
                entries.push({
                    row: i,
                    col: j,
                    re: stats.re,
                    im: stats.im,
                    mag: stats.mag,
                    phaseDeg: stats.phaseDeg,
                    color,
                    ket: this._formatBasisKet(j, numQubits),
                    bra: this._formatBasisBra(i, numQubits)
                });
            }
        }

        return entries;
    }

    _densityLayoutParams(dim) {
        const baseSpacing = 1.15;
        const pad = 0.35;
        const maxExtent = 10.5;

        let spacing = baseSpacing;
        let gridW = dim * spacing + pad;
        if (gridW > maxExtent) {
            spacing = dim > 1 ? (maxExtent - pad) / dim : baseSpacing;
            gridW = dim * spacing + pad;
        }
        const gridD = gridW;
        const barFoot = Math.max(0.035, Math.min(0.88, spacing * 0.92));
        const offset = (dim - 1) * spacing * 0.5;

        return {
            dim,
            spacing,
            barFoot,
            offset,
            gridW,
            gridD,
            heightUnits: 2.6,
            minBarH: 0.035
        };
    }

    _densityCameraRadiusForGrid(gridW, gridD) {
        const span = Math.max(gridW, gridD);
        return (7 + span * 0.68) * 1.15;
    }

    _densityLabelIndices(dim, maxCount = 20) {
        if (dim <= maxCount) {
            return Array.from({ length: dim }, (_, i) => i);
        }
        const indices = new Set([0, dim - 1]);
        const slots = maxCount - 2;
        for (let k = 1; k <= slots; k++) {
            indices.add(Math.round((k * (dim - 1)) / (slots + 1)));
        }
        return [...indices].sort((a, b) => a - b);
    }

    _buildDensityInstancedBars(entries, layout, maxMag) {
        let list = entries;
        const maxN = this._density3dMaxInstances;
        if (list.length > maxN) {
            list = [...list].sort((a, b) => b.mag - a.mag).slice(0, maxN);
        }
        const count = list.length;
        if (!count || typeof THREE === 'undefined') return;

        const { spacing, barFoot, heightUnits, minBarH, dim } = layout;
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshStandardMaterial({
            roughness: 0.42,
            metalness: 0.12
        });
        const mesh = new THREE.InstancedMesh(geo, mat, count);
        mesh.userData.ownsGeometry = true;

        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const baseColors = [];

        for (let n = 0; n < count; n++) {
            const e = list[n];
            const h = Math.max(minBarH, (e.mag / maxMag) * heightUnits);
            const { x, z } = this._densityGridXZ(e.row, e.col, dim, spacing);
            position.set(x, h * 0.5, z);
            scale.set(barFoot, h, barFoot);
            matrix.compose(position, new THREE.Quaternion(), scale);
            mesh.setMatrixAt(n, matrix);
            mesh.setColorAt(n, e.color);
            baseColors.push(e.color.clone());
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.renderOrder = 10;
        mesh.userData.isDensityInstanced = true;
        mesh.userData.baseColors = baseColors;

        this._getDensity3DContentGroup().add(mesh);
        this._density3dInstancedMesh = mesh;
        this._density3dBarInstances = list;
        this.density3dBarMeshes.push(mesh);
    }

    _buildDensityIndividualBars(entries, layout, maxMag) {
        const { spacing, barFoot, heightUnits, minBarH, dim } = layout;
        const barGeo = new THREE.BoxGeometry(barFoot, 1, barFoot);

        for (const e of entries) {
            const h = Math.max(minBarH, (e.mag / maxMag) * heightUnits);
            const mat = new THREE.MeshStandardMaterial({
                color: e.color,
                roughness: 0.42,
                metalness: 0.12,
                emissive: e.color.clone().multiplyScalar(0.12)
            });
            const mesh = new THREE.Mesh(barGeo, mat);
            mesh.scale.y = h;
            mesh.renderOrder = 10;
            const { x, z } = this._densityGridXZ(e.row, e.col, dim, spacing);
            mesh.position.set(x, h * 0.5, z);
            mesh.userData = {
                row: e.row,
                col: e.col,
                re: e.re,
                im: e.im,
                mag: e.mag,
                phaseDeg: e.phaseDeg,
                ket: e.ket,
                bra: e.bra
            };
            this._getDensity3DContentGroup().add(mesh);
            this.density3dBarMeshes.push(mesh);
        }
    }

    /** Table layout: j=0 left, i=0 top (⟨0|ρ|0⟩ top-left, same as tabular view). */
    _densityGridXZ(i, j, dim, spacing) {
        const half = (dim - 1) * spacing * 0.5;
        return {
            x: j * spacing - half,
            z: i * spacing - half
        };
    }

    _densityLabelBg(colors) {
        return colors.bgElevated || colors.bgPlot || '#1e1e3a';
    }

    _createDensityBillboard(text, colors, { muted = false, scaleX, scaleY } = {}) {
        const fontSize = text.length > 12 ? 72 : 96;
        const fontFamily = 'Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
        const font = `800 ${fontSize}px ${fontFamily}`;

        const probe = document.createElement('canvas').getContext('2d');
        probe.font = font;
        const textW = probe.measureText(text).width;
        const padX = 72;
        const padY = 46;
        const w = Math.max(360, Math.ceil(textW + padX * 2));
        const h = Math.ceil(fontSize + padY * 2);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = w;
        canvas.height = h;

        const radius = h * 0.42;
        ctx.fillStyle = this._densityLabelBg(colors);
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(w - radius, 0);
        ctx.quadraticCurveTo(w, 0, w, radius);
        ctx.lineTo(w, h - radius);
        ctx.quadraticCurveTo(w, h, w - radius, h);
        ctx.lineTo(radius, h);
        ctx.quadraticCurveTo(0, h, 0, h - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = colors.accent || colors.border || 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 6;
        ctx.stroke();

        const fill = muted
            ? colors.textSecondary
            : (colors.accentText || colors.textPrimary);
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 20;
        ctx.strokeStyle = colors.bgOuter;
        ctx.strokeText(text, w / 2, h / 2 + 1);
        ctx.fillStyle = fill;
        ctx.fillText(text, w / 2, h / 2 + 1);

        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        tex.needsUpdate = true;

        const mat = new THREE.SpriteMaterial({
            map: tex,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            toneMapped: false
        });
        const sprite = new THREE.Sprite(mat);
        const aspect = w / h;
        const sx = scaleX ?? 0.92;
        const sy = scaleY ?? (sx / aspect);
        sprite.scale.set(sx, sy, 1);
        sprite.renderOrder = -20;
        sprite.userData.isDensityLabel = true;
        sprite.userData.labelTexture = tex;
        return sprite;
    }

    _disposeDensity3DObject(root) {
        if (!root) return;
        root.traverse((obj) => {
            if (obj.userData?.labelTexture) {
                obj.userData.labelTexture.dispose();
            }
            if (obj.isInstancedMesh) {
                obj.geometry?.dispose();
                obj.material?.dispose();
                return;
            }
            if (obj.isSprite) {
                obj.material?.map?.dispose();
                obj.material?.dispose();
                return;
            }
            if (obj.isLine || obj.isLineSegments) {
                obj.geometry?.dispose();
                obj.material?.dispose();
                return;
            }
            if (!obj.isMesh) return;
            obj.material?.dispose();
            if (obj.userData?.ownsGeometry && obj.geometry) {
                obj.geometry.dispose();
            }
        });
        if (root.userData?.sharedGeometry) {
            root.userData.sharedGeometry.dispose();
        }
    }

    _addDensityMatrix3DLabels(dim, numQubits, maxMag, spacing, offset, heightUnits, gridW, gridD, colors) {
        const perCell = gridW / Math.max(dim, 1);
        const labelScaleX = Math.max(0.82, Math.min(spacing * 0.69, perCell * 0.38));
        const labelScaleY = labelScaleX * 0.52;
        const edgePad = labelScaleX * 0.55 + 0.55;
        const ketY = 0.04;
        const ketZ = -gridD / 2 - edgePad;
        const braX = -gridW / 2 - edgePad;
        const braY = 0.04;
        const magX = -gridW / 2 - edgePad - labelScaleX * 0.42;
        const magZ = -gridD / 2 - edgePad * 0.35;
        const colLabels = this._densityLabelIndices(dim);
        const rowLabels = this._densityLabelIndices(dim);

        for (const j of colLabels) {
            const { x } = this._densityGridXZ(0, j, dim, spacing);
            const s = this._createDensityBillboard(this._formatBasisKet(j, numQubits), colors, {
                scaleX: labelScaleX,
                scaleY: labelScaleY
            });
            s.position.set(x, ketY, ketZ);
            this._getDensity3DContentGroup().add(s);
        }

        for (const i of rowLabels) {
            const { z } = this._densityGridXZ(i, 0, dim, spacing);
            const s = this._createDensityBillboard(this._formatBasisBra(i, numQubits), colors, {
                scaleX: labelScaleX,
                scaleY: labelScaleY
            });
            s.position.set(braX, braY, z);
            this._getDensity3DContentGroup().add(s);
        }

        const magTitle = this._createDensityBillboard('|ρ|', colors, {
            muted: true,
            scaleX: labelScaleX,
            scaleY: labelScaleY
        });
        magTitle.position.set(magX, heightUnits + 0.65, magZ);
        this._getDensity3DContentGroup().add(magTitle);

        const steps = 4;
        for (let s = 0; s <= steps; s++) {
            const v = (maxMag * s) / steps;
            const txt = v < 0.001 ? '0' : v.toFixed(2);
            const tick = this._createDensityBillboard(txt, colors, {
                muted: true,
                scaleX: labelScaleX,
                scaleY: labelScaleY
            });
            tick.position.set(magX, (heightUnits * s) / steps + 0.1, magZ);
            this._getDensity3DContentGroup().add(tick);
        }
    }

    _updateDensityMatrix3DCameraFromOrbit() {
        if (!this.density3dCamera || !this._density3dTarget) return;
        const t = this._density3dTarget;
        const { yaw, pitch, radius } = this._density3dOrbit;
        const horiz = radius * Math.cos(pitch);
        const yOff = radius * Math.sin(pitch);
        this.density3dCamera.position.set(
            t.x + horiz * Math.sin(yaw),
            t.y + yOff,
            t.z + horiz * Math.cos(yaw)
        );
        this.density3dCamera.lookAt(t);
    }

    _safeRenderDensity3D() {
        if (this._density3dRebuilding) return false;
        if (!this.density3dRenderer || !this.density3dScene || !this.density3dCamera) return false;
        if (!this._isDensity3DRenderable()) return false;
        if (this._density3DContextIsLost()) return false;
        const mount = this.density3dMount;
        if (!mount?.isConnected || mount !== this.density3dRenderer.domElement.parentNode) return false;
        try {
            return this._renderDensityMatrix3DImmediate();
        } catch (err) {
            console.warn('Density matrix 3D render failed:', err);
            return false;
        }
    }

    _ensureDensityMatrix3D() {
        const mount = document.getElementById('nmr-density-3d-mount');
        if (!mount || typeof THREE === 'undefined') return false;

        if (this.density3dRenderer && !this._density3DContextIsLost()) {
            this.density3dMount = mount;
            const canvas = this.density3dRenderer.domElement;
            if (canvas.parentNode !== mount) {
                mount.appendChild(canvas);
            }
            if (!this.density3dScene) {
                this.density3dScene = new THREE.Scene();
                this._ensureDensityMatrix3DSceneLights();
            }
            if (!this.density3dContent) {
                this.density3dContent = new THREE.Group();
                this.density3dScene.add(this.density3dContent);
            }
            if (!this.density3dCamera) {
                this.density3dCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
                this._density3dTarget = this._density3dTarget || new THREE.Vector3(0, 1.1, 0);
                this._updateDensityMatrix3DCameraFromOrbit();
            }
            if (!this._density3dRaycaster) this._density3dRaycaster = new THREE.Raycaster();
            if (!this._density3dMouse) this._density3dMouse = new THREE.Vector2();
            if (!canvas._density3dHandlers) this._bindDensityMatrix3DControls();
            if (!canvas._density3dGlHandlers) this._bindDensityMatrix3DContextHandlers(canvas);
            return true;
        }

        this._disposeDensityMatrix3D();
        this.density3dMount = mount;
        this._density3dOrbit = { yaw: 0, pitch: 0.68, radius: 12 };
        this._density3dTarget = new THREE.Vector3(0, 1.1, 0);
        this._density3dRaycaster = new THREE.Raycaster();
        this._density3dMouse = new THREE.Vector2();

        this.density3dScene = new THREE.Scene();
        this.density3dContent = new THREE.Group();

        this.density3dCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
        this._updateDensityMatrix3DCameraFromOrbit();

        const colors = this.getNmrThemeColors();
        this.density3dRenderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false
        });
        this.density3dRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        mount.appendChild(this.density3dRenderer.domElement);
        this._bindDensityMatrix3DContextHandlers(this.density3dRenderer.domElement);

        const softThree = new THREE.Color(colors.accentSoft);
        this._ensureDensityMatrix3DSceneLights(softThree);
        this.density3dScene.add(this.density3dContent);

        this._density3dPaused = false;
        this._applyDensityMatrix3DBackground();
        this._bindDensityMatrix3DControls();
        this._density3dLastSize = { w: 0, h: 0 };
        this._resizeDensityMatrix3DIfNeeded();
        this._attachDensityMatrix3DResizeObserver();
        return true;
    }

    _ensureDensityMatrix3DSceneLights(softThree = null) {
        if (!this.density3dScene || typeof THREE === 'undefined') return;
        if (this.density3dScene.children.some((c) => c.isLight)) return;
        const colors = this.getNmrThemeColors();
        const soft = softThree || new THREE.Color(colors.accentSoft);
        this.density3dScene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const key = new THREE.DirectionalLight(0xffffff, 0.82);
        key.position.set(6, 10, 4);
        this.density3dScene.add(key);
        const fill = new THREE.DirectionalLight(soft, 0.38);
        fill.position.set(-5, 4, -6);
        this.density3dScene.add(fill);
    }

    _initDensityMatrix3D() {
        const ok = this._ensureDensityMatrix3D();
        if (ok && !this.density3dAnimId) {
            this._startDensityMatrix3DLoop();
        }
        return ok;
    }

    _bindDensityMatrix3DContextHandlers(canvas) {
        if (!canvas || canvas._density3dGlHandlers) return;
        const handlers = [];
        const add = (evt, fn, opts) => {
            canvas.addEventListener(evt, fn, opts);
            handlers.push([evt, fn, opts]);
        };
        add('webglcontextlost', (e) => {
            e.preventDefault();
            this._setDensityMatrix3DPanelState('error', '3D view paused (GPU context lost). Switching back…');
            this._disposeDensityMatrix3D();
        }, false);
        add('webglcontextrestored', () => {
            this._requestDensity3DRecover();
        }, false);
        canvas._density3dGlHandlers = handlers;
    }

    _bindDensityMatrix3DControls() {
        const canvas = this.density3dRenderer?.domElement;
        if (!canvas) return;
        const handlers = [];
        const add = (evt, fn, opts) => {
            canvas.addEventListener(evt, fn, opts);
            handlers.push([evt, fn, opts]);
        };

        const onPointerDown = (x, y) => {
            this._density3dDragging = true;
            this._density3dPointer = { x, y };
            canvas.style.cursor = 'grabbing';
        };
        const onPointerMove = (x, y) => {
            this._pickDensityBar(x, y);
            if (!this._density3dDragging) return;
            const dx = x - this._density3dPointer.x;
            const dy = y - this._density3dPointer.y;
            this._density3dOrbit.yaw -= dx * 0.006;
            this._density3dOrbit.pitch = Math.max(0.22, Math.min(0.82, this._density3dOrbit.pitch + dy * 0.004));
            this._updateDensityMatrix3DCameraFromOrbit();
            this._density3dPointer = { x, y };
        };
        const onPointerUp = () => {
            this._density3dDragging = false;
            canvas.style.cursor = this._density3dHoverMesh ? 'pointer' : 'grab';
        };

        add('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
        add('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
        add('mouseup', onPointerUp);
        add('mouseleave', () => {
            onPointerUp();
            this._hideDensityMatrixTooltip();
            this._setDensityBarHighlight(null);
        });

        const onTouchStart = (e) => {
            if (e.touches.length !== 1) return;
            onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
        };
        const onTouchMove = (e) => {
            if (e.touches.length !== 1) return;
            e.preventDefault();
            onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        };
        const onTouchEnd = onPointerUp;
        add('touchstart', onTouchStart, { passive: true });
        add('touchmove', onTouchMove, { passive: false });
        add('touchend', onTouchEnd);

        const onWheel = (e) => {
            e.preventDefault();
            this._density3dOrbit.radius = Math.max(
                this._density3dOrbit.minRadius ?? 5,
                Math.min(this._density3dOrbit.maxRadius ?? 24, this._density3dOrbit.radius * (1 + e.deltaY * 0.0012))
            );
            this._updateDensityMatrix3DCameraFromOrbit();
        };
        add('wheel', onWheel, { passive: false });

        canvas._density3dHandlers = handlers;
        canvas.style.cursor = 'grab';
    }

    _barColorForEntry(e, colors, maxMag) {
        const { mag, phase } = this._densityEntryStats(e);
        const t = maxMag > 1e-9 ? Math.min(1, mag / maxMag) : 0;
        const base = new THREE.Color(colors.accent);
        const hsl = { h: 0, s: 0, l: 0 };
        base.getHSL(hsl);
        const phaseHue = (phase + Math.PI) / (2 * Math.PI);
        const color = new THREE.Color();
        color.setHSL(phaseHue * 0.28 + hsl.h * 0.72, 0.55 + t * 0.2, 0.38 + t * 0.28);
        return { color, mag, t };
    }

    _rebuildDensityMatrix3D(rho, dim, numQubits, { preserveCamera = false, updateGen = null } = {}) {
        const gen = updateGen ?? this._density3dUpdateGen;
        if (!this.density3dScene || typeof THREE === 'undefined') return false;
        if (!this._isDensity3DUpdateCurrent(gen)) return false;

        this._density3dRebuilding = true;
        try {
            let maxMag = 0;
            for (let i = 0; i < dim; i++) {
                for (let j = 0; j < dim; j++) {
                    maxMag = Math.max(maxMag, this._densityEntryStats(rho[i][j]).mag);
                }
            }
            if (maxMag < 1e-9) maxMag = 1;
            this._density3dMaxMag = maxMag;

            const colors = this.getNmrThemeColors();
            const layout = this._densityLayoutParams(dim);
            const { spacing, offset, gridW, gridD, heightUnits } = layout;
            const entries = this._collectDensityBarEntries(rho, dim, maxMag, numQubits, colors);

            const nextContent = new THREE.Group();
            this._density3dBuildTarget = nextContent;
            this.density3dBarMeshes = [];
            this._density3dBarInstances = [];
            this._density3dInstancedMesh = null;
            this._density3dHoverInstance = -1;
            this._density3dHoverMesh = null;

            const platformMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(colors.bgPlot),
                roughness: 0.88,
                metalness: 0.04
            });
            const platformGeo = new THREE.BoxGeometry(gridW, 0.1, gridD);
            const platform = new THREE.Mesh(platformGeo, platformMat);
            platform.userData.ownsGeometry = true;
            platform.position.set(0, -0.05, 0);
            platform.receiveShadow = true;
            nextContent.add(platform);

            const edgeMat = new THREE.LineBasicMaterial({
                color: colors.border,
                transparent: true,
                opacity: 0.65
            });
            const edgePts = [
                new THREE.Vector3(-gridW / 2, 0, -gridD / 2),
                new THREE.Vector3(gridW / 2, 0, -gridD / 2),
                new THREE.Vector3(gridW / 2, 0, gridD / 2),
                new THREE.Vector3(-gridW / 2, 0, gridD / 2),
                new THREE.Vector3(-gridW / 2, 0, -gridD / 2)
            ];
            const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
            const edge = new THREE.Line(edgeGeo, edgeMat);
            edge.userData.ownsGeometry = true;
            nextContent.add(edge);

            this._addDensityMatrix3DLabels(dim, numQubits, maxMag, spacing, offset, heightUnits, gridW, gridD, colors);

            if (!this._isDensity3DUpdateCurrent(gen)) return false;

            if (entries.length > 256 || dim > 32) {
                this._buildDensityInstancedBars(entries, layout, maxMag);
            } else {
                this._buildDensityIndividualBars(entries, layout, maxMag);
            }

            this._density3dBuildTarget = null;

            if (!this._isDensity3DUpdateCurrent(gen)) {
                this._disposeDensity3DObject(nextContent);
                return false;
            }

            const oldContent = this.density3dContent;
            if (oldContent) oldContent.visible = false;

            this.density3dContent = nextContent;
            this.density3dScene.add(nextContent);

            const layoutChanged = this._density3dBuiltDim !== dim || this._density3dBuiltNumQubits !== numQubits;
            if (!this._density3dTarget) {
                this._density3dTarget = new THREE.Vector3(0, 1.1, 0);
            }
            if (!preserveCamera || layoutChanged) {
                this._density3dTarget.set(0, heightUnits * 0.22, 0);
                const fitRadius = this._densityCameraRadiusForGrid(gridW, gridD);
                this._density3dOrbit.radius = fitRadius;
                this._density3dOrbit.minRadius = Math.max(5, fitRadius * 0.45);
                this._density3dOrbit.maxRadius = Math.max(18, fitRadius * 2.2);
            }
            this._density3dBuiltDim = dim;
            this._density3dBuiltNumQubits = numQubits;
            this._updateDensityMatrix3DCameraFromOrbit();

            if (!this._isDensity3DUpdateCurrent(gen)) {
                if (nextContent.parent) nextContent.parent.remove(nextContent);
                this._disposeDensity3DObject(nextContent);
                if (oldContent) oldContent.visible = true;
                this.density3dContent = oldContent;
                return false;
            }

            this._renderDensityMatrix3DImmediate();

            if (oldContent?.parent) oldContent.parent.remove(oldContent);
            if (oldContent && oldContent !== nextContent) {
                this._disposeDensity3DObject(oldContent);
            }

            if (!this._isDensity3DUpdateCurrent(gen)) return false;
            return true;
        } catch (err) {
            console.error('Density matrix 3D rebuild failed:', err);
            this._density3dBuildTarget = null;
            if (this._isDensity3DUpdateCurrent(gen)) {
                this._setDensityMatrix3DPanelState('error', '3D density matrix could not be built. Retrying…');
                this._queueDensityMatrix3DUpdate({ preserveCamera: true });
            }
            return false;
        } finally {
            this._density3dBuildTarget = null;
            this._density3dRebuilding = false;
        }
    }

    _updateDensityMatrix3DOverlays() {
        /* Labels live in the 3D scene (planes on the grid). */
    }

    _setDensityMatrix3DPanelState(state, message = '') {
        const frame = document.querySelector('.nmr-density-3d-frame');
        const empty = document.getElementById('nmr-density-3d-empty');
        if (frame) frame.classList.toggle('is-hidden', state === 'empty');
        if (empty) {
            empty.hidden = state === 'ready';
            if (state === 'ready') {
                empty.textContent = '';
            } else {
                empty.textContent = message || (state === 'empty'
                    ? 'Run circuit to view density matrix'
                    : '');
            }
        }
    }

    _scheduleDensityMatrix3DUpdate(rho, dim, numQubits, { preserveCamera = false, updateGen = null } = {}) {
        const gen = updateGen ?? this._density3dUpdateGen;
        this._density3dPending = { rho, dim, numQubits, preserveCamera };
        if (this._density3dPaused || !this._isDensity3DViewModeOn()) return;
        if (this._density3dRetryAf) cancelAnimationFrame(this._density3dRetryAf);
        let attempts = 0;
        const run = () => {
            this._density3dRetryAf = null;
            if (!this._isDensity3DUpdateCurrent(gen)) return;
            if (this._density3dPaused || !this._isDensity3DViewModeOn()) return;

            const mount = document.getElementById('nmr-density-3d-mount');
            if (!mount?.isConnected) return;

            if (!this._isDensity3DPanelVisible()) {
                attempts += 1;
                if (attempts < 120) {
                    this._density3dRetryAf = requestAnimationFrame(run);
                } else {
                    this._armDensity3DMountWatch();
                }
                return;
            }

            const w = mount.clientWidth;
            const h = mount.clientHeight;
            if (w < 8 || h < 8) {
                attempts += 1;
                if (attempts < 180) {
                    this._density3dRetryAf = requestAnimationFrame(run);
                } else {
                    this._armDensity3DMountWatch();
                }
                return;
            }

            if (!this._isDensity3DUpdateCurrent(gen)) return;
            if (!this._initDensityMatrix3D()) {
                attempts += 1;
                if (attempts < 180) {
                    this._density3dRetryAf = requestAnimationFrame(run);
                } else {
                    this._armDensity3DMountWatch();
                }
                return;
            }
            if (!this._isDensity3DUpdateCurrent(gen)) return;
            this._density3dPaused = false;
            if (this._tryUpdateDensityMatrix3DInPlace(rho, dim, numQubits, { preserveCamera, updateGen: gen })) {
                this._disarmDensity3DMountWatch();
                this._setDensityMatrix3DPanelState('ready');
                return;
            }
            if (!this._rebuildDensityMatrix3D(rho, dim, numQubits, { preserveCamera, updateGen: gen })) {
                return;
            }
            if (!this._isDensity3DUpdateCurrent(gen)) return;
            this._attachDensityMatrix3DResizeObserver();
            this._startDensityMatrix3DLoop();
            this._disarmDensity3DMountWatch();
            this._setDensityMatrix3DPanelState('ready');
        };
        this._density3dRetryAf = requestAnimationFrame(run);
    }

    _pickDensityBar(clientX, clientY) {
        if (!this.density3dRenderer || !this._density3dRaycaster || !this._density3dMouse) return;
        const rect = this.density3dRenderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        this._density3dMouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this._density3dMouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        this._density3dRaycaster.setFromCamera(this._density3dMouse, this.density3dCamera);
        const hits = this._density3dRaycaster.intersectObjects(this.density3dBarMeshes, false);
        let data = null;
        let mesh = null;
        let instanceId = null;

        if (hits.length) {
            const hit = hits[0];
            mesh = hit.object;
            if (mesh.isInstancedMesh && hit.instanceId !== undefined) {
                instanceId = hit.instanceId;
                data = this._density3dBarInstances[instanceId];
            } else {
                data = mesh.userData;
            }
        }

        this._setDensityBarHighlight(mesh, instanceId);
        if (data) {
            this._showDensityMatrixTooltip(data, clientX, clientY);
            if (this.density3dRenderer?.domElement) {
                this.density3dRenderer.domElement.style.cursor = this._density3dDragging ? 'grabbing' : 'pointer';
            }
        } else {
            this._hideDensityMatrixTooltip();
            if (this.density3dRenderer?.domElement && !this._density3dDragging) {
                this.density3dRenderer.domElement.style.cursor = 'grab';
            }
        }
    }

    _setDensityBarHighlight(mesh, instanceId = null) {
        if (this._density3dHoverMesh && this._density3dHoverMesh !== mesh) {
            const prev = this._density3dHoverMesh.material;
            if (prev && prev.userData.restEmissive) {
                prev.emissive.copy(prev.userData.restEmissive);
            }
        }
        if (this._density3dInstancedMesh && this._density3dHoverInstance >= 0) {
            const im = this._density3dInstancedMesh;
            const base = im.userData.baseColors?.[this._density3dHoverInstance];
            if (base && im.setColorAt) {
                im.setColorAt(this._density3dHoverInstance, base);
                if (im.instanceColor) im.instanceColor.needsUpdate = true;
            }
            this._density3dHoverInstance = -1;
        }

        this._density3dHoverMesh = mesh || null;

        if (mesh?.isInstancedMesh && instanceId !== null && instanceId >= 0) {
            const base = mesh.userData.baseColors?.[instanceId];
            if (base && mesh.setColorAt) {
                const bright = base.clone().multiplyScalar(1.5);
                mesh.setColorAt(instanceId, bright);
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
                this._density3dHoverInstance = instanceId;
            }
            return;
        }

        if (mesh?.material) {
            const m = mesh.material;
            if (!m.userData.restEmissive) {
                m.userData.restEmissive = m.emissive.clone();
            }
            m.emissive.setHex(0xffffff);
            m.emissive.multiplyScalar(0.45);
        }
    }

    _showDensityMatrixTooltip(data, clientX, clientY) {
        const tip = document.getElementById('nmr-density-3d-tooltip');
        if (!tip || !data) return;
        const reStr = Math.abs(data.re) < 1e-4 && Math.abs(data.im) < 1e-4 ? '0' : data.re.toFixed(4);
        const imStr = Math.abs(data.im) < 1e-4 ? '0' : data.im.toFixed(4);
        tip.innerHTML = `
            <div class="nmr-density-tip-title">${data.bra} ρ ${data.ket}</div>
            <div><span>|ρ|</span> <strong>${data.mag.toFixed(4)}</strong></div>
            <div><span>Phase</span> <strong>${data.phaseDeg.toFixed(1)}°</strong></div>
            <div><span>Re</span> <strong>${reStr}</strong> · <span>Im</span> <strong>${imStr}</strong></div>
        `;
        tip.hidden = false;
        const host = document.getElementById('nmr-density-3d-panel');
        const hostRect = host?.getBoundingClientRect();
        if (!hostRect) return;
        const x = clientX - hostRect.left + 12;
        const y = clientY - hostRect.top + 12;
        tip.style.left = `${Math.min(x, hostRect.width - 200)}px`;
        tip.style.top = `${Math.min(y, hostRect.height - 90)}px`;
    }

    _hideDensityMatrixTooltip() {
        const tip = document.getElementById('nmr-density-3d-tooltip');
        if (tip) tip.hidden = true;
    }

    updateDensityMatrix({ preserveCamera = false } = {}) {
        const panel3d = document.getElementById('nmr-density-3d-panel');
        const tableHost = this._getDensityTableHost();

        const emptyMsg = 'Run circuit to view density matrix';

        if (!this.nmrEngine?.densityMatrix) {
            this._bumpDensity3DUpdateGen();
            this._cancelDensityTableRender();
            this._setDensityMatrix3DPanelState('empty', emptyMsg);
            if (tableHost) tableHost.innerHTML = `<p class="nmr-note">${emptyMsg}</p>`;
            return;
        }

        const rho = this._prepareDensityMatrixForView();
        if (!rho) return;

        const dim = Math.pow(2, this.nmrEngine.numQubits);
        const numQubits = this.nmrEngine.numQubits;

        if (this.densityMatrixViewMode === '3d') {
            this._density3dPaused = false;
            this._cancelDensityTableRender();
            this._queueDensityMatrix3DUpdate({ preserveCamera });
        } else if (tableHost) {
            this._renderDensityMatrixTable(tableHost, rho, dim, numQubits);
        }
    }

    _gammaTableHtml() {
        return `
                        <table class="nmr-gamma-table">
                            <tr><td><span class="nmr-badge">¹H</span></td><td>42.577</td></tr>
                            <tr><td><span class="nmr-badge">¹⁹F</span></td><td>40.052</td></tr>
                            <tr><td><span class="nmr-badge">³He</span></td><td>−32.434</td></tr>
                            <tr><td><span class="nmr-badge">²⁰⁵Tl</span></td><td>24.816</td></tr>
                            <tr><td><span class="nmr-badge">²⁰³Tl</span></td><td>24.567</td></tr>
                            <tr><td><span class="nmr-badge">³¹P</span></td><td>17.235</td></tr>
                            <tr><td><span class="nmr-badge">¹¹⁹Sn</span></td><td>−15.867</td></tr>
                            <tr><td><span class="nmr-badge">¹¹⁷Sn</span></td><td>−15.166</td></tr>
                            <tr><td><span class="nmr-badge">¹¹⁵Sn</span></td><td>−13.882</td></tr>
                            <tr><td><span class="nmr-badge">¹²⁵Te</span></td><td>−13.507</td></tr>
                            <tr><td><span class="nmr-badge">¹²⁹Xe</span></td><td>−11.777</td></tr>
                            <tr><td><span class="nmr-badge">¹²³Te</span></td><td>−11.195</td></tr>
                            <tr><td><span class="nmr-badge">¹³C</span></td><td>10.705</td></tr>
                            <tr><td><span class="nmr-badge">¹⁹⁵Pt</span></td><td>9.151</td></tr>
                            <tr><td><span class="nmr-badge">¹¹¹Cd</span></td><td>−9.028</td></tr>
                            <tr><td><span class="nmr-badge">²⁰⁷Pb</span></td><td>8.878</td></tr>
                            <tr><td><span class="nmr-badge">²⁹Si</span></td><td>−8.465</td></tr>
                            <tr><td><span class="nmr-badge">⁷⁷Se</span></td><td>8.131</td></tr>
                            <tr><td><span class="nmr-badge">¹⁹⁹Hg</span></td><td>7.641</td></tr>
                            <tr><td><span class="nmr-badge">¹⁷¹Yb</span></td><td>7.533</td></tr>
                            <tr><td><span class="nmr-badge">¹⁵N</span></td><td>−4.316</td></tr>
                            <tr><td><span class="nmr-badge">¹⁶⁹Tm</span></td><td>−3.508</td></tr>
                            <tr><td><span class="nmr-badge">⁸⁹Y</span></td><td>−2.086</td></tr>
                            <tr><td><span class="nmr-badge">¹⁰⁹Ag</span></td><td>−1.982</td></tr>
                            <tr><td><span class="nmr-badge">¹⁸³W</span></td><td>1.774</td></tr>
                            <tr><td><span class="nmr-badge">¹⁰⁷Ag</span></td><td>−1.723</td></tr>
                            <tr><td><span class="nmr-badge">⁵⁷Fe</span></td><td>1.377</td></tr>
                            <tr><td><span class="nmr-badge">¹⁰³Rh</span></td><td>−1.340</td></tr>
                            <tr><td><span class="nmr-badge">¹⁸⁷Os</span></td><td>0.979</td></tr>
                        </table>`;
    }

    _populateSamplesGrid() {
        const grid = document.getElementById('nmr-samples-grid');
        if (!grid) return;
        let html = '';
        const sortedSamples = Object.entries(NMRSamples)
            .filter(([key]) => key !== 'custom')
            .sort((a, b) => {
                const qubitDiff = a[1].nuclei.length - b[1].nuclei.length;
                if (qubitDiff !== 0) return qubitDiff;
                return this.getSampleRarityScore(a[1]) - this.getSampleRarityScore(b[1]);
            });
        sortedSamples.forEach(([key, sample]) => {
            html += `<div class="nmr-sample-card">
                <strong>${sample.name}</strong> <span class="nmr-qubits">${sample.nuclei.length}Q</span>
                <div class="nmr-sample-nuclei">${sample.nuclei.map(n => n.element).join(' ')}</div>
            </div>`;
        });
        grid.innerHTML = html;
    }

    _analysisStepperHtml() {
        return `
            <div class="analysis-stepper nmr-density-stepper" id="analysis-stepper">
                <div class="nmr-density-stepper-toolbar">
                    <div class="nmr-density-stepper-transport" role="group" aria-label="Circuit step controls">
                        <button type="button" id="nmr-density-step-prev" class="nmr-density-step-btn" title="Previous step" aria-label="Previous step">${this._densityStepIconHtml('prev')}</button>
                        <button type="button" id="nmr-density-step-play" class="nmr-density-step-btn nmr-density-step-btn--play" title="Play / pause" aria-label="Play" aria-pressed="false">${this._densityStepIconHtml('play')}</button>
                        <button type="button" id="nmr-density-step-next" class="nmr-density-step-btn nmr-density-step-btn--next" title="Next step" aria-label="Next step">${this._densityStepIconHtml('next')}</button>
                    </div>
                    <div class="nmr-density-stepper-info">
                        <span id="nmr-density-step-label" class="nmr-density-step-label">No circuit steps</span>
                        <span id="nmr-density-step-counter" class="nmr-density-step-counter">—</span>
                    </div>
                    <div class="nmr-density-stepper-speed" role="group" aria-label="Playback speed">
                        <button type="button" class="nmr-density-step-btn" data-density-speed="slower" title="Slower">−</button>
                        <span id="nmr-density-step-speed" class="nmr-density-step-speed">1×</span>
                        <button type="button" class="nmr-density-step-btn" data-density-speed="faster" title="Faster">+</button>
                        <button type="button" class="nmr-density-step-btn" data-density-speed="reverse" title="Reverse direction">⇄</button>
                        <button type="button" class="nmr-density-step-btn" data-density-speed="loop" title="Loop playback" aria-pressed="false">↻</button>
                    </div>
                </div>
                <div id="nmr-density-step-timeline" class="nmr-density-step-timeline" aria-label="Circuit execution steps"></div>
            </div>`;
    }

    _bindAnalysisVizTabs() {
        const tabs = document.getElementById('analysis-viz-tabs');
        if (!tabs || tabs._bound) return;
        tabs._bound = true;
        tabs.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-analysis-viz]');
            if (!btn) return;
            this._setAnalysisVizTab(btn.dataset.analysisViz);
        });
    }

    _setAnalysisVizTab(tab) {
        this.analysisVizTab = tab || 'density';
        const tabs = document.getElementById('analysis-viz-tabs');
        tabs?.querySelectorAll('[data-analysis-viz]').forEach((btn) => {
            const on = btn.dataset.analysisViz === this.analysisVizTab;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        document.querySelectorAll('[data-analysis-panel]').forEach((panel) => {
            panel.classList.toggle('active', panel.dataset.analysisPanel === this.analysisVizTab);
        });
        if (this.analysisVizTab === 'density') {
            if (this._isDensity3DPanelVisible() && this.densityMatrixViewMode === '3d') {
                this._kickDensityMatrix3DAfterAnalysisShown();
            } else if (this.densityMatrixViewMode === '3d') {
                this._whenDensity3DMountReady(() => {
                    this._resumeDensityMatrix3D({ preserveCamera: true });
                });
                this._armDensity3DMountWatch();
            } else {
                this.updateDensityMatrix({ preserveCamera: true });
            }
            this._notifyAnalysisViewUpdate();
        }
    }

    _initDensityAnalysisBindings() {
        this._bindDensityMatrixViewToggle();
        this._bindDensityMatrixHeatmapToggle();
        this._bindDensityStepControls();
        this._bindAnalysisVizTabs();
        this._rebuildDensityStepStates();
        this._densityStepIndex = Math.max(0, this._densityStepStates.length - 1);
        this._renderDensityStepTimeline();
        this._updateDensityStepUI();
        const densityFsBtn = document.getElementById('nmr-density-table-fullscreen');
        if (densityFsBtn && !densityFsBtn._bound) {
            densityFsBtn._bound = true;
            densityFsBtn.addEventListener('click', () => {
                this.toggleFullscreen('nmr-density-table-panel');
            });
        }
        this._updateDensityTableOptionsVisibility();
        this._syncDensityHeatmapToggleUI();
        const mode = this.densityMatrixViewMode || '3d';
        const panel3d = document.getElementById('nmr-density-3d-panel');
        const hostTable = document.getElementById('nmr-density-table-wrap');
        const toggle = document.getElementById('nmr-density-view-toggle');
        if (panel3d) panel3d.classList.toggle('active', mode === '3d');
        if (hostTable) hostTable.classList.toggle('active', mode === 'table');
        if (toggle) {
            toggle.querySelectorAll('[data-density-view]').forEach((btn) => {
                const on = btn.dataset.densityView === mode;
                btn.classList.toggle('active', on);
                btn.setAttribute('aria-selected', on ? 'true' : 'false');
            });
        }
        this._setAnalysisVizTab(this.analysisVizTab || 'density');
    }

    renderDataAnalysisContent(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        this._disposeDensityMatrix3D();
        this._cancelDensityTableRender();
        this._stopDensityPlayback();
        this.analysisVizTab = this.analysisVizTab || 'density';

        container.innerHTML = `
            <div class="analysis-root">
                <div class="analysis-viz-tabs nmr-density-view-toggle" id="analysis-viz-tabs" role="tablist" aria-label="Data analysis views">
                    <button type="button" class="active" data-analysis-viz="density" role="tab" aria-selected="true">Density Matrix</button>
                    <button type="button" data-analysis-viz="probabilities" role="tab" aria-selected="false">Probabilities</button>
                    <button type="button" data-analysis-viz="state" role="tab" aria-selected="false">State Vector</button>
                    <button type="button" data-analysis-viz="bar" role="tab" aria-selected="false">Bar Chart</button>
                    <button type="button" data-analysis-viz="pie" role="tab" aria-selected="false">Pie Chart</button>
                    <button type="button" data-analysis-viz="bloch" role="tab" aria-selected="false">Bloch Spheres</button>
                </div>
                <div class="analysis-viz-body">
                    <div class="analysis-panel analysis-panel--density active" data-analysis-panel="density">
                        <div class="analysis-density-wrap">
                            <div class="nmr-density-header">
                                <div class="nmr-density-header-controls">
                                    <div class="nmr-density-table-options" id="nmr-density-table-options">
                                        <div class="nmr-density-heatmap-toggle nmr-density-view-toggle" id="nmr-density-heatmap-toggle" role="group" aria-label="Table cell coloring">
                                            <button type="button" data-density-heatmap="0" aria-pressed="false">Values</button>
                                            <button type="button" class="active" data-density-heatmap="1" aria-pressed="true">Heatmap</button>
                                        </div>
                                    </div>
                                    <div class="nmr-density-view-toggle" id="nmr-density-view-toggle" role="tablist" aria-label="Density matrix view">
                                        <button type="button" class="active" data-density-view="3d" role="tab" aria-selected="true">3D</button>
                                        <button type="button" data-density-view="table" role="tab" aria-selected="false">Table</button>
                                    </div>
                                </div>
                            </div>
                            <div class="nmr-density-body">
                                <div id="nmr-density-3d-panel" class="nmr-density-view nmr-density-view--3d active" role="tabpanel">
                                    <p id="nmr-density-3d-empty" class="nmr-density-3d-empty nmr-note" hidden></p>
                                    <div class="nmr-density-3d-frame">
                                        <div id="nmr-density-3d-mount" class="nmr-density-3d-mount"></div>
                                        <div id="nmr-density-3d-tooltip" class="nmr-density-3d-tooltip" role="status" hidden></div>
                                    </div>
                                </div>
                                <div id="nmr-density-table-wrap" class="nmr-density-view nmr-density-view--table" role="tabpanel">
                                    <div id="nmr-density-table-panel" class="nmr-density-table-panel">
                                        <div class="nmr-density-table-toolbar">
                                            <button type="button" id="nmr-density-table-fullscreen" class="nmr-btn-sm nmr-fullscreen-btn" title="Fullscreen table">⛶</button>
                                        </div>
                                        <div id="nmr-density-table-host" class="nmr-density-table-host"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="analysis-panel" data-analysis-panel="probabilities">
                        <div id="analysis-measurementResults" class="results-display analysis-viz-mount">
                            <p class="placeholder">Run circuit to see probabilities</p>
                        </div>
                    </div>
                    <div class="analysis-panel" data-analysis-panel="state">
                        <div id="analysis-stateVector" class="state-vector analysis-viz-mount"></div>
                    </div>
                    <div class="analysis-panel" data-analysis-panel="bar">
                        <div id="analysis-barChart" class="probability-graphs analysis-viz-mount"></div>
                    </div>
                    <div class="analysis-panel" data-analysis-panel="pie">
                        <div id="analysis-pieChart" class="probability-graphs analysis-viz-mount"></div>
                    </div>
                    <div class="analysis-panel" data-analysis-panel="bloch">
                        <div id="analysis-qubitVisualization" class="qubit-visualization analysis-viz-mount"></div>
                    </div>
                </div>
                ${this._analysisStepperHtml()}
            </div>
        `;

        this._density3dPaused = false;
        this._initDensityAnalysisBindings();
    }

    renderOtherResourcesContent(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="nmr-resources nmr-resources--reference">
                <div class="nmr-res-section">
                    <h4>Spin-½ Gyromagnetic Ratios (MHz/T)</h4>
                    <div class="nmr-gamma-scroll">
                        ${this._gammaTableHtml()}
                    </div>
                </div>
                <div class="nmr-res-section">
                    <h4>Sample Library</h4>
                    <div class="nmr-samples-grid" id="nmr-samples-grid"></div>
                </div>
            </div>
        `;

        this._populateSamplesGrid();
    }

    renderResourcesContent(containerId) {
        this.renderDataAnalysisContent(containerId);
    }
    
    dispose() {
        this._stopDensityPlayback();
        this._disposeDensityMatrix3D();
    }
}

if (typeof window !== 'undefined') {
    window.NMRSimulatorUI = NMRSimulatorUI;
}

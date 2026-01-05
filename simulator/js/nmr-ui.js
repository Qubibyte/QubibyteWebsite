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
        
        this.buildUI();
        this.nmrEngine.setSample(this.selectedSample);
        this.updateAllVisualizations();
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
            '1H':  1,   // Proton - most common, used in almost all NMR
            '19F': 2,   // Fluorine - very sensitive, 100% abundant
            '31P': 3,   // Phosphorus - common in biochem
            '13C': 4,   // Carbon - very common
            '15N': 5,   // Nitrogen - common in biochem
            '29Si': 6,  // Silicon - fairly common
            '11B': 7,   // Boron - less common
            '2H':  8,   // Deuterium - specialized
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
            }
        });
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
        
        nuclei.forEach((n, i) => {
            // Make qubit number clickable to focus on that peak
            html += `<tr class="nmr-nuclei-row" data-qubit="${i}" title="Click to focus on Q${i} peak">
                <td class="nmr-qubit-focus">${i}</td>
                <td><span class="nmr-badge">${n.element}</span></td>
                <td>${(n.chemicalShift || 0).toFixed(1)}</td>
                <td>${(n.larmorFreq / 1e6).toFixed(2)}</td>
            </tr>`;
        });
        
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
            
            this.spectrumPanX = (freq - center) / 1e6 * 20;
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
        
        // Background with subtle gradient
        const bgGradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 0,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height)
        );
        bgGradient.addColorStop(0, '#111827');
        bgGradient.addColorStop(1, '#0a0f1a');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (atoms.length === 0) {
            ctx.fillStyle = '#64748b';
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
                ctx.strokeStyle = '#64748b';
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
                ctx.strokeStyle = '#64748b';
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
                ctx.strokeStyle = '#64748b';
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
                grad.addColorStop(0, 'rgba(129, 140, 248, 0.8)');
                grad.addColorStop(0.5, 'rgba(129, 140, 248, 0.4)');
                grad.addColorStop(1, 'rgba(129, 140, 248, 0.8)');
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
                glowGradient.addColorStop(0, 'rgba(251, 191, 36, 0.5)');
                glowGradient.addColorStop(0.5, 'rgba(251, 191, 36, 0.2)');
                glowGradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
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
                ctx.strokeStyle = '#fbbf24';
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
                ctx.fillStyle = '#fbbf24';
                ctx.font = `bold ${isFullscreen ? 14 : 9}px sans-serif`;
                ctx.fillText(`Q${atom.qubit}`, pos.x, pos.y + r + (isFullscreen ? 16 : 10));
            }
        });
        
        // Sample name
        ctx.fillStyle = '#64748b';
        ctx.font = `${isFullscreen ? 14 : 10}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(this.nmrEngine.sample.formula || '', isFullscreen ? 15 : 8, canvas.height - (isFullscreen ? 15 : 8));
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
        return luminance > 0.5 ? '#1e293b' : '#f1f5f9';
    }
    
    updateSpectrum() {
        const canvas = document.getElementById('nmr-spectrum-canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
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
        ctx.fillStyle = '#0a0f1a';
        ctx.fillRect(0, 0, width, height);
        
        // Plot area background
        ctx.fillStyle = '#0f172a';
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
        const maxVal = vals.length ? Math.max(...vals) : 10;
        const spread = (maxVal - minVal) || 10;
        const padding = Math.max(spread * 0.15, mode === 'ppm' ? 0.5 : 50);
        
        // Apply zoom and pan
        const range = (spread + 2 * padding) / this.spectrumZoom;
        const center = (minVal + maxVal) / 2 + this.spectrumPanX * (mode === 'ppm' ? 0.05 : 5);
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
        ctx.strokeStyle = '#1e293b';
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
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(marginLeft, dynamicBaseline);
            ctx.lineTo(marginLeft + plotWidth, dynamicBaseline);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Gradient for positive peaks (upward, blue)
            const gradientPos = ctx.createLinearGradient(0, dynamicBaseline - halfHeight, 0, dynamicBaseline);
            gradientPos.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
            gradientPos.addColorStop(0.5, 'rgba(99, 102, 241, 0.2)');
            gradientPos.addColorStop(1, 'rgba(99, 102, 241, 0.05)');
            
            // Gradient for negative peaks (downward, red/orange - inverted signal)
            const gradientNeg = ctx.createLinearGradient(0, dynamicBaseline, 0, dynamicBaseline + halfHeight);
            gradientNeg.addColorStop(0, 'rgba(239, 68, 68, 0.05)');
            gradientNeg.addColorStop(0.5, 'rgba(239, 68, 68, 0.2)');
            gradientNeg.addColorStop(1, 'rgba(239, 68, 68, 0.4)');
            
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
            ctx.strokeStyle = hasNegative && !hasPositive ? '#ef4444' : '#818cf8';
            ctx.lineWidth = 2.0;  // Thicker line to prevent sub-pixel rendering glitches
            ctx.stroke();
            
            // Store peak positions for click detection and draw labels
            ctx.fillStyle = '#a5b4fc';
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
                    ctx.strokeStyle = '#64748b';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(x, marginTop - 3);
                    ctx.lineTo(x, marginTop + 5);
                    ctx.stroke();
                    labeled.push(x);
                }
            });
        } else {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No peaks to display', width / 2, height / 2);
        }
        
        // Draw frame/border for plot area
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(marginLeft, marginTop, plotWidth, plotHeight);
        
        // X-axis labels
        ctx.fillStyle = '#94a3b8';
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
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, baseline);
                ctx.lineTo(x, baseline + 5);
                ctx.stroke();
            }
        }
        
        // X-axis title
        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(mode === 'ppm' ? 'Chemical Shift (ppm)' : 'Frequency (MHz)', marginLeft + plotWidth / 2, height - 8);
        
        // Y-axis label
        ctx.save();
        ctx.translate(15, marginTop + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Intensity', 0, 0);
        ctx.restore();
        
        // Y-axis ticks - check for negative peaks to adjust labels
        const peakIntensities = peaks.map(p => p.intensity);
        const hasNegativePeaks = peakIntensities.some(i => i < 0);
        const hasPositivePeaks = peakIntensities.some(i => i > 0);
        
        ctx.fillStyle = '#64748b';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'right';
        
        if (hasNegativePeaks && hasPositivePeaks) {
            // Mixed positive/negative: show -100% to +100% scale
            const centerY = marginTop + plotHeight / 2;
            const halfTicks = Math.floor(intensityTicks / 2);
            
            // Draw center (0%) line label
            ctx.fillText('0%', marginLeft - 8, centerY + 3);
            ctx.strokeStyle = '#475569';
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
                ctx.fillStyle = '#ef4444';  // Red for negative
                ctx.fillText('-' + val + '%', marginLeft - 8, y + 3);
                ctx.fillStyle = '#64748b';
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
                ctx.fillStyle = i === 0 ? '#64748b' : '#ef4444';
                ctx.fillText(i === 0 ? '0%' : '-' + val + '%', marginLeft - 8, y + 3);
                ctx.fillStyle = '#64748b';
                
                ctx.strokeStyle = '#475569';
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
                
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(marginLeft - 4, y);
                ctx.lineTo(marginLeft, y);
                ctx.stroke();
            }
        }
        
        // Info overlay
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        
        const b0Text = `B₀ = ${this.nmrEngine.B0.toFixed(2)} T`;
        ctx.fillText(b0Text, marginLeft + plotWidth - 5, marginTop + 15);
        
        if (this.spectrumZoom !== 1.0) {
            ctx.fillStyle = '#818cf8';
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
                    pulsesAtCol.forEach(p => {
                        // Color based on rotation angle
                        let cls = 'nmr-pulse-90';
                        if (p.flipAngle && Math.abs(p.flipAngle - Math.PI) < 0.1) cls = 'nmr-pulse-180';
                        else if (p.flipAngle && p.flipAngle < Math.PI / 4) cls = 'nmr-pulse-small';
                        
                        const phaseRad = p.phase || 0;
                        const phaseDeg = (phaseRad * 180 / Math.PI) % 360;
                        const phaseLabel = phaseDeg === 0 ? 'x' : phaseDeg === 90 ? 'y' : phaseDeg === 180 ? '-x' : phaseDeg === 270 ? '-y' : `${phaseDeg.toFixed(0)}°`;
                        const angleDeg = p.flipAngle ? (p.flipAngle * 180 / Math.PI).toFixed(0) : '90';
                        const tooltip = `${p.gate || p.description} (${angleDeg}°${phaseLabel})`;
                        
                        html += `<div class="nmr-pulse-block ${cls}" title="${tooltip}">
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
        this.nmrEngine.updateFromQuantumState(quantumState);
        this.updateSpectrum();
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
    
    updateDensityMatrix() {
        const container = document.getElementById('nmr-density-container');
        if (!container || !this.nmrEngine.densityMatrix) return;
        
        const dim = Math.pow(2, this.nmrEngine.numQubits);
        const rho = this.nmrEngine.densityMatrix;
        
        if (dim > 16) {
            container.innerHTML = `<p class="nmr-note">Matrix too large (${dim}×${dim})</p>`;
            return;
        }
        
        let html = '<div class="nmr-density-scroll"><table class="nmr-density-table">';
        html += '<tr><th></th>';
        for (let j = 0; j < dim; j++) {
            html += `<th>|${j.toString(2).padStart(this.nmrEngine.numQubits, '0')}⟩</th>`;
        }
        html += '</tr>';
        
        for (let i = 0; i < dim; i++) {
            html += `<tr><th>⟨${i.toString(2).padStart(this.nmrEngine.numQubits, '0')}|</th>`;
            for (let j = 0; j < dim; j++) {
                const e = rho[i][j];
                const mag = Math.sqrt(e.re * e.re + e.im * e.im);
                const hue = (Math.atan2(e.im, e.re) + Math.PI) / (2 * Math.PI) * 360;
                const bg = `hsla(${hue}, 70%, 50%, ${Math.min(mag, 1)})`;
                const val = mag < 0.001 ? '0' : e.re.toFixed(2);
                html += `<td style="background:${bg}">${val}</td>`;
            }
            html += '</tr>';
        }
        html += '</table></div>';
        container.innerHTML = html;
    }
    
    renderResourcesContent(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = `
            <div class="nmr-resources">
                <div class="nmr-res-section">
                    <h4>Density Matrix</h4>
                    <div id="nmr-density-container"></div>
                </div>
                
                <div class="nmr-res-section">
                    <h4>NMR Physics</h4>
                    <div class="nmr-equations">
                        <div class="nmr-eq-block"><strong>Larmor:</strong> ω₀ = γ·B₀·(1-σ)</div>
                        <div class="nmr-eq-block"><strong>J-coupling:</strong> H_J = 2π·J·Iz₁·Iz₂</div>
                        <div class="nmr-eq-block"><strong>Flip angle:</strong> θ = γ·B₁·τ</div>
                    </div>
                </div>
                
                <div class="nmr-res-section">
                    <h4>Spin-½ Gyromagnetic Ratios (MHz/T)</h4>
                    <div class="nmr-gamma-scroll">
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
                        </table>
                    </div>
                </div>
                
                <div class="nmr-res-section">
                    <h4>Sample Library</h4>
                    <div class="nmr-samples-grid" id="nmr-samples-grid"></div>
                </div>
            </div>
        `;
        
        // Populate samples (sorted by qubit count, then by nucleus commonality)
        const grid = document.getElementById('nmr-samples-grid');
        if (grid) {
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
        
        this.updateDensityMatrix();
    }
    
    dispose() {}
}

if (typeof window !== 'undefined') {
    window.NMRSimulatorUI = NMRSimulatorUI;
}

/**
 * NMR Simulator UI Controller
 * Main application controller that ties together all components
 */

class NMRSimulatorUI {
    constructor() {
        // Core components
        this.physics = new NMRPhysics();
        this.sample = new Sample('water');
        this.spectrometerViz = null;
        this.spectrumViz = null;
        this.blochViz = null;
        this.moleculeViz = null;

        // State
        this.isRunning = false;
        this.currentTab = 'spectrometer';
        this.experimentData = null;

        // Initialize on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('Initializing NMR Simulator...');

        // Initialize visualizations
        this.initVisualizations();

        // Setup event listeners
        this.setupEventListeners();

        // Initialize UI values
        this.syncUIFromState();

        // Update derived values
        this.updateDerivedValues();

        // Render pulse sequence diagram
        this.renderPulseSequence();

        // Update molecule view
        this.updateMoleculeView();

        console.log('NMR Simulator initialized');
    }

    initVisualizations() {
        // 3D Spectrometer visualization
        try {
            this.spectrometerViz = new SpectrometerVisualization('spectrometer3D');
        } catch (e) {
            console.error('Failed to initialize spectrometer visualization:', e);
        }

        // Spectrum visualization
        try {
            this.spectrumViz = new SpectrumVisualization();
            this.spectrumViz.init(this.physics);
            this.spectrumViz.initFIDChart('fidCanvas');
            this.spectrumViz.initSpectrumChart('spectrumCanvas');
        } catch (e) {
            console.error('Failed to initialize spectrum visualization:', e);
        }

        // Bloch sphere visualization
        try {
            this.blochViz = new BlochSphereVisualization('blochSphere3D');
        } catch (e) {
            console.error('Failed to initialize Bloch sphere:', e);
        }

        // Molecule visualization
        try {
            this.moleculeViz = new MoleculeVisualization('moleculeCanvas');
        } catch (e) {
            console.error('Failed to initialize molecule visualization:', e);
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.viz-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Header buttons
        document.getElementById('runBtn')?.addEventListener('click', () => this.runExperiment());
        document.getElementById('resetBtn')?.addEventListener('click', () => this.resetAll());
        document.getElementById('tutorialBtn')?.addEventListener('click', () => this.showTutorial());

        // Close tutorial modal
        document.getElementById('closeTutorialBtn')?.addEventListener('click', () => this.hideTutorial());

        // B0 Field controls
        this.setupSlider('b0Strength', 'b0StrengthValue', (value) => {
            this.physics.setB0Field(parseFloat(value));
            this.updateDerivedValues();
        });

        this.setupSlider('magnetGap', 'magnetGapValue', (value) => {
            if (this.spectrometerViz) {
                this.spectrometerViz.updateParameters({ magnetGap: parseFloat(value) });
            }
        });

        this.setupSlider('fieldHomogeneity', 'fieldHomogeneityValue', (value) => {
            this.physics.setFieldHomogeneity(parseFloat(value) / 100);
        });

        this.setupSlider('temperature', 'temperatureValue', (value) => {
            this.physics.setTemperature(parseFloat(value));
        });

        // Coil controls
        this.setupSlider('coilDiameter', 'coilDiameterValue', (value) => {
            if (this.spectrometerViz) {
                this.spectrometerViz.updateParameters({ coilDiameter: parseFloat(value) });
            }
        });

        this.setupSlider('pulsePower', 'pulsePowerValue');
        this.setupSlider('receiverGain', 'receiverGainValue');

        // Noise controls
        document.getElementById('noiseToggle')?.addEventListener('change', (e) => {
            this.physics.setNoiseEnabled(e.target.checked);
            const levelGroup = document.getElementById('noiseLevelGroup');
            if (levelGroup) {
                levelGroup.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        this.setupSlider('noiseLevel', 'noiseLevelValue', (value) => {
            this.physics.setNoiseLevel(parseFloat(value) / 100);
        });

        // TMS toggle
        document.getElementById('tmsToggle')?.addEventListener('change', (e) => {
            this.sample.showTMS = e.target.checked;
        });

        // Sample controls
        document.getElementById('sampleType')?.addEventListener('change', (e) => {
            this.sample.loadSample(e.target.value);
            this.updateSampleInfo();
            this.updateMoleculeView();
            this.updateSolventInfo();

            // Sync solvent dropdown to sample's default solvent
            const solventSelect = document.getElementById('solventType');
            if (solventSelect && this.sample.solventKey) {
                solventSelect.value = this.sample.solventKey;
            }

            if (this.spectrometerViz) {
                this.spectrometerViz.updateParameters({ sampleDiameter: this.sample.tubeDiameter });
            }
        });

        // Solvent controls
        document.getElementById('solventType')?.addEventListener('change', (e) => {
            this.sample.setSolvent(e.target.value);
            this.updateSolventInfo();
        });

        this.setupSlider('sampleConcentration', 'sampleConcentrationValue', (value) => {
            this.sample.setConcentration(parseFloat(value) / 100);
        });

        this.setupSlider('sampleVolume', 'sampleVolumeValue', (value) => {
            this.sample.setVolume(parseFloat(value));
        });

        // Pulse sequence controls
        document.getElementById('pulseSequence')?.addEventListener('change', (e) => {
            this.renderPulseSequence();
        });

        this.setupSlider('relaxDelay', 'relaxDelayValue');
        this.setupSlider('numScans', 'numScansValue');

        // FID controls
        document.getElementById('acquireBtn')?.addEventListener('click', () => this.acquireFID());

        // Auto-adjust acquisition time toggle
        document.getElementById('autoAcqTime')?.addEventListener('change', (e) => {
            const manualInput = document.querySelector('.manual-acq-time');
            if (manualInput) {
                manualInput.classList.toggle('disabled', e.target.checked);
            }
        });
        // Initialize disabled state on load
        const autoAcqToggle = document.getElementById('autoAcqTime');
        if (autoAcqToggle?.checked) {
            document.querySelector('.manual-acq-time')?.classList.add('disabled');
        }

        // Spectrum controls
        document.getElementById('zoomInBtn')?.addEventListener('click', () => {
            if (this.spectrumViz) {
                this.spectrumViz.spectrumZoom *= 1.5;
                this.spectrumViz.applySpectrumZoom();
            }
        });

        document.getElementById('zoomOutBtn')?.addEventListener('click', () => {
            if (this.spectrumViz) {
                this.spectrumViz.spectrumZoom /= 1.5;
                this.spectrumViz.applySpectrumZoom();
            }
        });

        document.getElementById('resetZoomBtn')?.addEventListener('click', () => {
            if (this.spectrumViz) {
                this.spectrumViz.resetZoom();
            }
        });

        document.getElementById('exportBtn')?.addEventListener('click', () => {
            if (this.spectrumViz) {
                this.spectrumViz.downloadCSV();
            }
        });

        // Bloch sphere controls
        document.getElementById('applyPulseBtn')?.addEventListener('click', () => {
            if (this.blochViz) this.blochViz.applyPulse(90);
        });

        document.getElementById('apply180PulseBtn')?.addEventListener('click', () => {
            if (this.blochViz) this.blochViz.applyPulse(180);
        });

        document.getElementById('apply45PulseBtn')?.addEventListener('click', () => {
            if (this.blochViz) this.blochViz.applyPulse(45);
        });

        document.getElementById('applyCustomPulseBtn')?.addEventListener('click', () => {
            const angle = parseFloat(document.getElementById('customPulseAngle')?.value || 30);
            const phase = document.getElementById('pulsePhase')?.value || 'x';
            if (this.blochViz) this.blochViz.applyPulse(angle, phase);
        });

        document.getElementById('resetBlochBtn')?.addEventListener('click', () => {
            if (this.blochViz) this.blochViz.reset();
        });

        // Modal backdrop click to close
        document.getElementById('tutorialModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'tutorialModal') {
                this.hideTutorial();
            }
        });
    }

    setupSlider(sliderId, valueId, callback) {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);

        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                valueDisplay.textContent = e.target.value;
                if (callback) callback(e.target.value);
            });
        }
    }

    switchTab(tabId) {
        this.currentTab = tabId;

        // Update tab buttons
        document.querySelectorAll('.viz-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });

        // Update panels
        document.querySelectorAll('.viz-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        const activePanel = document.getElementById(tabId + 'View');
        if (activePanel) {
            activePanel.classList.add('active');
        }

        // Trigger resize/refresh for visualizations
        if (tabId === 'spectrometer' && this.spectrometerViz) {
            this.spectrometerViz.onWindowResize();
        } else if (tabId === 'bloch' && this.blochViz) {
            this.blochViz.onWindowResize();
        } else if (tabId === 'molecule' && this.moleculeViz) {
            this.moleculeViz.render();
        }
    }

    syncUIFromState() {
        // Sync UI elements with current state
        const setSliderValue = (id, value) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(id + 'Value');
            if (slider) slider.value = value;
            if (valueDisplay) valueDisplay.textContent = value;
        };

        setSliderValue('b0Strength', this.physics.b0Field.toFixed(2));
        setSliderValue('temperature', this.physics.temperature);
        setSliderValue('fieldHomogeneity', Math.round(this.physics.fieldHomogeneity * 100));
        setSliderValue('noiseLevel', Math.round(this.physics.noiseLevel * 100));

        // Sync solvent dropdown with sample's solvent
        const solventSelect = document.getElementById('solventType');
        if (solventSelect && this.sample.solventKey) {
            solventSelect.value = this.sample.solventKey;
        }

        // Sync sample dropdown
        const sampleSelect = document.getElementById('sampleType');
        if (sampleSelect && this.sample.type) {
            sampleSelect.value = this.sample.type;
        }

        this.updateSampleInfo();
        this.updateSolventInfo();
    }

    updateDerivedValues() {
        // Update Larmor frequency display
        const larmorFreq = this.physics.calculateLarmorFrequency();
        document.getElementById('larmorFreq').textContent = larmorFreq.toFixed(2) + ' MHz';

        // Update spectral width estimate
        const spectralWidth = document.getElementById('spectralWidth');
        if (spectralWidth) {
            // Spectral width typically 10-15 ppm for 1H
            const swHz = larmorFreq * 12; // 12 ppm range in Hz
            if (swHz > 1000) {
                spectralWidth.textContent = (swHz / 1000).toFixed(1) + ' kHz';
            } else {
                spectralWidth.textContent = swHz.toFixed(0) + ' Hz';
            }
        }
    }

    updateSampleInfo() {
        document.getElementById('molecularFormula').textContent = this.sample.formula;
        document.getElementById('molecularWeight').textContent = this.sample.molecularWeight.toFixed(2) + ' g/mol';
        document.getElementById('numProtons').textContent = this.sample.getNumEnvironments();
    }

    updateSolventInfo() {
        const solvent = this.sample.getSolvent();
        const h1Residual = document.getElementById('solventH1');
        if (h1Residual && solvent) {
            h1Residual.textContent = solvent.h1_residual?.toFixed(2) || 'N/A';
        }
    }

    updateMoleculeView() {
        if (this.moleculeViz) {
            this.moleculeViz.setSample(this.sample);
        }
    }

    renderPulseSequence() {
        const container = document.getElementById('pulseDiagram');
        if (!container) return;

        const sequenceType = document.getElementById('pulseSequence')?.value || 'single_pulse';
        const sequence = PulseSequences[sequenceType];

        if (!sequence) {
            container.innerHTML = '<div class="empty-state">Unknown sequence</div>';
            return;
        }

        // Create SVG pulse diagram
        const width = container.clientWidth || 200;
        const height = 80;

        let svg = `<svg viewBox="0 0 ${width} ${height}" class="pulse-diagram-svg">`;

        // Draw baseline
        const baselineY = height * 0.6;
        svg += `<line x1="10" y1="${baselineY}" x2="${width - 10}" y2="${baselineY}" stroke="#475569" stroke-width="1"/>`;

        // Filter actual pulse elements
        const pulseElements = sequence.elements.filter(e =>
            e.type === 'pulse' || e.type === 'delay' || e.type === 'acquire'
        );

        const elementWidth = (width - 40) / Math.max(pulseElements.length, 1);
        let x = 20;

        for (const element of pulseElements) {
            const centerX = x + elementWidth / 2;

            if (element.type === 'pulse') {
                // Draw pulse rectangle
                const pulseHeight = element.angle === 180 ? 35 : (element.angle === 135 ? 30 : 25);
                const pulseWidth = 12;
                const y = baselineY - pulseHeight;

                const color = element.angle === 180 ? '#8b5cf6' :
                    element.angle === 135 ? '#a855f7' : '#6366f1';
                svg += `<rect x="${centerX - pulseWidth / 2}" y="${y}" width="${pulseWidth}" height="${pulseHeight}" fill="${color}" rx="2"/>`;
                svg += `<text x="${centerX}" y="${height - 8}" fill="#94a3b8" font-size="10" text-anchor="middle">${element.angle}°</text>`;

            } else if (element.type === 'delay') {
                // Draw delay marker
                svg += `<line x1="${centerX}" y1="${baselineY - 5}" x2="${centerX}" y2="${baselineY + 5}" stroke="#64748b" stroke-width="1"/>`;
                svg += `<text x="${centerX}" y="${height - 8}" fill="#64748b" font-size="9" text-anchor="middle">${element.name}</text>`;

            } else if (element.type === 'acquire') {
                // Draw acquisition period
                const acqWidth = elementWidth - 15;
                const acqHeight = 20;
                svg += `<rect x="${centerX - acqWidth / 2}" y="${baselineY - acqHeight / 2}" width="${acqWidth}" height="${acqHeight}" fill="none" stroke="#10b981" stroke-width="2" rx="3"/>`;

                // Wavy line inside
                let wavePath = `M ${centerX - acqWidth / 2 + 5} ${baselineY}`;
                for (let i = 0; i < 4; i++) {
                    const wx = centerX - acqWidth / 2 + 10 + i * (acqWidth - 15) / 4;
                    wavePath += ` Q ${wx} ${baselineY - 8} ${wx + (acqWidth - 15) / 8} ${baselineY}`;
                    wavePath += ` Q ${wx + (acqWidth - 15) / 4} ${baselineY + 8} ${wx + (acqWidth - 15) / 4} ${baselineY}`;
                }
                svg += `<path d="${wavePath}" stroke="#10b981" fill="none" stroke-width="1.5"/>`;
                svg += `<text x="${centerX}" y="${height - 8}" fill="#10b981" font-size="9" text-anchor="middle">AQ</text>`;
            }

            x += elementWidth;
        }

        // Add 2D indicator if applicable
        if (sequence.is2D) {
            svg += `<text x="${width - 15}" y="15" fill="#f59e0b" font-size="10" font-weight="bold">2D</text>`;
        }

        svg += '</svg>';

        // Add description
        container.innerHTML = svg + `<div class="pulse-sequence-name">${sequence.name}</div>`;
    }

    async runExperiment() {
        if (this.isRunning) return;

        this.isRunning = true;
        const runBtn = document.getElementById('runBtn');
        if (runBtn) {
            runBtn.textContent = 'Running...';
            runBtn.disabled = true;
        }

        // Start 3D animation
        if (this.spectrometerViz) {
            this.spectrometerViz.startExperimentAnimation();
        }

        // Apply pulse on Bloch sphere
        if (this.blochViz) {
            this.blochViz.apply90Pulse();
        }

        try {
            // Get acquisition parameters
            let acqTime = parseFloat(document.getElementById('acqTime')?.value || 1.0);
            const numPoints = parseInt(document.getElementById('numPoints')?.value || 2048);
            const numScans = parseInt(document.getElementById('numScans')?.value || 4);
            const receiverGain = parseFloat(document.getElementById('receiverGain')?.value || 50);
            const autoAcqTime = document.getElementById('autoAcqTime')?.checked ?? true;

            // Simulate delay for realism
            await this.delay(500);

            // Get peaks including TMS if enabled
            let peaks = this.sample.getScaledPeaks();

            // Add TMS reference if enabled
            if (this.sample.showTMS) {
                peaks = [
                    { shift: 0.00, intensity: 1.0, assignment: 'TMS', numProtons: 12, t2: 5.0 },
                    ...peaks
                ];
            }

            // Add solvent residual peak (if it doesn't overlap with existing peaks)
            const solvent = this.sample.getSolvent();
            if (solvent && solvent.h1_residual) {
                // Check if this peak already exists (e.g., D2O residual = water peak)
                const existingPeak = peaks.find(p => Math.abs(p.shift - solvent.h1_residual) < 0.1);
                if (!existingPeak) {
                    peaks.push({
                        shift: solvent.h1_residual,
                        intensity: 0.3,
                        assignment: 'Solvent',
                        numProtons: 1,
                        t2: 2.0
                    });
                }
            }

            // Auto-adjust acquisition time if enabled
            if (autoAcqTime) {
                // Calculate optimal acquisition time based on T2 values
                // We want to capture ~5 T2 time constants to show full decay
                const t2Values = peaks.map(p => p.t2 || this.physics.estimateT2(this.sample));
                const maxT2 = Math.max(...t2Values);
                const minT2 = Math.min(...t2Values.filter(t => t > 0.1));

                // Use 5× the average T2, clamped to reasonable range
                const avgT2 = (maxT2 + minT2) / 2;
                acqTime = Math.max(0.5, Math.min(5.0, avgT2 * 5));

                // Check bandwidth limiting to prevent aliasing (Nyquist limit)
                // We need to see up to ~14 ppm. Max detectable freq = SW/2.
                // So SW >= 2 * 14 * Larmor = 28 * Larmor.
                const larmorMHz = this.physics.calculateLarmorFrequency();
                const minSwHz = 30.0 * larmorMHz; // Use 30 ppm for safety

                // SW = N / AcqTime => AcqTime = N / SW
                const maxAcqTimeForBandwidth = numPoints / minSwHz;

                if (acqTime > maxAcqTimeForBandwidth) {
                    acqTime = maxAcqTimeForBandwidth;
                    // console.log(`Auto-adjusted acquisition time restricted to ${acqTime.toFixed(2)}s to prevent aliasing`);
                }

                // Update the UI display
                const acqTimeInput = document.getElementById('acqTime');
                if (acqTimeInput) {
                    acqTimeInput.value = acqTime.toFixed(1);
                }
            }

            // Reset noise seed for deterministic results
            this.physics.resetNoiseSeed(12345);

            // Get pulse sequence parameters
            const sequenceType = document.getElementById('pulseSequence')?.value || 'single_pulse';
            const relaxDelay = parseFloat(document.getElementById('relaxDelay')?.value || 2.0);

            // Generate FID with pulse sequence awareness
            const fid = this.physics.generateFIDWithSequence(peaks, acqTime, numPoints, sequenceType, relaxDelay, this.sample);

            // Update FID display
            if (this.spectrumViz) {
                this.spectrumViz.updateFID(fid);
            }

            await this.delay(300);

            // Compute spectrum
            const spectrum = this.physics.computeSpectrum(fid, true, true);

            // Update spectrum display with peak labels
            if (this.spectrumViz) {
                this.spectrumViz.updateSpectrum(spectrum, this.physics.calculateLarmorFrequency(), peaks);
                // Reset zoom to show full spectrum with all peaks
                this.spectrumViz.resetZoom();
            }

            // Store experiment data
            this.experimentData = { fid, spectrum };

            // Calculate and display results
            this.updateResults(numScans, receiverGain);

            // Don't force tab switch - let user stay on current tab

        } catch (error) {
            console.error('Experiment failed:', error);
            this.showToast('Experiment failed: ' + error.message, 'error');
        } finally {
            this.isRunning = false;
            if (runBtn) {
                runBtn.textContent = 'Run Experiment';
                runBtn.disabled = false;
            }

            if (this.spectrometerViz) {
                this.spectrometerViz.stopExperimentAnimation();
            }
        }
    }

    async acquireFID() {
        if (this.isRunning) return;

        this.isRunning = true;
        const acquireBtn = document.getElementById('acquireBtn');
        if (acquireBtn) {
            acquireBtn.textContent = 'Acquiring...';
            acquireBtn.disabled = true;
        }

        try {
            let acqTime = parseFloat(document.getElementById('acqTime')?.value || 1.0);
            const numPoints = parseInt(document.getElementById('numPoints')?.value || 2048);
            const autoAcqTime = document.getElementById('autoAcqTime')?.checked ?? true;

            await this.delay(300);

            // Get peaks
            let peaks = this.sample.getScaledPeaks();
            if (this.sample.showTMS) {
                peaks = [{ shift: 0.00, intensity: 1.0, assignment: 'TMS', t2: 5.0 }, ...peaks];
            }

            // Auto-adjust acquisition time if enabled
            if (autoAcqTime) {
                const t2Values = peaks.map(p => p.t2 || this.physics.estimateT2(this.sample));
                const maxT2 = Math.max(...t2Values);
                const minT2 = Math.min(...t2Values.filter(t => t > 0.1));
                const avgT2 = (maxT2 + minT2) / 2;
                acqTime = Math.max(0.5, Math.min(5.0, avgT2 * 5));

                const acqTimeInput = document.getElementById('acqTime');
                if (acqTimeInput) {
                    acqTimeInput.value = acqTime.toFixed(1);
                }
            }

            // Reset noise seed
            this.physics.resetNoiseSeed(12345);

            const fid = this.physics.generateFID(peaks, acqTime, numPoints);

            if (this.spectrumViz) {
                this.spectrumViz.updateFID(fid);
            }

            // Also update spectrum
            const spectrum = this.physics.computeSpectrum(fid, true, true);
            if (this.spectrumViz) {
                this.spectrumViz.updateSpectrum(spectrum, this.physics.calculateLarmorFrequency(), peaks);
            }

            this.experimentData = { fid, spectrum };

        } catch (error) {
            console.error('Acquisition failed:', error);
        } finally {
            this.isRunning = false;
            if (acquireBtn) {
                acquireBtn.textContent = 'Acquire FID';
                acquireBtn.disabled = false;
            }
        }
    }

    updateResults(numScans, receiverGain) {
        // Calculate SNR
        const snr = this.physics.calculateSNR(
            this.sample.concentration,
            this.sample.volume,
            numScans,
            receiverGain
        );
        document.getElementById('snrValue').textContent = snr.toFixed(1);

        // Estimate T1 and T2
        const t1 = this.physics.estimateT1(this.sample);
        const t2 = this.physics.estimateT2(this.sample);

        document.getElementById('t1Value').textContent = t1.toFixed(2) + ' s';
        document.getElementById('t2Value').textContent = t2.toFixed(2) + ' s';

        // Update peaks detected
        const peaksDetected = this.spectrumViz?.getDetectedPeaks()?.length || 0;
        document.getElementById('peaksDetected').textContent = peaksDetected;
    }

    resetAll() {
        // Reset physics parameters
        this.physics.setB0Field(1.5);
        this.physics.setTemperature(298);
        this.physics.setFieldHomogeneity(0.85);
        this.physics.setNoiseEnabled(false);
        this.physics.setNoiseLevel(0.05);

        // Reset sample
        this.sample.loadSample('water');
        this.sample.showTMS = true;

        // Reset UI elements
        const resetSlider = (id, value) => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(id + 'Value');
            if (slider) slider.value = value;
            if (valueDisplay) valueDisplay.textContent = value;
        };

        resetSlider('b0Strength', '1.50');
        resetSlider('magnetGap', '40');
        resetSlider('fieldHomogeneity', '85');
        resetSlider('temperature', '298');
        resetSlider('coilDiameter', '12');
        resetSlider('pulsePower', '50');
        resetSlider('receiverGain', '50');
        resetSlider('sampleConcentration', '100');
        resetSlider('sampleVolume', '0.5');
        resetSlider('relaxDelay', '2.0');
        resetSlider('numScans', '4');
        resetSlider('noiseLevel', '5');

        document.getElementById('sampleType').value = 'water';
        document.getElementById('pulseSequence').value = 'single_pulse';
        document.getElementById('noiseToggle').checked = false;
        document.getElementById('tmsToggle').checked = true;
        document.getElementById('noiseLevelGroup').style.display = 'none';

        // Sync solvent dropdown with sample's default solvent (water uses D2O)
        const solventSelect = document.getElementById('solventType');
        if (solventSelect && this.sample.solventKey) {
            solventSelect.value = this.sample.solventKey;
        }

        // Reset auto-adjust acquisition time
        const autoAcqTimeToggle = document.getElementById('autoAcqTime');
        if (autoAcqTimeToggle) {
            autoAcqTimeToggle.checked = true;
            document.querySelector('.manual-acq-time')?.classList.add('disabled');
        }
        document.getElementById('acqTime').value = '1.0';

        // Rebuild spectrometer visualization
        if (this.spectrometerViz) {
            this.spectrometerViz.updateParameters({
                magnetGap: 40,
                coilDiameter: 12,
                sampleDiameter: 5
            });
        }

        // Clear charts
        if (this.spectrumViz) {
            this.spectrumViz.clear();
        }

        // Reset Bloch sphere
        if (this.blochViz) {
            this.blochViz.reset();
        }

        // Reset results
        document.getElementById('snrValue').textContent = '--';
        document.getElementById('t1Value').textContent = '--';
        document.getElementById('t2Value').textContent = '--';
        document.getElementById('peaksDetected').textContent = '--';

        // Update derived values
        this.updateDerivedValues();
        this.updateSampleInfo();
        this.updateSolventInfo();
        this.updateMoleculeView();
        this.renderPulseSequence();

        // Switch to spectrometer view
        this.switchTab('spectrometer');

        this.showToast('All settings reset to default', 'success');
    }

    showTutorial() {
        const modal = document.getElementById('tutorialModal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    hideTutorial() {
        const modal = document.getElementById('tutorialModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    showToast(message, type = 'info') {
        // Simple toast notification
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the application
const nmrSimulator = new NMRSimulatorUI();

// Export for debugging
window.nmrSimulator = nmrSimulator;

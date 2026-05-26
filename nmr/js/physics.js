/**
 * NMR Physics Engine
 * Handles all NMR physics calculations including:
 * - Larmor frequency calculations
 * - FID signal generation
 * - FFT for spectrum computation
 * - Relaxation effects
 * - Field homogeneity modeling
 */

class NMRPhysics {
    constructor() {
        // Default parameters for permanent magnet NMR
        this.b0Field = 1.5;           // Tesla
        this.temperature = 298;        // Kelvin
        this.nucleus = '1H';          // Default nucleus
        this.fieldHomogeneity = 0.85; // 0-1 scale

        // Gyromagnetic ratios (MHz/T)
        this.GAMMA = {
            '1H': 42.577,
            '13C': 10.708,
            '15N': -4.316,
            '19F': 40.052,
            '31P': 17.235,
            '29Si': -8.465
        };

        // Random seed for deterministic noise
        this.noiseSeed = 12345;
        this.useNoise = false;
        this.noiseLevel = 0.05;
    }

    // Seeded random number generator for deterministic noise
    seededRandom() {
        this.noiseSeed = (this.noiseSeed * 9301 + 49297) % 233280;
        return this.noiseSeed / 233280;
    }

    resetNoiseSeed(seed = 12345) {
        this.noiseSeed = seed;
    }

    setNoiseEnabled(enabled) {
        this.useNoise = enabled;
    }

    setNoiseLevel(level) {
        this.noiseLevel = Math.max(0, Math.min(0.5, level));
    }

    setB0Field(tesla) {
        this.b0Field = Math.max(0.1, Math.min(10, tesla));
    }

    setTemperature(kelvin) {
        this.temperature = Math.max(200, Math.min(400, kelvin));
    }

    setNucleus(nucleus) {
        if (this.GAMMA[nucleus]) {
            this.nucleus = nucleus;
        }
    }

    setFieldHomogeneity(homogeneity) {
        this.fieldHomogeneity = Math.max(0, Math.min(1, homogeneity));
    }

    /**
     * Estimate T2 relaxation time based on sample and field properties
     * Returns T2 in seconds
     */
    estimateT1(sample = null) {
        // T1 scale with field strength (B0)
        // T1 ~ B0^a where a is typically 0.5-0.8 for small molecules
        return 1.5 * Math.sqrt(this.b0Field);
    }

    estimateT2(sample = null) {
        // Base T2 estimation based on field strength
        // Higher field typically means shorter T2* due to field inhomogeneity effects
        let baseT2 = 2.0 / this.b0Field; // Rough inverse relationship with field

        // Adjust for field homogeneity (better homogeneity = longer effective T2*)
        baseT2 *= (0.5 + 0.5 * this.fieldHomogeneity);

        // Clamp to reasonable range (0.1s to 5s)
        return Math.max(0.1, Math.min(5.0, baseT2));
    }

    /**
     * Calculate Larmor frequency in MHz
     */
    calculateLarmorFrequency(nucleus = null) {
        const nuc = nucleus || this.nucleus;
        const gamma = this.GAMMA[nuc] || this.GAMMA['1H'];
        return Math.abs(gamma * this.b0Field);
    }

    /**
     * Calculate linewidth in Hz from T2
     * Linewidth = 1 / (pi * T2)
     */
    calculateLinewidth(t2) {
        return 1 / (Math.PI * t2);
    }

    /**
     * Generate multiplet splitting pattern based on J-couplings
     * @param {number} centerFreq - Center frequency in Hz
     * @param {Array} couplings - Array of J-coupling constants in Hz
     * @returns {Array} Array of objects {freq, intensity}
     */
    generateMultiplet(centerFreq, couplingConstants) {
        if (!couplingConstants || couplingConstants.length === 0) {
            return [{ freq: centerFreq, intensity: 1.0 }];
        }

        let lines = [{ freq: centerFreq, intensity: 1.0 }];

        for (const J of couplingConstants) {
            const newLines = [];
            for (const line of lines) {
                // Split each line into a doublet
                newLines.push({
                    freq: line.freq - J / 2,
                    intensity: line.intensity * 0.5
                });
                newLines.push({
                    freq: line.freq + J / 2,
                    intensity: line.intensity * 0.5
                });
            }
            lines = newLines;
        }

        return lines;
    }

    /**
     * Convert chemical shift (ppm) to frequency offset (Hz)
     */
    ppmToHz(ppm, nucleus = null) {
        const larmorMHz = this.calculateLarmorFrequency(nucleus);
        return ppm * larmorMHz; // Hz
    }

    /**
     * Convert frequency offset (Hz) to chemical shift (ppm)
     */
    hzToPpm(hz, nucleus = null) {
        const larmorMHz = this.calculateLarmorFrequency(nucleus);
        return hz / larmorMHz;
    }

    /**
     * Calculate linewidth (Hz) based on T2 and field homogeneity
     */
    calculateLinewidth(t2, additionalBroadening = 0) {
        // Natural linewidth from T2
        const naturalWidth = 1 / (Math.PI * t2);

        // Inhomogeneous broadening from field inhomogeneity
        const inhomogeneousWidth = (1 - this.fieldHomogeneity) * 50 * this.b0Field;

        return naturalWidth + inhomogeneousWidth + additionalBroadening;
    }

    /**
     * Estimate T1 relaxation time based on sample properties
     */
    estimateT1(sample) {
        // Base T1 from sample data
        let t1 = sample.t1 || 2.0;

        // Temperature correction (T1 generally decreases with temperature)
        const tempFactor = Math.sqrt(this.temperature / 298);
        t1 *= tempFactor;

        // Viscosity effects (higher viscosity = shorter T1)
        const viscosityFactor = 1.0; // Could be modified based on sample

        return t1 * viscosityFactor;
    }

    /**
     * Estimate T2 relaxation time
     */
    estimateT2(sample) {
        // Base T2 from sample data
        let t2 = sample.t2 || 1.0;

        // Field inhomogeneity effects
        t2 *= Math.pow(this.fieldHomogeneity, 0.5);

        // T2 is always <= T1
        const t1 = this.estimateT1(sample);
        return Math.min(t2, t1);
    }

    /**
     * Generate Free Induction Decay (FID) signal
     * @param {Array} peaks - Array of peak objects with shift, intensity, t2, j_couplings
     * @param {number} acquisitionTime - Duration in seconds
     * @param {number} numPoints - Number of data points
     * @returns {Object} Object with real, imag, time arrays
     */
    generateFID(peaks, acquisitionTime = 1.0, numPoints = 2048) {
        // Reset noise seed for deterministic results
        this.resetNoiseSeed();

        const dt = acquisitionTime / numPoints;
        const time = new Array(numPoints);
        const real = new Array(numPoints).fill(0);
        const imag = new Array(numPoints).fill(0);

        const larmorMHz = this.calculateLarmorFrequency();

        // Generate time array
        for (let i = 0; i < numPoints; i++) {
            time[i] = i * dt;
        }

        // Add contribution from each peak
        for (const peak of peaks) {
            const freqHz = peak.shift * larmorMHz; // Chemical shift in Hz (relative to reference)
            const t2 = peak.t2 || 1.0;
            const amplitude = peak.intensity || 1.0;
            const linewidth = this.calculateLinewidth(t2);

            // Generate multiplet pattern from J-couplings
            const multipletFreqs = this.generateMultiplet(freqHz, peak.j_couplings || []);

            for (const multiplet of multipletFreqs) {
                const freq = multiplet.freq;
                const amp = amplitude * multiplet.intensity;

                for (let i = 0; i < numPoints; i++) {
                    const t = time[i];
                    const decay = Math.exp(-t / t2);
                    const phase = 2 * Math.PI * freq * t;

                    real[i] += amp * decay * Math.cos(phase);
                    imag[i] += amp * decay * Math.sin(phase);
                }
            }
        }

        // Add deterministic noise if enabled
        if (this.useNoise && this.noiseLevel > 0) {
            const maxSignal = Math.max(...real.map(Math.abs));
            const noiseAmp = maxSignal * this.noiseLevel;

            for (let i = 0; i < numPoints; i++) {
                // Gaussian-like noise using seeded random
                const u1 = this.seededRandom() || 0.001;
                const u2 = this.seededRandom();
                const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

                real[i] += gaussian * noiseAmp;
                imag[i] += gaussian * noiseAmp * 0.5;
            }
        }

        return { real, imag, time, dt, numPoints };
    }

    /**
     * Generate FID with pulse sequence awareness
     * Different sequences produce different signal characteristics
     */
    generateFIDWithSequence(peaks, acquisitionTime = 1.0, numPoints = 2048, sequenceType = 'single_pulse', relaxDelay = 2.0, sample = null) {
        // Reset noise seed for deterministic results
        this.resetNoiseSeed();

        const dt = acquisitionTime / numPoints;
        const time = new Array(numPoints);
        const real = new Array(numPoints).fill(0);
        const imag = new Array(numPoints).fill(0);

        const larmorMHz = this.calculateLarmorFrequency();
        const t1 = sample ? this.estimateT1(sample) : 2.0;
        const t2 = sample ? this.estimateT2(sample) : 1.0;

        // Generate time array
        for (let i = 0; i < numPoints; i++) {
            time[i] = i * dt;
        }

        // Apply pulse sequence effects
        let sequenceModifier = 1.0;
        let phaseModifier = 0;
        let t2Effective = t2;
        let signalInverted = false;
        let echoTime = 0;
        let hasEcho = false;

        switch (sequenceType) {
            case 'single_pulse':
                // Standard 90° excitation - pure FID decay
                sequenceModifier = 1.0;
                break;

            case 'inversion_recovery':
                // 180° - tau - 90° sequence for T1 measurement
                // Signal depends on tau (using relaxDelay as proxy)
                // M(tau) = M0 * (1 - 2*exp(-tau/T1))
                const tau = relaxDelay * 0.1; // Scale delay
                sequenceModifier = Math.abs(1 - 2 * Math.exp(-tau / t1));
                signalInverted = (1 - 2 * Math.exp(-tau / t1)) < 0;
                break;

            case 'spin_echo':
                // 90° - tau - 180° - tau - acquire (Hahn echo)
                // Refocuses inhomogeneous broadening, narrower peaks
                echoTime = 0.01; // 10ms echo time
                hasEcho = true;
                t2Effective = t2 * 1.5; // Longer effective T2 due to refocusing
                sequenceModifier = Math.exp(-2 * echoTime / t2); // Signal at echo
                break;

            case 'cpmg':
                // Multiple 180° pulses - even better T2 measurement
                // Multiple echoes create train effect
                const numEchoes = 8;
                echoTime = 0.002; // 2ms between echoes
                hasEcho = true;
                t2Effective = t2 * 2.0; // Much better refocusing
                // Signal amplitude after echo train
                sequenceModifier = Math.exp(-numEchoes * 2 * echoTime / t2);
                break;

            case 'cosy':
            case 'noesy':
            case 'hsqc':
                // 2D experiments - show cross-peak correlations would require 2D data
                // For 1D projection, just use standard FID with some mixing
                sequenceModifier = 0.7;
                phaseModifier = Math.PI / 8;
                break;

            case 'dept':
                // DEPT-135: CH3 and CH up, CH2 down
                // Simulate by phase modulation
                sequenceModifier = 0.85;
                break;

            default:
                sequenceModifier = 1.0;
        }

        // Add contribution from each peak
        for (const peak of peaks) {
            const freqHz = peak.shift * larmorMHz;
            const peakT2 = peak.t2 || t2Effective;
            let amplitude = (peak.intensity || 1.0) * sequenceModifier;

            // For DEPT, invert CH2 peaks (approximate by every other peak)
            if (sequenceType === 'dept' && peaks.indexOf(peak) % 3 === 1) {
                amplitude = -amplitude;
            }

            // Inversion recovery inverts signal when M < 0
            if (signalInverted) {
                amplitude = -amplitude;
            }

            // Generate multiplet pattern from J-couplings
            const multipletFreqs = this.generateMultiplet(freqHz, peak.j_couplings || []);

            for (const multiplet of multipletFreqs) {
                const freq = multiplet.freq;
                const amp = amplitude * multiplet.intensity;

                for (let i = 0; i < numPoints; i++) {
                    const t = time[i];
                    let decay;

                    if (hasEcho && echoTime > 0) {
                        // For echo sequences, modulate with echo envelope
                        const echoEnvelope = Math.exp(-t / t2Effective) *
                            (1 + 0.3 * Math.cos(2 * Math.PI * t / (4 * echoTime)));
                        decay = echoEnvelope;
                    } else {
                        decay = Math.exp(-t / peakT2);
                    }

                    const phase = 2 * Math.PI * freq * t + phaseModifier;
                    real[i] += amp * decay * Math.cos(phase);
                    imag[i] += amp * decay * Math.sin(phase);
                }
            }
        }

        // Add deterministic noise if enabled
        if (this.useNoise && this.noiseLevel > 0) {
            const maxSignal = Math.max(...real.map(Math.abs)) || 1;
            const noiseAmp = maxSignal * this.noiseLevel;

            for (let i = 0; i < numPoints; i++) {
                const u1 = this.seededRandom() || 0.001;
                const u2 = this.seededRandom();
                const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

                real[i] += gaussian * noiseAmp;
                imag[i] += gaussian * noiseAmp * 0.5;
            }
        }

        return { real, imag, time, dt, numPoints, sequenceType };
    }

    /**
     * Generate multiplet pattern from J-couplings
     */
    generateMultiplet(centerFreq, jCouplings) {
        if (!jCouplings || jCouplings.length === 0) {
            return [{ freq: centerFreq, intensity: 1.0 }];
        }

        let peaks = [{ freq: centerFreq, intensity: 1.0 }];

        for (const J of jCouplings) {
            const newPeaks = [];
            for (const peak of peaks) {
                // Split each peak into a doublet
                newPeaks.push({
                    freq: peak.freq + J / 2,
                    intensity: peak.intensity / 2
                });
                newPeaks.push({
                    freq: peak.freq - J / 2,
                    intensity: peak.intensity / 2
                });
            }
            peaks = newPeaks;
        }

        return peaks;
    }

    /**
     * Compute spectrum from FID using FFT
     */
    computeSpectrum(fid, applyZeroFill = true, applyWindowFunction = true) {
        let { real, imag, numPoints, dt } = fid;

        // Zero-fill to next power of 2
        if (applyZeroFill) {
            const targetSize = Math.pow(2, Math.ceil(Math.log2(numPoints)) + 1);
            while (real.length < targetSize) {
                real.push(0);
                imag.push(0);
            }
            numPoints = real.length;
        }

        // Apply window function (exponential line broadening)
        if (applyWindowFunction) {
            const lb = 0.3; // Line broadening in Hz
            for (let i = 0; i < numPoints; i++) {
                const t = i * dt;
                const window = Math.exp(-Math.PI * lb * t);
                real[i] *= window;
                imag[i] *= window;
            }
        }

        // Perform FFT
        const { realOut, imagOut } = this.fft(real, imag);

        // Calculate magnitude spectrum
        const magnitude = new Array(numPoints);
        for (let i = 0; i < numPoints; i++) {
            magnitude[i] = Math.sqrt(realOut[i] * realOut[i] + imagOut[i] * imagOut[i]);
        }

        // Calculate frequency axis (before shift, this is 0 to +SW then -SW to 0)
        const spectralWidth = 1 / dt; // Hz
        const frequenciesRaw = new Array(numPoints);
        for (let i = 0; i < numPoints; i++) {
            // Before shift: frequencies go from 0 to +SW/2, then -SW/2 to 0
            if (i < numPoints / 2) {
                frequenciesRaw[i] = i * spectralWidth / numPoints;
            } else {
                frequenciesRaw[i] = (i - numPoints) * spectralWidth / numPoints;
            }
        }

        // FFT shift to center zero frequency (moves negative freqs to start)
        const halfN = numPoints / 2;
        const shiftedMag = [...magnitude.slice(halfN), ...magnitude.slice(0, halfN)];
        const shiftedReal = [...realOut.slice(halfN), ...realOut.slice(0, halfN)];
        const shiftedImag = [...imagOut.slice(halfN), ...imagOut.slice(0, halfN)];
        const frequencies = [...frequenciesRaw.slice(halfN), ...frequenciesRaw.slice(0, halfN)];

        return {
            magnitude: shiftedMag,
            real: shiftedReal,
            imag: shiftedImag,
            frequencies,
            numPoints,
            spectralWidth
        };
    }

    /**
     * Fast Fourier Transform (Cooley-Tukey algorithm)
     */
    fft(real, imag) {
        const n = real.length;

        // Ensure n is a power of 2
        if (n & (n - 1)) {
            throw new Error('FFT size must be a power of 2');
        }

        // Copy arrays
        const realOut = [...real];
        const imagOut = [...imag];

        // Bit reversal permutation
        let j = 0;
        for (let i = 0; i < n - 1; i++) {
            if (i < j) {
                [realOut[i], realOut[j]] = [realOut[j], realOut[i]];
                [imagOut[i], imagOut[j]] = [imagOut[j], imagOut[i]];
            }
            let k = n >> 1;
            while (k <= j) {
                j -= k;
                k >>= 1;
            }
            j += k;
        }

        // Cooley-Tukey FFT
        for (let step = 1; step < n; step *= 2) {
            const halfStep = step;
            const tableStep = n / (2 * step);

            for (let group = 0; group < n; group += 2 * step) {
                for (let pair = 0; pair < step; pair++) {
                    const angle = -Math.PI * pair / step;
                    const wr = Math.cos(angle);
                    const wi = Math.sin(angle);

                    const i = group + pair;
                    const j = i + halfStep;

                    const tr = wr * realOut[j] - wi * imagOut[j];
                    const ti = wr * imagOut[j] + wi * realOut[j];

                    realOut[j] = realOut[i] - tr;
                    imagOut[j] = imagOut[i] - ti;
                    realOut[i] += tr;
                    imagOut[i] += ti;
                }
            }
        }

        return { realOut, imagOut };
    }

    /**
     * Calculate population difference (Boltzmann)
     */
    calculatePopulationDifference() {
        const HBAR = 1.054571817e-34;  // J·s
        const KB = 1.380649e-23;        // J/K

        const gamma = this.GAMMA[this.nucleus] * 2 * Math.PI * 1e6; // rad/s/T
        const deltaE = HBAR * gamma * this.b0Field;
        const polarization = Math.tanh(deltaE / (2 * KB * this.temperature));

        return polarization;
    }

    /**
     * Calculate signal-to-noise ratio estimate
     */
    calculateSNR(concentration, volume, numScans, receiverGain) {
        // Base SNR factors
        const fieldFactor = Math.pow(this.b0Field, 1.5);
        const concFactor = concentration;
        const volFactor = Math.sqrt(volume);
        const scanFactor = Math.sqrt(numScans);
        const gainFactor = receiverGain / 50;
        const tempFactor = 298 / this.temperature;

        // Estimate SNR on arbitrary scale
        return 100 * fieldFactor * concFactor * volFactor * scanFactor * gainFactor * tempFactor;
    }

    /**
     * Simulate inversion recovery experiment for T1 measurement
     */
    simulateInversionRecovery(sample, tauValues) {
        const t1 = this.estimateT1(sample);

        return tauValues.map(tau => {
            const signal = 1 - 2 * Math.exp(-tau / t1);
            return { tau, signal };
        });
    }

    /**
     * Simulate CPMG experiment for T2 measurement
     */
    simulateCPMG(sample, numEchoes, echoTime) {
        const t2 = this.estimateT2(sample);
        const results = [];

        for (let n = 1; n <= numEchoes; n++) {
            const totalTime = n * 2 * echoTime;
            const signal = Math.exp(-totalTime / t2);
            results.push({ echoNumber: n, time: totalTime, signal });
        }

        return results;
    }

    /**
     * Calculate spin echo signal accounting for refocusing
     */
    calculateSpinEcho(t2, tau) {
        // Spin echo refocuses inhomogeneous broadening
        // Signal at 2*tau depends on true T2
        return Math.exp(-2 * tau / t2);
    }
    /**
     * Reset the random seed for deterministic noise
     */
    resetNoiseSeed(seed = 12345) {
        this.noiseSeed = seed;
    }

    /**
     * Generate seeded random number (0-1)
     * Simple LCG algorithm
     */
    seededRandom() {
        if (this.noiseSeed === undefined) this.noiseSeed = 12345;
        this.noiseSeed = (this.noiseSeed * 9301 + 49297) % 233280;
        return this.noiseSeed / 233280;
    }
}

// Export for use in other modules
window.NMRPhysics = NMRPhysics;

/**
 * NMR Spectrum Visualization
 * FID (Free Induction Decay) and NMR Spectrum charts
 * Uses Chart.js for clean, interactive visualization
 */

class SpectrumVisualization {
    constructor() {
        this.fidChart = null;
        this.spectrumChart = null;
        this.physics = null;

        // Zoom and pan state
        this.spectrumZoom = 1.0;
        this.spectrumPanX = 0;
        this.isDragging = false;
        this.lastMouseX = 0;

        // Data storage
        this.fidData = null;
        this.spectrumData = null;
        this.peakResults = [];
        this.peakAnnotations = [];
        this.samplePeaks = [];
        this.fullSpectrumLabels = null;
        this.fullSpectrumData = null;
    }

    init(physics) {
        this.physics = physics;
    }

    initFIDChart(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        this.fidChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Real',
                        data: [],
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        tension: 0,
                        fill: false
                    },
                    {
                        label: 'Imaginary',
                        data: [],
                        borderColor: '#f43f5e',
                        backgroundColor: 'rgba(244, 63, 94, 0.1)',
                        borderWidth: 1,
                        pointRadius: 0,
                        tension: 0,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#94a3b8',
                            usePointStyle: true,
                            font: { size: 11 }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Free Induction Decay (FID)',
                        color: '#f1f5f9',
                        font: { size: 14, weight: 'bold' }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: '#475569',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time (s)',
                            color: '#94a3b8'
                        },
                        ticks: { color: '#64748b', maxTicksLimit: 8 },
                        grid: { color: 'rgba(71, 85, 105, 0.3)' }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Signal (a.u.)',
                            color: '#94a3b8'
                        },
                        ticks: { color: '#64748b' },
                        grid: { color: 'rgba(71, 85, 105, 0.3)' }
                    }
                }
            }
        });
    }

    initSpectrumChart(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        this.spectrumChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Spectrum',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: '¹H NMR Spectrum',
                        color: '#f1f5f9',
                        font: { size: 14, weight: 'bold' }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: '#475569',
                        borderWidth: 1,
                        callbacks: {
                            title: (items) => {
                                if (items.length > 0) {
                                    return `δ = ${parseFloat(items[0].label).toFixed(2)} ppm`;
                                }
                                return '';
                            },
                            label: (ctx) => {
                                return `Intensity: ${ctx.raw.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        reverse: true, // NMR convention: high ppm on left
                        title: {
                            display: true,
                            text: 'Chemical Shift (δ ppm)',
                            color: '#94a3b8'
                        },
                        ticks: {
                            color: '#64748b',
                            maxTicksLimit: 12,
                            callback: function (value) {
                                return parseFloat(this.getLabelForValue(value)).toFixed(1);
                            }
                        },
                        grid: { color: 'rgba(71, 85, 105, 0.3)' }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Intensity',
                            color: '#94a3b8'
                        },
                        ticks: { color: '#64748b' },
                        grid: { color: 'rgba(71, 85, 105, 0.3)' },
                        min: 0
                    }
                }
            },
            plugins: [{
                id: 'peakLabels',
                afterDraw: (chart) => {
                    if (!this.samplePeaks || this.samplePeaks.length === 0) return;

                    const ctx = chart.ctx;
                    const xAxis = chart.scales.x;
                    const yAxis = chart.scales.y;
                    const labels = chart.data.labels;
                    const data = chart.data.datasets[0].data;

                    if (!labels || labels.length === 0) return;

                    ctx.save();

                    // For each sample peak, find if it's visible in current view
                    for (const peak of this.samplePeaks) {
                        const targetPpm = peak.shift;

                        // Find closest data point in current visible labels
                        let closestIdx = -1;
                        let minDiff = Infinity;

                        for (let i = 0; i < labels.length; i++) {
                            const ppm = parseFloat(labels[i]);
                            const diff = Math.abs(ppm - targetPpm);
                            if (diff < minDiff) {
                                minDiff = diff;
                                closestIdx = i;
                            }
                        }

                        // Only draw if peak is visible and close enough
                        if (closestIdx === -1 || minDiff > 0.5) continue;

                        const intensity = data[closestIdx];
                        const maxVal = Math.max(...data);

                        // Skip if intensity is too low (noise) - use 2% threshold
                        if (intensity < maxVal * 0.02) continue;

                        const x = xAxis.getPixelForValue(closestIdx);
                        const y = yAxis.getPixelForValue(intensity);

                        // Check if x is within chart area
                        if (x < xAxis.left || x > xAxis.right) continue;

                        // Draw connecting line
                        ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x, y - 20);
                        ctx.stroke();

                        // Draw label background
                        const labelText = peak.assignment || `δ ${targetPpm.toFixed(2)}`;
                        ctx.font = 'bold 11px Arial';
                        const textWidth = ctx.measureText(labelText).width;
                        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
                        ctx.fillRect(x - textWidth / 2 - 4, y - 40, textWidth + 8, 18);

                        // Draw label border
                        ctx.strokeStyle = '#6366f1';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x - textWidth / 2 - 4, y - 40, textWidth + 8, 18);

                        // Draw label text
                        ctx.fillStyle = '#e2e8f0';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(labelText, x, y - 25);

                        // Draw ppm value below assignment
                        ctx.font = '9px Arial';
                        ctx.fillStyle = '#94a3b8';
                        ctx.fillText(`δ ${targetPpm.toFixed(2)}`, x, y - 8);
                    }

                    ctx.restore();
                }
            }]
        });

        // Add zoom/pan event listeners
        this.setupSpectrumInteraction(canvas);
    }

    setupSpectrumInteraction(canvas) {
        // Set cursor style
        canvas.style.cursor = 'grab';

        // Mouse Wheel Zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
            this.spectrumZoom = Math.max(1.0, Math.min(20, this.spectrumZoom * zoomFactor));
            this.applySpectrumZoom();
        }, { passive: false });

        // Interaction Handlers
        const handleDragStart = (x) => {
            this.isDragging = true;
            this.lastMouseX = x;
            canvas.style.cursor = 'grabbing';
        };

        const handleDragMove = (x) => {
            if (this.isDragging && this.fullSpectrumLabels) {
                const deltaX = x - this.lastMouseX;
                // Pan speed relative to zoom level and data length
                const panSpeed = this.fullSpectrumLabels.length / (this.spectrumZoom * 500);
                this.spectrumPanX += deltaX * panSpeed; // Paper Drag Direction (Standard)
                this.lastMouseX = x;
                this.applySpectrumZoom();
            }
        };

        const handleDragEnd = () => {
            this.isDragging = false;
            canvas.style.cursor = 'grab';
        };

        // Mouse Events
        canvas.addEventListener('mousedown', e => handleDragStart(e.clientX));
        canvas.addEventListener('mousemove', e => handleDragMove(e.clientX));
        canvas.addEventListener('mouseup', handleDragEnd);
        canvas.addEventListener('mouseleave', handleDragEnd);

        // Touch Events
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                handleDragStart(e.touches[0].clientX);
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                handleDragMove(e.touches[0].clientX);
            }
        }, { passive: false });

        canvas.addEventListener('touchend', handleDragEnd);
    }

    applySpectrumZoom() {
        if (!this.spectrumChart || !this.fullSpectrumLabels || this.fullSpectrumLabels.length === 0) return;

        const totalPoints = this.fullSpectrumLabels.length;
        const visiblePoints = Math.floor(totalPoints / this.spectrumZoom);

        // Calculate center with pan offset
        let centerIdx = Math.floor(totalPoints / 2) + Math.round(this.spectrumPanX);

        // Clamp center to valid range
        const halfVisible = Math.floor(visiblePoints / 2);
        centerIdx = Math.max(halfVisible, Math.min(totalPoints - halfVisible - 1, centerIdx));

        let minIdx = Math.max(0, centerIdx - halfVisible);
        let maxIdx = Math.min(totalPoints - 1, centerIdx + halfVisible);

        // Ensure we show at least some data
        if (maxIdx - minIdx < 10) {
            minIdx = Math.max(0, centerIdx - 5);
            maxIdx = Math.min(totalPoints - 1, centerIdx + 5);
        }

        // Slice the data for display
        const labels = this.fullSpectrumLabels.slice(minIdx, maxIdx + 1);
        const data = this.fullSpectrumData.slice(minIdx, maxIdx + 1);

        this.spectrumChart.data.labels = labels;
        this.spectrumChart.data.datasets[0].data = data;
        this.spectrumChart.update('none');
    }

    resetZoom() {
        // Reset to default standard view (~0-12 ppm) but keep margins for panning
        this.focusOnPpm(5.0, 1.5);
    }

    updateFID(fidData) {
        if (!this.fidChart || !fidData) return;

        this.fidData = fidData;

        // Downsample for display
        const maxPoints = 500;
        const step = Math.max(1, Math.floor(fidData.numPoints / maxPoints));

        const labels = [];
        const realData = [];
        const imagData = [];

        for (let i = 0; i < fidData.numPoints; i += step) {
            labels.push(fidData.time[i].toFixed(4));
            realData.push(fidData.real[i]);
            imagData.push(fidData.imag[i]);
        }

        this.fidChart.data.labels = labels;
        this.fidChart.data.datasets[0].data = realData;
        this.fidChart.data.datasets[1].data = imagData;
        this.fidChart.update('none');
    }

    updateSpectrum(spectrumData, larmorMHz, samplePeaks = []) {
        if (!this.spectrumChart || !spectrumData) return;

        // Store sample peaks for labeling
        this.samplePeaks = samplePeaks;

        // Convert frequency to ppm
        const { magnitude, frequencies, numPoints } = spectrumData;

        // Calculate ppm values from frequencies
        const ppmValues = frequencies.map(f => f / larmorMHz);

        // Define wider display range to allow panning (-5 to 20 ppm)
        const minDisplayPpm = -5.0;
        const maxDisplayPpm = 20.0;

        // Collect all points within valid ppm range
        const validPoints = [];
        for (let i = 0; i < numPoints; i++) {
            const ppm = ppmValues[i];
            if (ppm >= minDisplayPpm && ppm <= maxDisplayPpm) {
                validPoints.push({
                    ppm: ppm,
                    magnitude: magnitude[i],
                    index: i
                });
            }
        }

        // Sort by ppm (ascending, so reverse for NMR display)
        validPoints.sort((a, b) => a.ppm - b.ppm);

        // Use all available points to prevent peak loss (downsampling causes narrow peaks to disappear)
        const labels = validPoints.map(p => p.ppm.toFixed(3));
        const data = validPoints.map(p => p.magnitude);

        // If no data, show empty state
        if (labels.length === 0) {
            console.warn('No spectrum data in valid ppm range');
            return;
        }

        // Store full data for zoom functionality
        this.fullSpectrumLabels = labels.slice();
        this.fullSpectrumData = data.slice();

        // Store data range info
        this.spectrumData = {
            minPpm: validPoints[0]?.ppm || 0,
            maxPpm: validPoints[validPoints.length - 1]?.ppm || 10,
            ppmRange: maxDisplayPpm - minDisplayPpm
        };

        this.spectrumChart.data.labels = labels;
        this.spectrumChart.data.datasets[0].data = data;

        // Add peak labels as annotations using a custom plugin
        this.addPeakLabels(labels, data, samplePeaks);

        this.spectrumChart.update('none');

        // Store peak results from sample peaks
        this.peakResults = samplePeaks.map(p => ({
            ppm: p.shift,
            intensity: p.intensity,
            assignment: p.assignment
        }));

        // Update peak info display
        this.updatePeakInfoDisplay(samplePeaks);
    }

    addPeakLabels(labels, data, samplePeaks) {
        if (!samplePeaks || samplePeaks.length === 0) return;

        // Create point annotations for peaks
        const annotations = [];
        const labelDataset = {
            label: 'Peak Labels',
            data: [],
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            pointRadius: 0,
            showLine: false
        };

        // Find local maxima in data that correspond to sample peaks
        const maxVal = Math.max(...data);

        for (const peak of samplePeaks) {
            const targetPpm = peak.shift;

            // Find closest data point to this ppm value
            let closestIdx = 0;
            let minDiff = Infinity;

            for (let i = 0; i < labels.length; i++) {
                const ppm = parseFloat(labels[i]);
                const diff = Math.abs(ppm - targetPpm);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIdx = i;
                }
            }

            // Only label if we found a close match and the data value is significant
            if (minDiff < 0.5 && data[closestIdx] > maxVal * 0.05) {
                annotations.push({
                    ppm: targetPpm.toFixed(2),
                    assignment: peak.assignment || `δ ${targetPpm.toFixed(2)}`,
                    dataIndex: closestIdx,
                    intensity: data[closestIdx]
                });
            }
        }

        // Store annotations for the custom draw plugin
        this.peakAnnotations = annotations;
    }

    updatePeakInfoDisplay(samplePeaks) {
        const peakInfo = document.getElementById('peakInfo');
        if (!peakInfo) return;

        if (!samplePeaks || samplePeaks.length === 0) {
            peakInfo.innerHTML = '<span>No peaks detected</span>';
            return;
        }

        let html = '<div class="peak-label-legend"><strong>Click Peak to Focus:</strong><div class="peak-list">';
        for (let i = 0; i < samplePeaks.length; i++) {
            const peak = samplePeaks[i];
            const assignment = peak.assignment || 'Unknown';
            const shift = peak.shift.toFixed(2);
            html += `<span class="peak-tag clickable" data-ppm="${peak.shift}" data-index="${i}">δ ${shift}: ${assignment}</span>`;
        }
        html += '</div></div>';
        peakInfo.innerHTML = html;

        // Add click handlers for peak focusing
        const peakTags = peakInfo.querySelectorAll('.peak-tag.clickable');
        peakTags.forEach(tag => {
            tag.addEventListener('click', () => {
                const ppm = parseFloat(tag.dataset.ppm);
                this.focusOnPpm(ppm);
            });
        });
    }

    // Focus the spectrum view on a specific ppm value
    focusOnPpm(targetPpm, zoomLevel = 5.0) {
        if (!this.fullSpectrumLabels || this.fullSpectrumLabels.length === 0) return;

        // Find the index corresponding to this ppm
        let targetIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < this.fullSpectrumLabels.length; i++) {
            const ppm = parseFloat(this.fullSpectrumLabels[i]);
            const diff = Math.abs(ppm - targetPpm);
            if (diff < minDiff) {
                minDiff = diff;
                targetIdx = i;
            }
        }

        // Set zoom level
        this.spectrumZoom = zoomLevel;

        // Calculate pan offset to center on target (PanX = Target - Center)
        const centerIdx = Math.floor(this.fullSpectrumLabels.length / 2);
        this.spectrumPanX = targetIdx - centerIdx;

        this.applySpectrumZoom();
    }

    detectPeaks(magnitude, ppmValues, startIdx, endIdx, threshold) {
        const peaks = [];
        const windowSize = 5;

        for (let i = startIdx + windowSize; i < endIdx - windowSize; i++) {
            if (magnitude[i] < threshold) continue;

            // Check if local maximum
            let isMax = true;
            for (let j = -windowSize; j <= windowSize; j++) {
                if (j !== 0 && magnitude[i + j] >= magnitude[i]) {
                    isMax = false;
                    break;
                }
            }

            if (isMax) {
                peaks.push({
                    ppm: ppmValues[i],
                    intensity: magnitude[i],
                    index: i
                });
            }
        }

        // Sort by intensity
        peaks.sort((a, b) => b.intensity - a.intensity);

        return peaks.slice(0, 20); // Top 20 peaks
    }

    getDetectedPeaks() {
        return this.peakResults;
    }

    exportData(format = 'csv') {
        if (!this.spectrumData || !this.spectrumChart) {
            console.warn('No spectrum data to export');
            return '';
        }

        const labels = this.spectrumChart.data.labels;
        const data = this.spectrumChart.data.datasets[0].data;

        if (format === 'csv') {
            let csv = 'Chemical Shift (ppm),Intensity\n';
            for (let i = 0; i < labels.length; i++) {
                csv += `${labels[i]},${data[i]}\n`;
            }
            return csv;
        }

        return JSON.stringify({ ppm: labels, intensity: data });
    }

    downloadCSV(filename = 'nmr_spectrum.csv') {
        const csv = this.exportData('csv');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    clear() {
        if (this.fidChart) {
            this.fidChart.data.labels = [];
            this.fidChart.data.datasets[0].data = [];
            this.fidChart.data.datasets[1].data = [];
            this.fidChart.update('none');
        }

        if (this.spectrumChart) {
            this.spectrumChart.data.labels = [];
            this.spectrumChart.data.datasets[0].data = [];
            this.spectrumChart.update('none');
        }

        this.fidData = null;
        this.spectrumData = null;
        this.peakResults = [];
        this.peakAnnotations = [];
        this.fullSpectrumLabels = null;
        this.fullSpectrumData = null;
        this.resetZoom();

        // Clear peak info display
        const peakInfo = document.getElementById('peakInfo');
        if (peakInfo) {
            peakInfo.innerHTML = '<span>Click "Run Experiment" to generate spectrum</span>';
        }
    }

    applyTheme() {
        const c = window.QubibyteTheme?.getChartColors?.();
        if (!c) return;

        const applyToChart = (chart) => {
            if (!chart?.options) return;
            const o = chart.options;
            if (o.plugins?.legend?.labels) o.plugins.legend.labels.color = c.legend;
            if (o.plugins?.title) o.plugins.title.color = c.title;
            if (o.plugins?.tooltip) {
                o.plugins.tooltip.backgroundColor = c.tooltipBg;
                o.plugins.tooltip.titleColor = c.tooltipTitle;
                o.plugins.tooltip.bodyColor = c.tooltipBody;
                o.plugins.tooltip.borderColor = c.tooltipBorder;
            }
            const scales = o.scales || {};
            for (const key of Object.keys(scales)) {
                const axis = scales[key];
                if (axis?.title) axis.title.color = c.legend;
                if (axis?.ticks) axis.ticks.color = c.tick;
                if (axis?.grid) axis.grid.color = c.grid;
            }
            chart.update('none');
        };

        applyToChart(this.fidChart);
        applyToChart(this.spectrumChart);
    }

    dispose() {
        if (this.fidChart) {
            this.fidChart.destroy();
            this.fidChart = null;
        }
        if (this.spectrumChart) {
            this.spectrumChart.destroy();
            this.spectrumChart = null;
        }
    }
}

// Export
window.SpectrumVisualization = SpectrumVisualization;

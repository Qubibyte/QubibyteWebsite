// Probability Graph Visualizations

class ProbabilityGraphs {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentView = 'pie'; // Default to pie chart
        this.settings = { precision: 2, hideNegligibles: true, sortBy: 'probability', sortOrder: 'desc' };
        this.lastProbabilities = null;
        
        // Bar chart drag selection state
        this.isDragging = false;
        this.dragStartIndex = null;
        this.dragEndIndex = null;
        this.barElements = [];
        this.sortedData = [];
        
        if (!this.container) {
            console.warn(`ProbabilityGraphs: Container ${containerId} not found`);
        }
    }

    setSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }

    update(quantumState, settings = null) {
        if (settings) this.setSettings(settings);
        if (!quantumState || !this.container) return;
        
        const probabilities = quantumState.getAllProbabilities();
        this.lastProbabilities = probabilities;
        this.render(probabilities);
    }

    render(probabilities) {
        if (!this.container) return;
        
        this.container.innerHTML = '';
        
        // View tabs at top (exactly like measurement results/state vector)
        const tabs = document.createElement('div');
        tabs.className = 'viz-tabs';
        tabs.innerHTML = `
            <button class="viz-tab-btn ${this.currentView === 'bar' ? 'active' : ''}" data-view="bar">Bar Chart</button>
            <button class="viz-tab-btn ${this.currentView === 'pie' ? 'active' : ''}" data-view="pie">Pie Chart</button>
        `;
        
        tabs.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentView = e.target.dataset.view;
                tabs.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.render(probabilities);
            });
        });
        
        this.container.appendChild(tabs);
        
        // Panel container (exactly like viz-panel structure - NO inline styles, use CSS class)
        const panel = document.createElement('div');
        panel.className = 'viz-panel active';
        
        // Maximize button
        const maximizeBtn = document.createElement('button');
        maximizeBtn.className = 'btn btn-small';
        maximizeBtn.style.cssText = 'position: absolute; top: 1rem; right: 1rem; z-index: 10; padding: 0.25rem 0.5rem; font-size: 0.75rem;';
        maximizeBtn.innerHTML = '⛶';
        maximizeBtn.title = 'Maximize';
        maximizeBtn.addEventListener('click', () => this.showMaximizedChart(probabilities));
        panel.appendChild(maximizeBtn);
        
        // Graph container
        const graphContainer = document.createElement('div');
        graphContainer.className = 'graph-container';
        graphContainer.style.cssText = 'flex: 1; min-height: 0;';
        
        if (this.currentView === 'bar') {
            this.renderBarChart(graphContainer, probabilities, true); // true = scaled down
        } else if (this.currentView === 'pie') {
            this.renderPieChart(graphContainer, probabilities, true); // true = scaled down
        }
        
        panel.appendChild(graphContainer);
        this.container.appendChild(panel);
    }

    getFilteredSorted(probabilities) {
        const precision = this.settings.precision;
        const hideNegligibles = this.settings.hideNegligibles;
        const threshold = hideNegligibles ? Math.pow(10, -(precision + 2)) : 1e-10;
        const sortBy = this.settings.sortBy || 'probability';
        const sortOrder = this.settings.sortOrder || 'desc';
        
        let filtered = Object.entries(probabilities)
            .filter(([_, prob]) => prob >= threshold);
        
        if (sortBy === 'label') {
            filtered.sort((a, b) => {
                const cmp = parseInt(a[0], 2) - parseInt(b[0], 2);
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        } else {
            filtered.sort((a, b) => {
                const cmp = a[1] - b[1];
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        }
        
        return filtered;
    }

    showMaximizedChart(probabilities) {
        // Create modal for maximized chart
        const modal = document.createElement('div');
        modal.className = 'chart-maximize-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--surface);
            border: 1px solid var(--border-color);
            border-radius: 0.75rem;
            padding: 2rem;
            max-width: 90vw;
            max-height: 90vh;
            overflow: auto;
            position: relative;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn btn-small';
        closeBtn.style.cssText = 'position: absolute; top: 1rem; right: 1rem; z-index: 10;';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => modal.remove());
        
        const graphContainer = document.createElement('div');
        graphContainer.className = 'graph-container';
        graphContainer.style.cssText = 'min-width: 600px; min-height: 400px;';
        
        if (this.currentView === 'bar') {
            this.renderBarChart(graphContainer, probabilities, false); // false = full size
        } else if (this.currentView === 'pie') {
            this.renderPieChart(graphContainer, probabilities, false); // false = full size
        }
        
        content.appendChild(closeBtn);
        content.appendChild(graphContainer);
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    renderBarChart(container, probabilities, scaledDown = false) {
        const precision = this.settings.precision;
        container.innerHTML = '';
        
        const sorted = this.getFilteredSorted(probabilities);
        this.sortedData = sorted;
        this.barElements = [];
        this.dragStartIndex = null;
        this.dragEndIndex = null;
        
        if (sorted.length === 0) {
            container.innerHTML += '<p class="placeholder">No significant probabilities</p>';
            return;
        }
        
        const maxProb = Math.max(...sorted.map(([_, p]) => p));
        
        // Create chart wrapper
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'bar-chart-wrapper';
        chartWrapper.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-top: ${scaledDown ? '0.5rem' : '1rem'};
            user-select: none;
        `;
        
        // Horizontal bar container with vertical bars
        const barsContainer = document.createElement('div');
        barsContainer.className = 'bars-container';
        const chartHeight = scaledDown ? '120px' : '200px';
        barsContainer.style.cssText = `
            display: flex;
            align-items: flex-end;
            gap: 2px;
            height: ${chartHeight};
            padding: 0 4px;
            background: var(--surface-light);
            border-radius: 8px;
            position: relative;
            width: 100%;
            box-sizing: border-box;
            overflow-x: hidden;
        `;
        
        
        // Tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'bar-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: var(--surface);
            border: 1px solid var(--primary-color);
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 0.875rem;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s ease;
            z-index: 1000;
            box-shadow: 0 4px 12px var(--shadow);
        `;
        document.body.appendChild(tooltip);
        
        // Selection info display
        const selectionInfo = document.createElement('div');
        selectionInfo.className = 'selection-info';
        selectionInfo.style.cssText = `
            text-align: center;
            font-size: 0.875rem;
            color: var(--text-secondary);
            padding: 8px;
            background: var(--surface-light);
            border-radius: 6px;
            margin-top: 8px;
            min-height: 24px;
            display: none;
        `;
        
        // Color palette for bars
        const colors = [
            '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
            '#10b981', '#3b82f6', '#ef4444', '#06b6d4',
            '#84cc16', '#f97316', '#a855f7', '#14b8a6'
        ];
        
        sorted.forEach(([state, prob], index) => {
            const barWrapper = document.createElement('div');
            barWrapper.className = 'bar-wrapper';
            barWrapper.style.cssText = `
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-end;
                height: 100%;
                flex: 1 1 0;
                min-width: 0;
                max-width: 100%;
                cursor: pointer;
                position: relative;
            `;
            barWrapper.dataset.index = index;
            barWrapper.dataset.state = state;
            barWrapper.dataset.prob = prob;
            
            const bar = document.createElement('div');
            bar.className = 'probability-bar-vertical';
            const heightPercent = (prob / maxProb) * 100;
            bar.style.cssText = `
                width: 100%;
                height: ${heightPercent}%;
                min-height: 2px;
                background: linear-gradient(to top, ${colors[index % colors.length]}, ${colors[(index + 1) % colors.length]});
                border-radius: 4px 4px 0 0;
                transition: all 0.2s ease;
            `;
            
            barWrapper.appendChild(bar);
            barsContainer.appendChild(barWrapper);
            this.barElements.push(barWrapper);
            
            // Hover events
            barWrapper.addEventListener('mouseenter', (e) => {
                if (!this.isDragging) {
                    bar.style.transform = 'scaleX(1.1)';
                    bar.style.boxShadow = '0 0 10px ' + colors[index % colors.length];
                    tooltip.innerHTML = `<strong>|${state}⟩</strong><br>${(prob * 100).toFixed(precision)}%`;
                    tooltip.style.opacity = '1';
                }
            });
            
            barWrapper.addEventListener('mousemove', (e) => {
                if (!this.isDragging) {
                    tooltip.style.left = (e.clientX + 10) + 'px';
                    tooltip.style.top = (e.clientY - 40) + 'px';
                }
            });
            
            barWrapper.addEventListener('mouseleave', () => {
                bar.style.transform = '';
                bar.style.boxShadow = '';
                tooltip.style.opacity = '0';
            });
            
            // Click to select single bar
            barWrapper.addEventListener('click', (e) => {
                e.stopPropagation();
                
                if (e.shiftKey && this.dragStartIndex !== null) {
                    // Shift+click: extend selection to this bar
                    this.dragEndIndex = index;
                    this.updateBarSelection();
                    this.showSelectionInfo(selectionInfo, precision);
                } else {
                    // Regular click: select just this bar
                    this.dragStartIndex = index;
                    this.dragEndIndex = index;
                    this.updateBarSelection();
                    this.showSelectionInfo(selectionInfo, precision);
                }
                tooltip.style.opacity = '0';
            });
        });
        
        // Click anywhere else to clear selection
        chartWrapper.addEventListener('click', (e) => {
            // Only clear if clicking on the wrapper/container itself, not on a bar
            if (e.target === chartWrapper || e.target === barsContainer || e.target === selectionInfo) {
                this.clearBarSelection();
                selectionInfo.style.display = 'none';
            }
        });
        
        // Clear selection when clicking outside the chart
        const handleClickOutside = (e) => {
            if (!chartWrapper.contains(e.target)) {
                this.clearBarSelection();
                selectionInfo.style.display = 'none';
            }
        };
        
        // Use capture phase to catch clicks before they're handled
        document.addEventListener('click', handleClickOutside, true);
        
        // Also clear on window blur (user switches to another app/window)
        const handleWindowBlur = () => {
            this.clearBarSelection();
            selectionInfo.style.display = 'none';
        };
        
        window.addEventListener('blur', handleWindowBlur);
        
        chartWrapper.appendChild(barsContainer);
        chartWrapper.appendChild(selectionInfo);
        container.appendChild(chartWrapper);
        
        // Clean up tooltip and event listeners on container removal
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.removedNodes.length > 0) {
                    mutation.removedNodes.forEach((node) => {
                        if (node.contains && node.contains(chartWrapper)) {
                            tooltip.remove();
                            document.removeEventListener('click', handleClickOutside, true);
                            window.removeEventListener('blur', handleWindowBlur);
                        }
                    });
                }
            });
        });
        observer.observe(this.container.parentNode || document.body, { childList: true, subtree: true });
        
        // Show count info
        if (sorted.length > 0) {
            const totalStates = Object.keys(probabilities).length;
            if (sorted.length < totalStates) {
                const info = document.createElement('div');
                info.style.cssText = 'font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem; text-align: center;';
                info.textContent = `Showing ${sorted.length} of ${totalStates} states`;
                container.appendChild(info);
            }
        }
        
        // Hint text
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.5rem; text-align: center; font-style: italic;';
        hint.textContent = 'Hover for details • Click to select • Shift+Click for range';
        container.appendChild(hint);
    }
    
    updateBarSelection() {
        const startIdx = Math.min(this.dragStartIndex, this.dragEndIndex);
        const endIdx = Math.max(this.dragStartIndex, this.dragEndIndex);
        
        this.barElements.forEach((wrapper, idx) => {
            const bar = wrapper.querySelector('.probability-bar-vertical');
            if (idx >= startIdx && idx <= endIdx) {
                wrapper.classList.add('selected');
                bar.style.opacity = '1';
                bar.style.filter = 'brightness(1.2)';
            } else {
                wrapper.classList.remove('selected');
                bar.style.opacity = '0.4';
                bar.style.filter = '';
            }
        });
    }
    
    clearBarSelection() {
        this.barElements.forEach((wrapper) => {
            const bar = wrapper.querySelector('.probability-bar-vertical');
            wrapper.classList.remove('selected');
            bar.style.opacity = '';
            bar.style.filter = '';
        });
        this.dragStartIndex = null;
        this.dragEndIndex = null;
    }
    
    showSelectionInfo(infoEl, precision) {
        if (this.dragStartIndex === null || this.dragEndIndex === null) {
            infoEl.style.display = 'none';
            return;
        }
        
        const startIdx = Math.min(this.dragStartIndex, this.dragEndIndex);
        const endIdx = Math.max(this.dragStartIndex, this.dragEndIndex);
        
        // Calculate aggregated probability
        let totalProb = 0;
        const selectedStates = [];
        for (let i = startIdx; i <= endIdx; i++) {
            const [state, prob] = this.sortedData[i];
            totalProb += prob;
            selectedStates.push(state);
        }
        
        const count = endIdx - startIdx + 1;
        let stateRange;
        if (count === 1) {
            stateRange = `|${selectedStates[0]}⟩`;
        } else {
            stateRange = `|${selectedStates[0]}⟩ to |${selectedStates[selectedStates.length - 1]}⟩`;
        }
        
        infoEl.innerHTML = `<strong>${count} state${count > 1 ? 's' : ''}</strong> selected (${stateRange}): <strong>${(totalProb * 100).toFixed(precision)}%</strong> total`;
        infoEl.style.display = 'block';
    }

    renderPieChart(container, probabilities, scaledDown = false) {
        const precision = this.settings.precision;
        container.innerHTML = '';
        
        const sorted = this.getFilteredSorted(probabilities);
        
        if (sorted.length === 0) {
            container.innerHTML += '<p class="placeholder">No significant probabilities</p>';
            return;
        }
        
        const canvas = document.createElement('canvas');
        const size = scaledDown ? 180 : 300;
        canvas.width = size;
        canvas.height = size;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.margin = scaledDown ? '0.5rem auto' : '1rem auto';
        canvas.style.display = 'block';
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = scaledDown ? 60 : 100;
        
        let currentAngle = -Math.PI / 2;
        const colors = [
            '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
            '#10b981', '#3b82f6', '#ef4444', '#06b6d4'
        ];
        
        sorted.forEach(([state, prob], index) => {
            const sliceAngle = prob * 2 * Math.PI;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = colors[index % colors.length];
            ctx.fill();
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Label (only show if slice is big enough)
            if (sliceAngle > 0.2) {
                const labelAngle = currentAngle + sliceAngle / 2;
                const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
                const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
                
                ctx.fillStyle = 'white';
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`|${state}⟩`, labelX, labelY);
            }
            
            currentAngle += sliceAngle;
        });
        
        container.appendChild(canvas);
        
        // Legend with scrolling
        const legendContainer = document.createElement('div');
        legendContainer.style.maxHeight = scaledDown ? '80px' : '120px';
        legendContainer.style.overflowY = 'auto';
        legendContainer.style.marginTop = scaledDown ? '0.5rem' : '1rem';
        
        const legend = document.createElement('div');
        legend.style.display = 'flex';
        legend.style.flexWrap = 'wrap';
        legend.style.gap = '0.75rem';
        legend.style.justifyContent = 'center';
        
        sorted.forEach(([state, prob], index) => {
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.gap = '0.5rem';
            legendItem.style.fontSize = '0.875rem';
            
            const colorBox = document.createElement('div');
            colorBox.style.width = '16px';
            colorBox.style.height = '16px';
            colorBox.style.background = colors[index % colors.length];
            colorBox.style.borderRadius = '2px';
            colorBox.style.flexShrink = '0';
            
            const label = document.createElement('span');
            label.textContent = `|${state}⟩: ${(prob * 100).toFixed(precision)}%`;
            
            legendItem.appendChild(colorBox);
            legendItem.appendChild(label);
            legend.appendChild(legendItem);
        });
        
        legendContainer.appendChild(legend);
        container.appendChild(legendContainer);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProbabilityGraphs };
}

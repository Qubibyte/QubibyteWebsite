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
        
        this.qubiExecutor = new QubiExecutor(this.circuit);
        this.selectedGate = null;
        this.draggedGate = null;
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
        
        // Bidirectional sync state
        this.isUpdatingFromCircuit = false;
        this.isUpdatingFromCode = false;
        this.codeChangeDebounceTimer = null;
        this.codeChangeDebounceDelay = 500; // ms to wait before syncing code changes to circuit
        
        this.initializeEventListeners();
        this.updateQubitInputMax();
        this.renderCircuit();
        this.updateVisualization();
        
        // Initialize error state
        this.updateErrorState();
    }

    updateQubitInputMax() {
        // No longer needed since we're using text input, but keeping for compatibility
        // The validation happens in setQubitCount
    }

    initializeEventListeners() {
        // Gate palette drag and drop
        document.querySelectorAll('.gate-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggedGate = e.target.dataset.gate;
                e.dataTransfer.effectAllowed = 'copy';
            });
        });

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
                const maxQubits = settings.maxQubits || 10;
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
            if (savedState === 'true') {
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
                this.syntaxHighlighter.setCode('');
            } else {
                document.getElementById('qubiCode').value = '';
            }
            this.circuit.clear();
            this.renderCircuit();
            this.updateVisualization();
            this.isUpdatingFromCircuit = false;
        });
        
        // Qubi file save/load
        document.getElementById('saveQubiFileBtn').addEventListener('click', () => this.saveQubiFile());
        document.getElementById('loadQubiFileBtn').addEventListener('click', () => {
            document.getElementById('qubiFileInput').click();
        });
        document.getElementById('qubiFileInput').addEventListener('change', (e) => this.loadQubiFile(e));

        // Algorithms
        document.getElementById('algorithmsBtn').addEventListener('click', () => this.showAlgorithmsModal());
        document.getElementById('closeAlgorithmsBtn').addEventListener('click', () => {
            document.getElementById('algorithmsModal').classList.remove('active');
            document.getElementById('algorithmParams').style.display = 'none';
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

        // Click on gate slots
        document.getElementById('circuitCanvas').addEventListener('click', (e) => {
            if (e.target.classList.contains('gate-on-wire') || e.target.closest('.gate-on-wire')) {
                const gateEl = e.target.classList.contains('gate-on-wire') ? e.target : e.target.closest('.gate-on-wire');
                this.editGate(gateEl);
            } else if (this.selectedGate && e.target.classList.contains('gate-slot')) {
                this.placeGateOnSlot(e.target);
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
        
        // Add click handlers
        block.addEventListener('click', (e) => {
            e.stopPropagation();
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

        gateEl.textContent = symbols[type] || type;
        gateEl.title = `Click to edit, right-click to delete`;
        gateEl.style.position = 'relative';
        
        // Add gate family class for coloring
        if (gateFamily[type]) {
            gateEl.classList.add(gateFamily[type]);
        }

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

        // Single qubit gate
        this.circuit.addGate(type, qubit, column);
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
        } else {
            this.circuit.removeGate(qubit, column);
        }
        
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
        const maxQubits = settings.maxQubits || 10;
        
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
        const maxQubits = settings.maxQubits || 10;
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
        if (!this.circuit || !this.circuit.state) return;
        
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
            this.qubiExecutor.execute(code);
            
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
            errorEl.textContent = `Error: ${error.message}`;
            errorEl.classList.add('has-error');
            this.updateErrorState();
        } finally {
            this.isUpdatingFromCode = false;
        }
    }
    
    syncCircuitToCode() {
        if (this.isUpdatingFromCode) return; // Prevent circular updates
        
        const existingCode = document.getElementById('qubiCode').value;
        const code = this.qubiExecutor.generateCode(this.circuit, existingCode);
        
        this.isUpdatingFromCircuit = true;
        if (this.syntaxHighlighter) {
            this.syntaxHighlighter.setCode(code);
        } else {
            document.getElementById('qubiCode').value = code;
        }
        this.isUpdatingFromCircuit = false;
        
        // Update error state after code update
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
    }

    async saveQubiFile() {
        const code = document.getElementById('qubiCode').value;
        if (!code.trim()) {
            return;
        }
        
        // Try using the File System Access API for save dialog
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'circuit.qubi',
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
            a.download = 'circuit.qubi';
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
            const code = e.target.result;
            this.isUpdatingFromCircuit = true;
            if (this.syntaxHighlighter) {
                this.syntaxHighlighter.setCode(code);
            } else {
                document.getElementById('qubiCode').value = code;
            }
            this.isUpdatingFromCircuit = false;
            
            // Sync code to circuit
            this.syncCodeToCircuit();
            
            // Clear any previous errors
            const errorEl = document.getElementById('qubiErrors');
            errorEl.textContent = '';
            errorEl.classList.remove('has-error');
        };
        reader.onerror = () => {
            alert('Error reading file. Please try again.');
        };
        reader.readAsText(file);
        
        // Reset the input so the same file can be loaded again
        event.target.value = '';
    }

    showAlgorithmsModal() {
        const modal = document.getElementById('algorithmsModal');
        const list = document.getElementById('algorithmsList');
        const paramsDiv = document.getElementById('algorithmParams');
        const commentsCheckbox = document.getElementById('includeCommentsCheckbox');
        
        list.innerHTML = '';
        paramsDiv.style.display = 'none';
        if (commentsCheckbox) commentsCheckbox.checked = false; // Default unchecked

        Object.entries(QuantumAlgorithms).forEach(([key, algo]) => {
            const item = document.createElement('div');
            item.className = 'algorithm-item';
            item.innerHTML = `
                <h4>${algo.name}</h4>
                <p>${algo.description}</p>
            `;
            item.addEventListener('click', () => {
                if (algo.parameterizable && algo.parameters) {
                    this.showAlgorithmParams(algo);
                } else {
                    this.loadAlgorithm(algo);
                    modal.classList.remove('active');
                }
            });
            list.appendChild(item);
        });

        modal.classList.add('active');
    }

    showAlgorithmParams(algo) {
        const paramsDiv = document.getElementById('algorithmParams');
        const inputsDiv = document.getElementById('algorithmParamInputs');
        const settings = this.getSettings();
        const maxQubits = settings.maxQubits || 10;
        inputsDiv.innerHTML = '';
        
        algo.parameters.forEach(param => {
            // For qubit-related parameters, respect the max qubits setting
            let effectiveMax = param.max;
            if (param.key === 'numQubits' || param.key === 'numInputs') {
                effectiveMax = Math.min(param.max || maxQubits, maxQubits);
            }
            
            const group = document.createElement('div');
            group.className = 'parameter-group';
            group.innerHTML = `
                <label for="param_${param.key}">${param.name}:</label>
                <input type="${param.type}" id="param_${param.key}" 
                       value="${Math.min(param.default, effectiveMax || param.default)}" 
                       ${param.min !== undefined ? `min="${param.min}"` : ''}
                       ${effectiveMax !== undefined ? `max="${effectiveMax}"` : ''}
                       class="input-number">
            `;
            inputsDiv.appendChild(group);
        });
        
        paramsDiv.style.display = 'block';
        paramsDiv.dataset.algorithmKey = Object.keys(QuantumAlgorithms).find(k => QuantumAlgorithms[k] === algo);
    }

    confirmAlgorithmLoad() {
        const paramsDiv = document.getElementById('algorithmParams');
        const algoKey = paramsDiv.dataset.algorithmKey;
        const algo = QuantumAlgorithms[algoKey];
        const commentsCheckbox = document.getElementById('includeCommentsCheckbox');
        const withComments = commentsCheckbox ? commentsCheckbox.checked : false;
        
        const params = {};
        algo.parameters.forEach(param => {
            const input = document.getElementById(`param_${param.key}`);
            if (param.type === 'number') {
                params[param.key] = parseInt(input.value) || param.default;
            } else {
                params[param.key] = input.value || param.default;
            }
        });
        
        const generated = algo.generate(params, withComments);
        this.loadAlgorithm({ code: generated.code, qubits: generated.qubits }, false); // Don't check comments again
        document.getElementById('algorithmsModal').classList.remove('active');
        paramsDiv.style.display = 'none';
    }

    loadAlgorithm(algo, checkComments = true) {
        // Set qubit count
        this.setQubitCount(algo.qubits);
        
        // Determine which code to load
        let codeToLoad = algo.code;
        if (checkComments) {
            const commentsCheckbox = document.getElementById('includeCommentsCheckbox');
            const withComments = commentsCheckbox ? commentsCheckbox.checked : false;
            if (withComments && algo.codeWithComments) {
                codeToLoad = algo.codeWithComments;
            }
        }
        
        // Load into Qubi editor with syntax highlighting
        this.isUpdatingFromCircuit = true;
        if (this.syntaxHighlighter) {
            this.syntaxHighlighter.setCode(codeToLoad);
        } else {
            document.getElementById('qubiCode').value = codeToLoad;
        }
        this.isUpdatingFromCircuit = false;
        
        // Sync code to circuit (this will execute the code)
        this.syncCodeToCircuit();
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
                maxQubits: parsed.maxQubits ?? 10,
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
            maxQubits: 10,
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
            maxQubits: parseInt(document.getElementById('setting_maxQubits').value) || 10,
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
            
            svgContent += `\n    <rect x="${x}" y="${y - gateHeight/2}" width="${gateWidth}" height="${gateHeight}" class="gate-box" fill="${color}" stroke="${color}" stroke-width="2"/>`;
            svgContent += `\n    <text x="${x + gateWidth/2}" y="${y}" class="gate-text">${symbol}</text>`;
            
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
                svgContent += `\n    <line x1="${x + gateWidth/2}" y1="${lineY1}" x2="${x + gateWidth/2}" y2="${lineY2}" stroke="${color}" stroke-width="2"/>`;
                svgContent += `\n    <circle cx="${x + gateWidth/2}" cy="${controlY}" r="8" fill="${color}"/>`;
            });
            
            if (type === 'SWAP' && target !== null && target !== undefined) {
                const targetY = padding + (target * rowHeight) + rowHeight / 2;
                const lineY1 = Math.min(y, targetY);
                const lineY2 = Math.max(y, targetY);
                svgContent += `\n    <line x1="${x + gateWidth/2}" y1="${lineY1}" x2="${x + gateWidth/2}" y2="${lineY2}" stroke="${color}" stroke-width="2"/>`;
                svgContent += `\n    <rect x="${x}" y="${targetY - gateHeight/2}" width="${gateWidth}" height="${gateHeight}" class="gate-box" fill="${color}" stroke="${color}" stroke-width="2"/>`;
                svgContent += `\n    <text x="${x + gateWidth/2}" y="${targetY}" class="gate-text">⇄</text>`;
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
            svgContent += `\n    <text x="${x + gateWidth/2}" y="${blockY + blockHeight/2 - 10}" class="gate-text" font-size="20">${symbol}</text>`;
            if (label) {
                svgContent += `\n    <text x="${x + gateWidth/2}" y="${blockY + blockHeight/2 + 15}" class="gate-text" font-size="12">${label}</text>`;
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


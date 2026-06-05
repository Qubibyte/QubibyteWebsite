// Circuit Management

class QuantumCircuit {
    constructor(numQubits = 2, useOptimizedGates = true) {
        this.numQubits = numQubits;
        this.gates = []; // Array of {type, qubit, target, column, params}
        this.controlFlow = []; // Array of {type: 'REPEAT'|'END', column, params}
        this.useOptimizedGates = useOptimizedGates;
        this.state = new QuantumState(numQubits, useOptimizedGates);
        this.maxColumn = 0;
    }
    
    setOptimization(enabled) {
        this.useOptimizedGates = enabled;
        if (this.state) {
            this.state.setOptimization(enabled);
        }
    }

    addQubit() {
        this.numQubits++;
        this.state = new QuantumState(this.numQubits, this.useOptimizedGates);
        // Shift existing gates if needed
    }

    removeQubit() {
        if (this.numQubits > 1) {
            this.numQubits--;
            this.state = new QuantumState(this.numQubits, this.useOptimizedGates);
            // Remove gates on removed qubit
            this.gates = this.gates.filter(gate => 
                gate.qubit < this.numQubits && 
                (gate.target === undefined || gate.target < this.numQubits)
            );
        }
    }

    addGate(type, qubit, column, target = null, params = {}, multiQubits = null) {
        const gate = {
            type,
            qubit,
            target,
            column,
            params,
            multiQubits
        };
        
        this.gates.push(gate);
        this.maxColumn = Math.max(this.maxColumn, column);
        
        return gate;
    }

    addControlFlow(type, column, params = {}) {
        const cf = {
            type,
            column,
            params
        };
        
        this.controlFlow.push(cf);
        this.maxColumn = Math.max(this.maxColumn, column);
        this.refreshRepeatEndPairings();
        
        return cf;
    }

    removeControlFlow(column) {
        this.controlFlow = this.controlFlow.filter(cf => cf.column !== column);
        this.updateMaxColumn();
        this.refreshRepeatEndPairings();
    }

    /**
     * Pair each END with the innermost unmatched REPEAT before it (by column order).
     * Keeps END labels in sync when blocks are placed out of order or nested.
     */
    refreshRepeatEndPairings() {
        const sorted = [...this.controlFlow].sort((a, b) => a.column - b.column);
        const stack = [];

        for (const cf of this.controlFlow) {
            if (cf.type !== 'END') continue;
            cf.params.matchedRepeatColumn = null;
            cf.params.endingType = null;
            cf.params.endingLabel = '';
        }

        for (const cf of sorted) {
            if (cf.type === 'REPEAT') {
                stack.push(cf);
            } else if (cf.type === 'END') {
                const start = stack.pop();
                if (start) {
                    const count = start.params.count || 2;
                    cf.params.matchedRepeatColumn = start.column;
                    cf.params.endingType = 'REPEAT';
                    cf.params.endingLabel = `REPEAT ${count}`;
                }
            }
        }
    }

    getControlFlowAtColumn(column) {
        return this.controlFlow.find(cf => cf.column === column);
    }

    removeGate(qubit, column) {
        this.gates = this.gates.filter((gate) => {
            if (gate.column !== column) return true;
            const joint = gate.params && gate.params.jointQubits;
            if (Array.isArray(joint) && joint.length > 0) {
                return !joint.includes(qubit);
            }
            return !(gate.qubit === qubit || gate.target === qubit);
        });
        this.updateMaxColumn();
    }

    updateMaxColumn() {
        const gateMax = this.gates.length > 0 
            ? Math.max(...this.gates.map(g => g.column))
            : 0;
        const cfMax = this.controlFlow.length > 0
            ? Math.max(...this.controlFlow.map(cf => cf.column))
            : 0;
        this.maxColumn = Math.max(gateMax, cfMax);
    }

    getGatesAtColumn(column) {
        return this.gates.filter(gate => gate.column === column);
    }

    getGatesOnQubit(qubit) {
        return this.gates.filter((gate) => {
            const joint = gate.params && gate.params.jointQubits;
            if (Array.isArray(joint) && joint.length > 0) {
                return joint.includes(qubit);
            }
            return gate.qubit === qubit || gate.target === qubit;
        });
    }

    /** Gates anchored on a qubit wire (gate.qubit === qubit). */
    getAnchorGatesOnQubit(qubit) {
        return this.gates.filter((gate) => gate.qubit === qubit);
    }

    /** True if this gate is tied to qubit (anchor, control, swap partner, or joint). */
    gateAffectsQubit(gate, qubit) {
        if (gate.qubit === qubit) return true;
        if (gate.target !== null && gate.target !== undefined && gate.target === qubit) return true;
        if (gate.multiQubits && gate.multiQubits.includes(qubit)) return true;
        const joint = gate.params && gate.params.jointQubits;
        return Array.isArray(joint) && joint.includes(qubit);
    }

    /** All qubit indices this gate spans (anchor, target, controls, joint). */
    getQubitsInvolvedInGate(gate) {
        const qs = new Set([gate.qubit]);
        if (gate.target !== null && gate.target !== undefined) {
            qs.add(gate.target);
        }
        if (gate.multiQubits) {
            gate.multiQubits.forEach((q) => qs.add(q));
        }
        const joint = gate.params && gate.params.jointQubits;
        if (Array.isArray(joint)) {
            joint.forEach((q) => qs.add(q));
        }
        return qs;
    }

    gateTouchesQubitSet(gate, qubitSet) {
        for (const q of this.getQubitsInvolvedInGate(gate)) {
            if (qubitSet.has(q)) return true;
        }
        return false;
    }

    /**
     * Wires that must move when inserting on `qubit` at `fromColumn`: start on the
     * insert wire, then expand across any gate at col >= fromColumn that touches them.
     */
    getAffectedQubitsForInsertShift(qubit, fromColumn) {
        const affected = new Set([qubit]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const gate of this.gates) {
                if (gate.column < fromColumn) continue;
                if (!this.gateTouchesQubitSet(gate, affected)) continue;
                for (const q of this.getQubitsInvolvedInGate(gate)) {
                    if (!affected.has(q)) {
                        affected.add(q);
                        changed = true;
                    }
                }
            }
        }
        return affected;
    }

    /** Gates that shift right on insert-with-push. */
    getGatesToShiftForInsert(qubit, fromColumn) {
        // REPEAT/END span every wire — pushing them shifts the whole column timeline.
        if (this.getControlFlowAtColumn(fromColumn)) {
            return this.gates.filter((gate) => gate.column >= fromColumn);
        }
        const affected = this.getAffectedQubitsForInsertShift(qubit, fromColumn);
        return this.gates.filter(
            (gate) => gate.column >= fromColumn && this.gateTouchesQubitSet(gate, affected)
        );
    }

    /** Column positions that block or absorb an insert on this wire. */
    getInsertObstacleColumns(qubit, hoverColumn) {
        const cols = [];
        for (const gate of this.gates) {
            if (this.gateAffectsQubit(gate, qubit)) {
                cols.push(gate.column);
            }
        }
        for (const cf of this.controlFlow) {
            cols.push(cf.column);
        }
        return [...new Set(cols)].filter((c) => c >= hoverColumn).sort((a, b) => a - b);
    }

    /**
     * Whether inserting at hoverColumn should push correlated gates / REPEAT|END forward.
     * Only when dropping on the same column as an existing obstacle (occupied slot).
     */
    getInsertPlan(qubit, hoverColumn) {
        const sorted = this.getInsertObstacleColumns(qubit, hoverColumn);
        const next = sorted[0];
        if (next === undefined || hoverColumn !== next) {
            return { shouldShift: false, insertColumn: hoverColumn };
        }
        return { shouldShift: true, insertColumn: next };
    }

    /**
     * Shift gates at column >= fromColumn (all wires if inserting before REPEAT/END,
     * otherwise the insert wire and multi-qubit partners); also REPEAT/END markers.
     */
    shiftForInsertOnWire(qubit, fromColumn) {
        for (const gate of this.getGatesToShiftForInsert(qubit, fromColumn)) {
            gate.column += 1;
        }
        for (const cf of this.controlFlow) {
            if (cf.column >= fromColumn) {
                cf.column += 1;
            }
        }
        this.refreshRepeatEndPairings();
        this.updateMaxColumn();
    }

    getNextColumn() {
        return this.maxColumn + 1;
    }

    execute(options = {}) {
        const preview = options.preview === true;
        this.state = new QuantumState(this.numQubits, this.useOptimizedGates);

        const executionSequence = this.buildExecutionSequence();
        for (const gate of executionSequence) {
            this.executeGate(gate, { preview });
        }

        return this.state;
    }

    /** Unitary evolution only — skips MEASURE so analysis shows pre-collapse amplitudes. */
    simulatePreview() {
        return this.execute({ preview: true });
    }

    buildExecutionSequence() {
        return this.buildExecutionTimeline().flatMap((step) => step.gates);
    }

    /** Qubit indices with at least one MEASURE gate in program order. */
    getMeasureQubitIndices() {
        const seen = new Set();
        const ordered = [];
        for (const gate of this.buildExecutionSequence()) {
            if (gate.type === 'MEASURE' && !seen.has(gate.qubit)) {
                seen.add(gate.qubit);
                ordered.push(gate.qubit);
            }
        }
        return ordered;
    }

    /**
     * Unrolled time steps (respects REPEAT). Each step is one column's worth of gates
     * in execution order; repeats add duplicate steps per iteration.
     */
    buildExecutionTimeline() {
        const sortedGates = [...this.gates].sort((a, b) => a.column - b.column);
        const sortedCF = [...this.controlFlow].sort((a, b) => a.column - b.column);

        if (sortedCF.length === 0) {
            if (sortedGates.length === 0) return [];
            const gatesByColumn = {};
            for (const gate of sortedGates) {
                if (!gatesByColumn[gate.column]) gatesByColumn[gate.column] = [];
                gatesByColumn[gate.column].push(gate);
            }
            return Object.keys(gatesByColumn)
                .map(Number)
                .sort((a, b) => a - b)
                .map((column) => ({
                    gates: gatesByColumn[column],
                    column,
                    repeatContext: null
                }));
        }

        const gatesByColumn = {};
        for (const gate of sortedGates) {
            if (!gatesByColumn[gate.column]) gatesByColumn[gate.column] = [];
            gatesByColumn[gate.column].push(gate);
        }

        const allColumns = [...new Set([
            ...sortedGates.map((g) => g.column),
            ...sortedCF.map((cf) => cf.column)
        ])].sort((a, b) => a - b);

        const repeatPairs = [];
        const repeatStarts = [];
        for (const cf of sortedCF) {
            if (cf.type === 'REPEAT') {
                repeatStarts.push(cf);
            } else if (cf.type === 'END' && repeatStarts.length > 0) {
                const start = repeatStarts.pop();
                repeatPairs.push({
                    startColumn: start.column,
                    endColumn: cf.column,
                    count: start.params.count || 2
                });
            }
        }

        const steps = [];

        const executeRange = (startCol, endCol, pairs, repeatContext = []) => {
            let col = startCol;
            while (col <= endCol) {
                const innerPair = pairs.find((p) => p.startColumn === col);
                if (innerPair) {
                    for (let i = 0; i < innerPair.count; i++) {
                        const ctx = [
                            ...repeatContext,
                            { iteration: i + 1, total: innerPair.count, startColumn: innerPair.startColumn }
                        ];
                        executeRange(innerPair.startColumn + 1, innerPair.endColumn - 1, pairs, ctx);
                    }
                    col = innerPair.endColumn + 1;
                } else {
                    if (gatesByColumn[col]) {
                        steps.push({
                            gates: [...gatesByColumn[col]],
                            column: col,
                            repeatContext: repeatContext.length ? [...repeatContext] : null
                        });
                    }
                    col++;
                }
            }
        };

        let col = 0;
        const maxCol = Math.max(...allColumns, 0);
        while (col <= maxCol) {
            const pair = repeatPairs.find((p) => p.startColumn === col);
            if (pair) {
                for (let i = 0; i < pair.count; i++) {
                    const ctx = [{ iteration: i + 1, total: pair.count, startColumn: pair.startColumn }];
                    executeRange(pair.startColumn + 1, pair.endColumn - 1, repeatPairs, ctx);
                }
                col = pair.endColumn + 1;
            } else {
                if (gatesByColumn[col]) {
                    steps.push({
                        gates: [...gatesByColumn[col]],
                        column: col,
                        repeatContext: null
                    });
                }
                col++;
            }
        }

        return steps;
    }

    executeGate(gate, options = {}) {
        const { type, qubit, target, params, multiQubits } = gate;
        const preview = options.preview === true;

        try {
            if (type === 'MEASURE') {
                if (!preview) {
                    this.state.measure(qubit);
                }
            } else if (['CX', 'CY', 'CZ'].includes(type) && multiQubits && multiQubits.length > 0) {
                // Multi-controlled gate: controls in multiQubits, target in qubit
                if (type === 'CZ') {
                    this.state.applyMultiControlledZ(multiQubits, qubit);
                } else if (type === 'CX') {
                    // Proper multi-controlled X (Toffoli and beyond)
                    this.state.applyMultiControlledX(multiQubits, qubit);
                } else if (type === 'CY') {
                    // Proper multi-controlled Y
                    this.state.applyMultiControlledY(multiQubits, qubit);
                }
            } else if (type === 'CSWAP') {
                const joint = params && params.jointQubits;
                if (!Array.isArray(joint) || joint.length !== 3) {
                    console.warn('CSWAP requires jointQubits [control, swapA, swapB]');
                    return;
                }
                const [control, swapA, swapB] = joint;
                this.state.applyCSWAP(control, swapA, swapB);
            } else if (['CX', 'CY', 'CZ', 'SWAP'].includes(type)) {
                if (target === null || target === undefined) {
                    console.warn(`Two-qubit gate ${type} requires a target qubit`);
                    return;
                }
                // qubit is the target, target is the control
                this.state.applyTwoQubitGate(type, target, qubit);
            } else if (['RX', 'RY', 'RZ'].includes(type)) {
                const angle = params.angle !== undefined ? params.angle : Math.PI / 2;
                const axis = type.substring(1); // 'X', 'Y', or 'Z'
                this.state.applyRotationGate(axis, qubit, angle);
            } else if (params && Array.isArray(params.jointQubits) && params.jointQubits.length > 0) {
                const mat = this.state.getGateMatrix(type);
                if (mat && mat.length > 0) {
                    this.state.applyGateGeneral(mat, [...params.jointQubits]);
                }
            } else {
                // Single qubit gate
                this.state.applyGate(type, qubit);
            }
        } catch (error) {
            console.error(`Error executing gate ${type}:`, error);
        }
    }

    clear() {
        this.gates = [];
        this.controlFlow = [];
        this.maxColumn = 0;
        this.state = new QuantumState(this.numQubits, this.useOptimizedGates);
    }

    getDepth() {
        return this.buildExecutionTimeline().length;
    }

    getGateCount() {
        return this.buildExecutionSequence().length;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QuantumCircuit };
}


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
        
        return cf;
    }

    removeControlFlow(column) {
        this.controlFlow = this.controlFlow.filter(cf => cf.column !== column);
        this.updateMaxColumn();
    }

    getControlFlowAtColumn(column) {
        return this.controlFlow.find(cf => cf.column === column);
    }

    removeGate(qubit, column) {
        this.gates = this.gates.filter(gate => 
            !(gate.qubit === qubit && gate.column === column) &&
            !(gate.target === qubit && gate.column === column)
        );
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
        return this.gates.filter(gate => 
            gate.qubit === qubit || gate.target === qubit
        );
    }

    getNextColumn() {
        return this.maxColumn + 1;
    }

    execute() {
        // Reset state
        this.state = new QuantumState(this.numQubits, this.useOptimizedGates);
        
        // Build execution sequence considering REPEAT blocks
        const executionSequence = this.buildExecutionSequence();
        
        // Execute gates in sequence
        for (const gate of executionSequence) {
            this.executeGate(gate);
        }
        
        return this.state;
    }

    buildExecutionSequence() {
        // Sort gates by column
        const sortedGates = [...this.gates].sort((a, b) => a.column - b.column);
        
        // Sort control flow by column
        const sortedCF = [...this.controlFlow].sort((a, b) => a.column - b.column);
        
        // If no control flow, just return sorted gates
        if (sortedCF.length === 0) {
            return sortedGates;
        }
        
        // Build a map of columns to gates
        const gatesByColumn = {};
        for (const gate of sortedGates) {
            if (!gatesByColumn[gate.column]) {
                gatesByColumn[gate.column] = [];
            }
            gatesByColumn[gate.column].push(gate);
        }
        
        // Get all columns in order
        const allColumns = [...new Set([
            ...sortedGates.map(g => g.column),
            ...sortedCF.map(cf => cf.column)
        ])].sort((a, b) => a - b);
        
        // Build execution sequence
        const result = [];
        const repeatStack = []; // Stack of {count, startColumn, endColumn}
        
        // First pass: identify REPEAT-END pairs
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
                    count: start.params.count || 2,
                    endingType: cf.params.endingType || 'REPEAT'
                });
            }
        }
        
        // Helper function to get gates in column range, respecting repeats
        const executeRange = (startCol, endCol, pairs) => {
            const gates = [];
            let col = startCol;
            
            while (col <= endCol) {
                // Check if this column starts a repeat
                const innerPair = pairs.find(p => p.startColumn === col);
                if (innerPair) {
                    // Execute the repeat block
                    for (let i = 0; i < innerPair.count; i++) {
                        const innerGates = executeRange(innerPair.startColumn + 1, innerPair.endColumn - 1, pairs);
                        gates.push(...innerGates);
                    }
                    col = innerPair.endColumn + 1;
                } else {
                    // Regular column - add gates if any
                    if (gatesByColumn[col]) {
                        gates.push(...gatesByColumn[col]);
                    }
                    col++;
                }
            }
            
            return gates;
        };
        
        // Execute from start to end, respecting top-level repeats
        let col = 0;
        const maxCol = Math.max(...allColumns, 0);
        
        while (col <= maxCol) {
            const pair = repeatPairs.find(p => p.startColumn === col);
            if (pair) {
                // Execute the repeat block
                for (let i = 0; i < pair.count; i++) {
                    const innerGates = executeRange(pair.startColumn + 1, pair.endColumn - 1, repeatPairs);
                    result.push(...innerGates);
                }
                col = pair.endColumn + 1;
            } else {
                // Regular column
                if (gatesByColumn[col]) {
                    result.push(...gatesByColumn[col]);
                }
                col++;
            }
        }
        
        return result;
    }

    executeGate(gate) {
        const { type, qubit, target, params, multiQubits } = gate;
        
        try {
            if (type === 'MEASURE') {
                this.state.measure(qubit);
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
        return this.maxColumn + 1;
    }

    getGateCount() {
        return this.gates.length;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QuantumCircuit };
}


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

    removeGateByRef(gate) {
        if (!gate) return;
        this.gates = this.gates.filter((g) => g !== gate);
        this.updateMaxColumn();
    }

    removeGatesByRef(gates) {
        if (!gates || !gates.length) return;
        const drop = new Set(gates.filter(Boolean));
        if (!drop.size) return;
        this.gates = this.gates.filter((g) => !drop.has(g));
        this.updateMaxColumn();
    }

    _isExcludedGate(gate, excludeGate = null, excludeGates = null) {
        if (!gate) return false;
        if (excludeGate && gate === excludeGate) return true;
        if (excludeGates && excludeGates.has(gate)) return true;
        return false;
    }

    _virtualObstacleTouchesQubit(virtual, qubit) {
        if (!virtual || !Array.isArray(virtual.qubits)) return false;
        return virtual.qubits.includes(qubit);
    }

    cloneGate(gate) {
        return {
            type: gate.type,
            qubit: gate.qubit,
            target: gate.target,
            column: gate.column,
            params: gate.params ? JSON.parse(JSON.stringify(gate.params)) : {},
            multiQubits: gate.multiQubits ? [...gate.multiQubits] : null
        };
    }

    /** @returns {boolean} false if delta would place any wire out of range */
    applyGateQubitDelta(gate, deltaQ, qubitLimit = this.numQubits) {
        if (!deltaQ) return true;
        for (const q of this.getQubitsInvolvedInGate(gate)) {
            const next = q + deltaQ;
            if (next < 0 || next >= qubitLimit) return false;
        }
        gate.qubit += deltaQ;
        if (gate.target !== null && gate.target !== undefined) {
            gate.target += deltaQ;
        }
        if (gate.multiQubits) {
            gate.multiQubits = gate.multiQubits.map((q) => q + deltaQ);
        }
        const joint = gate.params && gate.params.jointQubits;
        if (Array.isArray(joint)) {
            gate.params.jointQubits = joint.map((q) => q + deltaQ);
        }
        return true;
    }

    gatesSamePlacement(a, b) {
        if (!a || !b) return false;
        if (a.type !== b.type || a.qubit !== b.qubit || a.column !== b.column) return false;
        if (a.target !== b.target) return false;
        const ma = a.multiQubits || null;
        const mb = b.multiQubits || null;
        if (JSON.stringify(ma) !== JSON.stringify(mb)) return false;
        const pa = a.params || {};
        const pb = b.params || {};
        return JSON.stringify(pa) === JSON.stringify(pb);
    }

    /**
     * Move an existing gate: the drop wire becomes the new anchor and the gate lands exactly on
     * the hovered column, pushing any obstacles out of the way via the shared group cascade.
     * Routing through moveCircuitGroup means a multi-qubit/controlled gate is checked against every
     * wire it spans — it can no longer be dropped on top of a gate sitting under its control wire.
     * @returns {boolean} success
     */
    moveGate(gate, newAnchorQubit, hoverColumn, excludeGates = null) {
        if (!gate) return false;
        const deltaQ = newAnchorQubit - gate.qubit;
        const deltaCol = hoverColumn - gate.column;
        return this.moveCircuitGroup([gate], [], deltaQ, deltaCol);
    }

    /** Leftmost REPEAT/END column at or after fromColumn (null if none). */
    _minControlFlowColumnAtOrAfter(fromColumn, excludeCF = null) {
        const cfExclude = excludeCF instanceof Set ? excludeCF : null;
        let min = null;
        for (const cf of this.controlFlow) {
            if (cfExclude?.has(cf)) continue;
            if (cf.column < fromColumn) continue;
            if (min === null || cf.column < min) min = cf.column;
        }
        return min;
    }

    /** Whether a gate shifts during a bulk push (wire-local below CF, all wires at/after CF). */
    _gateShouldBulkShift(fromColumn, gate, affectedQubits, shiftAllWires, minCfColumn) {
        if (gate.column < fromColumn) return false;
        if (shiftAllWires) return true;
        if (minCfColumn !== null && gate.column >= minCfColumn) return true;
        return this.gateTouchesQubitSet(gate, affectedQubits);
    }

    /**
     * Minimal rightward cascade so existing gates/REPEAT/END make room for a dropped selection.
     *
     * Obstacles are handled as rigid COLUMN units: every gate sharing a column moves together by
     * the same amount, so an aligned column (e.g. a row of H gates across all wires) never splits
     * apart when only one of its wires is what collided. Each column slides to the smallest column
     * >= its original that is free of:
     *   - cells the selection will occupy (gates block their own wires; REPEAT/END block every wire),
     *   - columns already repositioned in this pass (preserves order, prevents overlap),
     * while never crossing a REPEAT/END barrier it was originally behind.
     *
     * Direction-agnostic (only ever pushes right) and never moves a column further than needed, so
     * far-away gates stay put and every affected wire is handled — not just the dragged one.
     *
     * @returns {{gateMoves: Array, cfMoves: Array, needsShift: boolean}}
     */
    _resolveGroupObstacleMoves(gatePlacements, cfPlacements, excludeGates = null, excludeCF = null) {
        const gateExclude = excludeGates instanceof Set ? excludeGates : null;
        const cfExclude = excludeCF instanceof Set ? excludeCF : null;

        // Cells/columns the selection will occupy (fixed — obstacles must avoid these).
        const selGateCells = new Set();   // `${col}:${q}`
        const selGateColumns = new Set(); // any column with a selection gate
        for (const { candidate, targetCol } of gatePlacements || []) {
            for (const q of this.getQubitsInvolvedInGate(candidate)) {
                selGateCells.add(`${targetCol}:${q}`);
            }
            selGateColumns.add(targetCol);
        }
        const selCfCols = new Set();      // columns where the selection drops REPEAT/END (block all wires)
        for (const { targetCol } of cfPlacements || []) {
            selCfCols.add(targetCol);
        }

        // Group the non-selected obstacles into rigid per-column units.
        const colUnits = new Map(); // originalColumn -> { col, gates, wires, cfRefs }
        const unitFor = (col) => {
            let u = colUnits.get(col);
            if (!u) {
                u = { col, gates: [], wires: new Set(), cfRefs: [] };
                colUnits.set(col, u);
            }
            return u;
        };
        for (const gate of this.gates) {
            if (gateExclude?.has(gate)) continue;
            const u = unitFor(gate.column);
            u.gates.push(gate);
            for (const q of this.getQubitsInvolvedInGate(gate)) u.wires.add(q);
        }
        for (const cf of this.controlFlow) {
            if (cfExclude?.has(cf)) continue;
            unitFor(cf.column).cfRefs.push(cf);
        }

        // Occupancy accumulated as column units are placed.
        const occCells = new Set(selGateCells);     // occupied (col,q) cells
        const occColumns = new Set(selGateColumns); // columns holding any gate (a CF needs an empty column)
        const blockedCols = new Set(selCfCols);     // columns owned by a REPEAT/END (exclusive)

        const unitFeasible = (unit, c) => {
            // A REPEAT/END column must own the whole column; a gate column only its own wires.
            if (unit.cfRefs.length) {
                return !blockedCols.has(c) && !occColumns.has(c);
            }
            if (blockedCols.has(c)) return false;
            for (const q of unit.wires) {
                if (occCells.has(`${c}:${q}`)) return false;
            }
            return true;
        };

        const units = [...colUnits.values()].sort((a, b) => a.col - b.col);

        const gateMoves = [];
        const cfMoves = [];
        let cfFloor = -1; // new column of the most recent REPEAT/END barrier passed

        for (const unit of units) {
            let c = Math.max(unit.col, cfFloor + 1);
            while (!unitFeasible(unit, c)) c++;

            // Commit the entire column at c.
            occColumns.add(c);
            for (const gate of unit.gates) {
                for (const q of this.getQubitsInvolvedInGate(gate)) occCells.add(`${c}:${q}`);
            }
            if (unit.cfRefs.length) {
                blockedCols.add(c);
                cfFloor = c;
            }

            if (c !== unit.col) {
                for (const gate of unit.gates) gateMoves.push({ gate, fromCol: unit.col, toCol: c });
                for (const cf of unit.cfRefs) cfMoves.push({ cf, fromCol: unit.col, toCol: c });
            }
        }

        return { gateMoves, cfMoves, needsShift: gateMoves.length > 0 || cfMoves.length > 0 };
    }

    /** Preview group placement without mutating the circuit. */
    simulateGroupPlacement(gates, deltaQ, deltaCol, controlFlowItems = [], excludeGates = null, qubitLimit = null) {
        const limit = qubitLimit ?? this.numQubits;

        const gatePlacements = [];
        for (const gate of gates || []) {
            const candidate = this.cloneGate(gate);
            if (!this.applyGateQubitDelta(candidate, deltaQ, limit)) {
                return { valid: false, needsShift: false, gateMoves: [], cfMoves: [] };
            }
            const targetCol = gate.column + deltaCol;
            if (targetCol < 0) {
                return { valid: false, needsShift: false, gateMoves: [], cfMoves: [] };
            }
            gatePlacements.push({ candidate, targetCol });
        }

        const cfPlacements = [];
        for (const cf of controlFlowItems || []) {
            const targetCol = cf.column + deltaCol;
            if (targetCol < 0) {
                return { valid: false, needsShift: false, gateMoves: [], cfMoves: [] };
            }
            cfPlacements.push({ cf, targetCol });
        }

        // Selection gates still live in this.gates during preview — exclude them as obstacles.
        const excludeSet = excludeGates instanceof Set ? excludeGates : new Set((gates || []).filter(Boolean));
        const excludeCF = new Set((controlFlowItems || []).filter(Boolean));

        const { gateMoves, cfMoves, needsShift } =
            this._resolveGroupObstacleMoves(gatePlacements, cfPlacements, excludeSet, excludeCF);

        return { valid: true, needsShift, gateMoves, cfMoves };
    }

    /**
     * Move gates and/or REPEAT/END together. Any obstacles at the destination are
     * pushed right by the minimal cascade in _resolveGroupObstacleMoves.
     */
    moveCircuitGroup(gates, cfs, deltaQ, deltaCol) {
        const gateGroup = [...new Set((gates || []).filter(Boolean))];
        const cfGroup = [...new Set((cfs || []).filter(Boolean))];
        if (!gateGroup.length && !cfGroup.length) return false;
        if (deltaQ === 0 && deltaCol === 0) return true;

        for (const gate of gateGroup) {
            const probe = this.cloneGate(gate);
            if (!this.applyGateQubitDelta(probe, deltaQ)) return false;
            if (gate.column + deltaCol < 0) return false;
        }
        for (const cf of cfGroup) {
            if (cf.column + deltaCol < 0) return false;
        }

        const gateUnchanged = gateGroup.every((gate) => {
            const probe = this.cloneGate(gate);
            this.applyGateQubitDelta(probe, deltaQ);
            probe.column = gate.column + deltaCol;
            return this.gatesSamePlacement(gate, probe);
        });
        const cfUnchanged = cfGroup.every((cf) => cf.column + deltaCol === cf.column);
        if (gateUnchanged && cfUnchanged) return true;

        const gateSnapshots = gateGroup.map((g) => this.cloneGate(g));
        const cfSnapshots = cfGroup.map((cf) => ({ cf, column: cf.column }));

        for (const gate of gateGroup) this.removeGateByRef(gate);
        const cfSet = new Set(cfGroup);
        this.controlFlow = this.controlFlow.filter((cf) => !cfSet.has(cf));

        const gatePlacements = gateSnapshots.map((orig) => {
            const candidate = this.cloneGate(orig);
            this.applyGateQubitDelta(candidate, deltaQ);
            return {
                candidate,
                targetCol: orig.column + deltaCol
            };
        });

        const cfPlacements = cfSnapshots.map(({ cf, column }) => ({
            cf,
            targetCol: column + deltaCol
        }));

        // Selected items already removed above, so the remaining gates/CF are the obstacles.
        const { gateMoves, cfMoves } = this._resolveGroupObstacleMoves(gatePlacements, cfPlacements, null, null);
        for (const { gate, toCol } of gateMoves) gate.column = toCol;
        for (const { cf, toCol } of cfMoves) cf.column = toCol;

        for (const placement of gatePlacements) {
            placement.candidate.column = placement.targetCol;
            this.gates.push(placement.candidate);
        }
        for (const placement of cfPlacements) {
            placement.cf.column = placement.targetCol;
            this.controlFlow.push(placement.cf);
        }

        this.updateMaxColumn();
        this.refreshRepeatEndPairings();
        return true;
    }

    moveGateGroup(gates, deltaQ, deltaCol) {
        return this.moveCircuitGroup(gates, [], deltaQ, deltaCol);
    }

    moveControlFlowGroup(cfs, deltaCol) {
        return this.moveCircuitGroup([], cfs, 0, deltaCol);
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
    getGatesToShiftForInsert(qubit, fromColumn, excludeGate = null, excludeGates = null) {
        // REPEAT/END span every wire — pushing them shifts the whole column timeline.
        if (this.getControlFlowAtColumn(fromColumn)) {
            return this.gates.filter(
                (gate) => !this._isExcludedGate(gate, excludeGate, excludeGates) && gate.column >= fromColumn
            );
        }

        const affected = this.getAffectedQubitsForInsertShift(qubit, fromColumn);
        const minCfColumn = this._minControlFlowColumnAtOrAfter(fromColumn);

        return this.gates.filter(
            (gate) =>
                !this._isExcludedGate(gate, excludeGate, excludeGates) &&
                this._gateShouldBulkShift(fromColumn, gate, affected, false, minCfColumn)
        );
    }

    /** Column positions that block or absorb an insert on this wire. */
    getInsertObstacleColumns(
        qubit,
        hoverColumn,
        excludeGate = null,
        excludeGates = null,
        virtualObstacles = null,
        excludeControlFlow = null
    ) {
        const cols = [];
        for (const gate of this.gates) {
            if (this._isExcludedGate(gate, excludeGate, excludeGates)) continue;
            if (this.gateAffectsQubit(gate, qubit)) {
                cols.push(gate.column);
            }
        }
        if (Array.isArray(virtualObstacles)) {
            for (const virtual of virtualObstacles) {
                if (virtual.column >= hoverColumn && this._virtualObstacleTouchesQubit(virtual, qubit)) {
                    cols.push(virtual.column);
                }
            }
        }
        const cfExclude = excludeControlFlow instanceof Set ? excludeControlFlow : null;
        for (const cf of this.controlFlow) {
            if (cfExclude?.has(cf)) continue;
            cols.push(cf.column);
        }
        return [...new Set(cols)].filter((c) => c >= hoverColumn).sort((a, b) => a - b);
    }

    /**
     * Whether inserting at hoverColumn should push correlated gates / REPEAT|END forward.
     * Only when dropping on the same column as an existing obstacle (occupied slot).
     */
    getInsertPlan(
        qubit,
        hoverColumn,
        excludeGate = null,
        excludeGates = null,
        virtualObstacles = null,
        excludeControlFlow = null
    ) {
        const sorted = this.getInsertObstacleColumns(
            qubit,
            hoverColumn,
            excludeGate,
            excludeGates,
            virtualObstacles,
            excludeControlFlow
        );
        const next = sorted[0];
        if (next === undefined || hoverColumn !== next) {
            return { shouldShift: false, insertColumn: hoverColumn };
        }
        return { shouldShift: true, insertColumn: next };
    }

    /** Whether placing REPEAT/END at hoverColumn needs a push (any gate or CF on that column). */
    getControlFlowInsertPlan(hoverColumn, excludeControlFlow = null) {
        const cfExclude = excludeControlFlow instanceof Set ? excludeControlFlow : null;
        for (const cf of this.controlFlow) {
            if (cfExclude?.has(cf)) continue;
            if (cf.column === hoverColumn) {
                return { shouldShift: true, insertColumn: hoverColumn };
            }
        }
        if (this.gates.some((gate) => gate.column === hoverColumn)) {
            return { shouldShift: true, insertColumn: hoverColumn };
        }
        return { shouldShift: false, insertColumn: hoverColumn };
    }

    /** Push every gate and CF at/after fromColumn — REPEAT/END span all wires. */
    shiftForControlFlowInsert(fromColumn, excludeGates = null, excludeCF = null) {
        for (const gate of this.gates) {
            if (excludeGates?.has(gate)) continue;
            if (gate.column >= fromColumn) gate.column += 1;
        }
        const cfExclude = excludeCF instanceof Set ? excludeCF : null;
        for (const cf of this.controlFlow) {
            if (cfExclude?.has(cf)) continue;
            if (cf.column >= fromColumn) cf.column += 1;
        }
        this.refreshRepeatEndPairings();
        this.updateMaxColumn();
    }

    /**
     * Shift gates at column >= fromColumn (all wires if inserting before REPEAT/END,
     * otherwise the insert wire and multi-qubit partners); also REPEAT/END markers.
     */
    shiftForInsertOnWire(qubit, fromColumn, excludeGate = null, excludeGates = null, virtualObstacles = null) {
        for (const gate of this.getGatesToShiftForInsert(qubit, fromColumn, excludeGate, excludeGates)) {
            gate.column += 1;
        }
        if (Array.isArray(virtualObstacles)) {
            for (const virtual of virtualObstacles) {
                if (virtual.column >= fromColumn) virtual.column += 1;
            }
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


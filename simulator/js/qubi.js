// Qubi Programming Language Parser

class QubiParser {
    constructor() {
        this.tokens = [];
        this.current = 0;
    }

    parse(code) {
        this.tokens = this.tokenize(code);
        this.current = 0;
        
        const instructions = [];
        while (!this.isAtEnd()) {
            const instruction = this.parseInstruction();
            if (instruction) {
                instructions.push(instruction);
            }
        }
        
        return instructions;
    }

    tokenize(code) {
        const tokens = [];
        const lines = code.split('\n');
        
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum].trim();
            if (!line || line.startsWith('//')) continue;
            
            // Rotational shorthand: GATE qubit anglePi  (angle in multiples of π)
            const rotMatch = line.match(/^([A-Z0-9]+)\s+(\d+)\s+([0-9.]+)$/);
            if (rotMatch && ['RX','RY','RZ'].includes(rotMatch[1])) {
                const gateName = rotMatch[1];
                const qubit = parseInt(rotMatch[2]);
                const anglePi = parseFloat(rotMatch[3]);
                tokens.push({
                    type: 'GATE',
                    gate: gateName,
                    qubits: [qubit],
                    isControlled: false,
                    params: { angle: anglePi * Math.PI },
                    line: lineNum
                });
                continue;
            }
            
            // Handle REPEAT
            if (line.startsWith('REPEAT')) {
                const match = line.match(/REPEAT\s+(\d+)/);
                if (match) {
                    tokens.push({ type: 'REPEAT', value: parseInt(match[1]), line: lineNum });
                }
                continue;
            }
            
            // Handle END
            if (line === 'END') {
                tokens.push({ type: 'END', line: lineNum });
                continue;
            }
            
            // Handle gate instructions: GATE (qubits), GATE [qubits], or GATE qubit (shorthand for single qubit only)
            // First try shorthand: GATE qubit (must be single qubit, no commas)
            // This regex ensures it's a single number at the end, not multiple numbers
            const shorthandMatch = line.match(/^([A-Z0-9]+)\s+(\d+)$/);
            if (shorthandMatch) {
                const gateName = shorthandMatch[1];
                const qubit = parseInt(shorthandMatch[2]);
                
                tokens.push({
                    type: 'GATE',
                    gate: gateName,
                    qubits: [qubit],
                    isControlled: false,
                    params: {},
                    line: lineNum
                });
                continue;
            }
            
            // Then try full syntax: GATE (qubits) or GATE [qubits] - required for multiple qubits
            const gateMatch = line.match(/^([A-Z0-9]+)\s*([(\[])([^)\]]+)([)\]])/);
            if (gateMatch) {
                const gateName = gateMatch[1];
                const bracketType = gateMatch[2];
                const qubitsStr = gateMatch[3];
                const qubits = qubitsStr.split(',').map(q => parseInt(q.trim()));
                
                tokens.push({
                    type: 'GATE',
                    gate: gateName,
                    qubits: qubits,
                    isControlled: bracketType === '[',
                    params: {},
                    line: lineNum
                });
                continue;
            }
        }
        
        return tokens;
    }

    parseInstruction() {
        if (this.isAtEnd()) return null;
        
        const token = this.advance();
        
        if (token.type === 'REPEAT') {
            return this.parseRepeat(token);
        } else if (token.type === 'GATE') {
            return token;
        } else if (token.type === 'END') {
            return { type: 'END' };
        }
        
        return null;
    }

    parseRepeat(repeatToken) {
        const count = repeatToken.value;
        const instructions = [];
        let depth = 1; // Track nested REPEAT blocks
        
        while (!this.isAtEnd() && depth > 0) {
            const token = this.peek();
            if (!token) break;
            
            if (token.type === 'REPEAT') {
                depth++;
                const instruction = this.parseInstruction();
                if (instruction) instructions.push(instruction);
            } else if (token.type === 'END') {
                depth--;
                if (depth > 0) {
                    // This END belongs to a nested REPEAT, include it
                    const instruction = this.parseInstruction();
                    if (instruction) instructions.push(instruction);
                } else {
                    // This END belongs to our REPEAT, consume it
                    this.advance();
                }
            } else {
                const instruction = this.parseInstruction();
                if (instruction) {
                    instructions.push(instruction);
                }
            }
        }
        
        return {
            type: 'REPEAT',
            count: count,
            instructions: instructions
        };
    }

    peek() {
        if (this.isAtEnd()) return null;
        return this.tokens[this.current];
    }

    advance() {
        if (!this.isAtEnd()) this.current++;
        return this.tokens[this.current - 1];
    }

    isAtEnd() {
        return this.current >= this.tokens.length;
    }
}

class QubiExecutor {
    constructor(circuit) {
        this.circuit = circuit;
        this.parser = new QubiParser();
    }

    execute(code) {
        const instructions = this.parser.parse(code);
        this.circuit.clear();
        
        // Find max qubit index needed
        const maxQubit = this.findMaxQubit(instructions);
        while (this.circuit.numQubits <= maxQubit) {
            this.circuit.addQubit();
        }
        
        // Build circuit visually (without expanding repeats)
        let column = 0;
        column = this.buildVisualCircuit(instructions, column);
        
        return this.circuit;
    }
    
    buildVisualCircuit(instructions, startColumn) {
        let column = startColumn;
        
        for (const instruction of instructions) {
            if (instruction.type === 'REPEAT') {
                // Add REPEAT control flow block
                this.circuit.addControlFlow('REPEAT', column, { count: instruction.count });
                column++;
                
                // Recursively build inner instructions
                column = this.buildVisualCircuit(instruction.instructions, column);
                
                // Add END control flow block
                this.circuit.addControlFlow('END', column, { 
                    endingType: 'REPEAT',
                    endingLabel: `REPEAT ${instruction.count}`,
                    matchedRepeatColumn: column - instruction.instructions.length - 1
                });
                column++;
            } else if (instruction.type === 'GATE') {
                this.executeGate(instruction, column);
                column++;
            }
            // Skip END tokens in parsed instructions - they're handled with REPEAT
        }
        
        return column;
    }

    findMaxQubit(instructions) {
        let max = -1;
        for (const instruction of instructions) {
            if (instruction.type === 'REPEAT') {
                const nestedMax = this.findMaxQubit(instruction.instructions);
                max = Math.max(max, nestedMax);
            } else if (instruction.type === 'GATE') {
                for (const qubit of instruction.qubits) {
                    max = Math.max(max, qubit);
                }
            }
        }
        return max;
    }

    expandRepeats(instructions) {
        const expanded = [];
        
        for (const instruction of instructions) {
            if (instruction.type === 'REPEAT') {
                for (let i = 0; i < instruction.count; i++) {
                    const innerExpanded = this.expandRepeats(instruction.instructions);
                    expanded.push(...innerExpanded);
                }
            } else {
                expanded.push(instruction);
            }
        }
        
        return expanded;
    }

    executeGate(instruction, column) {
        const { gate, qubits, isControlled, params } = instruction;
        
        // Handle multi-qubit gates with bracket notation [controls..., target]
        if (isControlled) {
            if (qubits.length >= 2) {
                const target = qubits[qubits.length - 1];
                const controls = qubits.slice(0, -1);
                
                if (gate === 'CZ' || gate === 'CX' || gate === 'CY') {
                    // Multi-controlled gate: store controls in multiQubits
                    this.circuit.addGate(gate, target, column, null, {}, controls);
                } else if (gate === 'SWAP') {
                    // SWAP [0,1] -> swap qubits 0 and 1
                    this.circuit.addGate('SWAP', qubits[0], column, qubits[1]);
                }
            }
        } else {
            // Single or multi-qubit application: GATE (0,1,2)
            for (const qubit of qubits) {
                if (['RX', 'RY', 'RZ'].includes(gate)) {
                    // Rotation gates need default angle
                    const angle = params && params.angle !== undefined ? params.angle : Math.PI / 2;
                    this.circuit.addGate(gate, qubit, column, null, { angle });
                } else {
                    this.circuit.addGate(gate, qubit, column);
                }
            }
        }
    }

    generateCode(circuit, existingCode = '') {
        // Generate Qubi code from circuit, preserving comments from existing code
        const lines = [];
        const gatesByColumn = {};
        const controlFlowByColumn = {};
        
        // Parse existing code to extract comments
        const existingLines = existingCode.split('\n');
        const commentMap = new Map(); // Map column index to comments
        const standaloneComments = []; // Comments not associated with specific columns
        
        // Group gates by column
        for (const gate of circuit.gates) {
            if (!gatesByColumn[gate.column]) {
                gatesByColumn[gate.column] = [];
            }
            gatesByColumn[gate.column].push(gate);
        }
        
        // Group control flow by column
        for (const cf of circuit.controlFlow) {
            controlFlowByColumn[cf.column] = cf;
        }
        
        // Get all columns (gates + control flow)
        const allColumns = [...new Set([
            ...Object.keys(gatesByColumn).map(Number),
            ...Object.keys(controlFlowByColumn).map(Number)
        ])].sort((a, b) => a - b);
        
        // Extract comments from existing code (skip if existingCode is empty/whitespace only)
        if (existingCode.trim().length > 0) {
            let instructionIndex = 0;
            for (let i = 0; i < existingLines.length; i++) {
                const line = existingLines[i].trim();
                if (!line) {
                    // Empty line - preserve it
                    if (instructionIndex < allColumns.length) {
                        if (!commentMap.has(instructionIndex)) {
                            commentMap.set(instructionIndex, []);
                        }
                        commentMap.get(instructionIndex).push('');
                    } else {
                        standaloneComments.push('');
                    }
                } else if (line.startsWith('//')) {
                    // Comment line - preserve it
                    if (instructionIndex < allColumns.length) {
                        if (!commentMap.has(instructionIndex)) {
                            commentMap.set(instructionIndex, []);
                        }
                        commentMap.get(instructionIndex).push(existingLines[i]); // Preserve original formatting
                    } else {
                        standaloneComments.push(existingLines[i]);
                    }
                } else {
                    // Instruction line - move to next instruction
                    instructionIndex++;
                }
            }
        }
        
        let indentLevel = 0;
        let outputIndex = 0;
        
        for (const col of allColumns) {
            // Add comments associated with this column
            if (commentMap.has(outputIndex)) {
                for (const comment of commentMap.get(outputIndex)) {
                    lines.push(comment);
                }
            }
            
            const cf = controlFlowByColumn[col];
            const gates = gatesByColumn[col];
            
            // Handle control flow
            if (cf) {
                if (cf.type === 'REPEAT') {
                    lines.push('  '.repeat(indentLevel) + `REPEAT ${cf.params.count}`);
                    indentLevel++;
                } else if (cf.type === 'END') {
                    indentLevel = Math.max(0, indentLevel - 1);
                    lines.push('  '.repeat(indentLevel) + 'END');
                }
            }
            
            // Handle gates at this column
            if (gates && gates.length > 0) {
            // Group gates by type and qubits/targets
            const gateGroups = {};
            for (const gate of gates) {
                let key = `${gate.type}_${gate.target || 'single'}`;
                if (['CX', 'CY', 'CZ'].includes(gate.type) && gate.multiQubits && gate.multiQubits.length) {
                    key = `${gate.type}_MULTI_${gate.multiQubits.join(',')}_${gate.qubit}`;
                }
                if (!gateGroups[key]) {
                    gateGroups[key] = [];
                }
                gateGroups[key].push(gate);
            }
            
            // Generate code for each group
            for (const group of Object.values(gateGroups)) {
                const g0 = group[0];
                    const indent = '  '.repeat(indentLevel);
                    
                if (['CX', 'CY', 'CZ'].includes(g0.type) && g0.multiQubits && g0.multiQubits.length > 0) {
                    // Multi-controlled gate
                    const controls = g0.multiQubits;
                    const target = g0.qubit;
                        lines.push(indent + `${g0.type} [${[...controls, target].join(',')}]`);
                } else if (g0.target !== null && g0.target !== undefined) {
                    // Two-qubit gate
                    const control = g0.target;
                    const target = g0.qubit;
                        lines.push(indent + `${g0.type} [${control},${target}]`);
                } else if (['RX','RY','RZ'].includes(g0.type) && g0.params && g0.params.angle !== undefined && group.length === 1) {
                    const qubit = g0.qubit;
                    const anglePi = g0.params.angle / Math.PI;
                        lines.push(indent + `${g0.type} ${qubit} ${parseFloat(anglePi.toFixed(4))}`);
                } else {
                    // Single qubit gates
                    const qubits = group.map(g => g.qubit).sort((a, b) => a - b);
                    const gateType = g0.type;
                    
                    // Use shorthand for single qubit, full syntax for multiple
                    if (qubits.length === 1) {
                            lines.push(indent + `${gateType} ${qubits[0]}`);
                    } else {
                            lines.push(indent + `${gateType} (${qubits.join(',')})`);
                        }
                    }
                }
            }
            outputIndex++;
        }
        
        // Add standalone comments at the end
        if (standaloneComments.length > 0) {
            lines.push(...standaloneComments);
        }
        
        return lines.join('\n');
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QubiParser, QubiExecutor };
}


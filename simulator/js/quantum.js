// Quantum Mechanics Core Library

// Complex number helper functions
const Complex = {
    create: (re, im = 0) => ({ re, im }),
    add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
    sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
    mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
    scale: (a, s) => ({ re: a.re * s, im: a.im * s }),
    abs2: (a) => a.re * a.re + a.im * a.im,
    abs: (a) => Math.sqrt(Complex.abs2(a)),
    conj: (a) => ({ re: a.re, im: -a.im }),
    fromPolar: (r, theta) => ({ re: r * Math.cos(theta), im: r * Math.sin(theta) })
};

// Standard gate matrices (2x2 flattened) for generalized application
const GateMatrices = {
    // Single qubit gates
    'H': (() => {
        const s = 1 / Math.sqrt(2);
        return [Complex.create(s), Complex.create(s), Complex.create(s), Complex.create(-s)];
    })(),
    'X': [Complex.create(0), Complex.create(1), Complex.create(1), Complex.create(0)],
    'Y': [Complex.create(0), Complex.create(0, -1), Complex.create(0, 1), Complex.create(0)],
    'Z': [Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(-1)],
    'S': [Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(0, 1)],
    'T': [Complex.create(1), Complex.create(0), Complex.create(0), Complex.fromPolar(1, Math.PI / 4)],
    'I': [Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(1)],
    
    // Two qubit gate matrices (4x4 flattened, row-major)
    // CNOT (CX): control=qubit0, target=qubit1 in standard basis ordering
    'CX': [
        Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(0),
        Complex.create(0), Complex.create(1), Complex.create(0), Complex.create(0),
        Complex.create(0), Complex.create(0), Complex.create(0), Complex.create(1),
        Complex.create(0), Complex.create(0), Complex.create(1), Complex.create(0)
    ],
    'CY': [
        Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(0),
        Complex.create(0), Complex.create(1), Complex.create(0), Complex.create(0),
        Complex.create(0), Complex.create(0), Complex.create(0), Complex.create(0, -1),
        Complex.create(0), Complex.create(0), Complex.create(0, 1), Complex.create(0)
    ],
    'CZ': [
        Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(0),
        Complex.create(0), Complex.create(1), Complex.create(0), Complex.create(0),
        Complex.create(0), Complex.create(0), Complex.create(1), Complex.create(0),
        Complex.create(0), Complex.create(0), Complex.create(0), Complex.create(-1)
    ],
    'SWAP': [
        Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(0),
        Complex.create(0), Complex.create(0), Complex.create(1), Complex.create(0),
        Complex.create(0), Complex.create(1), Complex.create(0), Complex.create(0),
        Complex.create(0), Complex.create(0), Complex.create(0), Complex.create(1)
    ]
};

// Generate rotation matrix
function getRotationMatrixStatic(axis, angle) {
    const c = Math.cos(angle / 2);
    const s = Math.sin(angle / 2);
    
    if (axis === 'X') {
        return [
            Complex.create(c, 0), Complex.create(0, -s),
            Complex.create(0, -s), Complex.create(c, 0)
        ];
    } else if (axis === 'Y') {
        return [
            Complex.create(c, 0), Complex.create(-s, 0),
            Complex.create(s, 0), Complex.create(c, 0)
        ];
    } else if (axis === 'Z') {
        return [
            Complex.fromPolar(1, -angle / 2), Complex.create(0, 0),
            Complex.create(0, 0), Complex.fromPolar(1, angle / 2)
        ];
    }
    return GateMatrices['I'];
}

// Build multi-controlled gate matrix (e.g., Toffoli)
function buildMultiControlledMatrix(baseGate, numControls) {
    const totalQubits = numControls + 1;
    const dim = 1 << totalQubits;
    const matrix = [];
    
    // Initialize as identity
    for (let i = 0; i < dim * dim; i++) {
        matrix.push(Complex.create(0));
    }
    for (let i = 0; i < dim; i++) {
        matrix[i * dim + i] = Complex.create(1);
    }
    
    // The base gate is applied to the target (qubit 0) when all controls are |1⟩
    // Control mask: all qubits except qubit 0 must be 1
    const controlMask = dim - 2; // All bits except LSB set to 1
    
    // Get base 2x2 matrix
    let baseMatrix;
    if (baseGate === 'X') {
        baseMatrix = GateMatrices['X'];
    } else if (baseGate === 'Y') {
        baseMatrix = GateMatrices['Y'];
    } else if (baseGate === 'Z') {
        baseMatrix = GateMatrices['Z'];
    } else {
        baseMatrix = GateMatrices['I'];
    }
    
    // For states where all controls are |1⟩, apply the base gate to target
    for (let i = 0; i < dim; i++) {
        if ((i & controlMask) === controlMask) {
            // All control bits are 1, replace identity with base gate action
            const targetBit = i & 1;
            
            // Clear the identity entries
            matrix[i * dim + i] = Complex.create(0);
            
            // Apply base gate
            for (let j = 0; j < 2; j++) {
                const sourceState = (i & ~1) | j;
                matrix[i * dim + sourceState] = baseMatrix[targetBit * 2 + j];
            }
        }
    }
    
    return matrix;
}

class QuantumState {
    constructor(numQubits = 1, useOptimizedGates = true) {
        this.numQubits = numQubits;
        this.dimension = Math.pow(2, numQubits);
        // Store amplitudes as complex numbers
        this.amplitudes = new Array(this.dimension).fill(null).map(() => Complex.create(0, 0));
        this.amplitudes[0] = Complex.create(1, 0); // Start in |00...0⟩ state
        this.measured = false;
        this.measurementResult = null;
        this.useOptimizedGates = useOptimizedGates;
    }
    
    // Set whether to use optimized gate implementations
    setOptimization(enabled) {
        this.useOptimizedGates = enabled;
    }

    // Get the state as a complex number array
    getState() {
        return this.amplitudes.map(amp => ({ real: amp.re, imag: amp.im }));
    }

    // Set the state from amplitudes (can be real numbers or complex objects)
    setState(amplitudes) {
        // Convert to complex if needed
        const complexAmps = amplitudes.map(amp => 
            typeof amp === 'number' ? Complex.create(amp, 0) : amp
        );
        // Normalize
        const norm = Math.sqrt(complexAmps.reduce((sum, amp) => sum + Complex.abs2(amp), 0));
        this.amplitudes = complexAmps.map(amp => Complex.scale(amp, 1/norm));
    }

    // ========== GENERALIZED GATE APPLICATION ==========
    // Apply any k-qubit gate using matrix multiplication
    // matrix: flattened 2^k × 2^k matrix (row-major)
    // qubitIndices: array of k qubit indices the gate acts on [q0, q1, ...] 
    //               where q0 is the least significant in the gate's matrix ordering
    applyGateGeneral(matrix, qubitIndices) {
        const k = qubitIndices.length;
        const gateSize = 1 << k; // 2^k
        const newAmplitudes = new Array(this.dimension).fill(null).map(() => Complex.create(0, 0));
        
        // Optimized path for single-qubit gates: O(2^n) instead of O(4^n)
        if (k === 1) {
            const qubitIndex = qubitIndices[0];
            const step = 1 << qubitIndex;
            
            // Group states by all qubits except the target
            for (let i = 0; i < this.dimension; i += 2 * step) {
                for (let j = 0; j < step; j++) {
                    const idx0 = i + j;         // state with target qubit = 0
                    const idx1 = i + j + step;  // state with target qubit = 1
                    
                    const a0 = this.amplitudes[idx0];
                    const a1 = this.amplitudes[idx1];
                    
                    // Apply 2×2 matrix: [new0, new1] = M * [a0, a1]
                    // matrix is [m00, m01, m10, m11] (row-major)
                    newAmplitudes[idx0] = Complex.add(
                        Complex.mul(matrix[0], a0),  // m00 * a0
                        Complex.mul(matrix[1], a1)   // m01 * a1
                    );
                    newAmplitudes[idx1] = Complex.add(
                        Complex.mul(matrix[2], a0),  // m10 * a0
                        Complex.mul(matrix[3], a1)   // m11 * a1
                    );
                }
            }
            this.amplitudes = newAmplitudes;
            return;
        }
        
        // Optimized path for two-qubit gates: O(2^n) instead of O(4^n)
        if (k === 2) {
            const q0 = qubitIndices[0];
            const q1 = qubitIndices[1];
            const step0 = 1 << q0;
            const step1 = 1 << q1;
            
            // Mask for qubits other than q0 and q1
            const otherMask = ~(step0 | step1) & (this.dimension - 1);
            
            // Track which base states we've processed (each group of 4 states)
            const processed = new Set();
            
            for (let i = 0; i < this.dimension; i++) {
                // Get base state (with q0 and q1 both set to 0)
                const base = i & otherMask;
                
                if (processed.has(base)) continue;
                processed.add(base);
                
                // Get all 4 states in this group (all combinations of q0 and q1)
                const idx00 = base;
                const idx01 = base | step1;
                const idx10 = base | step0;
                const idx11 = base | step0 | step1;
                
                // Extract bits for matrix indexing (q0 is LSB, q1 is next bit)
                const getBits = (idx) => ((idx >> q0) & 1) | (((idx >> q1) & 1) << 1);
                
                const bits00 = getBits(idx00);
                const bits01 = getBits(idx01);
                const bits10 = getBits(idx10);
                const bits11 = getBits(idx11);
                
                // Get amplitudes
                const a00 = this.amplitudes[idx00];
                const a01 = this.amplitudes[idx01];
                const a10 = this.amplitudes[idx10];
                const a11 = this.amplitudes[idx11];
                
                // Apply 4×4 matrix multiplication
                // matrix[row * 4 + col] where row/col are 0-3 representing (q0, q1) bit patterns
                const applyRow = (rowBits) => {
                    return Complex.add(
                        Complex.add(
                            Complex.mul(matrix[rowBits * 4 + bits00], a00),
                            Complex.mul(matrix[rowBits * 4 + bits01], a01)
                        ),
                        Complex.add(
                            Complex.mul(matrix[rowBits * 4 + bits10], a10),
                            Complex.mul(matrix[rowBits * 4 + bits11], a11)
                        )
                    );
                };
                
                newAmplitudes[idx00] = applyRow(bits00);
                newAmplitudes[idx01] = applyRow(bits01);
                newAmplitudes[idx10] = applyRow(bits10);
                newAmplitudes[idx11] = applyRow(bits11);
            }
            
            this.amplitudes = newAmplitudes;
            return;
        }
        
        // For multi-qubit gates (k > 2), use optimized O(2^n) approach by grouping states
        // Build mask for participating qubits
        let participantMask = 0;
        for (const q of qubitIndices) {
            participantMask |= (1 << q);
        }
        const nonParticipantMask = ~participantMask & (this.dimension - 1);
        
        // Track which base states we've processed (each group has 2^k states)
        const processed = new Set();
        
        for (let i = 0; i < this.dimension; i++) {
            // Get base state (with all participating qubits set to 0)
            const base = i & nonParticipantMask;
            
            if (processed.has(base)) continue;
            processed.add(base);
            
            // Generate all 2^k states in this group (all combinations of participating qubits)
            const statesInGroup = [];
            const indicesInGroup = [];
            
            for (let bits = 0; bits < gateSize; bits++) {
                // Build state index by setting participating qubits according to bits
                let stateIdx = base;
                for (let b = 0; b < k; b++) {
                    if ((bits >> b) & 1) {
                        stateIdx |= (1 << qubitIndices[b]);
                    }
                }
                indicesInGroup.push(stateIdx);
                statesInGroup.push(this.amplitudes[stateIdx]);
            }
            
            // Apply the 2^k × 2^k matrix to this group
            for (let row = 0; row < gateSize; row++) {
                let result = Complex.create(0, 0);
                for (let col = 0; col < gateSize; col++) {
                    const factor = matrix[row * gateSize + col];
                    if (factor.re !== 0 || factor.im !== 0) {
                        result = Complex.add(result, Complex.mul(factor, statesInGroup[col]));
                    }
                }
                newAmplitudes[indicesInGroup[row]] = result;
            }
        }
        
        this.amplitudes = newAmplitudes;
    }

    // ========== OPTIMIZED SINGLE-QUBIT GATE (O(2^n) instead of O(4^n)) ==========
    applyGateOptimized(gate, qubitIndex) {
        const gateMatrix = this.getGateMatrix(gate);
        const newAmplitudes = new Array(this.dimension).fill(null).map(() => Complex.create(0, 0));
        const step = 1 << qubitIndex;
        
        for (let i = 0; i < this.dimension; i += 2 * step) {
            for (let j = 0; j < step; j++) {
                const idx0 = i + j;         // state with qubit=0
                const idx1 = i + j + step;  // state with qubit=1
                
                const a0 = this.amplitudes[idx0];
                const a1 = this.amplitudes[idx1];
                
                // Apply 2x2 gate: [new0, new1] = M * [a0, a1]
                newAmplitudes[idx0] = Complex.add(
                    Complex.mul(gateMatrix[0], a0),
                    Complex.mul(gateMatrix[1], a1)
                );
                newAmplitudes[idx1] = Complex.add(
                    Complex.mul(gateMatrix[2], a0),
                    Complex.mul(gateMatrix[3], a1)
                );
            }
        }
        
        this.amplitudes = newAmplitudes;
    }

    // Apply a single-qubit gate
    // Convention: qubit 0 is the rightmost (LSB), qubit n-1 is the leftmost (MSB)
    applyGate(gate, qubitIndex) {
        if (qubitIndex < 0 || qubitIndex >= this.numQubits) {
            throw new Error(`Invalid qubit index: ${qubitIndex}`);
        }

        if (this.useOptimizedGates) {
            // Use O(2^n) optimized implementation
            this.applyGateOptimized(gate, qubitIndex);
        } else {
            // Use generalized matrix multiplication
            const gateMatrix = GateMatrices[gate] || this.getGateMatrix(gate);
            this.applyGateGeneral(gateMatrix, [qubitIndex]);
        }
    }

    // ========== OPTIMIZED TWO-QUBIT GATE ==========
    applyTwoQubitGateOptimized(gate, controlQubit, targetQubit) {
        const newAmplitudes = new Array(this.dimension).fill(null).map(() => Complex.create(0, 0));

        for (let i = 0; i < this.dimension; i++) {
            const controlBit = (i >> controlQubit) & 1;
            
            if (gate === 'CX') {
                // Controlled-X (CNOT): flip target if control is |1⟩
                if (controlBit === 1) {
                    const newIndex = i ^ (1 << targetQubit);
                    newAmplitudes[newIndex] = this.amplitudes[i];
                } else {
                    newAmplitudes[i] = this.amplitudes[i];
                }
            } else if (gate === 'CY') {
                // Controlled-Y: apply Y to target if control is |1⟩
                if (controlBit === 1) {
                    const targetBit = (i >> targetQubit) & 1;
                    const newIndex = i ^ (1 << targetQubit);
                    // Y gate: |0⟩ → i|1⟩, |1⟩ → -i|0⟩
                    if (targetBit === 0) {
                        // Multiply by i
                        newAmplitudes[newIndex] = Complex.create(-this.amplitudes[i].im, this.amplitudes[i].re);
                    } else {
                        // Multiply by -i
                        newAmplitudes[newIndex] = Complex.create(this.amplitudes[i].im, -this.amplitudes[i].re);
                    }
                } else {
                    newAmplitudes[i] = this.amplitudes[i];
                }
            } else if (gate === 'CZ') {
                // Controlled-Z: phase flip if both are |1⟩
                if (controlBit === 1) {
                    const targetBit = (i >> targetQubit) & 1;
                    if (targetBit === 1) {
                        newAmplitudes[i] = Complex.scale(this.amplitudes[i], -1);
                    } else {
                        newAmplitudes[i] = this.amplitudes[i];
                    }
                } else {
                    newAmplitudes[i] = this.amplitudes[i];
                }
            } else if (gate === 'SWAP') {
                const cBit = (i >> controlQubit) & 1;
                const tBit = (i >> targetQubit) & 1;
                if (cBit !== tBit) {
                    const swapped = i ^ (1 << controlQubit) ^ (1 << targetQubit);
                    newAmplitudes[swapped] = this.amplitudes[i];
                } else {
                    newAmplitudes[i] = this.amplitudes[i];
                }
            }
        }

        this.amplitudes = newAmplitudes;
    }

    // Apply a two-qubit gate
    // Convention: qubit 0 is the rightmost (LSB), qubit n-1 is the leftmost (MSB)
    applyTwoQubitGate(gate, controlQubit, targetQubit) {
        if (controlQubit === targetQubit) {
            throw new Error('Control and target qubits must be different');
        }

        if (this.useOptimizedGates) {
            this.applyTwoQubitGateOptimized(gate, controlQubit, targetQubit);
        } else {
            // Use generalized matrix multiplication
            const gateMatrix = GateMatrices[gate];
            if (gateMatrix) {
                // Order: [target, control] for standard controlled gate matrix ordering
                this.applyGateGeneral(gateMatrix, [targetQubit, controlQubit]);
            } else {
                // Fallback to optimized for unknown gates
                this.applyTwoQubitGateOptimized(gate, controlQubit, targetQubit);
            }
        }
    }

    // ========== MULTI-CONTROLLED GATES ==========
    
    // Apply multi-controlled Z gate (phase flip when all controls and target are |1⟩)
    // Convention: qubit 0 is the rightmost (LSB), qubit n-1 is the leftmost (MSB)
    applyMultiControlledZ(controls = [], target = null) {
        // CZ is diagonal, so optimized version is always efficient
        const newAmplitudes = this.amplitudes.map(a => ({ ...a }));
        const participants = target !== null && target !== undefined ? [...controls, target] : [...controls];
        
        for (let i = 0; i < this.dimension; i++) {
            let allOne = true;
            for (const q of participants) {
                const bit = (i >> q) & 1;
                if (bit === 0) { allOne = false; break; }
            }
            if (allOne) newAmplitudes[i] = Complex.scale(newAmplitudes[i], -1);
        }
        this.amplitudes = newAmplitudes;
    }
    
    // Apply multi-controlled X gate (Toffoli and beyond)
    // controls: array of control qubit indices
    // target: target qubit index
    applyMultiControlledX(controls, target) {
        if (this.useOptimizedGates) {
            // Optimized: directly swap amplitudes when all controls are |1⟩
            const newAmplitudes = this.amplitudes.map(a => ({ ...a }));
            
            for (let i = 0; i < this.dimension; i++) {
                // Check if all controls are |1⟩
                let allControlsOne = true;
                for (const c of controls) {
                    if (((i >> c) & 1) === 0) {
                        allControlsOne = false;
                        break;
                    }
                }
                
                if (allControlsOne) {
                    // Swap with partner state (target bit flipped)
                    const partner = i ^ (1 << target);
                    if (i < partner) {
                        const temp = newAmplitudes[i];
                        newAmplitudes[i] = this.amplitudes[partner];
                        newAmplitudes[partner] = temp;
                    }
                }
            }
            this.amplitudes = newAmplitudes;
        } else {
            // Use generalized matrix multiplication
            const numControls = controls.length;
            const matrix = buildMultiControlledMatrix('X', numControls);
            // Qubit ordering: [target, control0, control1, ...]
            this.applyGateGeneral(matrix, [target, ...controls]);
        }
    }
    
    // Apply multi-controlled Y gate
    applyMultiControlledY(controls, target) {
        if (this.useOptimizedGates) {
            const newAmplitudes = this.amplitudes.map(a => ({ ...a }));
            
            for (let i = 0; i < this.dimension; i++) {
                let allControlsOne = true;
                for (const c of controls) {
                    if (((i >> c) & 1) === 0) {
                        allControlsOne = false;
                        break;
                    }
                }
                
                if (allControlsOne) {
                    const targetBit = (i >> target) & 1;
                    const partner = i ^ (1 << target);
                    if (i < partner) {
                        // Y gate: |0⟩ → i|1⟩, |1⟩ → -i|0⟩
                        if (targetBit === 0) {
                            // i -> partner gets i * original[i]
                            newAmplitudes[partner] = Complex.create(-this.amplitudes[i].im, this.amplitudes[i].re);
                            // partner (targetBit=1) -> i gets -i * original[partner]
                            newAmplitudes[i] = Complex.create(this.amplitudes[partner].im, -this.amplitudes[partner].re);
                        }
                    }
                }
            }
            this.amplitudes = newAmplitudes;
        } else {
            const numControls = controls.length;
            const matrix = buildMultiControlledMatrix('Y', numControls);
            this.applyGateGeneral(matrix, [target, ...controls]);
        }
    }

    // Apply rotation gate with angle
    // Convention: qubit 0 is the rightmost (LSB), qubit n-1 is the leftmost (MSB)
    applyRotationGate(axis, qubitIndex, angle) {
        const gateMatrix = this.getRotationMatrix(axis, angle);
        
        if (this.useOptimizedGates) {
            // Use optimized O(2^n) implementation
            const newAmplitudes = new Array(this.dimension).fill(null).map(() => Complex.create(0, 0));
            const step = 1 << qubitIndex;
            
            for (let i = 0; i < this.dimension; i += 2 * step) {
                for (let j = 0; j < step; j++) {
                    const idx0 = i + j;
                    const idx1 = i + j + step;
                    
                    const a0 = this.amplitudes[idx0];
                    const a1 = this.amplitudes[idx1];
                    
                    newAmplitudes[idx0] = Complex.add(
                        Complex.mul(gateMatrix[0], a0),
                        Complex.mul(gateMatrix[1], a1)
                    );
                    newAmplitudes[idx1] = Complex.add(
                        Complex.mul(gateMatrix[2], a0),
                        Complex.mul(gateMatrix[3], a1)
                    );
                }
            }
            this.amplitudes = newAmplitudes;
        } else {
            // Use generalized matrix multiplication
            this.applyGateGeneral(gateMatrix, [qubitIndex]);
        }
    }

    // Measure a qubit
    measure(qubitIndex) {
        if (qubitIndex < 0 || qubitIndex >= this.numQubits) {
            throw new Error(`Invalid qubit index: ${qubitIndex}`);
        }

        // Calculate probabilities
        const prob0 = this.getProbability(qubitIndex, 0);
        const prob1 = this.getProbability(qubitIndex, 1);

        // Collapse state based on measurement
        const result = Math.random() < prob0 ? 0 : 1;
        this.collapseState(qubitIndex, result);

        return result;
    }

    // Measure all qubits
    measureAll() {
        const results = [];
        for (let i = 0; i < this.numQubits; i++) {
            results.push(this.measure(i));
        }
        this.measured = true;
        this.measurementResult = results;
        return results;
    }

    // Get probability of measuring a qubit in a specific state
    // Convention: qubit 0 is the rightmost (LSB), qubit n-1 is the leftmost (MSB)
    getProbability(qubitIndex, value) {
        let prob = 0;
        for (let i = 0; i < this.dimension; i++) {
            const bit = (i >> qubitIndex) & 1;
            if (bit === value) {
                prob += Complex.abs2(this.amplitudes[i]);
            }
        }
        return prob;
    }

    // Get all measurement probabilities
    getAllProbabilities() {
        const probs = {};
        for (let i = 0; i < this.dimension; i++) {
            const binary = i.toString(2).padStart(this.numQubits, '0');
            probs[binary] = Complex.abs2(this.amplitudes[i]);
        }
        return probs;
    }

    // Get state vector representation
    getStateVectorString() {
        let result = '';
        let first = true;
        for (let i = 0; i < this.dimension; i++) {
            const amp = this.amplitudes[i];
            const prob = Complex.abs2(amp);
            if (prob > 1e-6) {
                const binary = i.toString(2).padStart(this.numQubits, '0');
                const magnitude = Complex.abs(amp);
                // Format complex number
                let ampStr;
                if (Math.abs(amp.im) < 1e-6) {
                    ampStr = amp.re < 0 ? `-${magnitude.toFixed(4)}` : `${magnitude.toFixed(4)}`;
                } else if (Math.abs(amp.re) < 1e-6) {
                    ampStr = amp.im < 0 ? `-${magnitude.toFixed(4)}i` : `${magnitude.toFixed(4)}i`;
                } else {
                    const sign = amp.im >= 0 ? '+' : '-';
                    ampStr = `(${amp.re.toFixed(3)}${sign}${Math.abs(amp.im).toFixed(3)}i)`;
                }
                const prefix = first ? '' : ' + ';
                result += `${prefix}${ampStr}|${binary}⟩`;
                first = false;
            }
        }
        return result.trim() || '0';
    }

    // Helper methods

    getGateMatrix(gate) {
        const sqrt2 = 1/Math.sqrt(2);
        const gates = {
            'H': [Complex.create(sqrt2), Complex.create(sqrt2), Complex.create(sqrt2), Complex.create(-sqrt2)],
            'X': [Complex.create(0), Complex.create(1), Complex.create(1), Complex.create(0)],
            'Y': [Complex.create(0), Complex.create(0, -1), Complex.create(0, 1), Complex.create(0)],
            'Z': [Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(-1)],
            'S': [Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(0, 1)], // Phase gate: |1⟩ -> i|1⟩
            'T': [Complex.create(1), Complex.create(0), Complex.create(0), Complex.fromPolar(1, Math.PI/4)], // T gate: |1⟩ -> e^(iπ/4)|1⟩
        };

        return gates[gate] || [Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(1)];
    }

    getRotationMatrix(axis, angle) {
        const c = Math.cos(angle / 2);
        const s = Math.sin(angle / 2);
        
        if (axis === 'X') {
            // RX(θ) = [[cos(θ/2), -i*sin(θ/2)], [-i*sin(θ/2), cos(θ/2)]]
            return [
                Complex.create(c, 0),
                Complex.create(0, -s),
                Complex.create(0, -s),
                Complex.create(c, 0)
            ];
        } else if (axis === 'Y') {
            // RY(θ) = [[cos(θ/2), -sin(θ/2)], [sin(θ/2), cos(θ/2)]]
            return [
                Complex.create(c, 0),
                Complex.create(-s, 0),
                Complex.create(s, 0),
                Complex.create(c, 0)
            ];
        } else if (axis === 'Z') {
            // RZ(θ) = [[e^(-iθ/2), 0], [0, e^(iθ/2)]]
            return [
                Complex.fromPolar(1, -angle/2),
                Complex.create(0, 0),
                Complex.create(0, 0),
                Complex.fromPolar(1, angle/2)
            ];
        }
        return [Complex.create(1), Complex.create(0), Complex.create(0), Complex.create(1)];
    }

    collapseState(qubitIndex, result) {
        // Collapse the state to have the measured qubit in the measured state
        // Convention: qubit 0 is the rightmost (LSB), qubit n-1 is the leftmost (MSB)
        for (let i = 0; i < this.dimension; i++) {
            const bit = (i >> qubitIndex) & 1;
            if (bit !== result) {
                this.amplitudes[i] = Complex.create(0, 0);
            }
        }
        // Renormalize
        const norm = Math.sqrt(this.amplitudes.reduce((sum, amp) => sum + Complex.abs2(amp), 0));
        if (norm > 1e-10) {
            this.amplitudes = this.amplitudes.map(amp => Complex.scale(amp, 1/norm));
        }
    }

    // Get Bloch sphere coordinates for a qubit
    // Convention: qubit 0 is the rightmost (LSB), qubit n-1 is the leftmost (MSB)
    getBlochCoordinates(qubitIndex) {
        // For multi-qubit states, we trace out other qubits
        // Calculate reduced density matrix elements
        let rho00 = 0, rho11 = 0;
        let rho01_re = 0, rho01_im = 0;
        
        for (let i = 0; i < this.dimension; i++) {
            const bit = (i >> qubitIndex) & 1;
            const amp = this.amplitudes[i];
            const prob = Complex.abs2(amp);
            
            if (bit === 0) {
                rho00 += prob;
                // Find corresponding |1⟩ state
                const j = i | (1 << qubitIndex);
                const ampJ = this.amplitudes[j];
                // rho01 = sum of amp_i * conj(amp_j) where i has bit=0, j has bit=1
                const conjJ = Complex.conj(ampJ);
                const product = Complex.mul(amp, conjJ);
                rho01_re += product.re;
                rho01_im += product.im;
            } else {
                rho11 += prob;
            }
        }
        
        // Bloch vector: x = 2*Re(rho01), y = -2*Im(rho01), z = rho00 - rho11
        // Note: y = Tr(ρ·σy) = i(ρ01 - ρ10) = -2*Im(ρ01)
        const x = 2 * rho01_re;
        const y = -2 * rho01_im;  // Negative sign is crucial!
        const z = rho00 - rho11;
        
        // Normalize to unit sphere (for mixed states, |r| < 1)
        const r = Math.sqrt(x*x + y*y + z*z);
        if (r > 1e-10) {
            return { x: x/r, y: y/r, z: z/r };
        }
        return { x: 0, y: 0, z: 1 };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QuantumState };
}


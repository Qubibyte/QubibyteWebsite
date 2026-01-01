// Gate Information and Matrices

const GateInfo = {
    'H': {
        name: 'Hadamard',
        matrix: [
            ['1/√2', '1/√2'],
            ['1/√2', '-1/√2']
        ],
        description: 'Creates superposition: |0⟩ → (|0⟩ + |1⟩)/√2, |1⟩ → (|0⟩ - |1⟩)/√2',
        category: 'Single Qubit'
    },
    'X': {
        name: 'Pauli-X (NOT)',
        matrix: [
            [0, 1],
            [1, 0]
        ],
        description: 'Bit flip: |0⟩ → |1⟩, |1⟩ → |0⟩',
        category: 'Single Qubit'
    },
    'Y': {
        name: 'Pauli-Y',
        matrix: [
            [0, '-i'],
            ['i', 0]
        ],
        description: 'Bit and phase flip: |0⟩ → i|1⟩, |1⟩ → -i|0⟩',
        category: 'Single Qubit'
    },
    'Z': {
        name: 'Pauli-Z',
        matrix: [
            [1, 0],
            [0, -1]
        ],
        description: 'Phase flip: |0⟩ → |0⟩, |1⟩ → -|1⟩',
        category: 'Single Qubit'
    },
    'S': {
        name: 'Phase (S)',
        matrix: [
            [1, 0],
            [0, 'i']
        ],
        description: 'Phase gate (√Z): |0⟩ → |0⟩, |1⟩ → i|1⟩',
        category: 'Single Qubit'
    },
    'S†': {
        name: 'S-dagger',
        matrix: [
            [1, 0],
            [0, '-i']
        ],
        description: 'Inverse phase gate: |0⟩ → |0⟩, |1⟩ → -i|1⟩',
        category: 'Single Qubit'
    },
    'T': {
        name: 'T Gate',
        matrix: [
            [1, 0],
            [0, 'e^(iπ/4)']
        ],
        description: 'π/8 phase gate (√S): |0⟩ → |0⟩, |1⟩ → e^(iπ/4)|1⟩',
        category: 'Single Qubit'
    },
    'T†': {
        name: 'T-dagger',
        matrix: [
            [1, 0],
            [0, 'e^(-iπ/4)']
        ],
        description: 'Inverse T gate: |0⟩ → |0⟩, |1⟩ → e^(-iπ/4)|1⟩',
        category: 'Single Qubit'
    },
    'RX': {
        name: 'Rotation X',
        matrix: [
            ['cos(θ/2)', '-i·sin(θ/2)'],
            ['-i·sin(θ/2)', 'cos(θ/2)']
        ],
        description: 'Rotation around X-axis by angle θ',
        category: 'Single Qubit (Parameterized)'
    },
    'RY': {
        name: 'Rotation Y',
        matrix: [
            ['cos(θ/2)', '-sin(θ/2)'],
            ['sin(θ/2)', 'cos(θ/2)']
        ],
        description: 'Rotation around Y-axis by angle θ (real-valued matrix)',
        category: 'Single Qubit (Parameterized)'
    },
    'RZ': {
        name: 'Rotation Z',
        matrix: [
            ['e^(-iθ/2)', 0],
            [0, 'e^(iθ/2)']
        ],
        description: 'Rotation around Z-axis by angle θ',
        category: 'Single Qubit (Parameterized)'
    },
    'CX': {
        name: 'Controlled-X',
        matrix: [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1],
            [0, 0, 1, 0]
        ],
        description: 'If control is |1⟩, flips target: |10⟩→|11⟩, |11⟩→|10⟩',
        category: 'Multi Qubit'
    },
    'CY': {
        name: 'Controlled-Y',
        matrix: [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 0, '-i'],
            [0, 0, 'i', 0]
        ],
        description: 'If control is |1⟩, applies Y gate to target: |10⟩→i|11⟩, |11⟩→-i|10⟩',
        category: 'Multi Qubit'
    },
    'CZ': {
        name: 'Controlled-Z',
        matrix: [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, -1]
        ],
        description: 'If both qubits are |1⟩, applies phase flip: |11⟩ → -|11⟩. Supports multi-qubit control.',
        category: 'Multi Qubit'
    },
    'SWAP': {
        name: 'SWAP',
        matrix: [
            [1, 0, 0, 0],
            [0, 0, 1, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1]
        ],
        description: 'Swaps the states of two qubits: |01⟩ ↔ |10⟩',
        category: 'Multi Qubit'
    },
    'iSWAP': {
        name: 'iSWAP',
        matrix: [
            [1, 0, 0, 0],
            [0, 0, 'i', 0],
            [0, 'i', 0, 0],
            [0, 0, 0, 1]
        ],
        description: 'Swaps with phase: |01⟩ → i|10⟩, |10⟩ → i|01⟩',
        category: 'Multi Qubit'
    },
    '√SWAP': {
        name: 'Square Root SWAP',
        matrix: [
            [1, 0, 0, 0],
            [0, '(1+i)/2', '(1-i)/2', 0],
            [0, '(1-i)/2', '(1+i)/2', 0],
            [0, 0, 0, 1]
        ],
        description: 'Half of a SWAP operation',
        category: 'Multi Qubit'
    },
    'MEASURE': {
        name: 'Measurement',
        matrix: 'N/A (Projection operators: |0⟩⟨0| and |1⟩⟨1|)',
        description: 'Collapses qubit to |0⟩ or |1⟩ based on probability amplitudes',
        category: 'Measurement'
    }
};

function getGateInfo(gateType) {
    return GateInfo[gateType] || {
        name: gateType,
        matrix: 'Unknown',
        description: 'No information available',
        category: 'Unknown'
    };
}

function tensorProduct(A, B) {
    const result = [];
    for (let i = 0; i < A.length; i++) {
        for (let k = 0; k < B.length; k++) {
            const row = [];
            for (let j = 0; j < A[0].length; j++) {
                for (let l = 0; l < B[0].length; l++) {
                    row.push(A[i][j] * B[k][l]);
                }
            }
            result.push(row);
        }
    }
    return result;
}

function identity(size) {
    return Array.from({length: size}, (_, i) =>
        Array.from({length: size}, (_, j) => (i === j ? 1 : 0))
    );
}

// Embed a 2x2 gate on the last qubit of an n-qubit system
function embedSingleQubit(gate, nQubits) {
    let result = gate;
    // Place gate on the least significant qubit; tensor identities to the left
    for (let i = 1; i < nQubits; i++) {
        result = tensorProduct(identity(2), result);
    }
    return result;
}

// Embed a 4x4 gate on the last two qubits of an n-qubit system
function embedTwoQubit(gate, nQubits) {
    let result = gate;
    // Place gate on the two least significant qubits; tensor identities to the left
    for (let i = 2; i < nQubits; i++) {
        result = tensorProduct(identity(2), result);
    }
    return result;
}

function buildMultiCZ(nQubits) {
    const dim = 2 ** nQubits;
    const mat = identity(dim);
    // Flip phase of |11...1>
    mat[dim - 1][dim - 1] = -1;
    return mat;
}

function buildMultiCX(nQubits) {
    const dim = 2 ** nQubits;
    const mat = Array.from({ length: dim }, () => Array(dim).fill(0));
    for (let i = 0; i < dim; i++) {
        const lastBit = i & 1;
        const controlsMask = i >> 1; // all bits except target
        const allControlsOne = controlsMask === (dim >> 1) - 1;
        if (allControlsOne) {
            const flipped = i ^ 1; // toggle target (LSB)
            mat[flipped][i] = 1;
        } else {
            mat[i][i] = 1;
        }
    }
    return mat;
}

function buildMultiCY(nQubits) {
    const dim = 2 ** nQubits;
    const mat = Array.from({ length: dim }, () => Array(dim).fill(0));
    for (let i = 0; i < dim; i++) {
        const lastBit = i & 1;
        const controlsMask = i >> 1;
        const allControlsOne = controlsMask === (dim >> 1) - 1;
        if (allControlsOne) {
            const flipped = i ^ 1;
            // Y gate: |0⟩ → i|1⟩, |1⟩ → -i|0⟩
            // Use symbolic strings for display
            mat[flipped][i] = lastBit === 0 ? 'i' : '-i';
        } else {
            mat[i][i] = 1;
        }
    }
    return mat;
}

function getMatrixForQubits(gateType, nQubits = 2) {
    const base = GateInfo[gateType]?.matrix;
    if (!base) return 'Unknown';
    // SWAP display fixed to 2 qubits
    if (gateType === 'SWAP') {
        const displayQubits = 2;
        return embedTwoQubit(base, displayQubits);
    }
    // Multi-controlled X (CX as MCX when n>2)
    if (gateType === 'CX' && nQubits > 2) {
        return buildMultiCX(nQubits);
    }
    // Multi-controlled Y (CY as MCY when n>2)
    if (gateType === 'CY' && nQubits > 2) {
        return buildMultiCY(nQubits);
    }
    // CZ as multi-controlled Z when n>2
    if (gateType === 'CZ' && nQubits > 2) {
        return buildMultiCZ(nQubits);
    }
    // Single and two-qubit bases
    if (typeof base === 'string') return base;
    if (base.length === 2 && base[0].length === 2) {
        return embedSingleQubit(base, nQubits);
    }
    if (base.length === 4 && base[0].length === 4) {
        return embedTwoQubit(base, nQubits);
    }
    return base;
}

function formatMatrix(matrix) {
    if (typeof matrix === 'string') return matrix;
    
    // Format as HTML table for proper matrix display
    let html = '<table class="matrix-table">';
    matrix.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
            html += `<td>${formatCell(cell)}</td>`;
        });
        html += '</tr>';
    });
    html += '</table>';
    
    return html;
}

function formatCell(value) {
    // Handle string symbolic values (like 'i', '-i', 'e^(iπ/4)', etc.)
    if (typeof value === 'string') {
        return value;
    }
    
    // Handle numeric values
    if (typeof value === 'number') {
        const EPS = 1e-6;
        if (Math.abs(value - 1) < EPS) return '1';
        if (Math.abs(value + 1) < EPS) return '-1';
        if (Math.abs(value) < EPS) return '0';
        const invSqrt2 = 1 / Math.sqrt(2);
        if (Math.abs(value - invSqrt2) < EPS) return '1/√2';
        if (Math.abs(value + invSqrt2) < EPS) return '-1/√2';
        // Check for other common values
        if (Math.abs(value - 0.5) < EPS) return '1/2';
        if (Math.abs(value + 0.5) < EPS) return '-1/2';
        return value.toFixed(3);
    }
    
    return String(value);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GateInfo, getGateInfo, formatMatrix, getMatrixForQubits };
}


// Quantum Algorithms Library

// Helper function to format qubits: shorthand for single, parentheses for multiple
function formatQubits(qubits) {
    if (Array.isArray(qubits)) {
        if (qubits.length === 1) {
            return qubits[0].toString();
        } else {
            return `(${qubits.join(',')})`;
        }
    } else {
        // If it's already a string like "0,1,2", convert to array first
        const qubitArray = qubits.split(',').map(q => parseInt(q.trim()));
        if (qubitArray.length === 1) {
            return qubitArray[0].toString();
        } else {
            return `(${qubits})`;
        }
    }
}

// Helper to format an operation on a subset (e.g., X on multiple indices)
function formatOperation(op, qubits) {
    if (!qubits || qubits.length === 0) return '';
    if (qubits.length === 1) {
        return `${op} ${qubits[0]}`;
    }
    return `${op} (${qubits.join(',')})`;
}

function generateGroversAlgorithm(numQubits, target) {
    const qubits = Array.from({length: numQubits}, (_, i) => i);
    const qubitsStr = qubits.join(',');
    const iterations = Math.floor(Math.PI / 4 * Math.sqrt(Math.pow(2, numQubits)));
    
    // Create oracle for target
    // Convention: target string "110" means q2=1, q1=1, q0=0
    // target[0] corresponds to qubit (numQubits-1), target[numQubits-1] corresponds to qubit 0
    let oracleCode = '';
    const zeroIndices = [];
    for (let i = 0; i < numQubits; i++) {
        if (target[i] === '0') {
            // Convert string index to qubit index (reverse order)
            zeroIndices.push(numQubits - 1 - i);
        }
    }
    const preFlip = formatOperation('X', zeroIndices);
    if (preFlip) oracleCode += `${preFlip}\n`;
    oracleCode += `CZ [${qubitsStr}]\n`;
    if (preFlip) oracleCode += `${preFlip}\n`;
    
    // Diffusion operator
    let diffusionCode = '';
    diffusionCode += `H ${formatQubits(qubits)}\n`;
    diffusionCode += `X ${formatQubits(qubits)}\n`;
    diffusionCode += `CZ [${qubitsStr}]\n`;
    diffusionCode += `X ${formatQubits(qubits)}\n`;
    diffusionCode += `H ${formatQubits(qubits)}\n`;
    
    let code = `H ${formatQubits(qubits)}\n\n`;
    code += `REPEAT ${iterations}\n\n`;
    code += oracleCode;
    code += '\n';
    code += diffusionCode;
    code += '\nEND';
    
    return code;
}

// Generate Grover's algorithm with comments
function generateGroversAlgorithmWithComments(numQubits, target) {
    const qubits = Array.from({length: numQubits}, (_, i) => i);
    const qubitsStr = qubits.join(',');
    const iterations = Math.floor(Math.PI / 4 * Math.sqrt(Math.pow(2, numQubits)));
    
    const zeroIndices = [];
    for (let i = 0; i < numQubits; i++) {
        if (target[i] === '0') {
            zeroIndices.push(numQubits - 1 - i);
        }
    }
    
    let code = `// Grover's Search Algorithm\n`;
    code += `// Searching for state |${target}⟩ in ${numQubits} qubits\n`;
    code += `// Optimal iterations: ${iterations}\n\n`;
    code += `// Step 1: Create uniform superposition\n`;
    code += `H ${formatQubits(qubits)}\n\n`;
    code += `REPEAT ${iterations}\n\n`;
    code += `// Oracle: Mark target state |${target}⟩\n`;
    if (zeroIndices.length > 0) {
        code += `// Flip qubits that are 0 in target\n`;
        code += `${formatOperation('X', zeroIndices)}\n`;
    }
    code += `// Multi-controlled Z marks the state\n`;
    code += `CZ [${qubitsStr}]\n`;
    if (zeroIndices.length > 0) {
        code += `// Unflip to restore\n`;
        code += `${formatOperation('X', zeroIndices)}\n`;
    }
    code += `\n// Diffusion operator (amplitude amplification)\n`;
    code += `H ${formatQubits(qubits)}\n`;
    code += `X ${formatQubits(qubits)}\n`;
    code += `CZ [${qubitsStr}]\n`;
    code += `X ${formatQubits(qubits)}\n`;
    code += `H ${formatQubits(qubits)}\n`;
    code += `\nEND\n\n`;
    code += `// Result: |${target}⟩ has high probability`;
    
    return code;
}

const QuantumAlgorithms = {
    grovers: {
        name: "Grover's Algorithm",
        description: "Search algorithm for finding marked items",
        parameterizable: true,
        parameters: [
            { name: 'Number of Qubits', key: 'numQubits', type: 'number', default: 3, min: 2, max: 10 },
            { name: 'Target State (binary)', key: 'target', type: 'text', default: '101' }
        ],
        generate: (params, withComments = false) => {
            const numQubits = parseInt(params.numQubits) || 3;
            const target = params.target || '101';
            const paddedTarget = target.padStart(numQubits, '0').slice(-numQubits);
            return {
                code: withComments 
                    ? generateGroversAlgorithmWithComments(numQubits, paddedTarget)
                    : generateGroversAlgorithm(numQubits, paddedTarget),
                qubits: numQubits
            };
        },
        code: generateGroversAlgorithm(3, '101'),
        codeWithComments: generateGroversAlgorithmWithComments(3, '101'),
        qubits: 3
    },
    
    deutschJozsa: {
        name: "Deutsch-Jozsa Algorithm",
        description: "Determines if a function is constant or balanced",
        parameterizable: true,
        parameters: [
            { name: 'Number of Input Qubits', key: 'numInputs', type: 'number', default: 2, min: 1, max: 5 }
        ],
        generate: (params, withComments = false) => {
            const numInputs = parseInt(params.numInputs) || 2;
            const qubits = Array.from({length: numInputs}, (_, i) => i);
            const ancilla = numInputs;
            const allQubits = [...qubits, ancilla];
            
            let code = '';
            if (withComments) {
                code += `// Deutsch-Jozsa Algorithm\n`;
                code += `// Determines if oracle is constant or balanced\n`;
                code += `// in a single query (quantum speedup!)\n\n`;
                code += `// Prepare ancilla in |1⟩\n`;
            }
            code += `X ${ancilla}\n`;
            if (withComments) code += `// Create superposition on all qubits\n`;
            code += `H ${formatQubits(allQubits)}\n`;
            if (withComments) code += `// Oracle (balanced function example)\n`;
            for (const q of qubits) {
                code += `CX [${q},${ancilla}]\n`;
            }
            if (withComments) code += `// Apply H to input qubits\n`;
            code += `H ${formatQubits(qubits)}\n`;
            if (withComments) code += `// Measure: all 0s = constant, otherwise = balanced\n`;
            code += `MEASURE ${formatQubits(qubits)}`;
            
            return {
                code: code,
                qubits: numInputs + 1
            };
        },
        code: `X 2
H (0,1,2)
CX [0,2]
CX [1,2]
H (0,1)
MEASURE (0,1)`,
        codeWithComments: `// Deutsch-Jozsa Algorithm
// Determines if oracle is constant or balanced
// in a single query (quantum speedup!)

// Prepare ancilla (q2) in |1⟩
X 2
// Create superposition on all qubits
H (0,1,2)
// Oracle (balanced function example)
CX [0,2]
CX [1,2]
// Apply H to input qubits
H (0,1)
// Measure: all 0s = constant, otherwise = balanced
MEASURE (0,1)`,
        qubits: 3
    },
    
    qft: {
        name: "Quantum Fourier Transform",
        description: "Fourier transform on quantum states",
        qubits: 3,
        code: `H 0
S 1
T 2
CX [1,0]
CX [2,1]
H 1
S 2
CX [2,1]
H 2
SWAP [0,2]`,
        codeWithComments: `// Quantum Fourier Transform (3 qubits)
// Transforms computational basis to frequency basis
// Core subroutine in many quantum algorithms

// Apply Hadamard to first qubit
H 0
// Controlled rotations for phase
S 1
T 2
// Entangling operations
CX [1,0]
CX [2,1]
// Continue QFT on remaining qubits
H 1
S 2
CX [2,1]
H 2
// Reverse qubit order (QFT convention)
SWAP [0,2]`
    },
    
    bellState: {
        name: "Bell State",
        description: "Creates maximally entangled Bell state |Φ+⟩",
        qubits: 2,
        code: `H 0
CX [0,1]`,
        codeWithComments: `// Bell State |Φ+⟩ = (|00⟩ + |11⟩)/√2
// Maximally entangled two-qubit state
// Foundation of quantum communication

// Put q0 in superposition
H 0
// Entangle q1 with q0 using CX
// Result: measuring one qubit instantly
// determines the other's state
CX [0,1]`
    },
    
    ghzState: {
        name: "GHZ State",
        description: "Creates Greenberger-Horne-Zeilinger state",
        parameterizable: true,
        parameters: [
            { name: 'Number of Qubits', key: 'numQubits', type: 'number', default: 3, min: 3, max: 10 }
        ],
        generate: (params, withComments = false) => {
            const numQubits = Math.max(3, parseInt(params.numQubits) || 3);
            let code = '';
            
            if (withComments) {
                const zeros = '0'.repeat(numQubits);
                const ones = '1'.repeat(numQubits);
                code += `// GHZ State = (|${zeros}⟩ + |${ones}⟩)/√2\n`;
                code += `// ${numQubits}-qubit maximally entangled state\n`;
                code += `// Used in quantum error correction & cryptography\n\n`;
                code += `// Put first qubit in superposition\n`;
            }
            code += `H 0\n`;
            
            if (withComments) code += `// Chain CX gates to entangle all qubits\n`;
            for (let i = 0; i < numQubits - 1; i++) {
                code += `CX [${i},${i + 1}]\n`;
            }
            
            if (withComments) {
                code += `\n// Result: All qubits measured together\n`;
                code += `// are always all 0 or all 1`;
            }
            
            return {
                code: code.trim(),
                qubits: numQubits
            };
        },
        qubits: 3,
        code: `H 0
CX [0,1]
CX [1,2]`,
        codeWithComments: `// GHZ State = (|000⟩ + |111⟩)/√2
// Three-qubit maximally entangled state
// Used in quantum error correction & cryptography

// Put first qubit in superposition
H 0
// Entangle second qubit with first
CX [0,1]
// Entangle third qubit with second
// Now all three are correlated
CX [1,2]

// Result: All qubits measured together
// are always all 0 or all 1`
    },
    
    teleportation: {
        name: "Quantum Teleportation",
        description: "Teleports quantum state from q0 to q2",
        qubits: 3,
        code: `H 1
CX [1,2]
CX [0,1]
H 0
MEASURE (0,1)
X 2
Z 2`,
        codeWithComments: `// Quantum Teleportation Protocol
// Transfers quantum state from q0 to q2
// Using entanglement and classical communication

// Create Bell pair between q1 and q2
H 1
CX [1,2]

// Alice's operations (has q0 and q1)
// Entangle q0 with Bell pair
CX [0,1]
H 0

// Measure Alice's qubits
// Results sent classically to Bob
MEASURE (0,1)

// Bob's corrections based on measurement
// (In real protocol, these are conditional)
X 2
Z 2

// Result: q2 now has original state of q0`
    },
    
    superdense: {
        name: "Superdense Coding",
        description: "Sends 2 classical bits using 1 qubit",
        qubits: 2,
        code: `H 0
CX [0,1]
X 0
Z 0
CX [0,1]
H 0
MEASURE 0`,
        codeWithComments: `// Superdense Coding Protocol
// Send 2 classical bits using 1 qubit
// Requires pre-shared entanglement

// Create shared Bell pair
H 0
CX [0,1]

// Alice encodes 2 bits by applying gates
// 00: I (nothing), 01: X, 10: Z, 11: XZ
// This example encodes "11"
X 0
Z 0

// Bob receives qubit and decodes
CX [0,1]
H 0
MEASURE 0

// Result reveals the 2 bits Alice sent`
    },
    
    phaseKickbackCX: {
        name: "Phase Kickback (CX)",
        description: "Demonstrates phase kickback with CX. The Z phase on target kicks back to control after CX.",
        qubits: 2,
        code: `H (0,1)
Z 0
CX [1,0]
H (0,1)`,
        codeWithComments: `// Phase Kickback with CX Gate
// Demonstrates how a phase on the target qubit
// kicks back to the control qubit through CX

// Put both qubits in superposition
H (0,1)

// Apply Z to q0 (this phase will kick back)
Z 0

// CX with q1 as control, q0 as target
// The phase from Z kicks back to q1
CX [1,0]

// Return to computational basis to observe
H (0,1)

// Result: The phase has transferred from q0 to q1`
    },
    
    phaseKickbackCZ: {
        name: "Phase Kickback (CZ)",
        description: "Demonstrates phase kickback with CZ. The X state on q0 receives a phase flip through CZ.",
        qubits: 2,
        code: `X 0
H 1
CZ [1,0]
H 1`,
        codeWithComments: `// Phase Kickback with CZ Gate
// Shows how CZ causes phase kickback when one
// qubit is in |1⟩ and other is in superposition

// Put q0 in |1⟩ state
X 0

// Put q1 in |+⟩ superposition
H 1

// Apply CZ - since q0 is |1⟩, q1 gets phase flipped
// q1 goes from |+⟩ to |−⟩
CZ [1,0]

// Convert q1 back to see the effect
// |−⟩ becomes |1⟩ after H
H 1

// Result: q1 is now |1⟩ due to phase kickback`
    },
    
    phaseKickbackOracle: {
        name: "Phase Kickback Oracle",
        description: "Shows how phase kickback marks states in quantum algorithms like Grover's search.",
        qubits: 3,
        code: `H (0,1,2)
X 0
CZ [0,1,2]
X 0`,
        codeWithComments: `// Phase Kickback as Oracle (Grover's marking)
// Demonstrates marking a specific state with phase
// This is the core of Grover's search algorithm

// Create uniform superposition of all states
H (0,1,2)

// Oracle: marks |110⟩ by applying phase flip
// We want to flip phase when q2=1, q1=1, q0=0

// Flip q0 so we mark when all qubits are |1⟩
X 0

// Multi-controlled Z flips phase of |111⟩
// (which corresponds to original |110⟩)
CZ [0,1,2]

// Unflip q0 to restore original encoding
X 0

// Result: |110⟩ now has -1 phase (marked)
// All other states unchanged`
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QuantumAlgorithms };
}


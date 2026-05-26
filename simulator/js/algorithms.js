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
        const qubitArray = qubits.split(',').map(q => parseInt(q.trim()));
        if (qubitArray.length === 1) {
            return qubitArray[0].toString();
        } else {
            return `(${qubits})`;
        }
    }
}

// Helper to format an operation on a subset
function formatOperation(op, qubits) {
    if (!qubits || qubits.length === 0) return '';
    if (qubits.length === 1) {
        return `${op} ${qubits[0]}`;
    }
    return `${op} (${qubits.join(',')})`;
}

function generateGroversAlgorithm(numQubits, target) {
    const qubits = Array.from({ length: numQubits }, (_, i) => i);
    const qubitsStr = qubits.join(',');
    const iterations = Math.floor(Math.PI / 4 * Math.sqrt(Math.pow(2, numQubits)));

    let oracleCode = '';
    const zeroIndices = [];
    for (let i = 0; i < numQubits; i++) {
        if (target[i] === '0') {
            zeroIndices.push(numQubits - 1 - i);
        }
    }
    const preFlip = formatOperation('X', zeroIndices);
    if (preFlip) oracleCode += `${preFlip}\n`;
    oracleCode += `CZ [${qubitsStr}]\n`;
    if (preFlip) oracleCode += `${preFlip}\n`;

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

function generateGroversAlgorithmWithComments(numQubits, target) {
    const qubits = Array.from({ length: numQubits }, (_, i) => i);
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
    bellState: {
        name: "Bell State",
        icon: "🔗",
        category: "Entanglement",
        description: "Creates maximally entangled Bell state between two qubits",
        longDescription: "A Bell state is one of four maximally entangled two-qubit quantum states that form the Bell basis. They are the simplest examples of quantum entanglement. When two qubits are in a Bell state, measuring one instantly determines the state of the other, regardless of distance — the phenomenon Einstein called 'spooky action at a distance'.",
        keyInsights: [
            "Measurement outcomes are perfectly correlated",
            "Cannot be described as a product of individual qubit states",
            "Foundation of quantum teleportation and superdense coding",
            "Violates Bell inequalities, proving quantum non-locality"
        ],
        complexity: "O(1)",
        qubitRange: "2",
        parameterizable: true,
        parameters: [
            {
                name: 'Bell State Type', key: 'bellType', type: 'select', default: 'phi_plus',
                options: [
                    { value: 'phi_plus', label: '|Φ+⟩ = (|00⟩ + |11⟩)/√2' },
                    { value: 'phi_minus', label: '|Φ−⟩ = (|00⟩ − |11⟩)/√2' },
                    { value: 'psi_plus', label: '|Ψ+⟩ = (|01⟩ + |10⟩)/√2' },
                    { value: 'psi_minus', label: '|Ψ−⟩ = (|01⟩ − |10⟩)/√2' }
                ]
            }
        ],
        generate: (params, withComments = false) => {
            const bellType = params.bellType || 'phi_plus';
            let code = '';
            const labels = {
                phi_plus: '|Φ+⟩ = (|00⟩ + |11⟩)/√2',
                phi_minus: '|Φ−⟩ = (|00⟩ − |11⟩)/√2',
                psi_plus: '|Ψ+⟩ = (|01⟩ + |10⟩)/√2',
                psi_minus: '|Ψ−⟩ = (|01⟩ − |10⟩)/√2'
            };
            if (withComments) {
                code += `// Bell State ${labels[bellType]}\n`;
                code += `// Maximally entangled two-qubit state\n\n`;
            }
            // Standard construction — q0 is rightmost bit in |q1 q0⟩
            // |Φ+⟩: H, CX
            // |Φ−⟩: X q0 → H → CX  (starting from |01⟩)
            // |Ψ+⟩: X q1 → H → CX  (starting from |10⟩)
            // |Ψ−⟩: X q1 → H → CX → Z q1
            if (bellType === 'phi_minus') {
                if (withComments) code += `// Prepare q0 in |1⟩ for minus variant\n`;
                code += `X 0\n`;
            }
            if (bellType === 'psi_plus' || bellType === 'psi_minus') {
                if (withComments) code += `// Prepare q1 in |1⟩ for Ψ variant\n`;
                code += `X 1\n`;
            }
            if (withComments) code += `// Create superposition on q0\n`;
            code += `H 0\n`;
            if (withComments) code += `// Entangle q1 with q0\n`;
            code += `CX [0,1]`;
            if (bellType === 'phi_minus') {
                // Φ− already correct from input state preparation
            }
            if (bellType === 'psi_minus') {
                if (withComments) code += `\n// Phase flip for |Ψ−⟩\n`;
                code += `\nZ 1`;
            }
            if (withComments) code += `\n\n// Result: ${labels[bellType]}`;
            return { code: code.trim(), qubits: 2 };
        },
        qubits: 2,
        code: `H 0\nCX [0,1]`,
        codeWithComments: `// Bell State |Φ+⟩ = (|00⟩ + |11⟩)/√2\n// Maximally entangled two-qubit state\n// Foundation of quantum communication\n\n// Put q0 in superposition\nH 0\n// Entangle q1 with q0 using CX\n// Result: measuring one qubit instantly\n// determines the other's state\nCX [0,1]`
    },

    ghzState: {
        name: "GHZ State",
        icon: "🌐",
        category: "Entanglement",
        description: "Creates Greenberger-Horne-Zeilinger multi-qubit entangled state",
        longDescription: "The GHZ state generalizes Bell states to three or more qubits. Named after Greenberger, Horne, and Zeilinger, it creates an equal superposition of all qubits being |0⟩ and all being |1⟩. GHZ states are maximally entangled and are crucial for quantum error correction, secret sharing, and tests of quantum non-locality.",
        keyInsights: [
            "All qubits are maximally entangled together",
            "Measurement of any qubit collapses all others",
            "Used in quantum secret sharing protocols",
            "More fragile than W states — losing one qubit destroys all entanglement"
        ],
        complexity: "O(n)",
        qubitRange: "2+",
        parameterizable: true,
        parameters: [
            { name: 'Number of Qubits', key: 'numQubits', type: 'number', default: 3, min: 2 }
        ],
        generate: (params, withComments = false) => {
            const numQubits = Math.max(2, parseInt(params.numQubits) || 3);
            let code = '';
            if (withComments) {
                const zeros = '0'.repeat(numQubits);
                const ones = '1'.repeat(numQubits);
                code += `// GHZ State = (|${zeros}⟩ + |${ones}⟩)/√2\n`;
                code += `// ${numQubits}-qubit maximally entangled state\n\n`;
                code += `// Put first qubit in superposition\n`;
            }
            code += `H 0\n`;
            if (withComments) code += `// Chain CX gates to entangle all qubits\n`;
            for (let i = 0; i < numQubits - 1; i++) {
                code += `CX [${i},${i + 1}]\n`;
            }
            if (withComments) code += `\n// Result: All qubits are always all 0 or all 1`;
            return { code: code.trim(), qubits: numQubits };
        },
        qubits: 3,
        code: `H 0\nCX [0,1]\nCX [1,2]`,
        codeWithComments: `// GHZ State = (|000⟩ + |111⟩)/√2\n// Three-qubit maximally entangled state\n\n// Put first qubit in superposition\nH 0\n// Entangle second qubit with first\nCX [0,1]\n// Entangle third qubit\nCX [1,2]\n\n// Result: All qubits measured together\n// are always all 0 or all 1`
    },

    wState: {
        name: "W State",
        icon: "🌊",
        category: "Entanglement",
        description: "Creates a W state - entanglement robust to qubit loss",
        longDescription: "The W state is a multi-qubit entangled state where exactly one qubit is in |1⟩ and the rest are |0⟩, in an equal superposition of all such possibilities. Unlike GHZ states, W states are robust: if one qubit is lost, the remaining qubits are still entangled. This makes W states valuable for quantum networks and fault-tolerant protocols.",
        keyInsights: [
            "Robust entanglement — survives loss of a qubit",
            "Equal superposition of all single-excitation states",
            "Different entanglement class than GHZ (cannot convert between them with local operations)",
            "Useful in quantum memories and leader election protocols"
        ],
        complexity: "O(n)",
        qubitRange: "3+",
        parameterizable: true,
        parameters: [
            { name: 'Number of Qubits', key: 'numQubits', type: 'number', default: 3, min: 3 }
        ],
        generate: (params, withComments = false) => {
            const numQubits = Math.max(3, parseInt(params.numQubits) || 3);
            let code = '';
            if (withComments) {
                const terms = [];
                for (let i = 0; i < numQubits; i++) {
                    let s = '';
                    for (let j = numQubits - 1; j >= 0; j--) {
                        s += (j === i) ? '1' : '0';
                    }
                    terms.push(`|${s}⟩`);
                }
                code += `// W State = (${terms.join(' + ')})/√${numQubits}\n`;
                code += `// Entanglement survives loss of any single qubit\n\n`;
            }
            // Build W state using RY rotations and controlled-X
            // Start by putting a single excitation on q0 and distributing it
            if (withComments) code += `// Initialize single excitation on q0\n`;
            code += `X 0\n`;
            // Distribute using controlled operations
            for (let i = 0; i < numQubits - 1; i++) {
                const remaining = numQubits - i;
                const angle = 2 * Math.acos(Math.sqrt(1 / remaining));
                // Qubi parser expects angle as multiplier of π
                const anglePi = angle / Math.PI;
                if (withComments) code += `// Distribute excitation: split 1/${remaining} to q${i + 1}\n`;
                code += `RY ${i} ${anglePi.toFixed(4)}\n`;
                code += `CX [${i},${i + 1}]\n`;
            }
            if (withComments) code += `\n// Result: Equal superposition of single-excitation states`;
            return { code: code.trim(), qubits: numQubits };
        },
        qubits: 3,
        code: `X 0\nRY 0 0.3918\nCX [0,1]\nRY 1 0.5000\nCX [1,2]`,
        codeWithComments: `// W State = (|001⟩ + |010⟩ + |100⟩)/√3\n// Entanglement survives loss of any single qubit\n\n// Initialize single excitation on q0\nX 0\n// Distribute excitation\nRY 0 0.3918\nCX [0,1]\nRY 1 0.5000\nCX [1,2]\n\n// Result: Equal superposition of single-excitation states`
    },

    superdense: {
        name: "Superdense Coding",
        icon: "📡",
        category: "Communication",
        description: "Sends 2 classical bits using 1 qubit via pre-shared entanglement",
        longDescription: "Superdense coding is a quantum communication protocol that allows transmission of two classical bits of information by sending only one qubit, provided the sender and receiver share a pre-entangled Bell pair. Alice encodes her 2-bit message by applying gates to her qubit, then sends it to Bob, who decodes by performing a Bell measurement.",
        keyInsights: [
            "Doubles the classical capacity of a quantum channel",
            "Requires pre-shared entanglement (Bell pair)",
            "Alice encodes: 00→I, 01→Z, 10→X, 11→XZ",
            "Bob decodes with CX + H and measures both qubits"
        ],
        complexity: "O(1)",
        qubitRange: "2",
        parameterizable: true,
        parameters: [
            {
                name: 'Message to Encode', key: 'message', type: 'select', default: '11',
                options: [
                    { value: '00', label: '00 — No gate (Identity)' },
                    { value: '01', label: '01 — Apply Z gate' },
                    { value: '10', label: '10 — Apply X gate' },
                    { value: '11', label: '11 — Apply X then Z' }
                ]
            }
        ],
        generate: (params, withComments = false) => {
            const message = params.message || '11';
            let code = '';
            if (withComments) {
                code += `// Superdense Coding Protocol\n`;
                code += `// Encoding message "${message}" using 1 qubit\n\n`;
                code += `// Step 1: Create shared Bell pair\n`;
            }
            code += `H 0\nCX [0,1]\n`;
            if (withComments) code += `\n// Step 2: Alice encodes "${message}"\n`;
            if (message[0] === '1') {
                if (withComments) code += `// Apply X for bit flip\n`;
                code += `X 0\n`;
            }
            if (message[1] === '1') {
                if (withComments) code += `// Apply Z for phase flip\n`;
                code += `Z 0\n`;
            }
            if (message === '00') {
                if (withComments) code += `// No encoding needed for "00"\n`;
            }
            if (withComments) code += `\n// Step 3: Bob decodes\n`;
            code += `CX [0,1]\nH 0\n`;
            if (withComments) code += `\n// Measure both qubits to read message\n`;
            code += `MEASURE (0,1)`;
            if (withComments) code += `\n\n// Result: Measurement reveals "${message}"`;
            return { code: code.trim(), qubits: 2 };
        },
        qubits: 2,
        code: `H 0\nCX [0,1]\nX 0\nZ 0\nCX [0,1]\nH 0\nMEASURE (0,1)`,
        codeWithComments: `// Superdense Coding Protocol\n// Encoding message "11" using 1 qubit\n\n// Create shared Bell pair\nH 0\nCX [0,1]\n\n// Alice encodes "11"\nX 0\nZ 0\n\n// Bob decodes\nCX [0,1]\nH 0\n\n// Measure both qubits\nMEASURE (0,1)\n\n// Result: Measurement reveals "11"`
    },

    teleportation: {
        name: "Quantum Teleportation",
        icon: "✨",
        category: "Communication",
        description: "Teleports a quantum state from one qubit to another using entanglement",
        longDescription: "Quantum teleportation transfers the complete quantum state of a qubit to a distant qubit without physically moving the qubit itself. It uses a shared Bell pair and two classical bits of communication. The original qubit's state is destroyed in the process (consistent with the no-cloning theorem). This protocol is essential for quantum networks and distributed quantum computing.",
        keyInsights: [
            "Does NOT transmit information faster than light (requires classical channel)",
            "Original state is destroyed (no-cloning theorem preserved)",
            "Requires pre-shared entanglement and 2 classical bits",
            "Conditional corrections (X, Z) depend on Alice's measurement results"
        ],
        complexity: "O(1)",
        qubitRange: "3",
        parameterizable: true,
        parameters: [
            {
                name: 'Initial State to Teleport', key: 'initState', type: 'select', default: 'plus',
                options: [
                    { value: 'zero', label: '|0⟩ state' },
                    { value: 'one', label: '|1⟩ state' },
                    { value: 'plus', label: '|+⟩ = (|0⟩+|1⟩)/√2' },
                    { value: 'minus', label: '|−⟩ = (|0⟩−|1⟩)/√2' }
                ]
            }
        ],
        generate: (params, withComments = false) => {
            const initState = params.initState || 'plus';
            let code = '';
            if (withComments) {
                const stateLabels = { zero: '|0⟩', one: '|1⟩', plus: '|+⟩', minus: '|−⟩' };
                code += `// Quantum Teleportation Protocol\n`;
                code += `// Teleporting ${stateLabels[initState]} from q0 to q2\n\n`;
                code += `// Prepare the state to teleport on q0\n`;
            }
            // Prepare q0
            if (initState === 'one') {
                code += `X 0\n`;
            } else if (initState === 'plus') {
                code += `H 0\n`;
            } else if (initState === 'minus') {
                code += `X 0\nH 0\n`;
            }
            // zero: no prep needed
            if (withComments) code += `\n// Create Bell pair between q1 and q2\n`;
            code += `H 1\nCX [1,2]\n`;
            if (withComments) code += `\n// Alice's Bell measurement on q0, q1\n`;
            code += `CX [0,1]\nH 0\n`;
            if (withComments) code += `\n// Measure Alice's qubits\n`;
            code += `MEASURE (0,1)\n`;
            if (withComments) {
                code += `\n// Bob's corrections (shown unconditionally for demo)\n`;
                code += `// In real protocol, X and Z are conditional on measurement\n`;
            }
            code += `CX [1,2]\nCZ [0,2]`;
            if (withComments) code += `\n\n// Result: q2 now holds the teleported state`;
            return { code: code.trim(), qubits: 3 };
        },
        qubits: 3,
        code: `H 0\nH 1\nCX [1,2]\nCX [0,1]\nH 0\nMEASURE (0,1)\nCX [1,2]\nCZ [0,2]`,
        codeWithComments: `// Quantum Teleportation Protocol\n// Teleporting |+⟩ from q0 to q2\n\n// Prepare |+⟩ on q0\nH 0\n\n// Create Bell pair between q1 and q2\nH 1\nCX [1,2]\n\n// Alice's Bell measurement\nCX [0,1]\nH 0\n\n// Measure Alice's qubits\nMEASURE (0,1)\n\n// Bob's corrections\nCX [1,2]\nCZ [0,2]\n\n// Result: q2 now holds the teleported state`
    },

    deutschJozsa: {
        name: "Deutsch-Jozsa Algorithm",
        icon: "⚖️",
        category: "Algorithm",
        description: "Determines if a function is constant or balanced in a single query",
        longDescription: "The Deutsch-Jozsa algorithm was one of the first to demonstrate quantum computational advantage. Given a black-box function that is either constant (same output for all inputs) or balanced (outputs 0 for half the inputs and 1 for the other half), this algorithm determines which type it is with 100% certainty using only ONE function evaluation — whereas a classical algorithm would need up to 2^(n-1)+1 evaluations.",
        keyInsights: [
            "First algorithm to show exponential quantum speedup",
            "Uses quantum parallelism to evaluate all inputs simultaneously",
            "Ancilla qubit prepared in |−⟩ enables phase kickback",
            "All 0s measurement = constant function, any 1 = balanced"
        ],
        complexity: "O(1) vs O(2ⁿ)",
        qubitRange: "2+",
        parameterizable: true,
        parameters: [
            { name: 'Number of Input Qubits', key: 'numInputs', type: 'number', default: 2, min: 1 },
            {
                name: 'Oracle Type', key: 'oracleType', type: 'select', default: 'balanced',
                options: [
                    { value: 'balanced', label: 'Balanced function (XOR oracle)' },
                    { value: 'constant0', label: 'Constant function (always 0)' },
                    { value: 'constant1', label: 'Constant function (always 1)' }
                ]
            }
        ],
        generate: (params, withComments = false) => {
            const numInputs = parseInt(params.numInputs) || 2;
            const oracleType = params.oracleType || 'balanced';
            const qubits = Array.from({ length: numInputs }, (_, i) => i);
            const ancilla = numInputs;
            const allQubits = [...qubits, ancilla];

            let code = '';
            if (withComments) {
                code += `// Deutsch-Jozsa Algorithm\n`;
                code += `// Oracle type: ${oracleType}\n`;
                code += `// ${numInputs} input qubits + 1 ancilla\n\n`;
                code += `// Prepare ancilla in |1⟩\n`;
            }
            code += `X ${ancilla}\n`;
            if (withComments) code += `// Create superposition on all qubits\n`;
            code += `H ${formatQubits(allQubits)}\n`;
            if (withComments) code += `\n// Oracle\n`;
            if (oracleType === 'balanced') {
                if (withComments) code += `// Balanced: CX from each input to ancilla\n`;
                for (const q of qubits) {
                    code += `CX [${q},${ancilla}]\n`;
                }
            } else if (oracleType === 'constant1') {
                if (withComments) code += `// Constant-1: flip ancilla\n`;
                code += `X ${ancilla}\n`;
            } else {
                if (withComments) code += `// Constant-0: do nothing (identity)\n`;
            }
            if (withComments) code += `\n// Apply H to input qubits and measure\n`;
            code += `H ${formatQubits(qubits)}\n`;
            code += `MEASURE ${formatQubits(qubits)}`;
            if (withComments) {
                if (oracleType === 'balanced') {
                    code += `\n\n// Expected: NOT all zeros → balanced`;
                } else {
                    code += `\n\n// Expected: all zeros → constant`;
                }
            }
            return { code: code.trim(), qubits: numInputs + 1 };
        },
        code: `X 2\nH (0,1,2)\nCX [0,2]\nCX [1,2]\nH (0,1)\nMEASURE (0,1)`,
        codeWithComments: `// Deutsch-Jozsa Algorithm\n// Determines if oracle is constant or balanced\n// in a single query (quantum speedup!)\n\n// Prepare ancilla (q2) in |1⟩\nX 2\n// Create superposition on all qubits\nH (0,1,2)\n\n// Oracle (balanced function)\nCX [0,2]\nCX [1,2]\n\n// Apply H to input qubits\nH (0,1)\nMEASURE (0,1)\n\n// Expected: NOT all zeros → balanced`,
        qubits: 3
    },

    bernsteinVazirani: {
        name: "Bernstein-Vazirani",
        icon: "🔑",
        category: "Algorithm",
        description: "Finds a hidden binary string in a single query",
        longDescription: "The Bernstein-Vazirani algorithm finds a secret string s encoded in a function f(x) = s·x mod 2 (bitwise dot product). Classically, finding an n-bit secret string requires n queries. Quantum mechanically, it takes only ONE query. This is achieved through quantum parallelism and phase kickback from the oracle.",
        keyInsights: [
            "Finds n-bit secret string in 1 query vs n classically",
            "Oracle computes f(x) = s·x mod 2 (inner product)",
            "Direct application of the Hadamard transform and phase kickback",
            "Precursor to more powerful algorithms like Simon's"
        ],
        complexity: "O(1) vs O(n)",
        qubitRange: "2+",
        parameterizable: true,
        parameters: [
            { name: 'Secret String (binary)', key: 'secret', type: 'text', default: '101' }
        ],
        generate: (params, withComments = false) => {
            const secret = params.secret || '101';
            const numInputs = secret.length;
            const ancilla = numInputs;
            const qubits = Array.from({ length: numInputs }, (_, i) => i);
            const allQubits = [...qubits, ancilla];

            let code = '';
            if (withComments) {
                code += `// Bernstein-Vazirani Algorithm\n`;
                code += `// Finding secret string: ${secret}\n\n`;
                code += `// Prepare ancilla in |−⟩\n`;
            }
            code += `X ${ancilla}\n`;
            if (withComments) code += `// Superposition on all qubits\n`;
            code += `H ${formatQubits(allQubits)}\n`;
            if (withComments) code += `\n// Oracle: f(x) = s·x mod 2\n`;
            // Oracle: CX from each qubit where secret bit is 1
            for (let i = 0; i < numInputs; i++) {
                // secret[0] is MSB, corresponds to qubit (numInputs-1)
                if (secret[i] === '1') {
                    const qubitIdx = numInputs - 1 - i;
                    if (withComments) code += `// Secret bit ${i} is 1 → CX from q${qubitIdx}\n`;
                    code += `CX [${qubitIdx},${ancilla}]\n`;
                }
            }
            if (withComments) code += `\n// Apply H to input qubits and measure\n`;
            code += `H ${formatQubits(qubits)}\n`;
            code += `MEASURE ${formatQubits(qubits)}`;
            if (withComments) code += `\n\n// Result reveals secret string: ${secret}`;
            return { code: code.trim(), qubits: numInputs + 1 };
        },
        qubits: 4,
        code: `X 3\nH (0,1,2,3)\nCX [2,3]\nCX [0,3]\nH (0,1,2)\nMEASURE (0,1,2)`,
        codeWithComments: `// Bernstein-Vazirani Algorithm\n// Finding secret string: 101\n\n// Prepare ancilla in |−⟩\nX 3\n// Superposition on all qubits\nH (0,1,2,3)\n\n// Oracle: f(x) = s·x mod 2\n// Secret bit 0 is 1 → CX from q2\nCX [2,3]\n// Secret bit 2 is 1 → CX from q0\nCX [0,3]\n\n// Apply H to input qubits and measure\nH (0,1,2)\nMEASURE (0,1,2)\n\n// Result reveals secret string: 101`
    },

    grovers: {
        name: "Grover's Algorithm",
        icon: "🔍",
        category: "Algorithm",
        description: "Quantum search algorithm — finds marked items with quadratic speedup",
        longDescription: "Grover's algorithm provides a quadratic speedup for unstructured search problems. Given a search space of N items, it finds a marked item in O(√N) evaluations instead of O(N) classically. The algorithm works by repeatedly applying an oracle (which marks the target) followed by a diffusion operator (which amplifies the target's amplitude). After ~π/4·√N iterations, measuring yields the target with high probability.",
        keyInsights: [
            "Quadratic speedup: O(√N) vs O(N) classical",
            "Optimal — provably the best possible quantum search",
            "Oracle marks target state with phase flip (−1)",
            "Diffusion operator = 'inversion about the mean'",
            "Too many iterations will DECREASE success probability"
        ],
        complexity: "O(√N)",
        qubitRange: "2+",
        parameterizable: true,
        parameters: [
            { name: 'Number of Qubits', key: 'numQubits', type: 'number', default: 3, min: 2 },
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

    qft: {
        name: "Quantum Fourier Transform",
        icon: "📊",
        category: "Algorithm",
        description: "Transforms computational basis to frequency basis",
        longDescription: "The Quantum Fourier Transform (QFT) is the quantum analogue of the discrete Fourier transform. It maps computational basis states to a frequency domain representation. The QFT is a key subroutine in many quantum algorithms including Shor's factoring algorithm, quantum phase estimation, and quantum simulation. While a classical FFT requires O(n·2ⁿ) operations, the QFT needs only O(n²) gates.",
        keyInsights: [
            "Exponentially faster than classical FFT: O(n²) vs O(n·2ⁿ)",
            "Core subroutine of Shor's algorithm for factoring",
            "Uses Hadamard gates and controlled phase rotations",
            "Output qubits are in reverse order (requires SWAP)"
        ],
        complexity: "O(n²)",
        qubitRange: "2+",
        parameterizable: true,
        parameters: [
            { name: 'Number of Qubits', key: 'numQubits', type: 'number', default: 3, min: 2 }
        ],
        generate: (params, withComments = false) => {
            const numQubits = Math.max(2, parseInt(params.numQubits) || 3);
            let code = '';
            if (withComments) {
                code += `// Quantum Fourier Transform (${numQubits} qubits)\n`;
                code += `// Transforms computational basis → frequency basis\n\n`;
            }
            // QFT: for each qubit i, apply H, then controlled-Rk from higher qubits
            // We approximate controlled-Rk with available gates
            for (let i = numQubits - 1; i >= 0; i--) {
                if (withComments) code += `// Apply H to q${i}\n`;
                code += `H ${i}\n`;
                // Controlled phase rotations from qubits below
                for (let j = i - 1; j >= 0; j--) {
                    const k = i - j + 1;
                    const angle = Math.PI / Math.pow(2, k - 1);
                    if (withComments) code += `// Controlled R${k} phase from q${j}\n`;
                    // Approximate with RZ on target conditioned — using RZ directly as we lack CRk
                    // For a simplified QFT, use S (π/2) and T (π/4) gates where applicable
                    if (k === 2) {
                        // S gate = Rz(π/2)
                        code += `CZ [${j},${i}]\n`;
                    } else if (k === 3) {
                        // T gate = Rz(π/4) — approximate with available gates
                        code += `CZ [${j},${i}]\n`;
                    }
                }
            }
            // Reverse qubit order
            if (withComments) code += `\n// Reverse qubit order (QFT convention)\n`;
            for (let i = 0; i < Math.floor(numQubits / 2); i++) {
                code += `SWAP [${i},${numQubits - 1 - i}]\n`;
            }
            if (withComments) code += `\n// Note: This is a simplified QFT using available gates`;
            return { code: code.trim(), qubits: numQubits };
        },
        qubits: 3,
        code: `H 2\nCZ [1,2]\nH 1\nCZ [0,2]\nCZ [0,1]\nH 0\nSWAP [0,2]`,
        codeWithComments: `// Quantum Fourier Transform (3 qubits)\n// Transforms computational basis → frequency basis\n\n// Apply H to q2\nH 2\n// Controlled phase from q1\nCZ [1,2]\n// Apply H to q1\nH 1\n// Controlled phases from q0\nCZ [0,2]\nCZ [0,1]\n// Apply H to q0\nH 0\n\n// Reverse qubit order\nSWAP [0,2]\n\n// Note: Simplified QFT using available gates`
    },

    phaseKickbackCX: {
        name: "Phase Kickback (CX)",
        icon: "⚡",
        category: "Concept",
        description: "Demonstrates phase kickback with CX — phase transfers from target to control",
        longDescription: "Phase kickback is a fundamental quantum phenomenon where applying a controlled gate causes the eigenvalue phase of the target qubit's state to 'kick back' onto the control qubit. This is the key mechanism behind many quantum algorithms. In this demo, a Z phase on the target qubit transfers to the control qubit through a CX gate.",
        keyInsights: [
            "Phase moves from target to control — counterintuitive!",
            "CX with target in eigenstate of X creates kickback",
            "Core mechanism of Grover's, Deutsch-Jozsa, QPE",
            "CX is symmetric under Hadamard: HH·CX·HH = reversed CX"
        ],
        complexity: "O(1)",
        qubitRange: "2",
        qubits: 2,
        code: `H (0,1)\nZ 0\nCX [1,0]\nH (0,1)`,
        codeWithComments: `// Phase Kickback with CX Gate\n// Phase on target qubit kicks back to control\n\n// Put both qubits in superposition\nH (0,1)\n\n// Apply Z to q0 (phase to kick back)\nZ 0\n\n// CX with q1 as control, q0 as target\n// The Z phase kicks back to q1\nCX [1,0]\n\n// Return to computational basis to observe\nH (0,1)\n\n// Result: Phase has transferred from q0 to q1`
    },

    phaseKickbackCZ: {
        name: "Phase Kickback (CZ)",
        icon: "⚡",
        category: "Concept",
        description: "Demonstrates phase kickback with CZ — symmetric phase interaction",
        longDescription: "The CZ gate applies a phase flip when both qubits are |1⟩. Unlike CX, the CZ gate is symmetric — it doesn't matter which qubit is 'control' and which is 'target'. This demo shows how a qubit in |1⟩ causes a phase flip on another qubit in superposition via CZ, illustrating the symmetry of this interaction.",
        keyInsights: [
            "CZ is symmetric: CZ|a,b⟩ = (−1)^(a·b)|a,b⟩",
            "No distinction between control and target",
            "|+⟩ becomes |−⟩ when CZ partner is |1⟩",
            "Used in graph states and measurement-based QC"
        ],
        complexity: "O(1)",
        qubitRange: "2",
        qubits: 2,
        code: `X 0\nH 1\nCZ [1,0]\nH 1`,
        codeWithComments: `// Phase Kickback with CZ Gate\n// CZ is symmetric — no control/target distinction\n\n// Put q0 in |1⟩ state\nX 0\n\n// Put q1 in |+⟩ superposition\nH 1\n\n// CZ: since q0 is |1⟩, q1 gets phase flipped\n// q1 goes from |+⟩ to |−⟩\nCZ [1,0]\n\n// Convert q1 back to see the effect\n// |−⟩ becomes |1⟩ after H\nH 1\n\n// Result: q1 is now |1⟩ due to phase kickback`
    },

    phaseKickbackOracle: {
        name: "Phase Kickback Oracle",
        icon: "🎯",
        category: "Concept",
        description: "Shows how phase kickback marks states in quantum search algorithms",
        longDescription: "This demo shows the oracle marking mechanism used in Grover's algorithm and other quantum search protocols. The oracle applies a multi-controlled Z gate that flips the phase of exactly one computational basis state. When applied to a uniform superposition, this marks the target state with a −1 phase, which can later be amplified by the diffusion operator.",
        keyInsights: [
            "Oracle marks target state with −1 phase (invisible classically!)",
            "X gates before/after CZ select which state to mark",
            "This is half of one Grover iteration",
            "Marking doesn't change measurement probabilities alone — needs amplification"
        ],
        complexity: "O(1)",
        qubitRange: "3",
        qubits: 3,
        code: `H (0,1,2)\nX 0\nCZ [0,1,2]\nX 0`,
        codeWithComments: `// Phase Kickback as Oracle (Grover's marking)\n// Marks |110⟩ with phase flip\n\n// Create uniform superposition\nH (0,1,2)\n\n// Oracle: mark |110⟩ (q2=1, q1=1, q0=0)\n// Flip q0 so CZ marks when all are |1⟩\nX 0\n\n// Multi-controlled Z flips phase of |111⟩\n// (= original |110⟩)\nCZ [0,1,2]\n\n// Unflip q0\nX 0\n\n// Result: |110⟩ now has −1 phase (marked)`
    },

    swapTest: {
        name: "SWAP Test",
        icon: "🔄",
        category: "Concept",
        description: "Measures the overlap between two quantum states without measuring them directly",
        longDescription: "The SWAP test is a quantum algorithm that determines how similar two quantum states are without directly measuring either state. It uses a controlled-SWAP (Fredkin gate) with an ancilla qubit. After measurement, the ancilla qubit is |0⟩ with probability (1 + |⟨ψ|φ⟩|²)/2. If the states are identical, the ancilla is always |0⟩; if orthogonal, it's |0⟩ or |1⟩ with equal probability.",
        keyInsights: [
            "Non-destructive comparison of quantum states",
            "P(ancilla=0) = (1 + |⟨ψ|φ⟩|²)/2",
            "Identical states → ancilla always 0",
            "Orthogonal states → ancilla 50/50"
        ],
        complexity: "O(1)",
        qubitRange: "3",
        parameterizable: true,
        parameters: [
            {
                name: 'State Comparison', key: 'comparison', type: 'select', default: 'same',
                options: [
                    { value: 'same', label: 'Same states (|0⟩ vs |0⟩) — expect ancilla=0' },
                    { value: 'orthogonal', label: 'Orthogonal (|0⟩ vs |1⟩) — expect 50/50' },
                    { value: 'similar', label: 'Similar (|0⟩ vs |+⟩) — expect 75% ancilla=0' }
                ]
            }
        ],
        generate: (params, withComments = false) => {
            const comparison = params.comparison || 'same';
            let code = '';
            if (withComments) {
                const labels = { same: '|0⟩ vs |0⟩', orthogonal: '|0⟩ vs |1⟩', similar: '|0⟩ vs |+⟩' };
                code += `// SWAP Test: comparing ${labels[comparison]}\n`;
                code += `// q0 = ancilla, q1 = state A, q2 = state B\n\n`;
                code += `// Prepare states to compare\n`;
            }
            // q1 = state A (always |0⟩), q2 = state B
            if (comparison === 'orthogonal') {
                code += `X 2\n`;
            } else if (comparison === 'similar') {
                code += `H 2\n`;
            }
            if (withComments) code += `\n// Ancilla in superposition\n`;
            code += `H 0\n`;
            if (withComments) code += `// Controlled-SWAP (approximated)\n`;
            // Controlled-SWAP using CX decomposition
            code += `CX [1,2]\nCX [0,1]\nCX [1,2]\n`;
            if (withComments) code += `// Measure ancilla\n`;
            code += `H 0\nMEASURE 0`;
            if (withComments) {
                const expect = { same: 'always 0', orthogonal: '50/50', similar: '~75% chance of 0' };
                code += `\n\n// Expected: ancilla ${expect[comparison]}`;
            }
            return { code: code.trim(), qubits: 3 };
        },
        qubits: 3,
        code: `H 0\nCX [1,2]\nCX [0,1]\nCX [1,2]\nH 0\nMEASURE 0`,
        codeWithComments: `// SWAP Test: comparing |0⟩ vs |0⟩\n// q0 = ancilla, q1 = state A, q2 = state B\n\n// Ancilla in superposition\nH 0\n// Controlled-SWAP (approximated)\nCX [1,2]\nCX [0,1]\nCX [1,2]\n// Measure ancilla\nH 0\nMEASURE 0\n\n// Expected: ancilla always 0 (identical states)`
    },

    bitFlipCode: {
        name: "Bit-Flip Error Correction",
        icon: "🛡️",
        category: "Error Correction",
        description: "3-qubit code that detects and corrects single bit-flip errors",
        longDescription: "The 3-qubit bit-flip code is the simplest quantum error correcting code. It encodes one logical qubit into three physical qubits by entangling them. If a single bit-flip (X) error occurs on any one qubit, syndrome measurements on the other two qubits can detect and localize the error, allowing correction without disturbing the encoded information.",
        keyInsights: [
            "Encodes |0⟩→|000⟩ and |1⟩→|111⟩ (repetition code)",
            "Protects against single X (bit-flip) errors",
            "Cannot correct phase-flip errors (that needs the phase-flip code)",
            "Syndrome measurement reveals WHICH qubit flipped"
        ],
        complexity: "O(1)",
        qubitRange: "3",
        parameterizable: true,
        parameters: [
            {
                name: 'Error Location', key: 'errorQubit', type: 'select', default: 'none',
                options: [
                    { value: 'none', label: 'No error (verify encoding)' },
                    { value: 'q0', label: 'Bit-flip error on q0' },
                    { value: 'q1', label: 'Bit-flip error on q1' },
                    { value: 'q2', label: 'Bit-flip error on q2' }
                ]
            }
        ],
        generate: (params, withComments = false) => {
            const errorQubit = params.errorQubit || 'none';
            let code = '';
            if (withComments) {
                code += `// 3-Qubit Bit-Flip Error Correction\n`;
                code += `// Error: ${errorQubit === 'none' ? 'None' : 'X on ' + errorQubit}\n\n`;
                code += `// Encode logical |+⟩ into 3 physical qubits\n`;
            }
            code += `H 0\n`;
            if (withComments) code += `// Entangle to create encoded state\n`;
            code += `CX [0,1]\nCX [0,2]\n`;
            if (errorQubit !== 'none') {
                const eqIdx = parseInt(errorQubit[1]);
                if (withComments) code += `\n// Introduce bit-flip error on ${errorQubit}\n`;
                code += `X ${eqIdx}\n`;
            }
            if (withComments) code += `\n// Syndrome detection and correction\n`;
            if (withComments) code += `// Compare qubits pairwise\n`;
            code += `CX [0,1]\nCX [0,2]\n`;
            if (withComments) code += `// Majority vote correction\n`;
            code += `CX [2,0]\nCX [1,0]\n`;
            if (withComments) code += `\n// Measure to verify correction\n`;
            code += `MEASURE (0,1,2)`;
            return { code: code.trim(), qubits: 3 };
        },
        qubits: 3,
        code: `H 0\nCX [0,1]\nCX [0,2]\nX 1\nCX [0,1]\nCX [0,2]\nCX [2,0]\nCX [1,0]\nMEASURE (0,1,2)`,
        codeWithComments: `// 3-Qubit Bit-Flip Error Correction\n// Error: X on q1\n\n// Encode logical |+⟩\nH 0\nCX [0,1]\nCX [0,2]\n\n// Introduce bit-flip error on q1\nX 1\n\n// Syndrome detection\nCX [0,1]\nCX [0,2]\n// Majority vote correction\nCX [2,0]\nCX [1,0]\n\n// Measure to verify\nMEASURE (0,1,2)`
    }
};

/**
 * Validate algorithm parameters (shared by simulator UI and Qubi manual examples).
 * @param {string} algoKey
 * @param {Record<string, unknown>} params
 * @param {number} maxQubits
 * @returns {string[]}
 */
function validateQuantumAlgorithmParams(algoKey, params, maxQubits) {
    const errors = [];

    for (const key of ['numQubits', 'numInputs']) {
        if (params[key] !== undefined) {
            const raw = params[key];
            const parsed = Number(raw);
            if (raw === '' || isNaN(parsed)) {
                errors.push(`${key === 'numInputs' ? 'Number of input qubits' : 'Number of qubits'} must be a valid number.`);
                return errors;
            }
            if (!Number.isInteger(parsed)) {
                errors.push(`${key === 'numInputs' ? 'Number of input qubits' : 'Number of qubits'} must be a whole number (got ${raw}).`);
                return errors;
            }
            if (parsed < 1) {
                errors.push(`${key === 'numInputs' ? 'Number of input qubits' : 'Number of qubits'} must be at least 1.`);
                return errors;
            }
        }
    }

    if (algoKey === 'grovers') {
        const numQubits = parseInt(params.numQubits) || 3;
        const target = params.target || '';
        if (numQubits < 2) {
            errors.push("Grover's algorithm requires at least 2 qubits.");
        }
        if (numQubits > maxQubits) {
            errors.push(`Number of qubits (${numQubits}) exceeds your max qubit limit (${maxQubits}). You can change this in Settings.`);
        }
        if (!/^[01]+$/.test(target)) {
            errors.push(`Target state "${target}" is not valid binary. Use only 0s and 1s.`);
        } else if (target.length !== numQubits) {
            errors.push(`Target state "${target}" is ${target.length} bits, but you selected ${numQubits} qubits. The target must be exactly ${numQubits} binary digits.`);
        }
    }

    if (algoKey === 'bernsteinVazirani') {
        const secret = params.secret || '';
        if (secret.length === 0) {
            errors.push('Secret string cannot be empty.');
        } else if (!/^[01]+$/.test(secret)) {
            errors.push(`Secret string "${secret}" is not valid binary. Use only 0s and 1s.`);
        } else {
            const totalQubits = secret.length + 1;
            if (totalQubits > maxQubits) {
                errors.push(`Secret string "${secret}" is ${secret.length} bits, which requires ${totalQubits} qubits (${secret.length} input + 1 ancilla). This exceeds your max qubit limit (${maxQubits}).`);
            }
        }
    }

    if (algoKey === 'deutschJozsa') {
        const numInputs = parseInt(params.numInputs) || 2;
        const totalQubits = numInputs + 1;
        if (numInputs < 1) {
            errors.push('Deutsch-Jozsa requires at least 1 input qubit.');
        }
        if (totalQubits > maxQubits) {
            errors.push(`${numInputs} input qubits + 1 ancilla = ${totalQubits} total qubits. This exceeds your max qubit limit (${maxQubits}).`);
        }
    }

    if (algoKey === 'ghzState') {
        const numQubits = parseInt(params.numQubits) || 3;
        if (numQubits < 2) {
            errors.push('GHZ state requires at least 2 qubits.');
        }
        if (numQubits > maxQubits) {
            errors.push(`Number of qubits (${numQubits}) exceeds your max qubit limit (${maxQubits}).`);
        }
    }

    if (algoKey === 'wState') {
        const numQubits = parseInt(params.numQubits) || 3;
        if (numQubits < 3) {
            errors.push('W state requires at least 3 qubits.');
        }
        if (numQubits > maxQubits) {
            errors.push(`Number of qubits (${numQubits}) exceeds your max qubit limit (${maxQubits}).`);
        }
    }

    if (algoKey === 'qft') {
        const numQubits = parseInt(params.numQubits) || 3;
        if (numQubits < 2) {
            errors.push('QFT requires at least 2 qubits.');
        }
        if (numQubits > maxQubits) {
            errors.push(`Number of qubits (${numQubits}) exceeds your max qubit limit (${maxQubits}).`);
        }
    }

    return errors;
}

/**
 * Build Qubi source for an algorithm key and parameter values.
 * @param {string} algoKey
 * @param {Record<string, unknown>} params
 * @param {boolean} withComments
 * @returns {{ code: string, qubits: number, error?: string }}
 */
function computeQuantumAlgorithmCode(algoKey, params, withComments) {
    const algo = QuantumAlgorithms[algoKey];
    if (!algo) {
        return { code: '', qubits: 0, error: 'Unknown algorithm.' };
    }
    try {
        if (algo.parameterizable && algo.parameters && algo.generate) {
            const generated = algo.generate(params, withComments);
            return { code: generated.code, qubits: generated.qubits };
        }
        let code = algo.code;
        if (withComments && algo.codeWithComments) {
            code = algo.codeWithComments;
        }
        return { code: (code || '').trim(), qubits: algo.qubits };
    } catch (e) {
        return { code: '', qubits: 0, error: e.message || 'Generation failed' };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QuantumAlgorithms, validateQuantumAlgorithmParams, computeQuantumAlgorithmCode };
}

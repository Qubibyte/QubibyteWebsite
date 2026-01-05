/**
 * NMR Quantum Computing Physics Engine
 * 
 * This module provides physically accurate NMR simulation including:
 * - Nuclear spin dynamics under static (B₀) and RF (B₁) magnetic fields
 * - Chemical environment-based chemical shifts (different environments = different qubits)
 * - Gate-to-pulse sequence mapping
 * - Density matrix evolution
 * - Relaxation effects (T₁, T₂)
 * - NMR spectroscopy (FFT)
 * 
 * Key Physics:
 * - Larmor frequency: ω₀ = γ · B₀ · (1 - σ) where σ is shielding constant
 * - Chemical shift creates frequency differences even for same nucleus type
 * - J-coupling enables multi-qubit gates through spin-spin interaction
 * - Different chemical environments (neighbors, bonding) create distinct qubits
 */

// ============================================================================
// PHYSICAL CONSTANTS
// ============================================================================

const NMRConstants = {
    // Planck's constant (J·s)
    HBAR: 1.054571817e-34,
    
    // Gyromagnetic ratios (MHz/T) - γ/(2π) for SPIN-1/2 NUCLEI ONLY
    // These are the ONLY nuclei suitable for NMR quantum computing qubits
    GAMMA: {
        // Common spin-1/2 nuclei
        '1H':   42.577478518,  // Proton - most sensitive
        '3He':  -32.434,       // Helium-3 (negative γ)
        '13C':  10.7084,       // Carbon-13
        '15N':  -4.316,        // Nitrogen-15 (negative γ)
        '19F':  40.052,        // Fluorine-19 - very sensitive
        '29Si': -8.465,        // Silicon-29 (negative γ)
        '31P':  17.235,        // Phosphorus-31
        
        // Transition metals (spin-1/2)
        '57Fe': 1.382,         // Iron-57 - low γ
        '77Se': 8.157,         // Selenium-77
        '89Y':  -2.095,        // Yttrium-89 (negative γ)
        '103Rh': -1.348,       // Rhodium-103 (negative γ)
        '107Ag': -1.723,       // Silver-107 (negative γ)
        '109Ag': -1.981,       // Silver-109 (negative γ)
        '111Cd': -9.069,       // Cadmium-111 (negative γ)
        '113Cd': -9.487,       // Cadmium-113 (negative γ)
        
        // Heavy metals (spin-1/2)
        '115Sn': -14.007,      // Tin-115 (negative γ)
        '117Sn': -15.261,      // Tin-117 (negative γ)
        '119Sn': -15.966,      // Tin-119 (negative γ)
        '123Te': -11.235,      // Tellurium-123 (negative γ)
        '125Te': -13.545,      // Tellurium-125 (negative γ)
        '129Xe': -11.860,      // Xenon-129 (negative γ)
        '169Tm': -3.531,       // Thulium-169 (negative γ)
        '171Yb': 7.526,        // Ytterbium-171
        '183W':  1.795,        // Tungsten-183
        '187Os': 0.987,        // Osmium-187
        '195Pt': 9.289,        // Platinum-195
        '199Hg': 7.712,        // Mercury-199
        '203Tl': 24.570,       // Thallium-203
        '205Tl': 24.816,       // Thallium-205
        '207Pb': 9.034,        // Lead-207
    },
    
    // Natural abundance (%) for spin-1/2 nuclei
    ABUNDANCE: {
        '1H':   99.985,
        '3He':  0.000137,
        '13C':  1.109,
        '15N':  0.366,
        '19F':  100.0,
        '29Si': 4.685,
        '31P':  100.0,
        '57Fe': 2.119,
        '77Se': 7.63,
        '89Y':  100.0,
        '103Rh': 100.0,
        '107Ag': 51.839,
        '109Ag': 48.161,
        '111Cd': 12.80,
        '113Cd': 12.22,
        '115Sn': 0.34,
        '117Sn': 7.68,
        '119Sn': 8.59,
        '123Te': 0.89,
        '125Te': 7.07,
        '129Xe': 26.44,
        '169Tm': 100.0,
        '171Yb': 14.28,
        '183W':  14.31,
        '187Os': 1.96,
        '195Pt': 33.83,
        '199Hg': 16.87,
        '203Tl': 29.52,
        '205Tl': 70.48,
        '207Pb': 22.1,
    },
    
    // Reference chemical shifts (ppm) for common environments
    TYPICAL_SHIFTS: {
        '1H': { 
            alkyl: [0.5, 2.0], 
            vinyl: [4.5, 6.5], 
            aromatic: [6.5, 8.5], 
            aldehyde: [9.0, 10.0],
            carboxylic: [10.0, 12.0]
        },
        '13C': { 
            alkyl: [0, 50], 
            aromatic: [110, 160], 
            carbonyl: [160, 220] 
        },
        '19F': { 
            CF3: [-60, -80], 
            CF2: [-100, -130], 
            CF: [-150, -200],
            arylF: [-110, -130]
        }
    }
};

// ============================================================================
// NMR SAMPLE PRESETS - EXTENSIVE LIBRARY FOR QUANTUM COMPUTING
// ============================================================================

/**
 * NMR Sample definitions with physical parameters for NMR Quantum Computing
 * 
 * IMPORTANT - SPIN-1/2 NUCLEI ONLY:
 * All samples in this library use ONLY spin-1/2 nuclei, which are the only
 * nuclei suitable for NMR quantum computing qubits. Spin-1/2 nuclei have
 * exactly two energy levels (|0⟩ and |1⟩) making them ideal two-level systems.
 * 
 * Supported spin-1/2 nuclei:
 * - Common: ¹H, ¹³C, ¹⁵N, ¹⁹F, ²⁹Si, ³¹P
 * - Transition metals: ⁵⁷Fe, ⁷⁷Se, ⁸⁹Y, ¹⁰³Rh, ¹⁰⁷Ag, ¹⁰⁹Ag, ¹¹¹Cd
 * - Heavy metals: ¹¹⁵Sn, ¹¹⁷Sn, ¹¹⁹Sn, ¹²³Te, ¹²⁵Te, ¹²⁹Xe, ¹⁹⁵Pt, ¹⁹⁹Hg, ²⁰⁷Pb
 * - Others: ³He, ¹⁶⁹Tm, ¹⁷¹Yb, ¹⁸³W, ¹⁸⁷Os, ²⁰³Tl, ²⁰⁵Tl
 * 
 * NOT included (not spin-1/2):
 * - ²H (deuterium, spin-1), ¹¹B (spin-3/2), ¹⁷O (spin-5/2), etc.
 * 
 * KEY PHYSICS:
 * - Same element atoms in DIFFERENT chemical environments have different
 *   chemical shifts, making them distinguishable as separate qubits
 * - J-coupling between nuclei enables multi-qubit gates
 * - This is the basis of liquid-state NMR quantum computing
 * 
 * Samples are organized by qubit count (ascending)
 */
const NMRSamples = {
    // ========== SINGLE QUBIT SYSTEMS ==========
    
    'proton': {
        name: '¹H (Chloroform Proton)',
        description: 'Single proton spin - ideal for learning NMR basics',
        formula: 'CHCl₃',
        nuclei: [
            { id: 0, element: '1H', label: 'H', chemicalShift: 7.26, 
              environment: 'CHCl₃ - deshielded by three chlorines' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: 0 },
                { element: 'H', x: 0, y: -40, qubit: 0 },
                { element: 'Cl', x: -35, y: 20 },
                { element: 'Cl', x: 35, y: 20 },
                { element: 'Cl', x: 0, y: 50 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 20.0,
        defaultT2: 7.0
    },
    
    'phosphoric_acid': {
        name: '³¹P (Phosphoric Acid)',
        description: 'Single ³¹P spin - 100% natural abundance phosphorus',
        formula: 'H₃PO₄',
        nuclei: [
            { id: 0, element: '31P', label: 'P', chemicalShift: 0.0, 
              environment: 'Phosphoric acid reference (0 ppm)' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: 'P', x: 0, y: 0, qubit: 0 },
                { element: 'O', x: 0, y: -35 },
                { element: 'O', x: -30, y: 20 },
                { element: 'O', x: 30, y: 20 },
                { element: 'O', x: 0, y: 45 },
                { element: 'H', x: -45, y: 35 },
                { element: 'H', x: 45, y: 35 },
                { element: 'H', x: 0, y: 70 }
            ],
            bonds: [[0,1,'double'], [0,2], [0,3], [0,4], [2,5], [3,6], [4,7]]
        },
        defaultT1: 5.0,
        defaultT2: 2.0
    },
    
    'carbon_methanol': {
        name: '¹³C (Methanol)',
        description: 'Single ¹³C spin - enriched methanol for carbon NMR',
        formula: '¹³CH₃OH',
        nuclei: [
            { id: 0, element: '13C', label: 'C', chemicalShift: 49.0, 
              environment: 'sp³ carbon bonded to oxygen' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: '13C', x: 0, y: 0, qubit: 0 },
                { element: 'O', x: 35, y: 0 },
                { element: 'H', x: -25, y: -25 },
                { element: 'H', x: -25, y: 25 },
                { element: 'H', x: 0, y: 35 },
                { element: 'H', x: 60, y: 15 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4], [1,5]]
        },
        defaultT1: 8.0,
        defaultT2: 1.5
    },
    
    'fluorobenzene': {
        name: '¹⁹F (Fluorobenzene)',
        description: 'Single ¹⁹F spin - 100% natural abundance fluorine',
        formula: 'C₆H₅F',
        nuclei: [
            { id: 0, element: '19F', label: 'F', chemicalShift: -113.0, 
              environment: 'Aromatic fluorine' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: -30 },
                { element: 'C', x: 26, y: -15 },
                { element: 'C', x: 26, y: 15 },
                { element: 'C', x: 0, y: 30 },
                { element: 'C', x: -26, y: 15 },
                { element: 'C', x: -26, y: -15 },
                { element: 'F', x: 0, y: -55, qubit: 0 },
                { element: 'H', x: 46, y: -26 },
                { element: 'H', x: 46, y: 26 },
                { element: 'H', x: 0, y: 55 },
                { element: 'H', x: -46, y: 26 },
                { element: 'H', x: -46, y: -26 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0], [0,6], [1,7], [2,8], [3,9], [4,10], [5,11]]
        },
        defaultT1: 6.0,
        defaultT2: 3.0
    },
    
    // ========== TWO QUBIT SYSTEMS ==========
    
    'pt_phosphine': {
        name: '¹⁹⁵Pt-³¹P Complex (2Q)',
        description: '¹⁹⁵Pt-³¹P heteronuclear 2-qubit system - phosphine platinum complex',
        formula: 'cis-[Pt(PMe₃)₂Cl₂]',
        nuclei: [
            { id: 0, element: '195Pt', label: 'Pt', chemicalShift: -4200.0,
              environment: 'Pt(II) with phosphine ligands' },
            { id: 1, element: '31P', label: 'P', chemicalShift: -22.0,
              environment: 'Phosphine P coordinated to Pt' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 3500.0, type: '¹J(Pt-P)' }  // Very large coupling!
        ],
        structure: {
            atoms: [
                { element: 'Pt', x: 0, y: 0, qubit: 0 },
                { element: 'P', x: -40, y: -25, qubit: 1 },
                { element: 'P', x: 40, y: -25 },
                { element: 'Cl', x: -40, y: 25 },
                { element: 'Cl', x: 40, y: 25 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 1.0,
        defaultT2: 0.2
    },
    
    'hg_carbon': {
        name: '¹⁹⁹Hg-¹³C Complex (2Q)',
        description: '¹⁹⁹Hg-¹³C heteronuclear 2-qubit system - organomercury',
        formula: '(¹³CH₃)₂¹⁹⁹Hg',
        nuclei: [
            { id: 0, element: '199Hg', label: 'Hg', chemicalShift: -780.0,
              environment: 'Linear Hg(II) with methyl groups' },
            { id: 1, element: '13C', label: 'C', chemicalShift: 5.0,
              environment: 'Methyl carbon bonded to Hg' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 687.0, type: '¹J(Hg-C)' }
        ],
        structure: {
            atoms: [
                { element: 'Hg', x: 0, y: 0, qubit: 0 },
                { element: '13C', x: -45, y: 0, qubit: 1 },
                { element: 'C', x: 45, y: 0 }
            ],
            bonds: [[0,1], [0,2]]
        },
        defaultT1: 2.0,
        defaultT2: 0.5
    },
    
    'sn_carbon': {
        name: '¹¹⁹Sn-¹³C Complex (2Q)',
        description: '¹¹⁹Sn-¹³C heteronuclear 2-qubit system - organotin',
        formula: '(¹³CH₃)₄¹¹⁹Sn',
        nuclei: [
            { id: 0, element: '119Sn', label: 'Sn', chemicalShift: 0.0,
              environment: 'Tetrahedral Sn(IV) center' },
            { id: 1, element: '13C', label: 'C', chemicalShift: -9.0,
              environment: 'Methyl carbon bonded to Sn' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 340.0, type: '¹J(Sn-C)' }
        ],
        structure: {
            atoms: [
                { element: 'Sn', x: 0, y: 0, qubit: 0 },
                { element: '13C', x: -35, y: -25, qubit: 1 },
                { element: 'C', x: 35, y: -25 },
                { element: 'C', x: -35, y: 25 },
                { element: 'C', x: 35, y: 25 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 10.0,
        defaultT2: 3.0
    },
    
    'pb_proton': {
        name: '²⁰⁷Pb-¹H Complex (2Q)',
        description: '²⁰⁷Pb-¹H heteronuclear 2-qubit system - plumbane derivative',
        formula: '(CH₃)₄²⁰⁷Pb',
        nuclei: [
            { id: 0, element: '207Pb', label: 'Pb', chemicalShift: 0.0,
              environment: 'Tetrahedral Pb(IV) center' },
            { id: 1, element: '1H', label: 'H', chemicalShift: 0.3,
              environment: 'Methyl protons on Pb' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 64.0, type: '²J(Pb-H)' }
        ],
        structure: {
            atoms: [
                { element: 'Pb', x: 0, y: 0, qubit: 0 },
                { element: 'C', x: -35, y: -25 },
                { element: 'C', x: 35, y: -25 },
                { element: 'C', x: -35, y: 25 },
                { element: 'C', x: 35, y: 25 },
                { element: 'H', x: -55, y: -35, qubit: 1 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4], [1,5]]
        },
        defaultT1: 1.0,
        defaultT2: 0.2
    },
    
    'se_proton': {
        name: '⁷⁷Se-¹H Complex (2Q)',
        description: '⁷⁷Se-¹H heteronuclear 2-qubit system - selenol',
        formula: 'C₆H₅⁷⁷SeH',
        nuclei: [
            { id: 0, element: '77Se', label: 'Se', chemicalShift: 150.0,
              environment: 'Benzeneselenol Se' },
            { id: 1, element: '1H', label: 'H', chemicalShift: 2.1,
              environment: 'Se-H proton' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 45.0, type: '¹J(Se-H)' }
        ],
        structure: {
            atoms: [
                { element: 'Se', x: 0, y: 0, qubit: 0 },
                { element: 'H', x: 30, y: 20, qubit: 1 },
                { element: 'C', x: -40, y: 0 },
                { element: 'C', x: -60, y: -25 },
                { element: 'C', x: -60, y: 25 }
            ],
            bonds: [[0,1], [0,2], [2,3], [2,4]]
        },
        defaultT1: 5.0,
        defaultT2: 1.0
    },
    
    'xe_129_proton': {
        name: '¹²⁹Xe-¹H van der Waals (2Q)',
        description: '¹²⁹Xe-¹H weakly coupled 2-qubit system in cryptophane cage',
        formula: '¹²⁹Xe@cryptophane-A',
        nuclei: [
            { id: 0, element: '129Xe', label: 'Xe', chemicalShift: 60.0,
              environment: 'Encapsulated Xe in cage' },
            { id: 1, element: '1H', label: 'H', chemicalShift: 4.5,
              environment: 'Cryptophane methine H' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 0.5, type: 'Through-space' }  // Very weak vdW coupling
        ],
        structure: {
            atoms: [
                { element: 'Xe', x: 0, y: 0, qubit: 0 },
                { element: 'C', x: -40, y: -25 },
                { element: 'C', x: 40, y: -25 },
                { element: 'C', x: 0, y: 40 },
                { element: 'H', x: -60, y: -35, qubit: 1 }
            ],
            bonds: [[1,2], [2,3], [3,1]]
        },
        defaultT1: 30.0,
        defaultT2: 10.0
    },
    
    'chloroform': {
        name: 'Chloroform ¹³CHCl₃',
        description: '¹H-¹³C coupled system - classic 2-qubit NMR QC molecule used in first QC demos',
        formula: '¹³CHCl₃',
        nuclei: [
            { id: 0, element: '1H', label: 'H', chemicalShift: 7.26,
              environment: 'Proton bonded to ¹³C, deshielded by Cl atoms' },
            { id: 1, element: '13C', label: 'C', chemicalShift: 77.0,
              environment: 'Carbon bonded to 3 Cl and 1 H' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 209.0, type: '¹J(C-H)' }
        ],
        structure: {
            atoms: [
                { element: '13C', x: 0, y: 0, qubit: 1 },
                { element: 'H', x: 0, y: -40, qubit: 0 },
                { element: 'Cl', x: -35, y: 20 },
                { element: 'Cl', x: 35, y: 20 },
                { element: 'Cl', x: 0, y: 50 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 25.0,
        defaultT2: 0.3
    },
    
    'cytosine': {
        name: 'Cytosine (2-Qubit)',
        description: 'Two ¹H in different environments - used in early NMR QC experiments',
        formula: 'C₄H₅N₃O',
        nuclei: [
            { id: 0, element: '1H', label: 'H5', chemicalShift: 5.87,
              environment: 'Vinyl proton, shielded position' },
            { id: 1, element: '1H', label: 'H6', chemicalShift: 7.54,
              environment: 'Vinyl proton, deshielded by N' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 7.3, type: '³J(H-H)' }
        ],
        structure: {
            atoms: [
                { element: 'N', x: -30, y: -30 },
                { element: 'C', x: 0, y: -50 },
                { element: 'N', x: 30, y: -30 },
                { element: 'C', x: 30, y: 10 },
                { element: 'C', x: 0, y: 30 },
                { element: 'C', x: -30, y: 10 },
                { element: 'O', x: -55, y: 25 },
                { element: 'N', x: 0, y: -80 },
                { element: 'H', x: 50, y: -45, qubit: 1 },
                { element: 'H', x: 50, y: 25, qubit: 0 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0], [5,6], [1,7]]
        },
        defaultT1: 3.0,
        defaultT2: 0.5
    },
    
    'dichlorofluoromethane': {
        name: 'Dichlorofluoromethane',
        description: '¹H-¹⁹F heteronuclear system - demonstrates heteronuclear J-coupling',
        formula: 'CHCl₂F',
        nuclei: [
            { id: 0, element: '1H', label: 'H', chemicalShift: 6.2,
              environment: 'Proton adjacent to F and 2 Cl' },
            { id: 1, element: '19F', label: 'F', chemicalShift: -80.0,
              environment: 'Fluorine adjacent to H and 2 Cl' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 52.0, type: '²J(H-F)' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: 0 },
                { element: 'H', x: -40, y: -25, qubit: 0 },
                { element: 'F', x: 40, y: -25, qubit: 1 },
                { element: 'Cl', x: -30, y: 35 },
                { element: 'Cl', x: 30, y: 35 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 5.0,
        defaultT2: 1.0
    },
    
    'difluoromethane': {
        name: 'Difluoromethane',
        description: '¹H-¹⁹F 2-qubit system - two fluorines appear equivalent',
        formula: 'CH₂F₂',
        nuclei: [
            { id: 0, element: '1H', label: 'H', chemicalShift: 5.5,
              environment: 'Proton between two fluorines' },
            { id: 1, element: '19F', label: 'F', chemicalShift: -119.0,
              environment: 'Geminal fluorines (equivalent)' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 50.2, type: '²J(H-F)' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: 0 },
                { element: 'H', x: -35, y: -20, qubit: 0 },
                { element: 'H', x: 35, y: -20 },
                { element: 'F', x: -35, y: 25, qubit: 1 },
                { element: 'F', x: 35, y: 25 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 4.0,
        defaultT2: 1.5
    },
    
    'phosphorus_carbon': {
        name: 'Trimethyl Phosphite',
        description: '³¹P-¹³C 2-qubit heteronuclear system',
        formula: 'P(O¹³CH₃)₃',
        nuclei: [
            { id: 0, element: '31P', label: 'P', chemicalShift: 140.0,
              environment: 'Phosphorus(III) center' },
            { id: 1, element: '13C', label: 'C', chemicalShift: 51.0,
              environment: 'Methoxy carbon' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 6.8, type: '²J(P-C)' }
        ],
        structure: {
            atoms: [
                { element: 'P', x: 0, y: 0, qubit: 0 },
                { element: 'O', x: -35, y: -10 },
                { element: 'O', x: 0, y: 35 },
                { element: 'O', x: 35, y: -10 },
                { element: '13C', x: -55, y: -25, qubit: 1 },
                { element: 'C', x: 0, y: 60 },
                { element: 'C', x: 55, y: -25 }
            ],
            bonds: [[0,1], [0,2], [0,3], [1,4], [2,5], [3,6]]
        },
        defaultT1: 3.0,
        defaultT2: 0.8
    },
    
    'nitrogen_carbon': {
        name: 'Acetonitrile',
        description: '¹⁵N-¹³C 2-qubit system with triple bond',
        formula: '¹³C≡¹⁵N',
        nuclei: [
            { id: 0, element: '13C', label: 'CN', chemicalShift: 117.0,
              environment: 'sp carbon of nitrile' },
            { id: 1, element: '15N', label: 'N', chemicalShift: -135.0,
              environment: 'Nitrile nitrogen' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 17.5, type: '¹J(C-N)' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -30, y: 0 },
                { element: '13C', x: 10, y: 0, qubit: 0 },
                { element: '15N', x: 50, y: 0, qubit: 1 },
                { element: 'H', x: -50, y: -20 },
                { element: 'H', x: -50, y: 20 },
                { element: 'H', x: -30, y: 35 }
            ],
            bonds: [[0,1], [1,2,'triple'], [0,3], [0,4], [0,5]]
        },
        defaultT1: 20.0,
        defaultT2: 5.0
    },
    
    // ========== THREE QUBIT SYSTEMS ==========
    
    'pt_phosphine_carbon': {
        name: '¹⁹⁵Pt-³¹P-¹³C Complex (3Q)',
        description: '3-qubit heteronuclear system with heavy metal',
        formula: '[¹⁹⁵Pt(¹³CO)(P(¹³CH₃)₃)Cl₂]',
        nuclei: [
            { id: 0, element: '195Pt', label: 'Pt', chemicalShift: -4500.0,
              environment: 'Pt(II) center' },
            { id: 1, element: '31P', label: 'P', chemicalShift: 5.0,
              environment: 'Phosphine trans to CO' },
            { id: 2, element: '13C', label: 'CO', chemicalShift: 175.0,
              environment: 'Carbonyl carbon' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 3200.0, type: '¹J(Pt-P)' },
            { nuclei: [0, 2], J: 1200.0, type: '¹J(Pt-C)' },
            { nuclei: [1, 2], J: 8.0, type: '²J(P-C)' }
        ],
        structure: {
            atoms: [
                { element: 'Pt', x: 0, y: 0, qubit: 0 },
                { element: 'P', x: -45, y: 0, qubit: 1 },
                { element: 'C', x: 45, y: 0, qubit: 2 },
                { element: 'O', x: 75, y: 0 },
                { element: 'Cl', x: 0, y: -40 },
                { element: 'Cl', x: 0, y: 40 }
            ],
            bonds: [[0,1], [0,2], [2,3,'triple'], [0,4], [0,5]]
        },
        defaultT1: 1.0,
        defaultT2: 0.15
    },
    
    'sn_fluorine_carbon': {
        name: '¹¹⁹Sn-¹⁹F-¹³C Complex (3Q)',
        description: '3-qubit system with tin, fluorine and carbon',
        formula: '(¹³CH₃)₃¹¹⁹SnF',
        nuclei: [
            { id: 0, element: '119Sn', label: 'Sn', chemicalShift: 45.0,
              environment: 'Tetrahedral Sn with F' },
            { id: 1, element: '19F', label: 'F', chemicalShift: -180.0,
              environment: 'Fluorine on Sn' },
            { id: 2, element: '13C', label: 'C', chemicalShift: -5.0,
              environment: 'Methyl carbon' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 1850.0, type: '¹J(Sn-F)' },
            { nuclei: [0, 2], J: 380.0, type: '¹J(Sn-C)' },
            { nuclei: [1, 2], J: 3.0, type: '³J(F-C)' }
        ],
        structure: {
            atoms: [
                { element: 'Sn', x: 0, y: 0, qubit: 0 },
                { element: 'F', x: 0, y: -40, qubit: 1 },
                { element: '13C', x: -35, y: 25, qubit: 2 },
                { element: 'C', x: 35, y: 25 },
                { element: 'C', x: 0, y: 45 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 8.0,
        defaultT2: 2.0
    },
    
    'hg_phosphorus_proton': {
        name: '¹⁹⁹Hg-³¹P-¹H Complex (3Q)',
        description: '3-qubit mercury phosphine system',
        formula: '[¹⁹⁹Hg(PH₃)₂]²⁺',
        nuclei: [
            { id: 0, element: '199Hg', label: 'Hg', chemicalShift: -1200.0,
              environment: 'Linear Hg(II) center' },
            { id: 1, element: '31P', label: 'P', chemicalShift: -95.0,
              environment: 'Phosphine P' },
            { id: 2, element: '1H', label: 'H', chemicalShift: 4.5,
              environment: 'P-H proton' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 11000.0, type: '¹J(Hg-P)' },  // Very large!
            { nuclei: [1, 2], J: 350.0, type: '¹J(P-H)' },
            { nuclei: [0, 2], J: 150.0, type: '²J(Hg-H)' }
        ],
        structure: {
            atoms: [
                { element: 'Hg', x: 0, y: 0, qubit: 0 },
                { element: 'P', x: -50, y: 0, qubit: 1 },
                { element: 'P', x: 50, y: 0 },
                { element: 'H', x: -70, y: -20, qubit: 2 },
                { element: 'H', x: -70, y: 20 },
                { element: 'H', x: -50, y: -35 }
            ],
            bonds: [[0,1], [0,2], [1,3], [1,4], [1,5]]
        },
        defaultT1: 0.5,
        defaultT2: 0.1
    },
    
    'trifluoroethylene': {
        name: 'Iodotrifluoroethylene (SpinQ Triangulum)',
        description: '3 ¹⁹F qubits - SpinQ Triangulum molecule. Different chemical environments distinguish each F.',
        formula: 'CF₂=CFI',
        nuclei: [
            { id: 0, element: '19F', label: 'Fa', chemicalShift: -85.0,
              environment: 'F trans to I, strongly deshielded' },
            { id: 1, element: '19F', label: 'Fb', chemicalShift: -118.0,
              environment: 'F cis to I, moderately shielded' },
            { id: 2, element: '19F', label: 'Fc', chemicalShift: -190.0,
              environment: 'F on CFI carbon, most shielded' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 115.0, type: '²J(F-F) geminal' },
            { nuclei: [0, 2], J: 28.0, type: '³J(F-F) trans' },
            { nuclei: [1, 2], J: 45.0, type: '³J(F-F) cis' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -30, y: 0 },
                { element: 'C', x: 30, y: 0 },
                { element: 'F', x: -55, y: -30, qubit: 0 },
                { element: 'F', x: -55, y: 30, qubit: 1 },
                { element: 'F', x: 55, y: -30, qubit: 2 },
                { element: 'I', x: 55, y: 35 }
            ],
            bonds: [[0,1,'double'], [0,2], [0,3], [1,4], [1,5]]
        },
        defaultT1: 2.5,
        defaultT2: 0.8
    },
    
    'alanine': {
        name: 'Alanine (3 ¹³C)',
        description: '3 ¹³C qubits in amino acid - different environments. Used in biological NMR QC.',
        formula: 'CH₃-CH(NH₂)-COOH',
        nuclei: [
            { id: 0, element: '13C', label: 'Cα', chemicalShift: 51.0,
              environment: 'α-carbon bonded to NH₂ and COOH' },
            { id: 1, element: '13C', label: 'Cβ', chemicalShift: 17.0,
              environment: 'β-carbon (methyl group), most shielded' },
            { id: 2, element: '13C', label: 'C=O', chemicalShift: 176.0,
              environment: 'Carbonyl carbon, strongly deshielded' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 35.0, type: '¹J(C-C)' },
            { nuclei: [0, 2], J: 54.0, type: '¹J(C-C)' },
            { nuclei: [1, 2], J: 1.0, type: '²J(C-C)' }
        ],
        structure: {
            atoms: [
                { element: '13C', x: 0, y: 0, qubit: 0 },
                { element: '13C', x: -50, y: 0, qubit: 1 },
                { element: '13C', x: 50, y: 0, qubit: 2 },
                { element: 'N', x: 0, y: -45 },
                { element: 'H', x: 0, y: 35 },
                { element: 'H', x: -50, y: -30 },
                { element: 'H', x: -80, y: 15 },
                { element: 'H', x: -50, y: 30 },
                { element: 'O', x: 75, y: -25 },
                { element: 'O', x: 75, y: 25 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4], [1,5], [1,6], [1,7], [2,8,'double'], [2,9]]
        },
        defaultT1: 2.0,
        defaultT2: 0.2
    },
    
    'trichloroethylene': {
        name: 'Trichloroethylene (3Q)',
        description: '¹H + 2 ¹³C - mixed nuclei 3-qubit heteronuclear system',
        formula: 'H¹³C=¹³CCl₂',
        nuclei: [
            { id: 0, element: '1H', label: 'H', chemicalShift: 6.5,
              environment: 'Vinyl H on CHCl' },
            { id: 1, element: '13C', label: 'C1', chemicalShift: 117.0,
              environment: '¹³C bonded to H and Cl' },
            { id: 2, element: '13C', label: 'C2', chemicalShift: 121.0,
              environment: '¹³C bonded to 2 Cl' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 200.0, type: '¹J(C-H)' },
            { nuclei: [1, 2], J: 80.0, type: '¹J(C=C)' },
            { nuclei: [0, 2], J: 8.0, type: '²J(C-H)' }
        ],
        structure: {
            atoms: [
                { element: '13C', x: -25, y: 0, qubit: 1 },
                { element: '13C', x: 25, y: 0, qubit: 2 },
                { element: 'H', x: -55, y: -25, qubit: 0 },
                { element: 'Cl', x: -55, y: 30 },
                { element: 'Cl', x: 55, y: -25 },
                { element: 'Cl', x: 55, y: 30 }
            ],
            bonds: [[0,1,'double'], [0,2], [0,3], [1,4], [1,5]]
        },
        defaultT1: 3.0,
        defaultT2: 0.4
    },
    
    'glycine': {
        name: 'Glycine (3Q)',
        description: 'Labeled amino acid with 3 different nuclides - true heteronuclear',
        formula: '¹⁵NH₂-¹³CH₂-COOH',
        nuclei: [
            { id: 0, element: '1H', label: 'Hα', chemicalShift: 3.56,
              environment: 'Methylene protons (equivalent)' },
            { id: 1, element: '13C', label: 'Cα', chemicalShift: 42.5,
              environment: 'α-carbon adjacent to amine and carboxyl' },
            { id: 2, element: '15N', label: 'N', chemicalShift: -345.0,
              environment: 'Amine nitrogen' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 145.0, type: '¹J(C-H)' },
            { nuclei: [1, 2], J: 10.5, type: '¹J(C-N)' },
            { nuclei: [0, 2], J: -1.5, type: '²J(H-N)' }
        ],
        structure: {
            atoms: [
                { element: '15N', x: -60, y: 0, qubit: 2 },
                { element: '13C', x: 0, y: 0, qubit: 1 },
                { element: 'C', x: 60, y: 0 },
                { element: 'H', x: -80, y: -20 },
                { element: 'H', x: -80, y: 20 },
                { element: 'H', x: 0, y: -35, qubit: 0 },
                { element: 'H', x: 0, y: 35 },
                { element: 'O', x: 85, y: -20 },
                { element: 'O', x: 85, y: 20 }
            ],
            bonds: [[0,1], [1,2], [0,3], [0,4], [1,5], [1,6], [2,7,'double'], [2,8]]
        },
        defaultT1: 3.5,
        defaultT2: 0.4
    },
    
    'trifluoroacetone': {
        name: 'Trifluoroacetone (¹³C₂¹⁹F)',
        description: 'Mixed nuclei 3Q system with ketone',
        formula: 'CF₃-¹³CO-¹³CH₃',
        nuclei: [
            { id: 0, element: '19F', label: 'F₃', chemicalShift: -75.0,
              environment: 'CF₃ group (equivalent fluorines)' },
            { id: 1, element: '13C', label: 'C=O', chemicalShift: 191.0,
              environment: 'Ketone carbonyl carbon' },
            { id: 2, element: '13C', label: 'CH₃', chemicalShift: 27.0,
              environment: 'Methyl carbon' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 36.0, type: '²J(C-F)' },
            { nuclei: [1, 2], J: 40.0, type: '¹J(C-C)' },
            { nuclei: [0, 2], J: 2.0, type: '⁴J(F-C)' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -50, y: 0 },
                { element: '13C', x: 0, y: 0, qubit: 1 },
                { element: '13C', x: 50, y: 0, qubit: 2 },
                { element: 'F', x: -70, y: -25, qubit: 0 },
                { element: 'F', x: -70, y: 25 },
                { element: 'F', x: -50, y: 40 },
                { element: 'O', x: 0, y: -35 },
                { element: 'H', x: 70, y: -20 },
                { element: 'H', x: 70, y: 20 },
                { element: 'H', x: 50, y: 35 }
            ],
            bonds: [[0,1], [1,2], [0,3], [0,4], [0,5], [1,6,'double'], [2,7], [2,8], [2,9]]
        },
        defaultT1: 2.5,
        defaultT2: 0.5
    },
    
    // ========== FOUR QUBIT SYSTEMS ==========
    
    'crotonic_acid': {
        name: 'Crotonic Acid (Shor 4Q)',
        description: '4 ¹³C qubits - historic molecule used for first Shor\'s algorithm demonstration',
        formula: '¹³CH₃-¹³CH=¹³CH-¹³COOH',
        nuclei: [
            { id: 0, element: '13C', label: 'C1', chemicalShift: 17.9,
              environment: 'Methyl carbon, most shielded' },
            { id: 1, element: '13C', label: 'C2', chemicalShift: 122.0,
              environment: 'Vinyl =CH adjacent to methyl' },
            { id: 2, element: '13C', label: 'C3', chemicalShift: 145.0,
              environment: 'Vinyl CH= adjacent to COOH, deshielded' },
            { id: 3, element: '13C', label: 'C4', chemicalShift: 172.0,
              environment: 'Carboxyl carbon, most deshielded' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 6.8, type: '²J' },
            { nuclei: [1, 2], J: 72.0, type: '¹J(C=C)' },
            { nuclei: [2, 3], J: 69.0, type: '¹J(C-C)' },
            { nuclei: [0, 2], J: -1.2, type: '³J' },
            { nuclei: [1, 3], J: 7.6, type: '²J' },
            { nuclei: [0, 3], J: 0.5, type: '⁴J' }
        ],
        structure: {
            atoms: [
                { element: '13C', x: -75, y: 0, qubit: 0 },
                { element: '13C', x: -25, y: 0, qubit: 1 },
                { element: '13C', x: 25, y: 0, qubit: 2 },
                { element: '13C', x: 75, y: 0, qubit: 3 },
                { element: 'H', x: -100, y: -20 },
                { element: 'H', x: -75, y: 35 },
                { element: 'H', x: -90, y: -35 },
                { element: 'H', x: -25, y: -35 },
                { element: 'H', x: 25, y: -35 },
                { element: 'O', x: 100, y: -20 },
                { element: 'O', x: 100, y: 25 }
            ],
            bonds: [[0,1], [1,2,'double'], [2,3], [0,4], [0,5], [0,6], [1,7], [2,8], [3,9,'double'], [3,10]]
        },
        defaultT1: 3.0,
        defaultT2: 0.15
    },
    
    'perfluorobutadiene': {
        name: 'Perfluorobutadiene (4 ¹⁹F)',
        description: '4 ¹⁹F qubits - all fluorine system with distinct chemical environments',
        formula: 'CF₂=CF-CF=CF₂',
        nuclei: [
            { id: 0, element: '19F', label: 'F1a', chemicalShift: -82.0,
              environment: 'Terminal =CF₂, trans' },
            { id: 1, element: '19F', label: 'F1b', chemicalShift: -95.0,
              environment: 'Terminal =CF₂, cis' },
            { id: 2, element: '19F', label: 'F2', chemicalShift: -165.0,
              environment: 'Internal -CF=' },
            { id: 3, element: '19F', label: 'F3', chemicalShift: -175.0,
              environment: 'Internal =CF-' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 35.0, type: '²J(F-F) gem' },
            { nuclei: [0, 2], J: 115.0, type: '³J trans' },
            { nuclei: [1, 2], J: 33.0, type: '³J cis' },
            { nuclei: [2, 3], J: 28.0, type: '³J' },
            { nuclei: [0, 3], J: 3.0, type: '⁴J' },
            { nuclei: [1, 3], J: 12.0, type: '⁴J' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -60, y: 0 },
                { element: 'C', x: -20, y: 0 },
                { element: 'C', x: 20, y: 0 },
                { element: 'C', x: 60, y: 0 },
                { element: 'F', x: -85, y: -25, qubit: 0 },
                { element: 'F', x: -85, y: 25, qubit: 1 },
                { element: 'F', x: -20, y: -35, qubit: 2 },
                { element: 'F', x: 20, y: -35, qubit: 3 },
                { element: 'F', x: 85, y: -25 },
                { element: 'F', x: 85, y: 25 }
            ],
            bonds: [[0,1,'double'], [1,2], [2,3,'double'], [0,4], [0,5], [1,6], [2,7], [3,8], [3,9]]
        },
        defaultT1: 2.0,
        defaultT2: 0.6
    },
    
    'serine': {
        name: 'Serine (4Q)',
        description: 'Labeled amino acid - 4 qubit heteronuclear system',
        formula: 'HO-¹³CH₂-¹³CH(¹⁵NH₂)-COOH',
        nuclei: [
            { id: 0, element: '1H', label: 'Hα', chemicalShift: 3.85,
              environment: 'α-proton' },
            { id: 1, element: '13C', label: 'Cα', chemicalShift: 57.0,
              environment: 'α-carbon adjacent to amine' },
            { id: 2, element: '13C', label: 'Cβ', chemicalShift: 61.5,
              environment: 'β-carbon adjacent to hydroxyl' },
            { id: 3, element: '15N', label: 'N', chemicalShift: -347.0,
              environment: 'Amine nitrogen' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 142.0, type: '¹J(C-H)' },
            { nuclei: [1, 2], J: 37.0, type: '¹J(C-C)' },
            { nuclei: [1, 3], J: 11.0, type: '¹J(C-N)' },
            { nuclei: [0, 3], J: -1.2, type: '²J(H-N)' }
        ],
        structure: {
            atoms: [
                { element: '15N', x: -60, y: -25, qubit: 3 },
                { element: '13C', x: 0, y: 0, qubit: 1 },
                { element: '13C', x: -40, y: 30, qubit: 2 },
                { element: 'C', x: 60, y: 0 },
                { element: 'H', x: 0, y: -35, qubit: 0 },
                { element: 'O', x: -60, y: 55 },
                { element: 'O', x: 85, y: -20 },
                { element: 'O', x: 85, y: 20 }
            ],
            bonds: [[0,1], [1,2], [1,3], [1,4], [2,5], [3,6,'double'], [3,7]]
        },
        defaultT1: 2.0,
        defaultT2: 0.3
    },
    
    'tetrafluoroethane': {
        name: '1,1,1,2-Tetrafluoroethane (4 ¹⁹F)',
        description: 'Common refrigerant with 4 distinguishable ¹⁹F environments',
        formula: 'CF₃-CHF',
        nuclei: [
            { id: 0, element: '19F', label: 'Fa', chemicalShift: -72.0,
              environment: 'CF₃ fluorine (equivalent, 3F)' },
            { id: 1, element: '19F', label: 'Fb', chemicalShift: -218.0,
              environment: 'CHF fluorine' },
            { id: 2, element: '19F', label: 'Fc', chemicalShift: -73.0,
              environment: 'CF₃ fluorine (slightly different)' },
            { id: 3, element: '19F', label: 'Fd', chemicalShift: -74.0,
              environment: 'CF₃ fluorine (slightly different)' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 6.5, type: '³J(F-F)' },
            { nuclei: [1, 2], J: 6.3, type: '³J(F-F)' },
            { nuclei: [0, 2], J: 290.0, type: '²J(F-F) gem' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -25, y: 0 },
                { element: 'C', x: 25, y: 0 },
                { element: 'F', x: -50, y: -25, qubit: 0 },
                { element: 'F', x: -50, y: 25, qubit: 2 },
                { element: 'F', x: -25, y: 40, qubit: 3 },
                { element: 'H', x: 25, y: -35 },
                { element: 'F', x: 50, y: 25, qubit: 1 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4], [1,5], [1,6]]
        },
        defaultT1: 3.0,
        defaultT2: 0.8
    },
    
    // ========== FIVE QUBIT SYSTEMS ==========
    
    'valine': {
        name: 'Valine (5Q)',
        description: '5-qubit amino acid with diverse nuclides',
        formula: '(¹³CH₃)₂-¹³CH-¹³CH(¹⁵NH₂)-COOH',
        nuclei: [
            { id: 0, element: '1H', label: 'Hα', chemicalShift: 3.6,
              environment: 'α-proton' },
            { id: 1, element: '1H', label: 'Hβ', chemicalShift: 2.3,
              environment: 'β-proton' },
            { id: 2, element: '13C', label: 'Cα', chemicalShift: 61.3,
              environment: 'α-carbon' },
            { id: 3, element: '13C', label: 'Cβ', chemicalShift: 32.1,
              environment: 'β-carbon' },
            { id: 4, element: '15N', label: 'N', chemicalShift: -336.0,
              environment: 'Amine nitrogen' }
        ],
        jCouplings: [
            { nuclei: [0, 2], J: 140.0, type: '¹J(C-H)' },
            { nuclei: [1, 3], J: 125.0, type: '¹J(C-H)' },
            { nuclei: [2, 3], J: 35.0, type: '¹J(C-C)' },
            { nuclei: [2, 4], J: 10.5, type: '¹J(C-N)' },
            { nuclei: [0, 4], J: -1.5, type: '²J(H-N)' }
        ],
        structure: {
            atoms: [
                { element: '15N', x: -70, y: -20, qubit: 4 },
                { element: '13C', x: -20, y: 0, qubit: 2 },
                { element: '13C', x: 30, y: 20, qubit: 3 },
                { element: 'C', x: 80, y: 0 },
                { element: 'C', x: 80, y: 50 },
                { element: 'H', x: -20, y: -35, qubit: 0 },
                { element: 'H', x: 30, y: 55, qubit: 1 },
                { element: 'C', x: -80, y: 0 },
                { element: 'O', x: 100, y: -25 },
                { element: 'O', x: 100, y: 25 }
            ],
            bonds: [[0,1], [1,2], [2,3], [2,4], [1,5], [2,6], [1,7], [3,8,'double'], [3,9]]
        },
        defaultT1: 2.5,
        defaultT2: 0.25
    },
    
    'pentafluorophenol': {
        name: 'Pentafluorophenol (5 ¹⁹F)',
        description: '5 ¹⁹F qubits - different positions on aromatic ring',
        formula: 'C₆F₅OH',
        nuclei: [
            { id: 0, element: '19F', label: 'Fo1', chemicalShift: -163.0,
              environment: 'ortho-F adjacent to OH, H-bonding' },
            { id: 1, element: '19F', label: 'Fo2', chemicalShift: -163.5,
              environment: 'ortho-F, symmetric position' },
            { id: 2, element: '19F', label: 'Fm1', chemicalShift: -167.0,
              environment: 'meta-F position' },
            { id: 3, element: '19F', label: 'Fm2', chemicalShift: -167.5,
              environment: 'meta-F, symmetric position' },
            { id: 4, element: '19F', label: 'Fp', chemicalShift: -170.0,
              environment: 'para-F, opposite to OH' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 20.0, type: '⁴J ortho-ortho' },
            { nuclei: [0, 2], J: 22.0, type: '³J ortho-meta' },
            { nuclei: [1, 3], J: 22.0, type: '³J ortho-meta' },
            { nuclei: [2, 4], J: 21.0, type: '³J meta-para' },
            { nuclei: [3, 4], J: 21.0, type: '³J meta-para' },
            { nuclei: [0, 4], J: 5.0, type: '⁴J ortho-para' },
            { nuclei: [2, 3], J: 4.0, type: '⁵J meta-meta' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: -40 },
                { element: 'C', x: 35, y: -20 },
                { element: 'C', x: 35, y: 20 },
                { element: 'C', x: 0, y: 40 },
                { element: 'C', x: -35, y: 20 },
                { element: 'C', x: -35, y: -20 },
                { element: 'O', x: 0, y: -70 },
                { element: 'F', x: 60, y: -35, qubit: 0 },
                { element: 'F', x: 60, y: 35, qubit: 2 },
                { element: 'F', x: 0, y: 70, qubit: 4 },
                { element: 'F', x: -60, y: 35, qubit: 3 },
                { element: 'F', x: -60, y: -35, qubit: 1 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0], [0,6], [1,7], [2,8], [3,9], [4,10], [5,11]]
        },
        defaultT1: 2.0,
        defaultT2: 0.4
    },
    
    'leucine': {
        name: 'Leucine (6Q)',
        description: '6-qubit amino acid system with mixed nuclides',
        formula: '(¹³CH₃)₂-¹³CH-CH₂-¹³CH(¹⁵NH₂)-COOH',
        nuclei: [
            { id: 0, element: '1H', label: 'Hα', chemicalShift: 3.73,
              environment: 'α-proton' },
            { id: 1, element: '1H', label: 'Hγ', chemicalShift: 1.7,
              environment: 'γ-proton on isopropyl' },
            { id: 2, element: '13C', label: 'Cα', chemicalShift: 54.9,
              environment: 'α-carbon' },
            { id: 3, element: '13C', label: 'Cγ', chemicalShift: 24.8,
              environment: 'γ-carbon (CH)' },
            { id: 4, element: '13C', label: 'Cδ', chemicalShift: 23.5,
              environment: 'δ-carbon (CH₃)' },
            { id: 5, element: '15N', label: 'N', chemicalShift: -336.5,
              environment: 'Amine nitrogen' }
        ],
        jCouplings: [
            { nuclei: [0, 2], J: 140.0, type: '¹J(C-H)' },
            { nuclei: [1, 3], J: 125.0, type: '¹J(C-H)' },
            { nuclei: [2, 5], J: 10.8, type: '¹J(C-N)' },
            { nuclei: [3, 4], J: 35.0, type: '¹J(C-C)' },
            { nuclei: [0, 5], J: -1.3, type: '²J(H-N)' }
        ],
        structure: {
            atoms: [
                { element: '15N', x: -80, y: -15, qubit: 5 },
                { element: '13C', x: -30, y: 0, qubit: 2 },
                { element: 'C', x: 10, y: 20 },
                { element: '13C', x: 50, y: 0, qubit: 3 },
                { element: '13C', x: 90, y: -20, qubit: 4 },
                { element: 'C', x: 90, y: 30 },
                { element: 'H', x: -30, y: -35, qubit: 0 },
                { element: 'H', x: 50, y: -35, qubit: 1 },
                { element: 'C', x: -90, y: 10 },
                { element: 'O', x: -90, y: 35 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [3,5], [1,6], [3,7], [1,8], [8,9,'double']]
        },
        defaultT1: 2.0,
        defaultT2: 0.2
    },
    
    'hexafluorobenzene': {
        name: 'Hexafluorobenzene (¹⁹F-¹³C)',
        description: '2 qubits from ¹⁹F + ¹³C coupling in aromatic ring',
        formula: '¹³C₆F₆',
        nuclei: [
            { id: 0, element: '19F', label: 'F1', chemicalShift: -162.0,
              environment: 'F bonded to ¹³C' },
            { id: 1, element: '13C', label: 'C', chemicalShift: 136.0,
              environment: '¹³C in aromatic ring' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 245.0, type: '¹J(C-F)' }
        ],
        structure: {
            atoms: [
                { element: '13C', x: 0, y: -35, qubit: 1 },
                { element: 'C', x: 30, y: -17 },
                { element: 'C', x: 30, y: 17 },
                { element: 'C', x: 0, y: 35 },
                { element: 'C', x: -30, y: 17 },
                { element: 'C', x: -30, y: -17 },
                { element: 'F', x: 0, y: -65, qubit: 0 },
                { element: 'F', x: 55, y: -32 },
                { element: 'F', x: 55, y: 32 },
                { element: 'F', x: 0, y: 65 },
                { element: 'F', x: -55, y: 32 },
                { element: 'F', x: -55, y: -32 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0], [0,6], [1,7], [2,8], [3,9], [4,10], [5,11]]
        },
        defaultT1: 5.0,
        defaultT2: 1.0
    },
    
    'trimethyl_phosphate': {
        name: 'Trimethyl Phosphate (6Q)',
        description: '6-qubit system with ³¹P, ¹³C and ¹H',
        formula: 'P(O¹³CH₃)₃',
        nuclei: [
            { id: 0, element: '31P', label: 'P', chemicalShift: 2.1,
              environment: 'Phosphorus center' },
            { id: 1, element: '13C', label: 'C1', chemicalShift: 54.5,
              environment: 'Methoxy carbon 1' },
            { id: 2, element: '13C', label: 'C2', chemicalShift: 54.6,
              environment: 'Methoxy carbon 2' },
            { id: 3, element: '13C', label: 'C3', chemicalShift: 54.7,
              environment: 'Methoxy carbon 3' },
            { id: 4, element: '1H', label: 'H1', chemicalShift: 3.75,
              environment: 'Methoxy proton set 1' },
            { id: 5, element: '1H', label: 'H2', chemicalShift: 3.76,
              environment: 'Methoxy proton set 2' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 6.0, type: '²J(P-C)' },
            { nuclei: [0, 2], J: 6.0, type: '²J(P-C)' },
            { nuclei: [0, 3], J: 6.0, type: '²J(P-C)' },
            { nuclei: [1, 4], J: 145.0, type: '¹J(C-H)' },
            { nuclei: [2, 5], J: 145.0, type: '¹J(C-H)' },
            { nuclei: [0, 4], J: 10.5, type: '³J(P-H)' }
        ],
        structure: {
            atoms: [
                { element: 'P', x: 0, y: 0, qubit: 0 },
                { element: 'O', x: -35, y: -20 },
                { element: 'O', x: 35, y: -20 },
                { element: 'O', x: 0, y: 35 },
                { element: '13C', x: -60, y: -35, qubit: 1 },
                { element: '13C', x: 60, y: -35, qubit: 2 },
                { element: '13C', x: 0, y: 65, qubit: 3 },
                { element: 'H', x: -80, y: -20, qubit: 4 },
                { element: 'H', x: 80, y: -20, qubit: 5 },
                { element: 'O', x: 0, y: -30 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,9,'double'], [1,4], [2,5], [3,6], [4,7], [5,8]]
        },
        defaultT1: 3.0,
        defaultT2: 0.5
    },
    
    // ========== SPECIAL / BENCHMARK SYSTEMS ==========
    
    'glutamine': {
        name: 'Glutamine (7Q)',
        description: '7-qubit amino acid with highly diverse nuclides',
        formula: 'H₂N-CO-¹³CH₂-¹³CH₂-¹³CH(¹⁵NH₂)-COOH',
        nuclei: [
            { id: 0, element: '1H', label: 'Hα', chemicalShift: 3.75,
              environment: 'α-proton' },
            { id: 1, element: '1H', label: 'Hβ', chemicalShift: 2.15,
              environment: 'β-protons (avg)' },
            { id: 2, element: '1H', label: 'Hγ', chemicalShift: 2.45,
              environment: 'γ-protons (avg)' },
            { id: 3, element: '13C', label: 'Cα', chemicalShift: 55.7,
              environment: 'α-carbon' },
            { id: 4, element: '13C', label: 'Cβ', chemicalShift: 28.8,
              environment: 'β-carbon' },
            { id: 5, element: '13C', label: 'Cγ', chemicalShift: 32.6,
              environment: 'γ-carbon' },
            { id: 6, element: '15N', label: 'N', chemicalShift: -337.0,
              environment: 'Amine nitrogen' }
        ],
        jCouplings: [
            { nuclei: [0, 3], J: 140.0, type: '¹J(C-H)' },
            { nuclei: [1, 4], J: 130.0, type: '¹J(C-H)' },
            { nuclei: [2, 5], J: 130.0, type: '¹J(C-H)' },
            { nuclei: [3, 4], J: 35.0, type: '¹J(C-C)' },
            { nuclei: [4, 5], J: 34.0, type: '¹J(C-C)' },
            { nuclei: [3, 6], J: 10.5, type: '¹J(C-N)' },
            { nuclei: [0, 6], J: -1.5, type: '²J(H-N)' }
        ],
        structure: {
            atoms: [
                { element: '15N', x: -100, y: -10, qubit: 6 },
                { element: '13C', x: -50, y: 0, qubit: 3 },
                { element: '13C', x: 0, y: 10, qubit: 4 },
                { element: '13C', x: 50, y: 0, qubit: 5 },
                { element: 'C', x: 100, y: 10 },
                { element: 'N', x: 130, y: -10 },
                { element: 'H', x: -50, y: -35, qubit: 0 },
                { element: 'H', x: 0, y: 45, qubit: 1 },
                { element: 'H', x: 50, y: -35, qubit: 2 },
                { element: 'O', x: 100, y: 40 },
                { element: 'C', x: -100, y: 25 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [1,6], [2,7], [3,8], [4,9,'double'], [1,10]]
        },
        defaultT1: 2.0,
        defaultT2: 0.15
    },
    
    'malonic_acid': {
        name: 'Diethyl Malonate (5Q)',
        description: 'Classic NMR QC molecule with labeled carbons',
        formula: '¹³CH₂(COO¹³CH₃)₂',
        nuclei: [
            { id: 0, element: '13C', label: 'C1', chemicalShift: 41.0,
              environment: 'Central CH₂ carbon' },
            { id: 1, element: '13C', label: 'C2', chemicalShift: 166.0,
              environment: 'Carbonyl C=O' },
            { id: 2, element: '13C', label: 'C3', chemicalShift: 167.0,
              environment: 'Carbonyl C=O' },
            { id: 3, element: '1H', label: 'H1', chemicalShift: 3.3,
              environment: 'CH₂ protons' },
            { id: 4, element: '1H', label: 'H2', chemicalShift: 4.2,
              environment: 'OCH₂ protons' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 55.0, type: '¹J(C-C)' },
            { nuclei: [0, 2], J: 56.0, type: '¹J(C-C)' },
            { nuclei: [0, 3], J: 130.0, type: '¹J(C-H)' },
            { nuclei: [1, 2], J: 2.0, type: '³J' }
        ],
        structure: {
            atoms: [
                { element: '13C', x: 0, y: 0, qubit: 0 },
                { element: '13C', x: -50, y: 0, qubit: 1 },
                { element: '13C', x: 50, y: 0, qubit: 2 },
                { element: 'H', x: -15, y: -30, qubit: 3 },
                { element: 'H', x: 15, y: -30 },
                { element: 'O', x: -75, y: -20 },
                { element: 'O', x: -75, y: 25 },
                { element: 'O', x: 75, y: -20 },
                { element: 'O', x: 75, y: 25 },
                { element: 'C', x: -100, y: 40 },
                { element: 'H', x: -115, y: 20, qubit: 4 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4], [1,5,'double'], [1,6], [2,7,'double'], [2,8], [6,9], [9,10]]
        },
        defaultT1: 2.0,
        defaultT2: 0.15
    },
    
    'tceb': {
        name: 'Trans-Crotonic Acid Butyl Ester (6Q)',
        description: '6-qubit ¹³C benchmark molecule',
        formula: '¹³C₆-labeled trans-crotonic acid butyl ester',
        nuclei: [
            { id: 0, element: '13C', label: 'C1', chemicalShift: 14.0, environment: 'Terminal CH₃' },
            { id: 1, element: '13C', label: 'C2', chemicalShift: 19.0, environment: 'Butyl CH₂' },
            { id: 2, element: '13C', label: 'C3', chemicalShift: 30.0, environment: 'Butyl CH₂' },
            { id: 3, element: '13C', label: 'C4', chemicalShift: 64.0, environment: 'O-CH₂' },
            { id: 4, element: '13C', label: 'C5', chemicalShift: 122.0, environment: '=CH vinyl' },
            { id: 5, element: '13C', label: 'C6', chemicalShift: 166.0, environment: 'C=O' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 35.0, type: '¹J(C-C)' },
            { nuclei: [1, 2], J: 35.0, type: '¹J(C-C)' },
            { nuclei: [2, 3], J: 35.0, type: '¹J(C-C)' },
            { nuclei: [3, 5], J: 3.0, type: '³J' },
            { nuclei: [4, 5], J: 70.0, type: '¹J(C=C)' }
        ],
        structure: {
            atoms: [
                { element: '13C', x: -100, y: 0, qubit: 0 },
                { element: '13C', x: -60, y: 0, qubit: 1 },
                { element: '13C', x: -20, y: 0, qubit: 2 },
                { element: '13C', x: 20, y: 0, qubit: 3 },
                { element: 'O', x: 50, y: 0 },
                { element: '13C', x: 70, y: -25, qubit: 5 },
                { element: '13C', x: 100, y: 0, qubit: 4 },
                { element: 'O', x: 70, y: -55 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6,'double'], [5,7,'double']]
        },
        defaultT1: 2.5,
        defaultT2: 0.2
    },
    
    'tryptophan': {
        name: 'Tryptophan (8Q)',
        description: '8-qubit amino acid with aromatic ring - diverse NMR active nuclei',
        formula: 'Labeled L-Tryptophan',
        nuclei: [
            { id: 0, element: '1H', label: 'Hα', chemicalShift: 3.98, environment: 'α-proton' },
            { id: 1, element: '1H', label: 'H2', chemicalShift: 7.24, environment: 'Indole C2-H' },
            { id: 2, element: '1H', label: 'H4', chemicalShift: 7.65, environment: 'Indole C4-H' },
            { id: 3, element: '13C', label: 'Cα', chemicalShift: 56.0, environment: 'α-carbon' },
            { id: 4, element: '13C', label: 'Cβ', chemicalShift: 28.0, environment: 'β-carbon' },
            { id: 5, element: '13C', label: 'C2', chemicalShift: 126.0, environment: 'Indole C2' },
            { id: 6, element: '15N', label: 'N1', chemicalShift: -248.0, environment: 'Indole nitrogen' },
            { id: 7, element: '15N', label: 'Nα', chemicalShift: -337.0, environment: 'α-amine nitrogen' }
        ],
        jCouplings: [
            { nuclei: [0, 3], J: 140.0, type: '¹J(C-H)' },
            { nuclei: [1, 5], J: 180.0, type: '¹J(C-H)' },
            { nuclei: [3, 4], J: 35.0, type: '¹J(C-C)' },
            { nuclei: [3, 7], J: 10.5, type: '¹J(C-N)' },
            { nuclei: [5, 6], J: 15.0, type: '²J(C-N)' },
            { nuclei: [1, 6], J: 5.0, type: '²J(H-N)' },
            { nuclei: [0, 7], J: -1.5, type: '²J(H-N)' }
        ],
        structure: {
            atoms: [
                { element: '15N', x: -80, y: -20, qubit: 7 },
                { element: '13C', x: -30, y: 0, qubit: 3 },
                { element: '13C', x: 10, y: 25, qubit: 4 },
                { element: 'C', x: 50, y: 10 },
                { element: '13C', x: 70, y: -20, qubit: 5 },
                { element: '15N', x: 50, y: -45, qubit: 6 },
                { element: 'C', x: 100, y: -30 },
                { element: 'C', x: 120, y: 0 },
                { element: 'H', x: -30, y: -35, qubit: 0 },
                { element: 'H', x: 70, y: -50, qubit: 1 },
                { element: 'H', x: 145, y: 0, qubit: 2 },
                { element: 'C', x: -80, y: 15 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [4,6], [6,7], [1,8], [4,9], [7,10], [1,11]]
        },
        defaultT1: 1.5,
        defaultT2: 0.1
    },
    
    'adenosine': {
        name: 'Adenosine (7Q)',
        description: 'Nucleoside with ¹³C, ¹⁵N, and ³¹P labeling',
        formula: 'Labeled Adenosine-5\'-monophosphate',
        nuclei: [
            { id: 0, element: '1H', label: 'H8', chemicalShift: 8.21, environment: 'Purine H8' },
            { id: 1, element: '1H', label: 'H2', chemicalShift: 8.13, environment: 'Purine H2' },
            { id: 2, element: '13C', label: 'C8', chemicalShift: 141.0, environment: 'Purine C8' },
            { id: 3, element: '13C', label: 'C2', chemicalShift: 153.0, environment: 'Purine C2' },
            { id: 4, element: '15N', label: 'N7', chemicalShift: -231.0, environment: 'Purine N7' },
            { id: 5, element: '15N', label: 'N1', chemicalShift: -225.0, environment: 'Purine N1' },
            { id: 6, element: '31P', label: 'P', chemicalShift: 0.5, environment: 'Phosphate' }
        ],
        jCouplings: [
            { nuclei: [0, 2], J: 215.0, type: '¹J(C-H)' },
            { nuclei: [1, 3], J: 205.0, type: '¹J(C-H)' },
            { nuclei: [2, 4], J: 12.0, type: '²J(C-N)' },
            { nuclei: [3, 5], J: 15.0, type: '²J(C-N)' },
            { nuclei: [0, 4], J: 5.0, type: '²J(H-N)' },
            { nuclei: [1, 5], J: 5.0, type: '²J(H-N)' }
        ],
        structure: {
            atoms: [
                { element: '15N', x: -30, y: -30, qubit: 4 },
                { element: '13C', x: 0, y: -45, qubit: 2 },
                { element: '15N', x: 30, y: -30, qubit: 5 },
                { element: '13C', x: 30, y: 10, qubit: 3 },
                { element: 'C', x: 0, y: 30 },
                { element: 'C', x: -30, y: 10 },
                { element: 'N', x: -55, y: 25 },
                { element: 'C', x: 0, y: 60 },
                { element: 'O', x: 0, y: 90 },
                { element: 'P', x: 0, y: 120, qubit: 6 },
                { element: 'H', x: 0, y: -75, qubit: 0 },
                { element: 'H', x: 55, y: 10, qubit: 1 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0], [5,6], [4,7], [7,8], [8,9], [1,10], [3,11]]
        },
        defaultT1: 2.0,
        defaultT2: 0.15
    },
    
    // ========== 7-8 QUBIT SYSTEMS ==========
    
    'perfluoroheptane': {
        name: 'Perfluoroheptane',
        description: '7 ¹⁹F qubits - linear fluorocarbon chain with distinct environments',
        formula: 'CF₃-(CF₂)₅-CF₃',
        nuclei: [
            { id: 0, element: '19F', label: 'F1', chemicalShift: -81.0, environment: 'Terminal CF₃' },
            { id: 1, element: '19F', label: 'F2', chemicalShift: -127.0, environment: 'α-CF₂ to CF₃' },
            { id: 2, element: '19F', label: 'F3', chemicalShift: -122.0, environment: 'β-CF₂' },
            { id: 3, element: '19F', label: 'F4', chemicalShift: -123.5, environment: 'Central CF₂' },
            { id: 4, element: '19F', label: 'F5', chemicalShift: -122.5, environment: 'β-CF₂' },
            { id: 5, element: '19F', label: 'F6', chemicalShift: -126.5, environment: 'α-CF₂ to CF₃' },
            { id: 6, element: '19F', label: 'F7', chemicalShift: -81.5, environment: 'Terminal CF₃' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 10.0, type: '³J' },
            { nuclei: [1, 2], J: 12.0, type: '³J' },
            { nuclei: [2, 3], J: 12.0, type: '³J' },
            { nuclei: [3, 4], J: 12.0, type: '³J' },
            { nuclei: [4, 5], J: 12.0, type: '³J' },
            { nuclei: [5, 6], J: 10.0, type: '³J' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -90, y: 0 },
                { element: 'C', x: -60, y: 0 },
                { element: 'C', x: -30, y: 0 },
                { element: 'C', x: 0, y: 0 },
                { element: 'C', x: 30, y: 0 },
                { element: 'C', x: 60, y: 0 },
                { element: 'C', x: 90, y: 0 },
                { element: 'F', x: -90, y: -25, qubit: 0 },
                { element: 'F', x: -60, y: -25, qubit: 1 },
                { element: 'F', x: -30, y: -25, qubit: 2 },
                { element: 'F', x: 0, y: -25, qubit: 3 },
                { element: 'F', x: 30, y: -25, qubit: 4 },
                { element: 'F', x: 60, y: -25, qubit: 5 },
                { element: 'F', x: 90, y: -25, qubit: 6 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6]]
        },
        defaultT1: 2.0,
        defaultT2: 0.5
    },
    
    'octafluoronaphthalene': {
        name: 'Octafluoronaphthalene',
        description: '8 ¹⁹F qubits - fused aromatic ring system with 4 distinct environments',
        formula: 'C₁₀F₈',
        nuclei: [
            { id: 0, element: '19F', label: 'F1', chemicalShift: -150.0, environment: 'Peri F, ring junction' },
            { id: 1, element: '19F', label: 'F2', chemicalShift: -155.0, environment: 'α to junction' },
            { id: 2, element: '19F', label: 'F3', chemicalShift: -160.0, environment: 'β to junction' },
            { id: 3, element: '19F', label: 'F4', chemicalShift: -152.0, environment: 'Peri F, ring junction' },
            { id: 4, element: '19F', label: 'F5', chemicalShift: -150.5, environment: 'Peri F, ring junction' },
            { id: 5, element: '19F', label: 'F6', chemicalShift: -155.5, environment: 'α to junction' },
            { id: 6, element: '19F', label: 'F7', chemicalShift: -160.5, environment: 'β to junction' },
            { id: 7, element: '19F', label: 'F8', chemicalShift: -152.5, environment: 'Peri F, ring junction' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 58.0, type: '³J ortho' },
            { nuclei: [1, 2], J: 20.0, type: '⁴J meta' },
            { nuclei: [2, 3], J: 58.0, type: '³J ortho' },
            { nuclei: [4, 5], J: 58.0, type: '³J ortho' },
            { nuclei: [5, 6], J: 20.0, type: '⁴J meta' },
            { nuclei: [6, 7], J: 58.0, type: '³J ortho' },
            { nuclei: [0, 4], J: 5.0, type: 'peri' },
            { nuclei: [3, 7], J: 5.0, type: 'peri' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -40, y: -20 }, { element: 'C', x: -20, y: -35 },
                { element: 'C', x: 0, y: -20 }, { element: 'C', x: 0, y: 10 },
                { element: 'C', x: -20, y: 25 }, { element: 'C', x: -40, y: 10 },
                { element: 'C', x: 20, y: -35 }, { element: 'C', x: 40, y: -20 },
                { element: 'C', x: 40, y: 10 }, { element: 'C', x: 20, y: 25 },
                { element: 'F', x: -60, y: -30, qubit: 0 },
                { element: 'F', x: -20, y: -60, qubit: 1 },
                { element: 'F', x: 20, y: -60, qubit: 2 },
                { element: 'F', x: 60, y: -30, qubit: 3 },
                { element: 'F', x: 60, y: 20, qubit: 4 },
                { element: 'F', x: 20, y: 50, qubit: 5 },
                { element: 'F', x: -20, y: 50, qubit: 6 },
                { element: 'F', x: -60, y: 20, qubit: 7 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0], [2,6], [6,7], [7,8], [8,9], [9,3]]
        },
        defaultT1: 2.0,
        defaultT2: 0.6
    },
    
    // ========== 9-10 QUBIT SYSTEMS ==========
    
    'perfluorodecalin': {
        name: 'Perfluorodecalin',
        description: '9 ¹⁹F in different ring positions - used in blood substitutes',
        formula: 'C₁₀F₁₈ (9 distinguishable)',
        nuclei: [
            { id: 0, element: '19F', label: 'F1', chemicalShift: -130.0, environment: 'Axial ring junction' },
            { id: 1, element: '19F', label: 'F2', chemicalShift: -138.0, environment: 'Equatorial α' },
            { id: 2, element: '19F', label: 'F3', chemicalShift: -140.0, environment: 'Axial α' },
            { id: 3, element: '19F', label: 'F4', chemicalShift: -135.0, environment: 'Equatorial β' },
            { id: 4, element: '19F', label: 'F5', chemicalShift: -142.0, environment: 'Axial β' },
            { id: 5, element: '19F', label: 'F6', chemicalShift: -131.0, environment: 'Axial ring junction' },
            { id: 6, element: '19F', label: 'F7', chemicalShift: -137.0, environment: 'Equatorial γ' },
            { id: 7, element: '19F', label: 'F8', chemicalShift: -141.0, environment: 'Axial γ' },
            { id: 8, element: '19F', label: 'F9', chemicalShift: -136.0, environment: 'Equatorial δ' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 250.0, type: '²J gem' },
            { nuclei: [1, 2], J: 10.0, type: '³J' },
            { nuclei: [2, 3], J: 45.0, type: '³J ax-eq' },
            { nuclei: [3, 4], J: 10.0, type: '³J' },
            { nuclei: [4, 5], J: 250.0, type: '²J gem' },
            { nuclei: [5, 6], J: 45.0, type: '³J' },
            { nuclei: [6, 7], J: 10.0, type: '³J' },
            { nuclei: [7, 8], J: 45.0, type: '³J' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -30, y: -20 }, { element: 'C', x: 0, y: -30 },
                { element: 'C', x: 30, y: -20 }, { element: 'C', x: 30, y: 20 },
                { element: 'C', x: 0, y: 30 }, { element: 'C', x: -30, y: 20 },
                { element: 'F', x: -50, y: -35, qubit: 0 }, { element: 'F', x: 0, y: -55, qubit: 1 },
                { element: 'F', x: 50, y: -35, qubit: 2 }, { element: 'F', x: 50, y: 35, qubit: 3 },
                { element: 'F', x: 0, y: 55, qubit: 4 }, { element: 'F', x: -50, y: 35, qubit: 5 },
                { element: 'F', x: -30, y: 0, qubit: 6 }, { element: 'F', x: 30, y: 0, qubit: 7 },
                { element: 'F', x: 0, y: 0, qubit: 8 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0]]
        },
        defaultT1: 2.5,
        defaultT2: 0.7
    },
    
    'decafluorobiphenyl': {
        name: 'Decafluorobiphenyl',
        description: '10 ¹⁹F qubits - two pentafluorophenyl rings with distinct positions',
        formula: 'C₁₂F₁₀',
        nuclei: [
            { id: 0, element: '19F', label: 'F2', chemicalShift: -138.0, environment: 'ortho to bridge, ring A' },
            { id: 1, element: '19F', label: 'F3', chemicalShift: -154.0, environment: 'meta position, ring A' },
            { id: 2, element: '19F', label: 'F4', chemicalShift: -162.0, environment: 'para position, ring A' },
            { id: 3, element: '19F', label: 'F5', chemicalShift: -154.5, environment: 'meta position, ring A' },
            { id: 4, element: '19F', label: 'F6', chemicalShift: -138.5, environment: 'ortho to bridge, ring A' },
            { id: 5, element: '19F', label: "F2'", chemicalShift: -139.0, environment: 'ortho to bridge, ring B' },
            { id: 6, element: '19F', label: "F3'", chemicalShift: -155.0, environment: 'meta position, ring B' },
            { id: 7, element: '19F', label: "F4'", chemicalShift: -163.0, environment: 'para position, ring B' },
            { id: 8, element: '19F', label: "F5'", chemicalShift: -155.5, environment: 'meta position, ring B' },
            { id: 9, element: '19F', label: "F6'", chemicalShift: -139.5, environment: 'ortho to bridge, ring B' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 22.0, type: '³J ortho' },
            { nuclei: [1, 2], J: 22.0, type: '³J ortho' },
            { nuclei: [2, 3], J: 22.0, type: '³J ortho' },
            { nuclei: [3, 4], J: 22.0, type: '³J ortho' },
            { nuclei: [5, 6], J: 22.0, type: '³J ortho' },
            { nuclei: [6, 7], J: 22.0, type: '³J ortho' },
            { nuclei: [7, 8], J: 22.0, type: '³J ortho' },
            { nuclei: [8, 9], J: 22.0, type: '³J ortho' },
            { nuclei: [0, 5], J: 2.5, type: 'through-space' },
            { nuclei: [4, 9], J: 2.5, type: 'through-space' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -60, y: 0 }, { element: 'C', x: -50, y: -25 },
                { element: 'C', x: -25, y: -40 }, { element: 'C', x: 0, y: -25 },
                { element: 'C', x: 0, y: 0 }, { element: 'C', x: -25, y: 15 },
                { element: 'C', x: 25, y: 0 }, { element: 'C', x: 50, y: -25 },
                { element: 'C', x: 75, y: -25 }, { element: 'C', x: 85, y: 0 },
                { element: 'C', x: 75, y: 25 }, { element: 'C', x: 50, y: 25 },
                { element: 'F', x: -70, y: -40, qubit: 0 }, { element: 'F', x: -25, y: -65, qubit: 1 },
                { element: 'F', x: 20, y: -40, qubit: 2 }, { element: 'F', x: -25, y: 40, qubit: 3 },
                { element: 'F', x: -85, y: 10, qubit: 4 },
                { element: 'F', x: 50, y: -50, qubit: 5 }, { element: 'F', x: 95, y: -40, qubit: 6 },
                { element: 'F', x: 110, y: 0, qubit: 7 }, { element: 'F', x: 95, y: 40, qubit: 8 },
                { element: 'F', x: 50, y: 50, qubit: 9 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,0], [4,6], [6,7], [7,8], [8,9], [9,10], [10,11], [11,6]]
        },
        defaultT1: 2.0,
        defaultT2: 0.5
    },
    
    // ========== 11-12 QUBIT SYSTEMS ==========
    
    'perfluoroundecanoic': {
        name: 'Perfluoroundecanoic Acid',
        description: '11 ¹⁹F qubits - long perfluoroalkyl chain with carboxylic acid',
        formula: 'CF₃-(CF₂)₉-COOH',
        nuclei: [
            { id: 0, element: '19F', label: 'F1', chemicalShift: -81.0, environment: 'Terminal CF₃' },
            { id: 1, element: '19F', label: 'F2', chemicalShift: -126.0, environment: 'α to CF₃' },
            { id: 2, element: '19F', label: 'F3', chemicalShift: -122.0, environment: 'β to CF₃' },
            { id: 3, element: '19F', label: 'F4', chemicalShift: -121.5, environment: 'γ to CF₃' },
            { id: 4, element: '19F', label: 'F5', chemicalShift: -122.5, environment: 'Central chain' },
            { id: 5, element: '19F', label: 'F6', chemicalShift: -123.0, environment: 'Central chain' },
            { id: 6, element: '19F', label: 'F7', chemicalShift: -122.8, environment: 'Central chain' },
            { id: 7, element: '19F', label: 'F8', chemicalShift: -121.0, environment: 'δ to COOH' },
            { id: 8, element: '19F', label: 'F9', chemicalShift: -123.5, environment: 'γ to COOH' },
            { id: 9, element: '19F', label: 'F10', chemicalShift: -120.0, environment: 'β to COOH' },
            { id: 10, element: '19F', label: 'F11', chemicalShift: -118.0, environment: 'α to COOH' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 10.0, type: '³J' },
            { nuclei: [1, 2], J: 12.0, type: '³J' },
            { nuclei: [2, 3], J: 12.0, type: '³J' },
            { nuclei: [3, 4], J: 12.0, type: '³J' },
            { nuclei: [4, 5], J: 12.0, type: '³J' },
            { nuclei: [5, 6], J: 12.0, type: '³J' },
            { nuclei: [6, 7], J: 12.0, type: '³J' },
            { nuclei: [7, 8], J: 12.0, type: '³J' },
            { nuclei: [8, 9], J: 12.0, type: '³J' },
            { nuclei: [9, 10], J: 10.0, type: '³J' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -150, y: 0 }, { element: 'C', x: -120, y: 0 },
                { element: 'C', x: -90, y: 0 }, { element: 'C', x: -60, y: 0 },
                { element: 'C', x: -30, y: 0 }, { element: 'C', x: 0, y: 0 },
                { element: 'C', x: 30, y: 0 }, { element: 'C', x: 60, y: 0 },
                { element: 'C', x: 90, y: 0 }, { element: 'C', x: 120, y: 0 },
                { element: 'C', x: 150, y: 0 },
                { element: 'F', x: -150, y: -20, qubit: 0 },
                { element: 'F', x: -120, y: -20, qubit: 1 },
                { element: 'F', x: -90, y: -20, qubit: 2 },
                { element: 'F', x: -60, y: -20, qubit: 3 },
                { element: 'F', x: -30, y: -20, qubit: 4 },
                { element: 'F', x: 0, y: -20, qubit: 5 },
                { element: 'F', x: 30, y: -20, qubit: 6 },
                { element: 'F', x: 60, y: -20, qubit: 7 },
                { element: 'F', x: 90, y: -20, qubit: 8 },
                { element: 'F', x: 120, y: -20, qubit: 9 },
                { element: 'F', x: 150, y: -20, qubit: 10 },
                { element: 'O', x: 170, y: -15 },
                { element: 'O', x: 170, y: 15 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5], [5,6], [6,7], [7,8], [8,9], [9,10]]
        },
        defaultT1: 2.0,
        defaultT2: 0.4
    },
    
    'dodecafluorohexane': {
        name: 'Perfluorohexane',
        description: '12 ¹⁹F qubits - linear chain, each F in unique environment due to position',
        formula: 'CF₃-CF₂-CF₂-CF₂-CF₂-CF₃',
        nuclei: [
            { id: 0, element: '19F', label: 'F1a', chemicalShift: -81.0, environment: 'Terminal CF₃, axial' },
            { id: 1, element: '19F', label: 'F1b', chemicalShift: -81.3, environment: 'Terminal CF₃, equatorial' },
            { id: 2, element: '19F', label: 'F2a', chemicalShift: -126.0, environment: 'α-CF₂, upper' },
            { id: 3, element: '19F', label: 'F2b', chemicalShift: -127.0, environment: 'α-CF₂, lower' },
            { id: 4, element: '19F', label: 'F3a', chemicalShift: -122.0, environment: 'β-CF₂, upper' },
            { id: 5, element: '19F', label: 'F3b', chemicalShift: -123.0, environment: 'β-CF₂, lower' },
            { id: 6, element: '19F', label: 'F4a', chemicalShift: -122.5, environment: 'β-CF₂, upper' },
            { id: 7, element: '19F', label: 'F4b', chemicalShift: -123.5, environment: 'β-CF₂, lower' },
            { id: 8, element: '19F', label: 'F5a', chemicalShift: -126.5, environment: 'α-CF₂, upper' },
            { id: 9, element: '19F', label: 'F5b', chemicalShift: -127.5, environment: 'α-CF₂, lower' },
            { id: 10, element: '19F', label: 'F6a', chemicalShift: -81.5, environment: 'Terminal CF₃, axial' },
            { id: 11, element: '19F', label: 'F6b', chemicalShift: -81.8, environment: 'Terminal CF₃, equatorial' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 290.0, type: '²J gem' },
            { nuclei: [0, 2], J: 10.0, type: '³J' },
            { nuclei: [2, 3], J: 290.0, type: '²J gem' },
            { nuclei: [2, 4], J: 12.0, type: '³J' },
            { nuclei: [4, 5], J: 290.0, type: '²J gem' },
            { nuclei: [4, 6], J: 12.0, type: '³J' },
            { nuclei: [6, 7], J: 290.0, type: '²J gem' },
            { nuclei: [6, 8], J: 12.0, type: '³J' },
            { nuclei: [8, 9], J: 290.0, type: '²J gem' },
            { nuclei: [8, 10], J: 10.0, type: '³J' },
            { nuclei: [10, 11], J: 290.0, type: '²J gem' }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -75, y: 0 }, { element: 'C', x: -45, y: 0 },
                { element: 'C', x: -15, y: 0 }, { element: 'C', x: 15, y: 0 },
                { element: 'C', x: 45, y: 0 }, { element: 'C', x: 75, y: 0 },
                { element: 'F', x: -90, y: -20, qubit: 0 }, { element: 'F', x: -75, y: 25, qubit: 1 },
                { element: 'F', x: -45, y: -25, qubit: 2 }, { element: 'F', x: -45, y: 25, qubit: 3 },
                { element: 'F', x: -15, y: -25, qubit: 4 }, { element: 'F', x: -15, y: 25, qubit: 5 },
                { element: 'F', x: 15, y: -25, qubit: 6 }, { element: 'F', x: 15, y: 25, qubit: 7 },
                { element: 'F', x: 45, y: -25, qubit: 8 }, { element: 'F', x: 45, y: 25, qubit: 9 },
                { element: 'F', x: 90, y: -20, qubit: 10 }, { element: 'F', x: 75, y: 25, qubit: 11 }
            ],
            bonds: [[0,1], [1,2], [2,3], [3,4], [4,5]]
        },
        defaultT1: 2.0,
        defaultT2: 0.5
    },
    
    'iron_porphyrin': {
        name: 'Iron Porphyrin',
        description: '12 ¹H qubits - porphyrin ring with distinct pyrrole and meso protons',
        formula: 'Fe-Porphyrin',
        nuclei: [
            { id: 0, element: '1H', label: 'H1', chemicalShift: 9.5, environment: 'meso position 1' },
            { id: 1, element: '1H', label: 'H2', chemicalShift: 9.7, environment: 'meso position 2' },
            { id: 2, element: '1H', label: 'H3', chemicalShift: 9.6, environment: 'meso position 3' },
            { id: 3, element: '1H', label: 'H4', chemicalShift: 9.8, environment: 'meso position 4' },
            { id: 4, element: '1H', label: 'H5', chemicalShift: 8.8, environment: 'pyrrole β, ring A' },
            { id: 5, element: '1H', label: 'H6', chemicalShift: 8.9, environment: 'pyrrole β, ring A' },
            { id: 6, element: '1H', label: 'H7', chemicalShift: 8.7, environment: 'pyrrole β, ring B' },
            { id: 7, element: '1H', label: 'H8', chemicalShift: 8.85, environment: 'pyrrole β, ring B' },
            { id: 8, element: '1H', label: 'H9', chemicalShift: 8.75, environment: 'pyrrole β, ring C' },
            { id: 9, element: '1H', label: 'H10', chemicalShift: 8.95, environment: 'pyrrole β, ring C' },
            { id: 10, element: '1H', label: 'H11', chemicalShift: 8.65, environment: 'pyrrole β, ring D' },
            { id: 11, element: '1H', label: 'H12', chemicalShift: 8.92, environment: 'pyrrole β, ring D' }
        ],
        jCouplings: [
            { nuclei: [4, 5], J: 4.5, type: '³J pyrrole' },
            { nuclei: [6, 7], J: 4.5, type: '³J pyrrole' },
            { nuclei: [8, 9], J: 4.5, type: '³J pyrrole' },
            { nuclei: [10, 11], J: 4.5, type: '³J pyrrole' }
        ],
        structure: {
            atoms: [
                { element: 'Fe', x: 0, y: 0 },
                { element: 'N', x: -25, y: 0 }, { element: 'N', x: 25, y: 0 },
                { element: 'N', x: 0, y: -25 }, { element: 'N', x: 0, y: 25 },
                { element: 'H', x: -50, y: -25, qubit: 0 }, { element: 'H', x: 50, y: -25, qubit: 1 },
                { element: 'H', x: 50, y: 25, qubit: 2 }, { element: 'H', x: -50, y: 25, qubit: 3 },
                { element: 'H', x: -35, y: -40, qubit: 4 }, { element: 'H', x: -15, y: -45, qubit: 5 },
                { element: 'H', x: 15, y: -45, qubit: 6 }, { element: 'H', x: 35, y: -40, qubit: 7 },
                { element: 'H', x: 35, y: 40, qubit: 8 }, { element: 'H', x: 15, y: 45, qubit: 9 },
                { element: 'H', x: -15, y: 45, qubit: 10 }, { element: 'H', x: -35, y: 40, qubit: 11 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 1.5,
        defaultT2: 0.3
    },
    
    // ========== SILICON AND BORON SYSTEMS ==========
    
    'tetramethoxysilane': {
        name: 'Tetramethoxysilane (4Q)',
        description: '²⁹Si and ¹³C 4-qubit system - silicon NMR',
        formula: 'Si(O¹³CH₃)₄',
        nuclei: [
            { id: 0, element: '29Si', label: 'Si', chemicalShift: -78.0,
              environment: 'Central silicon' },
            { id: 1, element: '13C', label: 'C1', chemicalShift: 50.5,
              environment: 'Methoxy carbon' },
            { id: 2, element: '13C', label: 'C2', chemicalShift: 50.6,
              environment: 'Methoxy carbon' },
            { id: 3, element: '1H', label: 'H', chemicalShift: 3.55,
              environment: 'Methoxy protons' }
        ],
        jCouplings: [
            { nuclei: [0, 1], J: 4.5, type: '²J(Si-C)' },
            { nuclei: [0, 2], J: 4.5, type: '²J(Si-C)' },
            { nuclei: [1, 3], J: 145.0, type: '¹J(C-H)' },
            { nuclei: [0, 3], J: 2.0, type: '³J(Si-H)' }
        ],
        structure: {
            atoms: [
                { element: 'Si', x: 0, y: 0, qubit: 0 },
                { element: 'O', x: -30, y: -20 },
                { element: 'O', x: 30, y: -20 },
                { element: 'O', x: -30, y: 20 },
                { element: 'O', x: 30, y: 20 },
                { element: '13C', x: -55, y: -35, qubit: 1 },
                { element: '13C', x: 55, y: -35, qubit: 2 },
                { element: 'C', x: -55, y: 35 },
                { element: 'C', x: 55, y: 35 },
                { element: 'H', x: -75, y: -20, qubit: 3 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4], [1,5], [2,6], [3,7], [4,8], [5,9]]
        },
        defaultT1: 20.0,
        defaultT2: 5.0
    },
    
    // === PLATINUM-195 COMPOUNDS (spin-1/2, 33.8% abundance) ===
    
    'cisplatin': {
        name: 'Cisplatin (¹⁹⁵Pt)',
        description: '¹⁹⁵Pt single qubit - anticancer drug with NMR-active platinum',
        formula: 'cis-[Pt(NH₃)₂Cl₂]',
        nuclei: [
            { id: 0, element: '195Pt', label: 'Pt', chemicalShift: -2100.0,
              environment: 'Pt(II) square planar coordination' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: 'Pt', x: 0, y: 0, qubit: 0 },
                { element: 'N', x: -35, y: -25 },
                { element: 'N', x: 35, y: -25 },
                { element: 'Cl', x: -35, y: 25 },
                { element: 'Cl', x: 35, y: 25 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 0.5,
        defaultT2: 0.1
    },
    
    // === SELENIUM-77 COMPOUNDS (spin-1/2, 7.6% abundance) ===
    
    'selenomethionine': {
        name: 'Selenomethionine (⁷⁷Se)',
        description: '⁷⁷Se single qubit - selenium amino acid used in protein NMR',
        formula: 'CH₃-⁷⁷Se-CH₂-CH₂-CH(NH₂)-COOH',
        nuclei: [
            { id: 0, element: '77Se', label: 'Se', chemicalShift: 50.0,
              environment: 'Selenomethionine Se atom' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: 'Se', x: 0, y: 0, qubit: 0 },
                { element: 'C', x: -40, y: 0 },
                { element: 'C', x: 40, y: 0 },
                { element: 'C', x: 80, y: 0 },
                { element: 'C', x: 120, y: 0 },
                { element: 'N', x: 120, y: -35 },
                { element: 'C', x: 160, y: 0 }
            ],
            bonds: [[0,1], [0,2], [2,3], [3,4], [4,5], [4,6]]
        },
        defaultT1: 5.0,
        defaultT2: 1.0
    },
    
    // === TIN-119 COMPOUNDS (spin-1/2, 8.6% abundance) ===
    
    'tetramethyltin': {
        name: 'Tetramethyltin (¹¹⁹Sn)',
        description: '¹¹⁹Sn single qubit - organometallic tin reference compound',
        formula: 'Sn(CH₃)₄',
        nuclei: [
            { id: 0, element: '119Sn', label: 'Sn', chemicalShift: 0.0,
              environment: 'Tetrahedral Sn(IV) - reference at 0 ppm' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: 'Sn', x: 0, y: 0, qubit: 0 },
                { element: 'C', x: -35, y: -25 },
                { element: 'C', x: 35, y: -25 },
                { element: 'C', x: -35, y: 25 },
                { element: 'C', x: 35, y: 25 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 10.0,
        defaultT2: 3.0
    },
    
    // === MERCURY-199 COMPOUNDS (spin-1/2, 16.9% abundance) ===
    
    'dimethylmercury': {
        name: 'Dimethylmercury (¹⁹⁹Hg)',
        description: '¹⁹⁹Hg single qubit - linear organomercury compound',
        formula: '(CH₃)₂Hg',
        nuclei: [
            { id: 0, element: '199Hg', label: 'Hg', chemicalShift: -780.0,
              environment: 'Linear Hg(II) with methyl groups' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: 'Hg', x: 0, y: 0, qubit: 0 },
                { element: 'C', x: -45, y: 0 },
                { element: 'C', x: 45, y: 0 }
            ],
            bonds: [[0,1], [0,2]]
        },
        defaultT1: 2.0,
        defaultT2: 0.5
    },
    
    // === LEAD-207 COMPOUNDS (spin-1/2, 22.1% abundance) ===
    
    'tetramethyllead': {
        name: 'Tetramethyllead (²⁰⁷Pb)',
        description: '²⁰⁷Pb single qubit - organolead compound',
        formula: 'Pb(CH₃)₄',
        nuclei: [
            { id: 0, element: '207Pb', label: 'Pb', chemicalShift: 0.0,
              environment: 'Tetrahedral Pb(IV) - reference compound' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: 'Pb', x: 0, y: 0, qubit: 0 },
                { element: 'C', x: -35, y: -25 },
                { element: 'C', x: 35, y: -25 },
                { element: 'C', x: -35, y: 25 },
                { element: 'C', x: 35, y: 25 }
            ],
            bonds: [[0,1], [0,2], [0,3], [0,4]]
        },
        defaultT1: 1.0,
        defaultT2: 0.3
    },
    
    // === XENON-129 (spin-1/2, 26.4% abundance) ===
    
    'xenon_gas': {
        name: 'Hyperpolarized ¹²⁹Xe',
        description: '¹²⁹Xe single qubit - noble gas used in MRI and quantum sensing',
        formula: '¹²⁹Xe (gas)',
        nuclei: [
            { id: 0, element: '129Xe', label: 'Xe', chemicalShift: 0.0,
              environment: 'Gas phase xenon reference' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: 'Xe', x: 0, y: 0, qubit: 0 }
            ],
            bonds: []
        },
        defaultT1: 60.0,  // Very long T1 when hyperpolarized
        defaultT2: 20.0
    },
    
    // === THALLIUM-205 COMPOUNDS (spin-1/2, 70.5% abundance) ===
    
    'thallium_nitrate': {
        name: 'Thallium Nitrate (²⁰⁵Tl)',
        description: '²⁰⁵Tl single qubit - highest sensitivity heavy metal',
        formula: 'TlNO₃ (aq)',
        nuclei: [
            { id: 0, element: '205Tl', label: 'Tl', chemicalShift: 0.0,
              environment: 'Tl(I) aqueous reference' }
        ],
        jCouplings: [],
        structure: {
            atoms: [
                { element: 'Tl', x: 0, y: 0, qubit: 0 },
                { element: 'N', x: 40, y: 0 },
                { element: 'O', x: 60, y: -25 },
                { element: 'O', x: 60, y: 25 },
                { element: 'O', x: 80, y: 0 }
            ],
            bonds: [[1,2], [1,3], [1,4,'double']]
        },
        defaultT1: 0.1,
        defaultT2: 0.05
    },
    
    // ========== EDUCATIONAL/CUSTOM ==========
    
    'custom': {
        name: 'Custom Molecule',
        description: 'User-defined spin system with configurable parameters',
        formula: 'Custom',
        nuclei: [
            { id: 0, element: '1H', label: 'Q0', chemicalShift: 0.0,
              environment: 'User-defined qubit 0' }
        ],
        jCouplings: [],
        structure: {
            atoms: [{ element: 'H', x: 0, y: 0, qubit: 0 }],
            bonds: []
        },
        defaultT1: 2.0,
        defaultT2: 1.0,
        isCustom: true
    }
};

// ============================================================================
// PULSE SHAPES
// ============================================================================

const PulseShapes = {
    square: (t, duration) => 1.0,
    gaussian: (t, duration) => {
        const sigma = duration / 6;
        const center = duration / 2;
        return Math.exp(-Math.pow(t - center, 2) / (2 * sigma * sigma));
    },
    sinc: (t, duration) => {
        const x = 6 * Math.PI * (t / duration - 0.5);
        if (Math.abs(x) < 1e-10) return 1.0;
        return Math.sin(x) / x;
    },
    hermite: (t, duration) => {
        const x = 2 * (t / duration - 0.5);
        return (1 - 4 * x * x) * Math.exp(-2 * x * x);
    }
};

// ============================================================================
// NMR PHYSICS ENGINE
// ============================================================================

class NMRPhysicsEngine {
    constructor() {
        this.B0 = 1.0;       // Default 1 Tesla (common for desktop NMR)
        this.B1 = 50e-3;     // Default 50 mT RF field
        this.rfFrequency = 500e6;
        this.rfPhase = 0;
        
        this.sample = null;
        this.numQubits = 0;
        
        this.T1 = [];
        this.T2 = [];
        
        this.densityMatrix = null;
        this.blochVectors = [];
        this.pulseSequence = [];
        
        this.useRotatingFrame = true;
        this.useIdealPulses = true;
        this.includeRelaxation = false;
        
        this.currentTime = 0;
        this.fid = [];
        this.spectrum = [];
    }
    
    setSample(sampleKey) {
        const sample = NMRSamples[sampleKey];
        if (!sample) {
            console.warn(`Unknown sample: ${sampleKey}`);
            return;
        }
        
        this.sample = { ...sample, key: sampleKey };
        this.numQubits = sample.nuclei.length;
        
        this.T1 = sample.nuclei.map(() => sample.defaultT1 || 2.0);
        this.T2 = sample.nuclei.map(() => sample.defaultT2 || 1.0);
        
        this.initializeDensityMatrix();
        this.blochVectors = [];
        this.updateBlochVectors();
        this.pulseSequence = [];
        this.currentTime = 0;
    }
    
    /**
     * Get Larmor frequencies for all nuclei (for display)
     */
    getAllLarmorFrequencies() {
        if (!this.sample) return [];
        return this.sample.nuclei.map((_, i) => this.getLarmorFrequency(i));
    }
    
    initializeDensityMatrix() {
        const dim = Math.pow(2, this.numQubits);
        this.densityMatrix = [];
        
        for (let i = 0; i < dim; i++) {
            this.densityMatrix[i] = [];
            for (let j = 0; j < dim; j++) {
                this.densityMatrix[i][j] = { re: (i === 0 && j === 0) ? 1 : 0, im: 0 };
            }
        }
    }
    
    /**
     * Calculate Larmor frequency for a nucleus
     * ω₀ = γ · B₀ · (1 + δ × 10⁻⁶)
     * Chemical shift creates frequency offset from bare Larmor frequency
     */
    getLarmorFrequency(nucleusIndex) {
        if (!this.sample || nucleusIndex >= this.sample.nuclei.length) return 0;
        
        const nucleus = this.sample.nuclei[nucleusIndex];
        const gamma = NMRConstants.GAMMA[nucleus.element] || 42.577;
        const chemShift = nucleus.chemicalShift || 0;
        
        // For ¹⁹F, chemical shift is in ppm relative to CFCl₃ reference
        // For ¹H, relative to TMS
        // For ¹³C, relative to TMS
        return gamma * this.B0 * (1 + chemShift * 1e-6) * 1e6;
    }
    
    getNucleiInfo() {
        if (!this.sample) return [];
        
        return this.sample.nuclei.map((nucleus, i) => ({
            id: nucleus.id,
            element: nucleus.element,
            label: nucleus.label,
            gamma: NMRConstants.GAMMA[nucleus.element] || 42.577,
            chemicalShift: nucleus.chemicalShift,
            environment: nucleus.environment || '',
            larmorFreq: this.getLarmorFrequency(i),
            T1: this.T1[i],
            T2: this.T2[i]
        }));
    }
    
    getJCoupling(i, j) {
        if (!this.sample) return 0;
        
        const coupling = this.sample.jCouplings.find(c => 
            (c.nuclei[0] === i && c.nuclei[1] === j) ||
            (c.nuclei[0] === j && c.nuclei[1] === i)
        );
        
        return coupling ? coupling.J : 0;
    }
    
    updateBlochVectors() {
        this.blochVectors = [];
        const dim = Math.pow(2, this.numQubits);
        
        for (let q = 0; q < this.numQubits; q++) {
            let rho00 = 0, rho01_re = 0, rho01_im = 0, rho11 = 0;
            
            for (let i = 0; i < dim; i++) {
                for (let j = 0; j < dim; j++) {
                    const bit_i = (i >> q) & 1;
                    const bit_j = (j >> q) & 1;
                    const mask = ~(1 << q) & (dim - 1);
                    
                    if ((i & mask) === (j & mask)) {
                        const entry = this.densityMatrix[i][j];
                        
                        if (bit_i === 0 && bit_j === 0) {
                            rho00 += entry.re;
                        } else if (bit_i === 0 && bit_j === 1) {
                            rho01_re += entry.re;
                            rho01_im += entry.im;
                        } else if (bit_i === 1 && bit_j === 1) {
                            rho11 += entry.re;
                        }
                    }
                }
            }
            
            const trace = rho00 + rho11;
            if (trace > 1e-10) {
                rho00 /= trace;
                rho11 /= trace;
                rho01_re /= trace;
                rho01_im /= trace;
            }
            
            const x = 2 * rho01_re;
            const y = 2 * rho01_im;
            const z = rho00 - rho11;
            
            this.blochVectors.push({ x, y, z, rho00, rho11 });
        }
    }
    
    mapGatesToPulses(gates) {
        this.pulseSequence = [];
        this.currentTime = 0;
        
        const gatesByColumn = {};
        gates.forEach(gate => {
            if (!gatesByColumn[gate.column]) {
                gatesByColumn[gate.column] = [];
            }
            gatesByColumn[gate.column].push(gate);
        });
        
        const columns = Object.keys(gatesByColumn).map(Number).sort((a, b) => a - b);
        
        for (const col of columns) {
            const gatesAtColumn = gatesByColumn[col];
            const pulsesForColumn = [];
            
            for (const gate of gatesAtColumn) {
                const pulses = this.gateToNMRPulse(gate);
                // Preserve column info from the original gate
                pulses.forEach(p => p.column = col);
                pulsesForColumn.push(...pulses);
            }
            
            pulsesForColumn.forEach(pulse => {
                pulse.startTime = this.currentTime;
                this.pulseSequence.push(pulse);
            });
            
            const maxDuration = pulsesForColumn.reduce((max, p) => Math.max(max, p.duration), 0);
            this.currentTime += maxDuration + 0.001;
        }
        
        return this.pulseSequence;
    }
    
    gateToNMRPulse(gate) {
        const { type, qubit, target, params, multiQubits } = gate;
        const nucleus = this.sample?.nuclei[qubit];
        const omega = this.getLarmorFrequency(qubit);
        const gamma = NMRConstants.GAMMA[nucleus?.element || '1H'] * 1e6;
        const piTime = this.useIdealPulses ? 0.01 : Math.PI / (gamma * this.B1);
        
        const pulses = [];
        
        switch (type) {
            case 'X':
                pulses.push({
                    type: 'rf', gate: 'X', qubit, frequency: omega,
                    phase: 0, flipAngle: Math.PI, duration: piTime,
                    shape: 'square', description: 'π pulse (X gate)'
                });
                break;
                
            case 'Y':
                pulses.push({
                    type: 'rf', gate: 'Y', qubit, frequency: omega,
                    phase: Math.PI / 2, flipAngle: Math.PI, duration: piTime,
                    shape: 'square', description: 'π pulse (Y gate)'
                });
                break;
                
            case 'Z':
                pulses.push({
                    type: 'phase', gate: 'Z', qubit, phaseShift: Math.PI,
                    duration: 0.001, description: 'Virtual Z gate'
                });
                break;
                
            case 'H':
                // Hadamard = RY(π/2) then RX(π) (up to global phase)
                // Verified: RX(π) * RY(π/2) = -i * H
                // H*H = I is preserved since (-i*H)*(-i*H) = -H² = -I ≈ I (global phase)
                pulses.push({
                    type: 'rf', gate: 'H-Ry', qubit, frequency: omega,
                    phase: Math.PI / 2, flipAngle: Math.PI / 2, duration: piTime / 2,
                    shape: 'square', description: 'Ry(90°) for Hadamard'
                });
                pulses.push({
                    type: 'rf', gate: 'H-Rx', qubit, frequency: omega,
                    phase: 0, flipAngle: Math.PI, duration: piTime,
                    shape: 'square', description: 'Rx(180°) for Hadamard'
                });
                break;
                
            case 'RX':
                const angleRX = params?.angle || Math.PI / 2;
                pulses.push({
                    type: 'rf', gate: `Rx(${(angleRX * 180 / Math.PI).toFixed(0)}°)`,
                    qubit, frequency: omega, phase: 0, flipAngle: angleRX,
                    duration: piTime * Math.abs(angleRX) / Math.PI,
                    shape: 'gaussian', description: `Rx by ${(angleRX * 180 / Math.PI).toFixed(1)}°`
                });
                break;
                
            case 'RY':
                const angleRY = params?.angle || Math.PI / 2;
                pulses.push({
                    type: 'rf', gate: `Ry(${(angleRY * 180 / Math.PI).toFixed(0)}°)`,
                    qubit, frequency: omega, phase: Math.PI / 2, flipAngle: angleRY,
                    duration: piTime * Math.abs(angleRY) / Math.PI,
                    shape: 'gaussian', description: `Ry by ${(angleRY * 180 / Math.PI).toFixed(1)}°`
                });
                break;
                
            case 'RZ':
                const angleRZ = params?.angle || Math.PI / 2;
                pulses.push({
                    type: 'phase', gate: `Rz(${(angleRZ * 180 / Math.PI).toFixed(0)}°)`,
                    qubit, phaseShift: angleRZ, duration: 0.001,
                    description: `Rz by ${(angleRZ * 180 / Math.PI).toFixed(1)}°`
                });
                break;
                
            case 'S':
                pulses.push({
                    type: 'phase', gate: 'S', qubit, phaseShift: Math.PI / 2,
                    duration: 0.001, description: 'S gate (π/2 phase)'
                });
                break;
                
            case 'T':
                pulses.push({
                    type: 'phase', gate: 'T', qubit, phaseShift: Math.PI / 4,
                    duration: 0.001, description: 'T gate (π/4 phase)'
                });
                break;
                
            case 'CX':
            case 'CZ':
                const controlQubits = multiQubits || (target !== null ? [target] : []);
                if (controlQubits.length > 0) {
                    const control = controlQubits[0];
                    const J = this.getJCoupling(qubit, control);
                    
                    if (Math.abs(J) > 0.1) {
                        const tau = 1 / (2 * Math.abs(J));
                        
                        if (type === 'CX') {
                            pulses.push({
                                type: 'rf', gate: 'CNOT-prep', qubit,
                                frequency: this.getLarmorFrequency(qubit),
                                phase: Math.PI / 2, flipAngle: Math.PI / 2,
                                duration: piTime / 2, shape: 'square',
                                description: 'CNOT preparation'
                            });
                            pulses.push({
                                type: 'delay', gate: 'J-evol', duration: tau,
                                description: `J-coupling (τ=${(tau*1000).toFixed(1)}ms)`
                            });
                            pulses.push({
                                type: 'rf', gate: 'Refocus', qubit: control,
                                frequency: this.getLarmorFrequency(control),
                                phase: 0, flipAngle: Math.PI,
                                duration: piTime, shape: 'square',
                                description: 'Refocusing pulse'
                            });
                            pulses.push({
                                type: 'delay', gate: 'J-evol', duration: tau,
                                description: `J-coupling (τ=${(tau*1000).toFixed(1)}ms)`
                            });
                            pulses.push({
                                type: 'rf', gate: 'CNOT-end', qubit,
                                frequency: this.getLarmorFrequency(qubit),
                                phase: -Math.PI / 2, flipAngle: Math.PI / 2,
                                duration: piTime / 2, shape: 'square',
                                description: 'CNOT completion'
                            });
                        } else {
                            pulses.push({
                                type: 'delay', gate: 'CZ-J', duration: 2 * tau,
                                description: `CZ via J (τ=${(2*tau*1000).toFixed(1)}ms)`
                            });
                        }
                    } else {
                        pulses.push({
                            type: 'error', gate: type, qubit, control,
                            duration: 0.01, description: `No J-coupling Q${qubit}-Q${control}`
                        });
                    }
                }
                break;
                
            case 'MEASURE':
                pulses.push({
                    type: 'acquire', gate: 'Acq', qubit, duration: 0.1,
                    description: 'FID acquisition'
                });
                break;
                
            case 'SWAP':
                // SWAP = three CNOTs: CNOT(a,b) * CNOT(b,a) * CNOT(a,b)
                // In NMR, each CNOT uses J-coupling evolution
                if (target !== null && target !== undefined) {
                    const J = this.getJCoupling(qubit, target);
                    if (Math.abs(J) > 0.1) {
                        const tau = 1 / (2 * Math.abs(J));
                        
                        // First CNOT (qubit controls target)
                        pulses.push({
                            type: 'rf', gate: 'SW1-prep', qubit: target,
                            frequency: this.getLarmorFrequency(target),
                            phase: Math.PI / 2, flipAngle: Math.PI / 2,
                            duration: piTime / 2, shape: 'square',
                            description: 'SWAP step 1 prep'
                        });
                        pulses.push({
                            type: 'delay', gate: 'SW1-J', duration: tau,
                            description: 'J-coupling evolution'
                        });
                        pulses.push({
                            type: 'rf', gate: 'SW1-ref', qubit,
                            frequency: omega, phase: 0, flipAngle: Math.PI,
                            duration: piTime, shape: 'square',
                            description: 'SWAP step 1 refocus'
                        });
                        pulses.push({
                            type: 'delay', gate: 'SW1-J', duration: tau,
                            description: 'J-coupling evolution'
                        });
                        pulses.push({
                            type: 'rf', gate: 'SW1-end', qubit: target,
                            frequency: this.getLarmorFrequency(target),
                            phase: -Math.PI / 2, flipAngle: Math.PI / 2,
                            duration: piTime / 2, shape: 'square',
                            description: 'SWAP step 1 complete'
                        });
                        
                        // Second CNOT (target controls qubit)
                        pulses.push({
                            type: 'rf', gate: 'SW2-prep', qubit,
                            frequency: omega, phase: Math.PI / 2, flipAngle: Math.PI / 2,
                            duration: piTime / 2, shape: 'square',
                            description: 'SWAP step 2 prep'
                        });
                        pulses.push({
                            type: 'delay', gate: 'SW2-J', duration: tau,
                            description: 'J-coupling evolution'
                        });
                        pulses.push({
                            type: 'rf', gate: 'SW2-ref', qubit: target,
                            frequency: this.getLarmorFrequency(target),
                            phase: 0, flipAngle: Math.PI,
                            duration: piTime, shape: 'square',
                            description: 'SWAP step 2 refocus'
                        });
                        pulses.push({
                            type: 'delay', gate: 'SW2-J', duration: tau,
                            description: 'J-coupling evolution'
                        });
                        pulses.push({
                            type: 'rf', gate: 'SW2-end', qubit,
                            frequency: omega, phase: -Math.PI / 2, flipAngle: Math.PI / 2,
                            duration: piTime / 2, shape: 'square',
                            description: 'SWAP step 2 complete'
                        });
                        
                        // Third CNOT (qubit controls target)
                        pulses.push({
                            type: 'rf', gate: 'SW3-prep', qubit: target,
                            frequency: this.getLarmorFrequency(target),
                            phase: Math.PI / 2, flipAngle: Math.PI / 2,
                            duration: piTime / 2, shape: 'square',
                            description: 'SWAP step 3 prep'
                        });
                        pulses.push({
                            type: 'delay', gate: 'SW3-J', duration: tau,
                            description: 'J-coupling evolution'
                        });
                        pulses.push({
                            type: 'rf', gate: 'SW3-ref', qubit,
                            frequency: omega, phase: 0, flipAngle: Math.PI,
                            duration: piTime, shape: 'square',
                            description: 'SWAP step 3 refocus'
                        });
                        pulses.push({
                            type: 'delay', gate: 'SW3-J', duration: tau,
                            description: 'J-coupling evolution'
                        });
                        pulses.push({
                            type: 'rf', gate: 'SW3-end', qubit: target,
                            frequency: this.getLarmorFrequency(target),
                            phase: -Math.PI / 2, flipAngle: Math.PI / 2,
                            duration: piTime / 2, shape: 'square',
                            description: 'SWAP step 3 complete'
                        });
                    } else {
                        pulses.push({
                            type: 'error', gate: 'SWAP', qubit, target,
                            duration: 0.01, description: `No J-coupling for SWAP Q${qubit}-Q${target}`
                        });
                    }
                }
                break;
                
            default:
                // Unimplemented gate - show as placeholder
                pulses.push({
                    type: 'unknown', gate: type, qubit,
                    duration: 0.01, description: `${type} (not yet mapped to NMR pulses)`
                });
                break;
        }
        
        return pulses;
    }
    
    updateFromQuantumState(quantumState) {
        if (!quantumState || !quantumState.amplitudes) return;
        
        if (this.numQubits !== quantumState.numQubits) {
            this.createCustomSample(quantumState.numQubits);
        }
        
        const dim = Math.pow(2, this.numQubits);
        
        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                const amp_i = quantumState.amplitudes[i];
                const amp_j = quantumState.amplitudes[j];
                
                this.densityMatrix[i][j] = {
                    re: amp_i.re * amp_j.re + amp_i.im * amp_j.im,
                    im: amp_i.im * amp_j.re - amp_i.re * amp_j.im
                };
            }
        }
        
        this.updateBlochVectors();
        
        if (this.includeRelaxation) {
            this.applyRelaxation(0.001);
        }
    }
    
    createCustomSample(numQubits) {
        const nuclei = [];
        for (let i = 0; i < numQubits; i++) {
            nuclei.push({
                id: i,
                element: '1H',
                label: `Q${i}`,
                chemicalShift: i * 2.0,
                environment: `Custom qubit ${i}`
            });
        }
        
        const jCouplings = [];
        for (let i = 0; i < numQubits - 1; i++) {
            jCouplings.push({
                nuclei: [i, i + 1],
                J: 10.0,
                type: 'Custom'
            });
        }
        
        const atoms = nuclei.map((n, i) => ({
            element: 'H',
            x: (i - (numQubits - 1) / 2) * 50,
            y: 0,
            qubit: i
        }));
        
        const bonds = [];
        for (let i = 0; i < numQubits - 1; i++) {
            bonds.push([i, i + 1]);
        }
        
        this.sample = {
            name: 'Custom',
            key: 'custom',
            formula: 'Custom',
            description: `Custom ${numQubits}-qubit system`,
            nuclei,
            jCouplings,
            structure: { atoms, bonds },
            defaultT1: 2.0,
            defaultT2: 1.0
        };
        
        this.numQubits = numQubits;
        this.T1 = nuclei.map(() => 2.0);
        this.T2 = nuclei.map(() => 1.0);
        this.initializeDensityMatrix();
        this.updateBlochVectors();
    }
    
    applyRelaxation(duration) {
        const dim = Math.pow(2, this.numQubits);
        
        for (let i = 0; i < dim; i++) {
            for (let j = 0; j < dim; j++) {
                if (i === j) {
                    const equilibrium = (i === 0) ? 1 : 0;
                    const avgT1 = this.T1.reduce((a, b) => a + b, 0) / this.T1.length;
                    const decay = Math.exp(-duration / avgT1);
                    this.densityMatrix[i][j].re = decay * this.densityMatrix[i][j].re + 
                                                   (1 - decay) * equilibrium;
                } else {
                    const avgT2 = this.T2.reduce((a, b) => a + b, 0) / this.T2.length;
                    const decay = Math.exp(-duration / avgT2);
                    this.densityMatrix[i][j].re *= decay;
                    this.densityMatrix[i][j].im *= decay;
                }
            }
        }
        
        this.updateBlochVectors();
    }
    
    /**
     * Get expected NMR peaks based on current quantum state
     * Each nucleus contributes peaks at its Larmor frequency
     * 
     * PHYSICS OF NMR SIGNAL:
     * - The NMR signal (FID) comes from transverse magnetization (Mxy) precessing
     * - In an actual measurement, a 90° pulse converts Mz to Mxy before detection
     * - The SIGN of the peak reflects the population difference:
     *   - Positive peak: excess population in |0⟩ (spin up, Mz > 0)
     *   - Negative peak: excess population in |1⟩ (spin down, Mz < 0, after X gate)
     * - This is physically accurate for NMR quantum computing readout
     */
    getExpectedPeaks() {
        if (!this.sample || !this.sample.nuclei) return [];
        
        // Ensure Bloch vectors are initialized
        if (!this.blochVectors || this.blochVectors.length !== this.numQubits) {
            this.updateBlochVectors();
        }
        
        const peaks = [];
        
        for (let i = 0; i < this.numQubits; i++) {
            const nucleus = this.sample.nuclei[i];
            if (!nucleus) continue;
            
            const baseFreq = this.getLarmorFrequency(i);
            const bloch = this.blochVectors[i] || { x: 0, y: 0, z: 1 };
            
            // Calculate signal intensity with proper sign for NMR quantum computing
            // 
            // In NMR QC, measurement involves:
            // 1. Apply 90° pulse to convert Mz → Mxy (or My, depending on phase)
            // 2. Detect the precessing Mxy as FID
            // 3. FFT to get spectrum
            //
            // The sign of the detected signal depends on:
            // - If Mz > 0 (|0⟩ state): 90°x pulse gives +My → positive peak
            // - If Mz < 0 (|1⟩ state): 90°x pulse gives -My → negative peak
            //
            // For visualization, we show what the spectrum would look like after readout:
            
            const Mxy = Math.sqrt(bloch.x * bloch.x + bloch.y * bloch.y);
            
            // Determine intensity with sign preserved
            // The sign comes from Mz (population difference between |0⟩ and |1⟩)
            let intensity;
            if (Mxy > 0.1) {
                // Significant transverse magnetization exists (superposition state)
                // Use Mxy magnitude, but preserve sign from dominant z-component if present
                intensity = Mxy;
                // For superpositions, check if there's also a z-component that indicates bias
                if (Math.abs(bloch.z) > 0.1) {
                    intensity = Math.sign(bloch.z) * Math.max(Mxy, Math.abs(bloch.z) * 0.5);
                }
            } else {
                // Mostly longitudinal magnetization (pure |0⟩ or |1⟩ state)
                // After 90° readout pulse, Mz converts to Mxy with sign preserved
                // Mz > 0 (|0⟩) → positive signal
                // Mz < 0 (|1⟩) → negative signal (inverted peak)
                intensity = bloch.z;
            }
            
            // Add J-coupling splitting
            const couplings = (this.sample.jCouplings || []).filter(c => c.nuclei.includes(i));
            
            if (couplings.length === 0) {
                peaks.push({
                    nucleus: nucleus.label,
                    element: nucleus.element,
                    freq: baseFreq,
                    intensity: intensity,  // Sign preserved for accurate NMR QC display
                    type: 'singlet',
                    environment: nucleus.environment || ''
                });
            } else {
                // Generate multiplet from J-couplings
                let offsets = [0];
                
                for (const coupling of couplings) {
                    const newOffsets = [];
                    for (const offset of offsets) {
                        newOffsets.push(offset - coupling.J / 2);
                        newOffsets.push(offset + coupling.J / 2);
                    }
                    offsets = newOffsets;
                }
                
                // Count multiplicities
                const freqCounts = {};
                offsets.forEach(f => {
                    const key = f.toFixed(1);
                    freqCounts[key] = (freqCounts[key] || 0) + 1;
                });
                
                const multipletType = offsets.length === 2 ? 'doublet' :
                                      offsets.length === 3 ? 'triplet' :
                                      offsets.length === 4 ? 'quartet' : 'multiplet';
                
                Object.entries(freqCounts).forEach(([offset, count]) => {
                    // Preserve sign of intensity for multiplet peaks
                    const peakIntensity = intensity * count / offsets.length;
                    peaks.push({
                        nucleus: nucleus.label,
                        element: nucleus.element,
                        freq: baseFreq + parseFloat(offset),
                        intensity: peakIntensity,  // Sign preserved for NMR QC
                        type: multipletType,
                        environment: nucleus.environment || ''
                    });
                });
            }
        }
        
        return peaks;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof window !== 'undefined') {
    window.NMRPhysicsEngine = NMRPhysicsEngine;
    window.NMRSamples = NMRSamples;
    window.NMRConstants = NMRConstants;
    window.PulseShapes = PulseShapes;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NMRPhysicsEngine, NMRSamples, NMRConstants, PulseShapes };
}

/**
 * NMR Sample Database
 * Contains chemical shift data, J-couplings, molecular structures, and properties
 * Imported from quantum circuit simulator with additions for traditional NMR spectroscopy
 */

// Common NMR solvents with their properties
const NMRSolvents = {
    CDCl3: {
        name: 'Chloroform-d (CDCl₃)',
        formula: 'CDCl₃',
        h1_residual: 7.26,  // ppm for residual CHCl3
        c13_signal: 77.16,  // ppm (triplet)
        deuterium_lock: true,
        boilingPoint: 61,
        density: 1.48
    },
    D2O: {
        name: 'Deuterium Oxide (D₂O)',
        formula: 'D₂O',
        h1_residual: 4.79,  // ppm for residual HOD
        c13_signal: null,
        deuterium_lock: true,
        boilingPoint: 101,
        density: 1.11
    },
    DMSO_d6: {
        name: 'DMSO-d₆',
        formula: '(CD₃)₂SO',
        h1_residual: 2.50,  // ppm (quintet)
        c13_signal: 39.52,  // ppm (septet)
        deuterium_lock: true,
        boilingPoint: 189,
        density: 1.19
    },
    CD3OD: {
        name: 'Methanol-d₄',
        formula: 'CD₃OD',
        h1_residual: 3.31,  // ppm for CHD2
        c13_signal: 49.00,  // ppm (septet)
        deuterium_lock: true,
        boilingPoint: 65,
        density: 0.89
    },
    C6D6: {
        name: 'Benzene-d₆',
        formula: 'C₆D₆',
        h1_residual: 7.16,
        c13_signal: 128.06,
        deuterium_lock: true,
        boilingPoint: 80,
        density: 0.95
    },
    Acetone_d6: {
        name: 'Acetone-d₆',
        formula: '(CD₃)₂CO',
        h1_residual: 2.05,
        c13_signal: 29.84,
        deuterium_lock: true,
        boilingPoint: 56,
        density: 0.87
    },
    THF_d8: {
        name: 'THF-d₈',
        formula: 'C₄D₈O',
        h1_residual: 1.72,
        c13_signal: 25.31,
        deuterium_lock: true,
        boilingPoint: 66,
        density: 0.99
    },
    Toluene_d8: {
        name: 'Toluene-d₈',
        formula: 'C₆D₅CD₃',
        h1_residual: 2.08,
        c13_signal: 20.43,
        deuterium_lock: true,
        boilingPoint: 111,
        density: 0.94
    }
};

// TMS reference standard (0 ppm for 1H and 13C)
const TMSReference = {
    name: 'TMS (Tetramethylsilane)',
    formula: 'Si(CH₃)₄',
    h1_shift: 0.00,
    c13_shift: 0.00,
    description: 'Primary reference standard for ¹H and ¹³C NMR (0.00 ppm)'
};

// Extended sample database for NMR spectroscopy
const SampleDatabase = {
    // ========== REFERENCE COMPOUNDS ==========
    tms: {
        name: 'TMS (Reference)',
        formula: 'Si(CH₃)₄',
        molecularWeight: 88.22,
        description: 'Tetramethylsilane - primary reference (0 ppm)',
        solvent: 'CDCl3',
        t1: 10.0,
        t2: 5.0,
        peaks: [
            { shift: 0.00, intensity: 12.0, assignment: 'Si(CH₃)₄', numProtons: 12, t2: 5.0 }
        ],
        structure: {
            atoms: [
                { element: 'Si', x: 0, y: 0 },
                { element: 'C', x: -40, y: -40 },
                { element: 'C', x: 40, y: -40 },
                { element: 'C', x: -40, y: 40 },
                { element: 'C', x: 40, y: 40 },
                { element: 'H', x: -60, y: -60 },
                { element: 'H', x: -20, y: -60 },
                { element: 'H', x: -60, y: -20 }
            ],
            bonds: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [1, 6], [1, 7]]
        }
    },

    // ========== SIMPLE MOLECULES ==========
    water: {
        name: 'Water',
        formula: 'H₂O',
        molecularWeight: 18.015,
        description: 'Pure water - chemical shift varies with temperature',
        solvent: 'CDCl3',
        t1: 3.0,
        t2: 2.0,
        peaks: [
            { shift: 4.79, intensity: 2.0, assignment: 'H₂O', numProtons: 2, t2: 2.0 }
        ],
        structure: {
            atoms: [
                { element: 'O', x: 0, y: 0 },
                { element: 'H', x: -30, y: 25 },
                { element: 'H', x: 30, y: 25 }
            ],
            bonds: [[0, 1], [0, 2]]
        }
    },

    ethanol: {
        name: 'Ethanol',
        formula: 'C₂H₅OH',
        molecularWeight: 46.07,
        description: 'Common organic solvent - classic NMR teaching example',
        solvent: 'CDCl3',
        t1: 2.5,
        t2: 1.5,
        peaks: [
            { shift: 1.18, intensity: 3.0, assignment: 'CH₃', numProtons: 3, t2: 1.5, j_couplings: [7.0] },
            { shift: 3.65, intensity: 2.0, assignment: 'CH₂', numProtons: 2, t2: 1.2, j_couplings: [7.0, 7.0, 7.0] },
            { shift: 2.60, intensity: 1.0, assignment: 'OH', numProtons: 1, t2: 0.5 }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -30, y: 0, qubit: 0 },
                { element: 'C', x: 30, y: 0, qubit: 1 },
                { element: 'O', x: 60, y: -30 },
                { element: 'H', x: -50, y: -25 },
                { element: 'H', x: -50, y: 25 },
                { element: 'H', x: -30, y: -35 },
                { element: 'H', x: 30, y: 35 },
                { element: 'H', x: 30, y: -35 },
                { element: 'H', x: 90, y: -30, qubit: 2 }
            ],
            bonds: [[0, 1], [1, 2], [0, 3], [0, 4], [0, 5], [1, 6], [1, 7], [2, 8]]
        }
    },

    acetic_acid: {
        name: 'Acetic Acid',
        formula: 'CH₃COOH',
        molecularWeight: 60.05,
        description: 'Simple carboxylic acid',
        solvent: 'D2O',
        t1: 2.0,
        t2: 1.2,
        peaks: [
            { shift: 2.10, intensity: 3.0, assignment: 'CH₃', numProtons: 3, t2: 1.5 },
            { shift: 11.4, intensity: 1.0, assignment: 'COOH', numProtons: 1, t2: 0.3 }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -30, y: 0, qubit: 0 },
                { element: 'C', x: 30, y: 0 },
                { element: 'O', x: 60, y: -25 },
                { element: 'O', x: 30, y: 40 },
                { element: 'H', x: -50, y: -25 },
                { element: 'H', x: -50, y: 25 },
                { element: 'H', x: -30, y: -35 },
                { element: 'H', x: 30, y: 70, qubit: 1 }
            ],
            bonds: [[0, 1], [1, 2, 'double'], [1, 3], [0, 4], [0, 5], [0, 6], [3, 7]]
        }
    },

    benzene: {
        name: 'Benzene',
        formula: 'C₆H₆',
        molecularWeight: 78.11,
        description: 'Aromatic hydrocarbon - equivalent protons',
        solvent: 'CDCl3',
        t1: 3.5,
        t2: 2.0,
        peaks: [
            { shift: 7.36, intensity: 6.0, assignment: 'Aromatic H', numProtons: 6, t2: 2.0 }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: -40 },
                { element: 'C', x: 35, y: -20 },
                { element: 'C', x: 35, y: 20 },
                { element: 'C', x: 0, y: 40 },
                { element: 'C', x: -35, y: 20 },
                { element: 'C', x: -35, y: -20 },
                { element: 'H', x: 0, y: -70 },
                { element: 'H', x: 60, y: -35 },
                { element: 'H', x: 60, y: 35 },
                { element: 'H', x: 0, y: 70 },
                { element: 'H', x: -60, y: 35 },
                { element: 'H', x: -60, y: -35 }
            ],
            bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]]
        }
    },

    chloroform: {
        name: 'Chloroform',
        formula: 'CHCl₃',
        molecularWeight: 119.38,
        description: 'Common NMR solvent signal',
        solvent: null,
        t1: 4.0,
        t2: 2.5,
        peaks: [
            { shift: 7.26, intensity: 1.0, assignment: 'CHCl₃', numProtons: 1, t2: 2.5 }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: 0, qubit: 0 },
                { element: 'H', x: 0, y: -40 },
                { element: 'Cl', x: -35, y: 25 },
                { element: 'Cl', x: 35, y: 25 },
                { element: 'Cl', x: 0, y: 50 }
            ],
            bonds: [[0, 1], [0, 2], [0, 3], [0, 4]]
        }
    },

    acetone: {
        name: 'Acetone',
        formula: 'CH₃COCH₃',
        molecularWeight: 58.08,
        description: 'Common ketone solvent',
        solvent: 'CDCl3',
        t1: 2.8,
        t2: 1.8,
        peaks: [
            { shift: 2.17, intensity: 6.0, assignment: 'CH₃', numProtons: 6, t2: 1.8 }
        ],
        structure: {
            atoms: [
                { element: 'C', x: -40, y: 0, qubit: 0 },
                { element: 'C', x: 0, y: 0 },
                { element: 'C', x: 40, y: 0, qubit: 1 },
                { element: 'O', x: 0, y: -40 },
                { element: 'H', x: -60, y: -20 },
                { element: 'H', x: -60, y: 20 },
                { element: 'H', x: -40, y: 35 },
                { element: 'H', x: 60, y: -20 },
                { element: 'H', x: 60, y: 20 },
                { element: 'H', x: 40, y: 35 }
            ],
            bonds: [[0, 1], [1, 2], [1, 3, 'double'], [0, 4], [0, 5], [0, 6], [2, 7], [2, 8], [2, 9]]
        }
    },

    dmso: {
        name: 'DMSO',
        formula: '(CH₃)₂SO',
        molecularWeight: 78.13,
        description: 'Dimethyl sulfoxide - polar aprotic solvent',
        solvent: null,
        t1: 2.5,
        t2: 1.5,
        peaks: [
            { shift: 2.62, intensity: 6.0, assignment: 'CH₃', numProtons: 6, t2: 1.5 }
        ],
        structure: {
            atoms: [
                { element: 'S', x: 0, y: 0 },
                { element: 'O', x: 0, y: -40 },
                { element: 'C', x: -40, y: 20, qubit: 0 },
                { element: 'C', x: 40, y: 20, qubit: 1 },
                { element: 'H', x: -60, y: 0 },
                { element: 'H', x: -60, y: 35 },
                { element: 'H', x: -35, y: 50 },
                { element: 'H', x: 60, y: 0 },
                { element: 'H', x: 60, y: 35 },
                { element: 'H', x: 35, y: 50 }
            ],
            bonds: [[0, 1, 'double'], [0, 2], [0, 3], [2, 4], [2, 5], [2, 6], [3, 7], [3, 8], [3, 9]]
        }
    },

    toluene: {
        name: 'Toluene',
        formula: 'C₆H₅CH₃',
        molecularWeight: 92.14,
        description: 'Methylbenzene - aromatic compound',
        solvent: 'CDCl3',
        t1: 3.0,
        t2: 1.8,
        peaks: [
            { shift: 2.36, intensity: 3.0, assignment: 'CH₃', numProtons: 3, t2: 2.0 },
            { shift: 7.17, intensity: 2.0, assignment: 'ortho-H', numProtons: 2, t2: 1.8, j_couplings: [7.5, 1.5] },
            { shift: 7.25, intensity: 2.0, assignment: 'meta-H', numProtons: 2, t2: 1.8, j_couplings: [7.5, 7.5, 1.5] },
            { shift: 7.20, intensity: 1.0, assignment: 'para-H', numProtons: 1, t2: 1.8, j_couplings: [7.5, 7.5] }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: -55, qubit: 0 },
                { element: 'C', x: 0, y: -20 },
                { element: 'C', x: 35, y: 0 },
                { element: 'C', x: 35, y: 40 },
                { element: 'C', x: 0, y: 60 },
                { element: 'C', x: -35, y: 40 },
                { element: 'C', x: -35, y: 0 },
                { element: 'H', x: -25, y: -70 },
                { element: 'H', x: 25, y: -70 },
                { element: 'H', x: 0, y: -85 },
                { element: 'H', x: 60, y: -15 },
                { element: 'H', x: 60, y: 55 },
                { element: 'H', x: 0, y: 90 },
                { element: 'H', x: -60, y: 55 },
                { element: 'H', x: -60, y: -15 }
            ],
            bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [0, 7], [0, 8], [0, 9], [2, 10], [3, 11], [4, 12], [5, 13], [6, 14]]
        }
    },

    methanol: {
        name: 'Methanol',
        formula: 'CH₃OH',
        molecularWeight: 32.04,
        description: 'Simple alcohol',
        solvent: 'CDCl3',
        t1: 3.0,
        t2: 1.5,
        peaks: [
            { shift: 3.49, intensity: 3.0, assignment: 'CH₃', numProtons: 3, t2: 1.5 },
            { shift: 1.09, intensity: 1.0, assignment: 'OH', numProtons: 1, t2: 0.5 }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: 0, qubit: 0 },
                { element: 'O', x: 40, y: 0 },
                { element: 'H', x: -25, y: -25 },
                { element: 'H', x: -25, y: 25 },
                { element: 'H', x: 0, y: 35 },
                { element: 'H', x: 65, y: 15, qubit: 1 }
            ],
            bonds: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5]]
        }
    },

    dichloromethane: {
        name: 'Dichloromethane',
        formula: 'CH₂Cl₂',
        molecularWeight: 84.93,
        description: 'Common solvent - also known as methylene chloride',
        solvent: 'CDCl3',
        t1: 3.5,
        t2: 2.0,
        peaks: [
            { shift: 5.30, intensity: 2.0, assignment: 'CH₂', numProtons: 2, t2: 2.0 }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: 0 },
                { element: 'H', x: -30, y: -25 },
                { element: 'H', x: 30, y: -25 },
                { element: 'Cl', x: -35, y: 30 },
                { element: 'Cl', x: 35, y: 30 }
            ],
            bonds: [[0, 1], [0, 2], [0, 3], [0, 4]]
        }
    },

    // ========== MORE COMPLEX MOLECULES ==========
    aspirin: {
        name: 'Aspirin',
        formula: 'C₉H₈O₄',
        molecularWeight: 180.16,
        description: 'Acetylsalicylic acid - common pharmaceutical',
        solvent: 'CDCl3',
        t1: 2.0,
        t2: 0.8,
        peaks: [
            { shift: 2.35, intensity: 3.0, assignment: 'COCH₃', numProtons: 3, t2: 1.0 },
            { shift: 7.15, intensity: 1.0, assignment: 'H-3', numProtons: 1, t2: 0.8, j_couplings: [8.0, 1.0] },
            { shift: 7.35, intensity: 1.0, assignment: 'H-4', numProtons: 1, t2: 0.8, j_couplings: [8.0, 8.0, 1.0] },
            { shift: 7.60, intensity: 1.0, assignment: 'H-5', numProtons: 1, t2: 0.8, j_couplings: [8.0, 8.0, 1.5] },
            { shift: 8.10, intensity: 1.0, assignment: 'H-6', numProtons: 1, t2: 0.8, j_couplings: [8.0, 1.5] }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: -50 },
                { element: 'C', x: 40, y: -25 },
                { element: 'C', x: 40, y: 25 },
                { element: 'C', x: 0, y: 50 },
                { element: 'C', x: -40, y: 25 },
                { element: 'C', x: -40, y: -25 },
                { element: 'C', x: -80, y: -50 },
                { element: 'O', x: -80, y: -90 },
                { element: 'O', x: -120, y: -25 },
                { element: 'O', x: 80, y: 50 },
                { element: 'C', x: 120, y: 25 },
                { element: 'O', x: 120, y: -15 },
                { element: 'C', x: 160, y: 50 }
            ],
            bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [5, 6], [6, 7, 'double'], [6, 8], [2, 9], [9, 10], [10, 11, 'double'], [10, 12]]
        }
    },

    caffeine: {
        name: 'Caffeine',
        formula: 'C₈H₁₀N₄O₂',
        molecularWeight: 194.19,
        description: 'Purine alkaloid found in coffee and tea',
        solvent: 'CDCl3',
        t1: 1.5,
        t2: 0.5,
        peaks: [
            { shift: 3.40, intensity: 3.0, assignment: 'N1-CH₃', numProtons: 3, t2: 0.8 },
            { shift: 3.58, intensity: 3.0, assignment: 'N3-CH₃', numProtons: 3, t2: 0.8 },
            { shift: 4.00, intensity: 3.0, assignment: 'N7-CH₃', numProtons: 3, t2: 0.8 },
            { shift: 7.52, intensity: 1.0, assignment: 'H-8', numProtons: 1, t2: 0.5 }
        ],
        structure: {
            atoms: [
                { element: 'N', x: -40, y: -30 },
                { element: 'C', x: 0, y: -50 },
                { element: 'N', x: 40, y: -30 },
                { element: 'C', x: 40, y: 20 },
                { element: 'C', x: 0, y: 40 },
                { element: 'N', x: -40, y: 20 },
                { element: 'C', x: -70, y: 45 },
                { element: 'N', x: 70, y: 45 },
                { element: 'C', x: 70, y: -50 },
                { element: 'O', x: 0, y: -90 },
                { element: 'O', x: 0, y: 80 },
                { element: 'C', x: -80, y: -50 },
                { element: 'C', x: 100, y: -70 },
                { element: 'C', x: 100, y: 70 }
            ],
            bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [5, 6], [3, 7], [7, 8], [8, 2], [1, 9, 'double'], [4, 10, 'double'], [0, 11], [8, 12], [7, 13]]
        }
    },

    glucose: {
        name: 'Glucose',
        formula: 'C₆H₁₂O₆',
        molecularWeight: 180.16,
        description: 'Simple sugar - α/β anomers visible',
        solvent: 'D2O',
        t1: 1.5,
        t2: 0.5,
        peaks: [
            { shift: 5.23, intensity: 0.36, assignment: 'H-1α', numProtons: 1, t2: 0.5, j_couplings: [3.8] },
            { shift: 4.64, intensity: 0.64, assignment: 'H-1β', numProtons: 1, t2: 0.5, j_couplings: [8.0] },
            { shift: 3.24, intensity: 1.0, assignment: 'H-2', numProtons: 1, t2: 0.6 },
            { shift: 3.49, intensity: 1.0, assignment: 'H-3', numProtons: 1, t2: 0.6 },
            { shift: 3.41, intensity: 1.0, assignment: 'H-4', numProtons: 1, t2: 0.6 },
            { shift: 3.47, intensity: 1.0, assignment: 'H-5', numProtons: 1, t2: 0.6 },
            { shift: 3.73, intensity: 1.0, assignment: 'H-6a', numProtons: 1, t2: 0.6 },
            { shift: 3.89, intensity: 1.0, assignment: 'H-6b', numProtons: 1, t2: 0.6 }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 30, y: -40 },
                { element: 'C', x: 50, y: 0 },
                { element: 'C', x: 30, y: 40 },
                { element: 'C', x: -20, y: 40 },
                { element: 'C', x: -40, y: 0 },
                { element: 'O', x: -20, y: -40 },
                { element: 'C', x: -80, y: 0 },
                { element: 'O', x: 60, y: -70 },
                { element: 'O', x: 90, y: 0 },
                { element: 'O', x: 50, y: 75 },
                { element: 'O', x: -40, y: 75 },
                { element: 'O', x: -100, y: -30 }
            ],
            bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [4, 6], [0, 7], [1, 8], [2, 9], [3, 10], [6, 11]]
        }
    },

    // ========== CUSTOM SAMPLE ==========
    custom: {
        name: 'Custom Sample',
        formula: 'Custom',
        molecularWeight: 100,
        description: 'User-defined sample',
        solvent: 'CDCl3',
        t1: 2.0,
        t2: 1.0,
        peaks: [
            { shift: 3.0, intensity: 1.0, assignment: 'Custom', numProtons: 1, t2: 1.0 }
        ],
        structure: {
            atoms: [
                { element: 'C', x: 0, y: 0 },
                { element: 'H', x: -25, y: -25 },
                { element: 'H', x: 25, y: -25 },
                { element: 'H', x: -25, y: 25 },
                { element: 'H', x: 25, y: 25 }
            ],
            bonds: [[0, 1], [0, 2], [0, 3], [0, 4]]
        }
    }
};

/**
 * Common pulse sequences with their parameters
 */
const PulseSequences = {
    single_pulse: {
        name: 'Single Pulse (zg)',
        description: 'Basic 90° excitation - acquire',
        diagram: 'd1 - 90° - AQ',
        elements: [
            { type: 'delay', name: 'd1', label: 'Relaxation Delay', defaultValue: 2.0 },
            { type: 'pulse', angle: 90, name: 'p1', label: '90° Pulse', phase: 'x' },
            { type: 'acquire', name: 'aq', label: 'Acquisition' }
        ]
    },
    inversion_recovery: {
        name: 'Inversion Recovery',
        description: 'T₁ measurement: 180° - τ - 90° - acquire',
        diagram: 'd1 - 180° - τ - 90° - AQ',
        elements: [
            { type: 'delay', name: 'd1', label: 'Relaxation Delay', defaultValue: 5.0 },
            { type: 'pulse', angle: 180, name: 'p1', label: '180° Pulse', phase: 'x' },
            { type: 'delay', name: 'tau', label: 'τ (variable)', defaultValue: 0.1 },
            { type: 'pulse', angle: 90, name: 'p2', label: '90° Pulse', phase: 'x' },
            { type: 'acquire', name: 'aq', label: 'Acquisition' }
        ]
    },
    spin_echo: {
        name: 'Spin Echo (Hahn)',
        description: 'T₂ measurement: 90° - τ - 180° - τ - acquire',
        diagram: 'd1 - 90°(x) - τ - 180°(y) - τ - AQ',
        elements: [
            { type: 'delay', name: 'd1', label: 'Relaxation Delay', defaultValue: 2.0 },
            { type: 'pulse', angle: 90, name: 'p1', label: '90° Pulse', phase: 'x' },
            { type: 'delay', name: 'tau', label: 'τ', defaultValue: 0.01 },
            { type: 'pulse', angle: 180, name: 'p2', label: '180° Pulse', phase: 'y' },
            { type: 'delay', name: 'tau2', label: 'τ', defaultValue: 0.01 },
            { type: 'acquire', name: 'aq', label: 'Acquisition' }
        ]
    },
    cpmg: {
        name: 'CPMG',
        description: 'T₂ multi-echo: 90°(x) - [τ - 180°(y) - τ]ₙ - acquire',
        diagram: 'd1 - 90°(x) - [τ - 180°(y) - τ]ₙ - AQ',
        elements: [
            { type: 'delay', name: 'd1', label: 'Relaxation Delay', defaultValue: 2.0 },
            { type: 'pulse', angle: 90, name: 'p1', label: '90° Pulse', phase: 'x' },
            { type: 'loop_start', name: 'loop', label: 'Echo Loop', count: 8 },
            { type: 'delay', name: 'tau', label: 'τ', defaultValue: 0.001 },
            { type: 'pulse', angle: 180, name: 'p2', label: '180° Pulse', phase: 'y' },
            { type: 'delay', name: 'tau2', label: 'τ', defaultValue: 0.001 },
            { type: 'loop_end' },
            { type: 'acquire', name: 'aq', label: 'Acquisition' }
        ]
    },
    cosy: {
        name: 'COSY',
        description: '2D homonuclear correlation',
        diagram: 'd1 - 90° - t₁ - 90° - AQ(t₂)',
        is2D: true,
        elements: [
            { type: 'delay', name: 'd1', label: 'Relaxation Delay', defaultValue: 1.5 },
            { type: 'pulse', angle: 90, name: 'p1', label: '90° Pulse', phase: 'x' },
            { type: 'delay', name: 't1', label: 't₁ (incremented)', defaultValue: 0.001 },
            { type: 'pulse', angle: 90, name: 'p2', label: '90° Pulse', phase: 'x' },
            { type: 'acquire', name: 'aq', label: 'Acquisition (t₂)' }
        ]
    },
    hsqc: {
        name: 'HSQC',
        description: '2D heteronuclear single quantum coherence',
        diagram: '¹H: 90° - Δ - 180° - Δ - t₁/2 - 180° - t₁/2 - 90° - AQ',
        is2D: true,
        elements: [
            { type: 'delay', name: 'd1', label: 'Relaxation Delay', defaultValue: 1.5 },
            { type: 'pulse', angle: 90, name: 'p1', label: '90°(¹H)', phase: 'x', channel: '1H' },
            { type: 'delay', name: 'delta', label: 'Δ = 1/(4J)', defaultValue: 0.00172 },
            { type: 'pulse', angle: 180, name: 'p2', label: '180°(¹H,¹³C)', phase: 'x' },
            { type: 'delay', name: 'delta2', label: 'Δ', defaultValue: 0.00172 },
            { type: 'pulse', angle: 90, name: 'p3', label: '90°(¹³C)', phase: 'x', channel: '13C' },
            { type: 'acquire', name: 'aq', label: 'Acquisition' }
        ]
    },
    noesy: {
        name: 'NOESY',
        description: '2D NOE spectroscopy for spatial proximity',
        diagram: 'd1 - 90° - t₁ - 90° - τₘ - 90° - AQ',
        is2D: true,
        elements: [
            { type: 'delay', name: 'd1', label: 'Relaxation Delay', defaultValue: 2.0 },
            { type: 'pulse', angle: 90, name: 'p1', label: '90° Pulse', phase: 'x' },
            { type: 'delay', name: 't1', label: 't₁ (incremented)', defaultValue: 0.001 },
            { type: 'pulse', angle: 90, name: 'p2', label: '90° Pulse', phase: 'x' },
            { type: 'delay', name: 'tm', label: 'τₘ (mixing)', defaultValue: 0.3 },
            { type: 'pulse', angle: 90, name: 'p3', label: '90° Pulse', phase: 'x' },
            { type: 'acquire', name: 'aq', label: 'Acquisition' }
        ]
    },
    dept: {
        name: 'DEPT-135',
        description: 'CH₃ and CH up, CH₂ down, quaternary C not visible',
        diagram: '¹H: 90° - Δ - 180° - Δ - θ | ¹³C: Δ - 180° - Δ - AQ',
        elements: [
            { type: 'delay', name: 'd1', label: 'Relaxation Delay', defaultValue: 2.0 },
            { type: 'pulse', angle: 90, name: 'p1', label: '90°(¹H)', phase: 'x', channel: '1H' },
            { type: 'delay', name: 'delta', label: 'Δ = 1/(2J)', defaultValue: 0.00345 },
            { type: 'pulse', angle: 180, name: 'p2', label: '180°(¹H,¹³C)', phase: 'x' },
            { type: 'delay', name: 'delta2', label: 'Δ', defaultValue: 0.00345 },
            { type: 'pulse', angle: 135, name: 'p3', label: '135°(¹H)', phase: 'y', channel: '1H' },
            { type: 'acquire', name: 'aq', label: 'Acquisition (¹³C)' }
        ]
    }
};

/**
 * Sample class to manage sample state
 */
class Sample {
    constructor(sampleType = 'water') {
        // Set defaults first
        this.concentration = 1.0;
        this.volume = 0.5;
        this.tubeDiameter = 5;
        this.solventKey = 'CDCl3';  // Default fallback
        this.showTMS = true;

        // Load sample (will set correct solvent from sample data)
        this.loadSample(sampleType);
    }

    loadSample(sampleType) {
        const data = SampleDatabase[sampleType] || SampleDatabase.water;
        this.type = sampleType;
        this.name = data.name;
        this.formula = data.formula;
        this.molecularWeight = data.molecularWeight;
        this.description = data.description;
        this.defaultSolvent = data.solvent;
        this.t1 = data.t1;
        this.t2 = data.t2;
        this.peaks = JSON.parse(JSON.stringify(data.peaks));
        this.structure = data.structure ? JSON.parse(JSON.stringify(data.structure)) : null;

        // Set solvent from sample default
        if (data.solvent && NMRSolvents[data.solvent]) {
            this.solventKey = data.solvent;
        }
    }

    getSolvent() {
        return NMRSolvents[this.solventKey] || NMRSolvents.CDCl3;
    }

    setSolvent(solventKey) {
        if (NMRSolvents[solventKey]) {
            this.solventKey = solventKey;
        }
    }

    setConcentration(conc) {
        this.concentration = Math.max(0.01, Math.min(1, conc));
    }

    setVolume(vol) {
        this.volume = Math.max(0.1, Math.min(5, vol));
    }

    setTubeDiameter(diameter) {
        this.tubeDiameter = Math.max(3, Math.min(10, diameter));
    }

    getScaledPeaks() {
        return this.peaks.map(peak => ({
            ...peak,
            intensity: peak.intensity * this.concentration
        }));
    }

    getTotalProtons() {
        return this.peaks.reduce((sum, peak) => sum + (peak.numProtons || 1), 0);
    }

    getNumEnvironments() {
        return this.peaks.length;
    }

    addPeak(shift, intensity = 1, assignment = 'Custom') {
        this.peaks.push({
            shift, intensity, assignment,
            numProtons: 1, t2: this.t2
        });
    }

    removePeak(index) {
        if (index >= 0 && index < this.peaks.length) {
            this.peaks.splice(index, 1);
        }
    }

    modifyPeak(index, properties) {
        if (index >= 0 && index < this.peaks.length) {
            Object.assign(this.peaks[index], properties);
        }
    }
}

// Export for use in other modules
window.SampleDatabase = SampleDatabase;
window.NMRSolvents = NMRSolvents;
window.TMSReference = TMSReference;
window.PulseSequences = PulseSequences;
window.Sample = Sample;

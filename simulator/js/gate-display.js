/**
 * Shared gate grouping / labels for circuit step UI (matches Qubi code generation).
 */
const GateDisplay = {
    groupGatesForStepDisplay(gates) {
        if (!gates || gates.length === 0) return [];

        const defaultRotAngle = Math.PI / 2;
        const rotAngleKey = (gate) => {
            const a =
                gate.params && typeof gate.params.angle === 'number'
                    ? gate.params.angle
                    : defaultRotAngle;
            return Math.round(a * 1e9);
        };

        const gateGroups = {};
        for (const gate of gates) {
            let key = `${gate.type}_${gate.target ?? 'single'}`;
            if (gate.params && Array.isArray(gate.params.jointQubits) && gate.params.jointQubits.length > 0) {
                key = `${gate.type}_JOINT_${gate.params.jointQubits.join(',')}`;
            } else if (['CX', 'CY', 'CZ'].includes(gate.type) && gate.multiQubits && gate.multiQubits.length) {
                key = `${gate.type}_MULTI_${gate.multiQubits.join(',')}_${gate.qubit}`;
            } else if (['RX', 'RY', 'RZ'].includes(gate.type)) {
                key = `${gate.type}_a${rotAngleKey(gate)}`;
            } else if (gate.target == null && !(gate.multiQubits && gate.multiQubits.length)) {
                key = `${gate.type}_parallel`;
            }
            if (!gateGroups[key]) gateGroups[key] = [];
            gateGroups[key].push(gate);
        }

        return Object.values(gateGroups);
    },

    formatGateGroupLabel(group) {
        if (!group || group.length === 0) return 'Unknown';
        const g0 = group[0];
        const { type, qubit, target, params, multiQubits } = g0;

        if (['CX', 'CY', 'CZ'].includes(type)) {
            if (multiQubits && multiQubits.length > 0) {
                return `${type} [${[...multiQubits, qubit].join(',')}]`;
            }
            if (target !== null && target !== undefined) {
                return `${type} [${target},${qubit}]`;
            }
        }
        if (type === 'SWAP' && target !== null && target !== undefined) {
            return `SWAP [${target},${qubit}]`;
        }
        if (type === 'CSWAP' && params && Array.isArray(params.jointQubits) && params.jointQubits.length === 3) {
            return `CSWAP [${params.jointQubits.join(',')}]`;
        }
        if (['RX', 'RY', 'RZ'].includes(type)) {
            const defaultRotAngle = Math.PI / 2;
            const angleRad =
                params && typeof params.angle === 'number' ? params.angle : defaultRotAngle;
            const angleStr = parseFloat((angleRad / Math.PI).toFixed(2));
            const qubits = group.map((g) => g.qubit).sort((a, b) => a - b);
            const mixedAngle = group.some((g) => {
                const ar =
                    g.params && typeof g.params.angle === 'number'
                        ? g.params.angle
                        : defaultRotAngle;
                return Math.abs(ar - angleRad) > 1e-6;
            });
            if (mixedAngle) {
                return group
                    .slice()
                    .sort((a, b) => a.qubit - b.qubit)
                    .map((g) => {
                        const ar =
                            g.params && typeof g.params.angle === 'number'
                                ? g.params.angle
                                : defaultRotAngle;
                        return `${type} ${g.qubit} ${parseFloat((ar / Math.PI).toFixed(2))}`;
                    })
                    .join(', ');
            }
            if (qubits.length === 1) {
                return `${type} ${qubits[0]} ${angleStr}`;
            }
            return `${type} (${qubits.join(',')}) ${angleStr}`;
        }
        if (params && Array.isArray(params.jointQubits) && params.jointQubits.length > 0) {
            return `${type} [${params.jointQubits.join(',')}]`;
        }

        const qubits = group.map((g) => g.qubit).sort((a, b) => a - b);
        if (qubits.length === 1) {
            return `${type} ${qubits[0]}`;
        }
        return `${type} (${qubits.join(',')})`;
    },

    formatExecutionStepGateLabel(step) {
        if (!step?.gates?.length) return null;
        return this.groupGatesForStepDisplay(step.gates)
            .map((group) => this.formatGateGroupLabel(group))
            .join(', ');
    },

    formatExecutionStepRepeatLabel(step) {
        if (!step?.repeatContext?.length) return null;
        return step.repeatContext.map((r) => `REP ${r.iteration} of ${r.total}`).join(' · ');
    },

    formatExecutionStepLabel(step) {
        return this.formatExecutionStepGateLabel(step) || '—';
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GateDisplay };
}

if (typeof window !== 'undefined') {
    window.GateDisplay = GateDisplay;
}

/**
 * Qubibyte Route Simulator — Quantum-Inspired Simulations
 * QAOA, Grover, Quantum Annealing, VQE, Quantum Walk, Quantum Genetic
 * All algorithms produce high-quality routes using quantum-inspired heuristics
 */

function safeFactorial(n) {
    if (n <= 1) return 1;
    if (n > 20) return 2.4e18;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

function validateRoute(route, n) {
    if (!route || route.length < 2) return null;
    for (let i = 0; i < route.length; i++) {
        if (route[i] === undefined || route[i] === null || route[i] < 0 || route[i] >= n) return null;
    }
    if (route[0] !== 0) route[0] = 0;
    if (route[route.length - 1] !== 0) route[route.length - 1] = 0;
    return route;
}

function safeCalcRouteLength(route, dm) {
    if (!route || route.length < 2) return Infinity;
    let t = 0;
    for (let i = 0; i < route.length - 1; i++) {
        const from = route[i], to = route[i + 1];
        if (from === undefined || to === undefined || !dm[from] || dm[from][to] === undefined) return Infinity;
        t += dm[from][to];
    }
    return isFinite(t) ? t : Infinity;
}

/* ============ QAOA Simulator ============ */
function solveQAOA(nodes, dm) {
    const n = nodes.length;
    if (n < 3) {
        const route = n === 2 ? [0, 1, 0] : [0, 0];
        return { route, length: safeCalcRouteLength(route, dm), iterations: 0, convergence: [0] };
    }

    const rng = new SeededRNG(314);
    const p = Math.min(8, Math.max(3, Math.floor(n / 3))); // Circuit depth layers
    const numSamples = Math.min(300, n * 20);
    const conv = [];
    const optSteps = 30;

    // Start from a greedy solution as our quantum "initial state"
    let bestRoute, bestLen;
    try {
        const greedy = solveGreedy(nodes, dm);
        bestRoute = [...greedy.route];
        bestLen = greedy.length;
    } catch (e) {
        bestRoute = [0, ...Array.from({ length: n - 1 }, (_, i) => i + 1), 0];
        bestLen = safeCalcRouteLength(bestRoute, dm);
    }

    let gamma = Array.from({ length: p }, () => rng.nextFloat(0, Math.PI));
    let beta = Array.from({ length: p }, () => rng.nextFloat(0, Math.PI / 2));
    let iters = 0;

    // Quantum-inspired sampling: use phase angles to bias perturbations
    const qaoaSample = (baseRoute, g, b) => {
        const route = [...baseRoute];
        for (let l = 0; l < p; l++) {
            // Problem unitary: swap nodes weighted by cost (gamma layer)
            const numSwaps = Math.max(1, Math.floor(Math.abs(Math.sin(g[l])) * n * 0.3));
            for (let s = 0; s < numSwaps; s++) {
                const i = rng.nextInt(1, route.length - 2);
                const j = rng.nextInt(1, route.length - 2);
                if (i !== j) {
                    // Accept swap with probability based on cost difference
                    const before = (dm[route[Math.max(0, i - 1)]][route[i]] || 0) + (dm[route[i]][route[Math.min(route.length - 1, i + 1)]] || 0);
                    [route[i], route[j]] = [route[j], route[i]];
                    const after = (dm[route[Math.max(0, i - 1)]][route[i]] || 0) + (dm[route[i]][route[Math.min(route.length - 1, i + 1)]] || 0);
                    if (after > before && rng.next() > Math.cos(g[l]) * 0.5 + 0.5) {
                        [route[i], route[j]] = [route[j], route[i]]; // Reject
                    }
                }
            }
            // Mixer unitary: random reversals (beta layer)
            const numReversals = Math.max(1, Math.floor(Math.abs(Math.sin(b[l])) * 3));
            for (let r = 0; r < numReversals; r++) {
                const a = rng.nextInt(1, route.length - 2);
                const bb = rng.nextInt(1, route.length - 2);
                if (a !== bb) {
                    const [lo, hi] = a < bb ? [a, bb] : [bb, a];
                    route.splice(lo, hi - lo + 1, ...route.slice(lo, hi + 1).reverse());
                }
            }
        }
        route[0] = 0;
        route[route.length - 1] = 0;
        return route;
    };

    conv.push(bestLen);

    // Variational optimization loop
    for (let step = 0; step < optSteps; step++) {
        let stepBest = bestLen;
        let stepBestRoute = bestRoute;

        // Sample from current parameters
        for (let s = 0; s < numSamples; s++) {
            const candidate = qaoaSample(bestRoute, gamma, beta);
            const len = safeCalcRouteLength(candidate, dm);
            iters++;
            if (len < stepBest && isFinite(len)) {
                stepBest = len;
                stepBestRoute = [...candidate];
            }
        }

        if (stepBest < bestLen) {
            bestLen = stepBest;
            bestRoute = stepBestRoute;
        }

        conv.push(bestLen);

        // Parameter update (gradient-free optimization)
        const perturbScale = 0.4 * (1 - step / optSteps);
        const ng = gamma.map(g => g + (rng.next() - 0.5) * perturbScale);
        const nb = beta.map(b => b + (rng.next() - 0.5) * perturbScale);

        // Test new parameters
        let testBest = Infinity;
        for (let s = 0; s < 40; s++) {
            const tRoute = qaoaSample(bestRoute, ng, nb);
            const tLen = safeCalcRouteLength(tRoute, dm);
            if (tLen < testBest) testBest = tLen;
        }
        if (testBest <= stepBest * 1.02) { gamma = ng; beta = nb; }
    }

    // Final 2-opt polish
    let polished = [...bestRoute];
    let polishedLen = bestLen;
    for (let pass = 0; pass < 3; pass++) {
        let improved = false;
        for (let i = 1; i < polished.length - 2; i++) {
            for (let j = i + 1; j < polished.length - 1; j++) {
                const d1 = dm[polished[i - 1]][polished[i]] + dm[polished[j]][polished[j + 1]];
                const d2 = dm[polished[i - 1]][polished[j]] + dm[polished[i]][polished[j + 1]];
                if (d2 < d1 - 1e-10) {
                    polished.splice(i, j - i + 1, ...polished.slice(i, j + 1).reverse());
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }
    polishedLen = safeCalcRouteLength(polished, dm);
    if (polishedLen < bestLen) { bestRoute = polished; bestLen = polishedLen; }

    conv.push(bestLen);
    return {
        route: bestRoute, length: bestLen, iterations: iters, convergence: conv,
        quantum: {
            qubits: n * Math.ceil(Math.log2(Math.max(2, n))),
            circuitDepth: p * (n - 1),
            coherenceCost: (p * n * 0.95).toFixed(1) + ' μs',
            probDistribution: genProbDist(n, rng),
            blochAngles: { theta: rng.nextFloat(0, Math.PI), phi: rng.nextFloat(0, 2 * Math.PI) }
        }
    };
}

/* ============ Grover Search ============ */
function solveGrover(nodes, dm) {
    const n = nodes.length;
    if (n < 3) {
        const route = n === 2 ? [0, 1, 0] : [0, 0];
        return { route, length: safeCalcRouteLength(route, dm), iterations: 0, convergence: [0] };
    }

    const rng = new SeededRNG(271);
    const conv = [];

    // Start from greedy
    let bestRoute, bestLen;
    try {
        const greedy = solveGreedy(nodes, dm);
        bestRoute = [...greedy.route];
        bestLen = greedy.length;
    } catch (e) {
        bestRoute = [0, ...Array.from({ length: n - 1 }, (_, i) => i + 1), 0];
        bestLen = safeCalcRouteLength(bestRoute, dm);
    }

    conv.push(bestLen);

    // Simulate Grover's amplitude amplification:
    // Sample random permutations, bias towards improvements (quadratic speedup simulation)
    const factVal = safeFactorial(n - 1);
    const maxSamples = Math.min(5000, Math.max(200, Math.ceil(Math.sqrt(factVal))));
    let iters = 0;

    // Phase 1: Random search with amplitude bias
    for (let i = 0; i < maxSamples; i++) {
        // Generate random tour
        const c = Array.from({ length: n - 1 }, (_, i) => i + 1);
        const shuffled = rng.shuffle(c);
        let route = [0, ...shuffled, 0];
        let len = safeCalcRouteLength(route, dm);
        if (len === Infinity) { iters++; continue; }

        // "Amplitude amplification" — local search to amplify good solutions
        // Simulates the oracle marking + diffusion operator
        const maxImprovements = Math.min(30, n);
        for (let j = 0; j < maxImprovements; j++) {
            const a = rng.nextInt(1, route.length - 2);
            const b = rng.nextInt(1, route.length - 2);
            if (a === b) continue;
            const [lo, hi] = a < b ? [a, b] : [b, a];
            const cand = [...route];
            cand.splice(lo, hi - lo + 1, ...cand.slice(lo, hi + 1).reverse());
            const cl = safeCalcRouteLength(cand, dm);
            if (cl < len) { route = cand; len = cl; }
        }

        if (len < bestLen) { bestLen = len; bestRoute = [...route]; }
        iters++;
        if (i % 50 === 0) conv.push(bestLen);
    }

    // Phase 2: Intensive local optimization on best found
    let cur = [...bestRoute];
    let curLen = bestLen;
    for (let pass = 0; pass < 5; pass++) {
        let improved = false;
        for (let i = 1; i < cur.length - 2; i++) {
            for (let j = i + 1; j < cur.length - 1; j++) {
                const d1 = dm[cur[i - 1]][cur[i]] + dm[cur[j]][cur[j + 1]];
                const d2 = dm[cur[i - 1]][cur[j]] + dm[cur[i]][cur[j + 1]];
                if (d2 < d1 - 1e-10) {
                    cur.splice(i, j - i + 1, ...cur.slice(i, j + 1).reverse());
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }
    curLen = safeCalcRouteLength(cur, dm);
    if (curLen < bestLen) { bestLen = curLen; bestRoute = cur; }

    conv.push(bestLen);
    const depthVal = Math.min(99999, Math.ceil(Math.PI / 4 * Math.sqrt(factVal) / 100));
    return {
        route: bestRoute, length: bestLen, iterations: iters, convergence: conv,
        quantum: {
            qubits: n * Math.ceil(Math.log2(Math.max(2, n))),
            circuitDepth: depthVal,
            coherenceCost: (Math.sqrt(n) * 2.1).toFixed(1) + ' μs',
            probDistribution: genProbDist(n, rng),
            blochAngles: { theta: Math.PI / 4, phi: rng.nextFloat(0, 2 * Math.PI) }
        }
    };
}

/* ============ Quantum Annealing ============ */
function solveQuantumAnnealing(nodes, dm) {
    const n = nodes.length;
    if (n < 3) {
        const route = n === 2 ? [0, 1, 0] : [0, 0];
        return { route, length: safeCalcRouteLength(route, dm), iterations: 0, convergence: [0] };
    }

    const rng = new SeededRNG(161);
    const conv = [];

    // Initialize with greedy solution
    let cur, curLen;
    try {
        const greedy = solveGreedy(nodes, dm);
        cur = [...greedy.route];
        curLen = greedy.length;
    } catch (e) {
        cur = [0, ...Array.from({ length: n - 1 }, (_, i) => i + 1), 0];
        curLen = safeCalcRouteLength(cur, dm);
    }
    if (!isFinite(curLen)) {
        cur = [0, ...Array.from({ length: n - 1 }, (_, i) => i + 1), 0];
        curLen = safeCalcRouteLength(cur, dm);
    }

    let best = [...cur], bestLen = curLen;
    const steps = Math.min(40000, n * n * 50);
    let iters = 0;
    conv.push(curLen);

    for (let step = 0; step < steps; step++) {
        const s = step / steps;
        // Classical temperature decreases, transverse field decreases
        const temp = Math.max(0.001, (1 - s) * curLen * 0.3 + 0.01);
        const tField = (1 - s) * 5.0; // Transverse field strength
        const tunnelProb = tField / 5.0;
        let candidate;

        if (rng.next() < tunnelProb && cur.length > 4) {
            // Quantum tunneling: large segment moves (non-local jumps)
            candidate = [...cur];
            const maxSegLen = Math.max(3, (cur.length / 3) | 0);
            const segLen = rng.nextInt(2, maxSegLen);
            const maxStart = cur.length - segLen - 1;
            if (maxStart > 1) {
                const start = rng.nextInt(1, maxStart);
                if (rng.next() < 0.5) {
                    candidate.splice(start, segLen, ...candidate.slice(start, start + segLen).reverse());
                } else {
                    const seg = candidate.splice(start, segLen);
                    const insertPos = rng.nextInt(1, Math.max(1, candidate.length - 1));
                    candidate.splice(insertPos, 0, ...seg);
                }
            }
        } else {
            // Classical move: 2-opt
            candidate = [...cur];
            if (cur.length > 3) {
                const a = rng.nextInt(1, cur.length - 2);
                const b = rng.nextInt(1, cur.length - 2);
                const [lo, hi] = a < b ? [a, b] : [b, a];
                if (lo !== hi) candidate.splice(lo, hi - lo + 1, ...candidate.slice(lo, hi + 1).reverse());
            }
        }

        // Ensure depot
        if (candidate[0] !== 0) candidate[0] = 0;
        if (candidate[candidate.length - 1] !== 0) candidate[candidate.length - 1] = 0;

        const candLen = safeCalcRouteLength(candidate, dm);
        if (!isFinite(candLen)) { iters++; continue; }

        const delta = candLen - curLen;
        if (delta < 0 || rng.next() < Math.exp(-delta / temp) * (tField > 0.5 ? 1.3 : 1)) {
            cur = candidate; curLen = candLen;
            if (curLen < bestLen) { best = [...cur]; bestLen = curLen; }
        }
        iters++;
        if (step % 200 === 0) conv.push(bestLen);
    }

    // 2-opt polish
    let polished = [...best];
    for (let pass = 0; pass < 3; pass++) {
        let improved = false;
        for (let i = 1; i < polished.length - 2; i++) {
            for (let j = i + 1; j < polished.length - 1; j++) {
                const d1 = dm[polished[i - 1]][polished[i]] + dm[polished[j]][polished[j + 1]];
                const d2 = dm[polished[i - 1]][polished[j]] + dm[polished[i]][polished[j + 1]];
                if (d2 < d1 - 1e-10) {
                    polished.splice(i, j - i + 1, ...polished.slice(i, j + 1).reverse());
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }
    const polishedLen = safeCalcRouteLength(polished, dm);
    if (polishedLen < bestLen) { best = polished; bestLen = polishedLen; }

    conv.push(bestLen);
    return {
        route: best, length: bestLen, iterations: iters, convergence: conv,
        quantum: {
            qubits: n * (n - 1),
            circuitDepth: steps,
            coherenceCost: (n * 0.5).toFixed(1) + ' ms',
            probDistribution: genProbDist(n, rng),
            blochAngles: { theta: rng.nextFloat(Math.PI / 6, Math.PI / 2), phi: rng.nextFloat(0, 2 * Math.PI) }
        }
    };
}

/* ============ VQE Router ============ */
function solveVQE(nodes, dm) {
    const n = nodes.length;
    if (n < 3) {
        const route = n === 2 ? [0, 1, 0] : [0, 0];
        return { route, length: safeCalcRouteLength(route, dm), iterations: 0, convergence: [0] };
    }

    const rng = new SeededRNG(577);
    const conv = [];
    const numParams = n * 2; // Variational parameters
    let params = Array.from({ length: numParams }, () => rng.nextFloat(-Math.PI, Math.PI));

    // Start from greedy
    let bestRoute, bestLen;
    try {
        const greedy = solveGreedy(nodes, dm);
        bestRoute = [...greedy.route];
        bestLen = greedy.length;
    } catch (e) {
        bestRoute = [0, ...Array.from({ length: n - 1 }, (_, i) => i + 1), 0];
        bestLen = safeCalcRouteLength(bestRoute, dm);
    }

    let iters = 0;
    conv.push(bestLen);

    // VQE ansatz: parameterized circuit simulation
    const evaluateAnsatz = (params) => {
        const route = [...bestRoute];
        // Apply rotations based on parameters
        for (let layer = 0; layer < Math.min(4, Math.floor(numParams / 2)); layer++) {
            for (let i = 1; i < route.length - 2; i++) {
                const pIdx = (layer * n + i) % numParams;
                const angle = params[pIdx];
                // Rotation probability determines swap
                if (Math.abs(Math.sin(angle)) > rng.next()) {
                    const j = 1 + Math.floor(Math.abs(Math.cos(angle)) * (route.length - 3));
                    const jj = Math.max(1, Math.min(route.length - 2, j));
                    if (jj !== i) {
                        [route[i], route[jj]] = [route[jj], route[i]];
                    }
                }
            }
        }
        route[0] = 0;
        route[route.length - 1] = 0;
        return route;
    };

    const optSteps = 50;
    const samplesPerStep = Math.min(100, n * 10);

    for (let step = 0; step < optSteps; step++) {
        let stepBest = bestLen;
        let stepBestRoute = bestRoute;

        for (let s = 0; s < samplesPerStep; s++) {
            const candidate = evaluateAnsatz(params);
            const len = safeCalcRouteLength(candidate, dm);
            iters++;
            if (isFinite(len) && len < stepBest) {
                stepBest = len;
                stepBestRoute = [...candidate];
            }
        }

        if (stepBest < bestLen) {
            bestLen = stepBest;
            bestRoute = stepBestRoute;
        }

        // SPSA parameter update
        const perturbScale = 0.3 * (1 - step / optSteps);
        const delta = Array.from({ length: numParams }, () => rng.next() < 0.5 ? -1 : 1);
        const paramsPlus = params.map((p, i) => p + perturbScale * delta[i]);
        const paramsMinus = params.map((p, i) => p - perturbScale * delta[i]);

        let costPlus = 0, costMinus = 0;
        for (let s = 0; s < 10; s++) {
            const rp = evaluateAnsatz(paramsPlus);
            const rm = evaluateAnsatz(paramsMinus);
            costPlus += safeCalcRouteLength(rp, dm);
            costMinus += safeCalcRouteLength(rm, dm);
        }
        costPlus /= 10; costMinus /= 10;

        const lr = 0.1 * (1 - step / optSteps);
        const gradient = (costPlus - costMinus) / (2 * perturbScale);
        params = params.map((p, i) => p - lr * gradient * delta[i]);

        conv.push(bestLen);
    }

    // Polish
    let polished = [...bestRoute];
    for (let pass = 0; pass < 5; pass++) {
        let improved = false;
        for (let i = 1; i < polished.length - 2; i++) {
            for (let j = i + 1; j < polished.length - 1; j++) {
                const d1 = dm[polished[i - 1]][polished[i]] + dm[polished[j]][polished[j + 1]];
                const d2 = dm[polished[i - 1]][polished[j]] + dm[polished[i]][polished[j + 1]];
                if (d2 < d1 - 1e-10) {
                    polished.splice(i, j - i + 1, ...polished.slice(i, j + 1).reverse());
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }
    const polishedLen = safeCalcRouteLength(polished, dm);
    if (polishedLen < bestLen) { bestRoute = polished; bestLen = polishedLen; }

    conv.push(bestLen);
    return {
        route: bestRoute, length: bestLen, iterations: iters, convergence: conv,
        quantum: {
            qubits: n * Math.ceil(Math.log2(Math.max(2, n))) + numParams,
            circuitDepth: optSteps * 4,
            coherenceCost: (numParams * 0.3).toFixed(1) + ' μs',
            probDistribution: genProbDist(n, rng),
            blochAngles: { theta: rng.nextFloat(0, Math.PI), phi: rng.nextFloat(0, 2 * Math.PI) }
        }
    };
}

/* ============ Quantum Walk ============ */
function solveQuantumWalk(nodes, dm) {
    const n = nodes.length;
    if (n < 3) {
        const route = n === 2 ? [0, 1, 0] : [0, 0];
        return { route, length: safeCalcRouteLength(route, dm), iterations: 0, convergence: [0] };
    }

    const rng = new SeededRNG(997);
    const conv = [];

    // Start from greedy
    let bestRoute, bestLen;
    try {
        const greedy = solveGreedy(nodes, dm);
        bestRoute = [...greedy.route];
        bestLen = greedy.length;
    } catch (e) {
        bestRoute = [0, ...Array.from({ length: n - 1 }, (_, i) => i + 1), 0];
        bestLen = safeCalcRouteLength(bestRoute, dm);
    }

    conv.push(bestLen);
    let iters = 0;
    const walkSteps = Math.min(20000, n * n * 30);

    // Simulate continuous-time quantum walk on solution graph
    // Position = current tour, adjacent positions = tours reachable by single swap/reversal
    let cur = [...bestRoute];
    let curLen = bestLen;

    // Phase amplitudes (simulate superposition)
    const numWalkers = Math.min(8, Math.max(3, Math.floor(n / 4)));
    let walkers = [];
    for (let w = 0; w < numWalkers; w++) {
        const c = Array.from({ length: n - 1 }, (_, i) => i + 1);
        const shuffled = rng.shuffle(c);
        const wRoute = [0, ...shuffled, 0];
        walkers.push({ route: wRoute, len: safeCalcRouteLength(wRoute, dm), phase: rng.nextFloat(0, 2 * Math.PI) });
    }
    // Replace one walker with greedy solution
    walkers[0] = { route: [...bestRoute], len: bestLen, phase: 0 };

    for (let step = 0; step < walkSteps; step++) {
        // Each walker takes a step (coin + shift operator)
        for (let w = 0; w < walkers.length; w++) {
            const walker = walkers[w];
            const candidate = [...walker.route];

            // Coin operation: bias walk direction based on phase
            const coinProb = Math.cos(walker.phase) * 0.5 + 0.5;

            if (rng.next() < coinProb) {
                // 2-opt step
                const a = rng.nextInt(1, candidate.length - 2);
                const b = rng.nextInt(1, candidate.length - 2);
                if (a !== b) {
                    const [lo, hi] = a < b ? [a, b] : [b, a];
                    candidate.splice(lo, hi - lo + 1, ...candidate.slice(lo, hi + 1).reverse());
                }
            } else {
                // Or-opt step
                const segLen = rng.nextInt(1, 3);
                const maxStart = candidate.length - segLen - 1;
                if (maxStart > 1) {
                    const start = rng.nextInt(1, maxStart);
                    const seg = candidate.splice(start, segLen);
                    const insertPos = rng.nextInt(1, Math.max(1, candidate.length - 1));
                    candidate.splice(insertPos, 0, ...seg);
                }
            }

            candidate[0] = 0;
            candidate[candidate.length - 1] = 0;
            const candLen = safeCalcRouteLength(candidate, dm);

            if (isFinite(candLen)) {
                // Accept if better, or probabilistically (interference)
                if (candLen < walker.len || rng.next() < Math.exp(-(candLen - walker.len) / (walker.len * 0.1 * (1 - step / walkSteps)))) {
                    walker.route = candidate;
                    walker.len = candLen;
                }

                if (candLen < bestLen) {
                    bestLen = candLen;
                    bestRoute = [...candidate];
                }
            }

            // Update phase (time evolution)
            walker.phase += 0.1 * (walker.len / bestLen);
            iters++;
        }

        // Interference: walkers influence each other
        if (step % 100 === 0) {
            // Find best walker
            let bestWalker = 0;
            for (let w = 1; w < walkers.length; w++) {
                if (walkers[w].len < walkers[bestWalker].len) bestWalker = w;
            }
            // Reset worst walker to near best
            let worstWalker = 0;
            for (let w = 1; w < walkers.length; w++) {
                if (walkers[w].len > walkers[worstWalker].len) worstWalker = w;
            }
            if (worstWalker !== bestWalker) {
                walkers[worstWalker].route = [...walkers[bestWalker].route];
                walkers[worstWalker].len = walkers[bestWalker].len;
                walkers[worstWalker].phase = rng.nextFloat(0, 2 * Math.PI);
            }
        }

        if (step % 500 === 0) conv.push(bestLen);
    }

    // Polish
    let polished = [...bestRoute];
    for (let pass = 0; pass < 5; pass++) {
        let improved = false;
        for (let i = 1; i < polished.length - 2; i++) {
            for (let j = i + 1; j < polished.length - 1; j++) {
                const d1 = dm[polished[i - 1]][polished[i]] + dm[polished[j]][polished[j + 1]];
                const d2 = dm[polished[i - 1]][polished[j]] + dm[polished[i]][polished[j + 1]];
                if (d2 < d1 - 1e-10) {
                    polished.splice(i, j - i + 1, ...polished.slice(i, j + 1).reverse());
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }
    const polishedLen = safeCalcRouteLength(polished, dm);
    if (polishedLen < bestLen) { bestRoute = polished; bestLen = polishedLen; }

    conv.push(bestLen);
    return {
        route: bestRoute, length: bestLen, iterations: iters, convergence: conv,
        quantum: {
            qubits: n * numWalkers,
            circuitDepth: walkSteps,
            coherenceCost: (Math.sqrt(n) * 1.8).toFixed(1) + ' μs',
            probDistribution: genProbDist(n, rng),
            blochAngles: { theta: rng.nextFloat(0, Math.PI), phi: rng.nextFloat(0, 2 * Math.PI) }
        }
    };
}

/* ============ Quantum Genetic ============ */
function solveQuantumGenetic(nodes, dm) {
    const n = nodes.length;
    if (n < 3) {
        const route = n === 2 ? [0, 1, 0] : [0, 0];
        return { route, length: safeCalcRouteLength(route, dm), iterations: 0, convergence: [0] };
    }

    const rng = new SeededRNG(1618);
    const conv = [];
    const popSize = Math.min(60, Math.max(16, n * 2));
    const gens = Math.min(300, Math.max(50, n * 4));
    let iters = 0;

    // Quantum rotation gates for chromosome evolution
    const mkInd = () => {
        const c = Array.from({ length: n - 1 }, (_, i) => i + 1);
        return [0, ...rng.shuffle(c), 0];
    };

    let pop = Array.from({ length: popSize }, mkInd);

    // Ensure greedy is in population
    try {
        const greedy = solveGreedy(nodes, dm);
        pop[0] = [...greedy.route];
    } catch (e) { /* keep random */ }

    const fitness = r => safeCalcRouteLength(r, dm);
    let best = pop[0], bestF = fitness(best);
    conv.push(bestF);

    // Quantum-inspired crossover: superposition of parent orderings
    const quantumCrossover = (p1, p2) => {
        const a = p1.slice(1, -1), b = p2.slice(1, -1), L = a.length;
        const child = new Array(L).fill(-1);
        const used = new Set();

        // Quantum: probabilistically inherit from each parent
        for (let i = 0; i < L; i++) {
            // Rotation angle determines parent choice probability
            const theta = Math.atan2(i, L) + rng.nextFloat(-0.3, 0.3);
            const probA = Math.cos(theta) * Math.cos(theta);

            const choice = rng.next() < probA ? a[i] : b[i];
            if (!used.has(choice)) {
                child[i] = choice;
                used.add(choice);
            }
        }

        // Fill blanks
        const remaining = [];
        for (let i = 1; i < n; i++) if (!used.has(i)) remaining.push(i);
        let ri = 0;
        for (let i = 0; i < L; i++) {
            if (child[i] === -1) { child[i] = remaining[ri++]; }
        }

        return [0, ...child, 0];
    };

    // Quantum-inspired mutation: Grover-like amplification of good segments
    const quantumMutate = (ind) => {
        const r = [...ind];
        // Identify best segment (lowest local cost)
        let bestSeg = 1, bestSegCost = Infinity;
        for (let i = 1; i < r.length - 2; i++) {
            const cost = dm[r[i - 1]][r[i]] + dm[r[i]][r[i + 1]];
            if (cost < bestSegCost) { bestSegCost = cost; bestSeg = i; }
        }

        // Amplify: keep best segment, perturb elsewhere
        const mutPos = rng.nextInt(1, r.length - 2);
        if (mutPos !== bestSeg) {
            const swapWith = rng.nextInt(1, r.length - 2);
            if (swapWith !== bestSeg) {
                [r[mutPos], r[swapWith]] = [r[swapWith], r[mutPos]];
            }
        }
        return r;
    };

    for (let g = 0; g < gens; g++) {
        const scored = pop.map(i => ({ i, f: fitness(i) })).sort((a, b) => a.f - b.f);
        if (scored[0].f < bestF) { best = scored[0].i; bestF = scored[0].f; }
        if (g % 3 === 0) conv.push(bestF);

        const newPop = [scored[0].i, scored[1].i]; // Elitism

        while (newPop.length < popSize) {
            // Grover-inspired selection: quadratic bias towards top
            const rank = Math.floor(Math.pow(rng.next(), 2) * (popSize / 2));
            const p1 = scored[Math.min(rank, scored.length - 1)].i;
            const rank2 = Math.floor(Math.pow(rng.next(), 2) * (popSize / 2));
            const p2 = scored[Math.min(rank2, scored.length - 1)].i;

            let child = quantumCrossover(p1, p2);
            if (rng.next() < 0.2) child = quantumMutate(child);
            newPop.push(child);
            iters++;
        }

        pop = newPop;
    }

    // Polish best
    let polished = [...best];
    for (let pass = 0; pass < 5; pass++) {
        let improved = false;
        for (let i = 1; i < polished.length - 2; i++) {
            for (let j = i + 1; j < polished.length - 1; j++) {
                const d1 = dm[polished[i - 1]][polished[i]] + dm[polished[j]][polished[j + 1]];
                const d2 = dm[polished[i - 1]][polished[j]] + dm[polished[i]][polished[j + 1]];
                if (d2 < d1 - 1e-10) {
                    polished.splice(i, j - i + 1, ...polished.slice(i, j + 1).reverse());
                    improved = true;
                }
            }
        }
        if (!improved) break;
    }
    const polishedLen = safeCalcRouteLength(polished, dm);
    if (polishedLen < bestF) { best = polished; bestF = polishedLen; }

    conv.push(bestF);
    return {
        route: best, length: bestF, iterations: iters, convergence: conv,
        quantum: {
            qubits: popSize * Math.ceil(Math.log2(Math.max(2, n))),
            circuitDepth: gens * n,
            coherenceCost: (gens * 0.05).toFixed(1) + ' μs',
            probDistribution: genProbDist(n, rng),
            blochAngles: { theta: rng.nextFloat(0, Math.PI), phi: rng.nextFloat(0, 2 * Math.PI) }
        }
    };
}

/* ============ Utilities ============ */
function genProbDist(n, rng) {
    const bins = Math.min(20, Math.max(2, n));
    const p = [];
    let sum = 0;
    for (let i = 0; i < bins; i++) {
        const v = (1 / (1 + i * 0.5)) * (0.5 + rng.next() * 0.5);
        p.push(v); sum += v;
    }
    if (sum === 0) return p.map(() => 1 / bins);
    return p.map(v => v / sum);
}

function renderBlochSphere(canvas, theta, phi, time) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) / 2 - 16;
    ctx.clearRect(0, 0, w, h);

    const at = (theta || 0) + Math.sin((time || 0) * 0.002) * 0.1;
    const ap = (phi || 0) + (time || 0) * 0.001;

    // Wireframe sphere
    ctx.strokeStyle = 'rgba(171,111,175,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.3, r, 0, 0, Math.PI * 2); ctx.stroke();

    // Outer circle
    ctx.strokeStyle = 'rgba(171,111,175,0.25)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy - r - 4); ctx.lineTo(cx, cy + r + 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r - 4, cy); ctx.lineTo(cx + r + 4, cy); ctx.stroke();

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px "JetBrains Mono",monospace'; ctx.textAlign = 'center';
    ctx.fillText('|0⟩', cx, cy - r - 6); ctx.fillText('|1⟩', cx, cy + r + 12);

    // State vector
    const sx = Math.sin(at) * Math.cos(ap), sz = Math.cos(at);
    const px = cx + sx * r, py = cy - sz * r;
    const grad = ctx.createLinearGradient(cx, cy, px, py);
    grad.addColorStop(0, 'rgba(192,132,252,0.3)'); grad.addColorStop(1, 'rgba(192,132,252,1)');
    ctx.strokeStyle = grad; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();

    // State dot
    ctx.fillStyle = '#c084fc'; ctx.shadowColor = 'rgba(192,132,252,0.5)'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

    // Dashed projection
    ctx.setLineDash([2, 2]); ctx.strokeStyle = 'rgba(192,132,252,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, cy); ctx.stroke();
    ctx.setLineDash([]);

    // Angle labels
    const thetaDeg = ((at * 180 / Math.PI) % 360 + 360) % 360;
    const phiDeg = ((ap * 180 / Math.PI) % 360 + 360) % 360;
    ctx.fillStyle = 'rgba(192,132,252,0.5)'; ctx.font = '8px "JetBrains Mono"';
    ctx.fillText(`θ=${thetaDeg.toFixed(0)}°`, cx + 6, cy - r / 2);
    ctx.fillText(`φ=${phiDeg.toFixed(0)}°`, cx + r / 2 + 6, cy - 6);
}

const QUANTUM_ALGORITHMS = {
    qaoa: solveQAOA,
    grover: solveGrover,
    qannealing: solveQuantumAnnealing,
    vqe: solveVQE,
    qwalk: solveQuantumWalk,
    qgenetic: solveQuantumGenetic
};

/**
 * Qubibyte Route Simulator — Algorithm Implementations
 * All algorithms: (nodes, distMatrix, config?) → { route, length, iterations?, convergence? }
 */

/* ============ Greedy Nearest Neighbor ============ */
function solveGreedy(nodes, dm) {
    const n = nodes.length;
    const vis = new Uint8Array(n);
    const route = [0]; vis[0] = 1;
    let cur = 0, iters = 0;
    while (route.length < n) {
        let best = -1, bestD = Infinity;
        for (let v = 0; v < n; v++) {
            if (!vis[v] && dm[cur][v] < bestD) { bestD = dm[cur][v]; best = v; }
        }
        route.push(best); vis[best] = 1; cur = best; iters++;
    }
    route.push(0);
    return { route, length: calcRouteLength(route, dm), iterations: iters };
}

/* ============ 2-Opt ============ */
function solve2Opt(nodes, dm) {
    const n = nodes.length;
    let { route } = solveGreedy(nodes, dm);
    let improved = true, iters = 0;
    const conv = [calcRouteLength(route, dm)];
    while (improved && iters < 8000) {
        improved = false;
        for (let i = 1; i < route.length - 2; i++) {
            for (let j = i + 1; j < route.length - 1; j++) {
                const d1 = dm[route[i - 1]][route[i]] + dm[route[j]][route[j + 1]];
                const d2 = dm[route[i - 1]][route[j]] + dm[route[i]][route[j + 1]];
                if (d2 < d1 - 1e-10) {
                    route.splice(i, j - i + 1, ...route.slice(i, j + 1).reverse());
                    improved = true; iters++;
                    if (iters % 10 === 0) conv.push(calcRouteLength(route, dm));
                }
            }
        }
    }
    const len = calcRouteLength(route, dm);
    conv.push(len);
    return { route, length: len, iterations: iters, convergence: conv };
}

/* ============ Or-Opt ============ */
function solveOrOpt(nodes, dm) {
    const n = nodes.length;
    let { route } = solveGreedy(nodes, dm);
    let improved = true, iters = 0;
    const conv = [calcRouteLength(route, dm)];
    while (improved && iters < 5000) {
        improved = false;
        for (let segLen = 1; segLen <= 3; segLen++) {
            for (let i = 1; i < route.length - segLen - 1; i++) {
                for (let j = 1; j < route.length - 1; j++) {
                    if (j >= i && j <= i + segLen) continue;
                    const seg = route.slice(i, i + segLen);
                    const candidate = [...route];
                    candidate.splice(i, segLen);
                    const insertPos = j > i ? j - segLen : j;
                    candidate.splice(insertPos, 0, ...seg);
                    const newLen = calcRouteLength(candidate, dm);
                    const curLen = calcRouteLength(route, dm);
                    if (newLen < curLen - 1e-10) {
                        route = candidate;
                        improved = true; iters++;
                        if (iters % 5 === 0) conv.push(newLen);
                        break;
                    }
                }
                if (improved) break;
            }
            if (improved) break;
        }
    }
    const len = calcRouteLength(route, dm);
    conv.push(len);
    return { route, length: len, iterations: iters, convergence: conv };
}

/* ============ Genetic Algorithm ============ */
function solveGenetic(nodes, dm) {
    const n = nodes.length;
    const popSize = Math.min(80, Math.max(20, n * 2));
    const gens = Math.min(400, Math.max(60, n * 5));
    const rng = new SeededRNG(42);
    const conv = [];
    const mkInd = () => {
        const c = Array.from({ length: n - 1 }, (_, i) => i + 1);
        return [0, ...rng.shuffle(c), 0];
    };
    const fitness = r => calcRouteLength(r, dm);
    const crossover = (p1, p2) => {
        const a = p1.slice(1, -1), b = p2.slice(1, -1), L = a.length;
        const s = rng.nextInt(0, L - 2), e = rng.nextInt(s + 1, L - 1);
        const child = new Array(L).fill(-1);
        for (let i = s; i <= e; i++) child[i] = a[i];
        let pos = (e + 1) % L;
        for (let i = 0; i < L; i++) {
            const idx = (e + 1 + i) % L;
            if (!child.includes(b[idx])) { child[pos] = b[idx]; pos = (pos + 1) % L; }
        }
        return [0, ...child, 0];
    };
    const mutate = ind => {
        const r = [...ind];
        const i = rng.nextInt(1, r.length - 2), j = rng.nextInt(1, r.length - 2);
        [r[i], r[j]] = [r[j], r[i]];
        return r;
    };
    let pop = Array.from({ length: popSize }, mkInd);
    let best = pop[0], bestF = fitness(best);
    for (let g = 0; g < gens; g++) {
        const scored = pop.map(i => ({ i, f: fitness(i) })).sort((a, b) => a.f - b.f);
        if (scored[0].f < bestF) { best = scored[0].i; bestF = scored[0].f; }
        if (g % 3 === 0) conv.push(bestF);
        const newPop = [scored[0].i, scored[1].i];
        while (newPop.length < popSize) {
            const p1 = scored[rng.nextInt(0, popSize / 2 | 0)].i;
            const p2 = scored[rng.nextInt(0, popSize / 2 | 0)].i;
            let c = crossover(p1, p2);
            if (rng.next() < 0.15) c = mutate(c);
            newPop.push(c);
        }
        pop = newPop;
    }
    conv.push(bestF);
    return { route: best, length: bestF, iterations: gens, convergence: conv };
}

/* ============ Simulated Annealing ============ */
function solveAnnealing(nodes, dm) {
    const n = nodes.length;
    const rng = new SeededRNG(123);
    let { route: cur } = solveGreedy(nodes, dm);
    let curLen = calcRouteLength(cur, dm);
    let best = [...cur], bestLen = curLen;
    let temp = curLen * 0.4;
    const maxIter = Math.min(50000, n * n * 80);
    const conv = [curLen];
    for (let i = 0; i < maxIter; i++) {
        const a = rng.nextInt(1, cur.length - 2), b = rng.nextInt(1, cur.length - 2);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        if (lo === hi) continue;
        const cand = [...cur];
        cand.splice(lo, hi - lo + 1, ...cand.slice(lo, hi + 1).reverse());
        const candLen = calcRouteLength(cand, dm);
        const delta = candLen - curLen;
        if (delta < 0 || rng.next() < Math.exp(-delta / temp)) {
            cur = cand; curLen = candLen;
            if (curLen < bestLen) { best = [...cur]; bestLen = curLen; }
        }
        temp *= 0.9995;
        if (i % 200 === 0) conv.push(bestLen);
    }
    conv.push(bestLen);
    return { route: best, length: bestLen, iterations: maxIter, convergence: conv };
}

/* ============ Ant Colony Optimization ============ */
function solveAntColony(nodes, dm) {
    const n = nodes.length;
    const rng = new SeededRNG(256);
    const numAnts = Math.min(30, Math.max(10, n));
    const numIters = Math.min(100, Math.max(30, n));
    const alpha = 1.0, beta = 3.0, evapRate = 0.3, Q = 100;
    const pheromone = Array.from({ length: n }, () => new Float64Array(n).fill(1));
    let bestRoute = null, bestLen = Infinity;
    const conv = [];
    for (let iter = 0; iter < numIters; iter++) {
        const antRoutes = [];
        for (let a = 0; a < numAnts; a++) {
            const vis = new Uint8Array(n);
            const route = [0]; vis[0] = 1;
            let cur = 0;
            while (route.length < n) {
                let total = 0;
                const probs = [];
                for (let v = 0; v < n; v++) {
                    if (vis[v]) { probs.push(0); continue; }
                    const p = Math.pow(pheromone[cur][v], alpha) * Math.pow(1 / (dm[cur][v] + 1e-6), beta);
                    probs.push(p); total += p;
                }
                let r = rng.next() * total, choice = 0;
                for (let v = 0; v < n; v++) {
                    r -= probs[v];
                    if (r <= 0) { choice = v; break; }
                }
                if (vis[choice]) {
                    for (let v = 0; v < n; v++) if (!vis[v]) { choice = v; break; }
                }
                route.push(choice); vis[choice] = 1; cur = choice;
            }
            route.push(0);
            antRoutes.push({ route, length: calcRouteLength(route, dm) });
        }
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++) pheromone[i][j] *= (1 - evapRate);
        for (const { route, length } of antRoutes) {
            const deposit = Q / length;
            for (let i = 0; i < route.length - 1; i++) {
                pheromone[route[i]][route[i + 1]] += deposit;
                pheromone[route[i + 1]][route[i]] += deposit;
            }
            if (length < bestLen) { bestLen = length; bestRoute = [...route]; }
        }
        conv.push(bestLen);
    }
    return { route: bestRoute, length: bestLen, iterations: numIters * numAnts, convergence: conv };
}

/* ============ Clarke-Wright Savings ============ */
function solveSavings(nodes, dm) {
    const n = nodes.length;
    const savings = [];
    for (let i = 1; i < n; i++)
        for (let j = i + 1; j < n; j++)
            savings.push({ i, j, s: dm[0][i] + dm[0][j] - dm[i][j] });
    savings.sort((a, b) => b.s - a.s);
    const routeOf = new Int32Array(n).fill(-1);
    const routes = [];
    for (let i = 1; i < n; i++) {
        const r = [0, i, 0];
        routeOf[i] = routes.length;
        routes.push(r);
    }
    let iters = 0;
    for (const { i, j } of savings) {
        iters++;
        const ri = routeOf[i], rj = routeOf[j];
        if (ri === -1 || rj === -1 || ri === rj) continue;
        const rA = routes[ri], rB = routes[rj];
        if (!rA || !rB) continue;
        const iEnd = rA[rA.length - 2] === i;
        const jStart = rB[1] === j;
        const iStart = rA[1] === i;
        const jEnd = rB[rB.length - 2] === j;
        let merged = null;
        if (iEnd && jStart) {
            merged = [...rA.slice(0, -1), ...rB.slice(1)];
        } else if (jEnd && iStart) {
            merged = [...rB.slice(0, -1), ...rA.slice(1)];
        } else if (iEnd && jEnd) {
            merged = [...rA.slice(0, -1), ...rB.slice(1, -1).reverse(), 0];
        } else if (iStart && jStart) {
            merged = [0, ...rA.slice(1, -1).reverse(), ...rB.slice(1)];
        }
        if (merged) {
            routes[ri] = merged;
            routes[rj] = null;
            for (const stop of merged) if (stop !== 0) routeOf[stop] = ri;
        }
    }
    const finalRoute = [0];
    for (const r of routes) {
        if (r) finalRoute.push(...r.slice(1, -1));
    }
    finalRoute.push(0);
    const len = calcRouteLength(finalRoute, dm);
    return { route: finalRoute, length: len, iterations: iters };
}

/* ============ Dijkstra + NN Tour ============ */
function solveDijkstra(nodes, dm) {
    const n = nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    const done = new Uint8Array(n);
    dist[0] = 0;
    for (let i = 0; i < n; i++) {
        let u = -1;
        for (let v = 0; v < n; v++)
            if (!done[v] && (u === -1 || dist[v] < dist[u])) u = v;
        if (u === -1) break;
        done[u] = 1;
        for (let v = 0; v < n; v++)
            if (!done[v] && dist[u] + dm[u][v] < dist[v]) dist[v] = dist[u] + dm[u][v];
    }
    // NN tour using graph distances
    const vis = new Uint8Array(n);
    const route = [0]; vis[0] = 1;
    let cur = 0;
    while (route.length < n) {
        let best = -1, bestD = Infinity;
        for (let v = 0; v < n; v++)
            if (!vis[v] && dm[cur][v] < bestD) { bestD = dm[cur][v]; best = v; }
        route.push(best); vis[best] = 1; cur = best;
    }
    route.push(0);
    return { route, length: calcRouteLength(route, dm), iterations: n * n };
}

/* ============ A* + NN Tour ============ */
function solveAStar(nodes, dm) {
    const n = nodes.length;
    const vis = new Uint8Array(n);
    const route = [0]; vis[0] = 1;
    let cur = 0;
    while (route.length < n) {
        let best = -1, bestScore = Infinity;
        for (let v = 0; v < n; v++) {
            if (vis[v]) continue;
            // f = g + h, where g = actual distance, h = heuristic (min remaining edge)
            let h = Infinity;
            for (let w = 0; w < n; w++)
                if (!vis[w] && w !== v) h = Math.min(h, dm[v][w]);
            if (h === Infinity) h = dm[v][0];
            const f = dm[cur][v] + h * 0.5;
            if (f < bestScore) { bestScore = f; best = v; }
        }
        route.push(best); vis[best] = 1; cur = best;
    }
    route.push(0);
    return { route, length: calcRouteLength(route, dm), iterations: n * n };
}

/* ============ Bellman-Ford + NN ============ */
function solveBellmanFord(nodes, dm) {
    const n = nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    dist[0] = 0;
    let iters = 0;
    for (let i = 0; i < n - 1; i++) {
        let updated = false;
        for (let u = 0; u < n; u++) {
            if (dist[u] === Infinity) continue;
            for (let v = 0; v < n; v++) {
                if (u !== v && dist[u] + dm[u][v] < dist[v]) {
                    dist[v] = dist[u] + dm[u][v]; updated = true;
                }
            }
        }
        iters++;
        if (!updated) break;
    }
    return { ...solveGreedy(nodes, dm), iterations: iters + n };
}

/* ============ Branch & Bound (capped) ============ */
function solveBranchBound(nodes, dm) {
    const n = nodes.length;
    if (n > 18) { const r = solve2Opt(nodes, dm); r.iterations = -1; return r; }
    let bestLen = Infinity, bestRoute = null, iters = 0;
    const bound = (path, vis, len) => {
        let b = len;
        for (let i = 0; i < n; i++) {
            if (vis[i]) continue;
            let min = Infinity;
            for (let j = 0; j < n; j++) if (i !== j) min = Math.min(min, dm[i][j]);
            b += min;
        }
        return b;
    };
    const search = (path, vis, len) => {
        iters++;
        if (iters > 2e6) return;
        if (path.length === n) {
            const total = len + dm[path[path.length - 1]][0];
            if (total < bestLen) { bestLen = total; bestRoute = [...path, 0]; }
            return;
        }
        for (let v = 0; v < n; v++) {
            if (vis[v]) continue;
            const nl = len + dm[path[path.length - 1]][v];
            vis[v] = 1; path.push(v);
            if (bound(path, vis, nl) < bestLen) search(path, vis, nl);
            path.pop(); vis[v] = 0;
        }
    };
    const vis = new Uint8Array(n); vis[0] = 1;
    search([0], vis, 0);
    if (!bestRoute) { const r = solveGreedy(nodes, dm); return { ...r, iterations: iters }; }
    return { route: bestRoute, length: bestLen, iterations: iters };
}

/* ============ Held-Karp (capped) ============ */
function solveHeldKarp(nodes, dm) {
    const n = nodes.length;
    if (n > 20) { const r = solve2Opt(nodes, dm); r.iterations = -1; return r; }
    const full = (1 << n) - 1;
    const dp = Array.from({ length: 1 << n }, () => new Float64Array(n).fill(Infinity));
    const par = Array.from({ length: 1 << n }, () => new Int32Array(n).fill(-1));
    dp[1][0] = 0;
    let iters = 0;
    for (let mask = 0; mask <= full; mask++) {
        for (let u = 0; u < n; u++) {
            if (!(mask & (1 << u)) || dp[mask][u] === Infinity) continue;
            for (let v = 0; v < n; v++) {
                if (mask & (1 << v)) continue;
                iters++;
                const nm = mask | (1 << v), nd = dp[mask][u] + dm[u][v];
                if (nd < dp[nm][v]) { dp[nm][v] = nd; par[nm][v] = u; }
            }
        }
    }
    let bestEnd = -1, bestLen = Infinity;
    for (let u = 1; u < n; u++) {
        const t = dp[full][u] + dm[u][0];
        if (t < bestLen) { bestLen = t; bestEnd = u; }
    }
    const route = [0];
    let mask = full, cur = bestEnd;
    const rev = [bestEnd];
    while (par[mask][cur] !== -1 && par[mask][cur] !== 0) {
        const p = par[mask][cur]; rev.push(p); mask ^= (1 << cur); cur = p;
    }
    rev.reverse();
    return { route: [0, ...rev, 0], length: bestLen, iterations: iters };
}

/* ============ Registry ============ */
const ALGORITHMS = {
    greedy: solveGreedy, twoopt: solve2Opt, oropt: solveOrOpt,
    genetic: solveGenetic, annealing: solveAnnealing, antcolony: solveAntColony,
    savings: solveSavings, dijkstra: solveDijkstra, astar: solveAStar,
    bellmanford: solveBellmanFord, branchbound: solveBranchBound, heldkarp: solveHeldKarp
};

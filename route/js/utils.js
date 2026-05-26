/**
 * Qubibyte Route Simulator — Utilities
 * Seeded RNG, distance, road network, VRP, metadata
 */

class SeededRNG {
    constructor(seed) { this.state = seed | 0; }
    next() {
        let t = (this.state += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    nextInt(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
    nextFloat(min, max) { return this.next() * (max - min) + min; }
    shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
}

/* ============ Distance ============ */
function euclideanDist(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}
function manhattanDist(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function buildDistanceMatrix(nodes, metric, trafficVar, seed) {
    const n = nodes.length;
    const m = Array.from({ length: n }, () => new Float64Array(n));
    const distFn = metric === 'manhattan' ? manhattanDist : euclideanDist;
    const rng = new SeededRNG(seed + 7777);
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const baseDist = distFn(nodes[i], nodes[j]);
            if (trafficVar > 0) {
                const factor = trafficVar / 100;
                const noiseIJ = 1 + (rng.next() - 0.5) * factor;
                const noiseJI = 1 + (rng.next() - 0.5) * factor;
                m[i][j] = baseDist * Math.max(0.5, noiseIJ);
                m[j][i] = baseDist * Math.max(0.5, noiseJI);
            } else {
                m[i][j] = baseDist;
                m[j][i] = baseDist;
            }
        }
    }
    return m;
}

function calcRouteLength(route, dm) {
    let t = 0;
    for (let i = 0; i < route.length - 1; i++) t += dm[route[i]][route[i + 1]];
    return t;
}

function timedExecution(fn) {
    const s = performance.now();
    const result = fn();
    return { result, time: performance.now() - s };
}

/* ============ City Generation (Direct) ============ */
function generateCityDirect(numStops, cw, ch, seed) {
    const rng = new SeededRNG(seed);
    const pad = 50;
    const nodes = [];
    // Place depot roughly center-left
    nodes.push({
        id: 0,
        x: pad + rng.next() * (cw - pad * 2) * 0.2 + (cw - pad * 2) * 0.05,
        y: pad + rng.next() * (ch - pad * 2) * 0.3 + (ch - pad * 2) * 0.35,
        isDepot: true, label: 'Depot'
    });
    // Generate cluster centers
    const nc = Math.max(2, Math.floor(numStops / 8));
    const centers = [];
    for (let i = 0; i < nc; i++) {
        centers.push({ x: pad + rng.next() * (cw - pad * 2), y: pad + rng.next() * (ch - pad * 2) });
    }
    // Place stops around cluster centers
    for (let i = 1; i <= numStops; i++) {
        const c = centers[rng.nextInt(0, nc - 1)];
        const sp = Math.min(cw, ch) * 0.12;
        nodes.push({
            id: i,
            x: Math.max(pad, Math.min(cw - pad, c.x + (rng.next() - 0.5) * sp * 2)),
            y: Math.max(pad, Math.min(ch - pad, c.y + (rng.next() - 0.5) * sp * 2)),
            isDepot: false, label: `Stop ${i}`
        });
    }
    return { nodes, roads: null, intersections: null, adjList: null };
}

/* ============ Road Network Generation ============ */
function generateCityWithRoads(numStops, cw, ch, seed) {
    const rng = new SeededRNG(seed);
    const pad = 45;
    const w = cw - pad * 2, h = ch - pad * 2;
    const gs = Math.max(5, Math.ceil(Math.sqrt(numStops) * 1.2));
    const aspect = w / h;
    const cols = Math.max(4, Math.ceil(gs * Math.sqrt(aspect)));
    const rows = Math.max(3, Math.ceil(gs / Math.sqrt(aspect)));
    const cellW = w / cols, cellH = h / rows;
    const intersections = [];
    const grid = [];
    for (let r = 0; r <= rows; r++) {
        grid[r] = [];
        for (let c = 0; c <= cols; c++) {
            const id = intersections.length;
            intersections.push({
                id, x: pad + c * cellW + (rng.next() - 0.5) * cellW * 0.3,
                y: pad + r * cellH + (rng.next() - 0.5) * cellH * 0.3
            });
            grid[r][c] = id;
        }
    }
    const roads = [];
    const adjList = new Map();
    const addRoad = (a, b) => {
        const d = euclideanDist(intersections[a], intersections[b]);
        roads.push({ from: a, to: b, length: d });
        if (!adjList.has(a)) adjList.set(a, []);
        if (!adjList.has(b)) adjList.set(b, []);
        adjList.get(a).push({ to: b, length: d });
        adjList.get(b).push({ to: a, length: d });
    };
    for (let r = 0; r <= rows; r++)
        for (let c = 0; c < cols; c++)
            if (rng.next() > 0.1) addRoad(grid[r][c], grid[r][c + 1]);
    for (let r = 0; r < rows; r++)
        for (let c = 0; c <= cols; c++)
            if (rng.next() > 0.1) addRoad(grid[r][c], grid[r + 1][c]);
    // Ensure connectivity
    const visited = new Uint8Array(intersections.length);
    const comps = [];
    for (let i = 0; i < intersections.length; i++) {
        if (visited[i]) continue;
        const comp = [];
        const q = [i]; visited[i] = 1;
        while (q.length) {
            const u = q.shift(); comp.push(u);
            for (const { to } of (adjList.get(u) || []))
                if (!visited[to]) { visited[to] = 1; q.push(to); }
        }
        comps.push(comp);
    }
    for (let c = 1; c < comps.length; c++) {
        let bestD = Infinity, ba = -1, bb = -1;
        for (const a of comps[0]) for (const b of comps[c]) {
            const d = euclideanDist(intersections[a], intersections[b]);
            if (d < bestD) { bestD = d; ba = a; bb = b; }
        }
        if (ba >= 0) { addRoad(ba, bb); comps[0].push(...comps[c]); }
    }
    // Place stops at random intersections
    const avail = rng.shuffle(Array.from({ length: intersections.length }, (_, i) => i));
    const numPlace = Math.min(numStops + 1, intersections.length);
    const nodes = [];
    nodes.push({
        id: 0, x: intersections[avail[0]].x, y: intersections[avail[0]].y,
        isDepot: true, label: 'Depot', intId: avail[0]
    });
    for (let i = 1; i < numPlace; i++) {
        const inter = intersections[avail[i]];
        nodes.push({
            id: i, x: inter.x, y: inter.y,
            isDepot: false, label: `Stop ${i}`, intId: avail[i]
        });
    }
    return { nodes, roads, intersections, adjList };
}

/* ============ Road Pathfinding ============ */
function dijkstraRoad(source, adjList, numNodes) {
    const dist = new Float64Array(numNodes).fill(Infinity);
    const prev = new Int32Array(numNodes).fill(-1);
    const done = new Uint8Array(numNodes);
    dist[source] = 0;
    const pq = [[0, source]];
    while (pq.length) {
        pq.sort((a, b) => a[0] - b[0]);
        const [d, u] = pq.shift();
        if (done[u]) continue;
        done[u] = 1;
        for (const { to, length } of (adjList.get(u) || [])) {
            const nd = d + length;
            if (nd < dist[to]) { dist[to] = nd; prev[to] = u; pq.push([nd, to]); }
        }
    }
    return { dist, prev };
}

function buildRoadDistanceMatrix(nodes, adjList, numIntersections) {
    const n = nodes.length;
    const m = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) {
        const { dist } = dijkstraRoad(nodes[i].intId, adjList, numIntersections);
        for (let j = i + 1; j < n; j++) {
            const d = dist[nodes[j].intId];
            m[i][j] = d === Infinity ? euclideanDist(nodes[i], nodes[j]) * 2 : d;
            m[j][i] = m[i][j];
        }
    }
    return m;
}

function getRoadPath(fromIntId, toIntId, adjList, numIntersections, intersections) {
    const { prev } = dijkstraRoad(fromIntId, adjList, numIntersections);
    const path = [];
    let cur = toIntId;
    while (cur !== -1) {
        path.unshift(intersections[cur]);
        if (cur === fromIntId) break;
        cur = prev[cur];
    }
    return path.length > 0 && path[0].id === fromIntId ? path : null;
}

/* ============ VRP Splitting (Sweep) ============ */
function splitVRP(nodes, numVehicles, distMatrix) {
    if (numVehicles <= 1) return [nodes.map(n => n.id)];
    const depot = nodes[0];
    const stops = nodes.slice(1);
    stops.sort((a, b) => {
        const aa = Math.atan2(a.y - depot.y, a.x - depot.x);
        const ab = Math.atan2(b.y - depot.y, b.x - depot.x);
        return aa - ab;
    });
    const perVehicle = Math.ceil(stops.length / numVehicles);
    const clusters = [];
    for (let v = 0; v < numVehicles; v++) {
        const start = v * perVehicle;
        const end = Math.min(start + perVehicle, stops.length);
        if (start >= stops.length) break;
        clusters.push(stops.slice(start, end).map(s => s.id));
    }
    return clusters;
}

/* ============ Algorithm Metadata ============ */
const ALGORITHM_META = {
    greedy: { name: 'Greedy NN', color: '#f97316', timeComplexity: 'O(N²)', spaceComplexity: 'O(N)', type: 'classical', description: 'Always visit nearest unvisited neighbor.' },
    twoopt: { name: '2-Opt', color: '#a78bfa', timeComplexity: 'O(N² / pass)', spaceComplexity: 'O(N)', type: 'classical', description: 'Reverse segments to eliminate crossings.' },
    oropt: { name: 'Or-Opt', color: '#22d3ee', timeComplexity: 'O(N² / pass)', spaceComplexity: 'O(N)', type: 'classical', description: 'Move subsequences of 1-3 cities for better routes.' },
    genetic: { name: 'Genetic (TSP)', color: '#fb7185', timeComplexity: 'O(G·P·N)', spaceComplexity: 'O(P·N)', type: 'classical', description: 'Evolutionary crossover, mutation, selection.' },
    annealing: { name: 'Simulated Annealing', color: '#2dd4bf', timeComplexity: 'O(I·N)', spaceComplexity: 'O(N)', type: 'classical', description: 'Probabilistic metallurgical-inspired optimization.' },
    antcolony: { name: 'Ant Colony', color: '#84cc16', timeComplexity: 'O(A·N²·I)', spaceComplexity: 'O(N²)', type: 'classical', description: 'Pheromone-guided swarm intelligence.' },
    savings: { name: 'Clarke-Wright', color: '#f59e0b', timeComplexity: 'O(N² log N)', spaceComplexity: 'O(N²)', type: 'classical', description: 'Merge routes by savings metric — ideal for VRP.' },
    dijkstra: { name: 'Dijkstra + NN', color: '#38bdf8', timeComplexity: 'O(V² log V)', spaceComplexity: 'O(V)', type: 'classical', description: 'Shortest-path tree then nearest-neighbor tour.' },
    astar: { name: 'A* + NN', color: '#34d399', timeComplexity: 'O(E log V)', spaceComplexity: 'O(V)', type: 'classical', description: 'Heuristic-guided search then NN tour.' },
    bellmanford: { name: 'Bellman-Ford + NN', color: '#fbbf24', timeComplexity: 'O(VE)', spaceComplexity: 'O(V)', type: 'classical', description: 'DP shortest paths, handles negative weights.' },
    branchbound: { name: 'Branch & Bound', color: '#e879f9', timeComplexity: 'O(N!)', spaceComplexity: 'O(N²)', type: 'advanced', description: 'Exact solver pruning suboptimal branches.' },
    heldkarp: { name: 'Held-Karp (DP)', color: '#67e8f9', timeComplexity: 'O(2ᴺ·N²)', spaceComplexity: 'O(2ᴺ·N)', type: 'advanced', description: 'Exact TSP using bitmask DP subsets.' },
    qaoa: { name: 'QAOA', color: '#c084fc', timeComplexity: 'O(p·N²)', spaceComplexity: 'O(N)', type: 'quantum', description: 'Quantum approximate optimization using variational circuits.' },
    grover: { name: 'Grover Search', color: '#818cf8', timeComplexity: 'O(√N!)', spaceComplexity: 'O(N)', type: 'quantum', description: 'Quantum amplitude amplification for route search.' },
    qannealing: { name: 'Quantum Annealing', color: '#f0abfc', timeComplexity: 'O(poly(N))', spaceComplexity: 'O(N²)', type: 'quantum', description: 'Quantum tunneling optimization simulation.' },
    vqe: { name: 'VQE Router', color: '#06b6d4', timeComplexity: 'O(p·N²)', spaceComplexity: 'O(N)', type: 'quantum', description: 'Variational Quantum Eigensolver for route Hamiltonians.' },
    qwalk: { name: 'Quantum Walk', color: '#8b5cf6', timeComplexity: 'O(√N)', spaceComplexity: 'O(N)', type: 'quantum', description: 'Continuous-time quantum walk on solution graphs.' },
    qgenetic: { name: 'Quantum Genetic', color: '#ec4899', timeComplexity: 'O(√G·P·N)', spaceComplexity: 'O(P·N)', type: 'quantum', description: 'Quantum-enhanced evolutionary crossover with Grover selection.' }
};

/**
 * Qubibyte Route Simulator — Algorithm Explorer (Learn Modal)
 * Animated visualizations showing how each algorithm works
 */
(function () {
    'use strict';

    const ALGO_INFO = {
        dijkstra: {
            name: 'Dijkstra + NN', time: 'O(V² log V)', space: 'O(V)', optimal: false,
            desc: 'Computes single-source shortest paths using a priority queue, then builds a tour by greedily visiting the nearest unvisited node. Guarantees optimal individual path segments but not optimal overall tour.',
            animate: 'expandTree'
        },
        astar: {
            name: 'A* + NN', time: 'O(E log V)', space: 'O(V)', optimal: false,
            desc: 'Uses a heuristic (estimated remaining distance) to guide the shortest-path search, making it faster than Dijkstra for targeted queries. The nearest-neighbor tour uses f(n) = g(n) + h(n) cost evaluation.',
            animate: 'expandTree'
        },
        greedy: {
            name: 'Greedy NN', time: 'O(N²)', space: 'O(N)', optimal: false,
            desc: 'The simplest TSP heuristic: always visit the closest unvisited city. Fast but can produce poor results — the ratio to optimal can be as bad as O(log N). Works well as a starting solution for improvement methods.',
            animate: 'greedy'
        },
        twoopt: {
            name: '2-Opt', time: 'O(N² / pass)', space: 'O(N)', optimal: false,
            desc: 'Iterative local search that removes two edges and reconnects the tour in the only other possible way. Eliminates route crossings. Repeats until no improving 2-opt swap exists. Typically improves greedy tours by 15-25%.',
            animate: 'twoopt'
        },
        oropt: {
            name: 'Or-Opt', time: 'O(N² / pass)', space: 'O(N)', optimal: false,
            desc: 'Moves subsequences of 1, 2, or 3 consecutive cities to a better position in the tour. Complementary to 2-Opt — finds improvements that edge swaps miss. Often combined with 2-Opt for best results.',
            animate: 'oropt'
        },
        savings: {
            name: 'Clarke-Wright', time: 'O(N² log N)', space: 'O(N²)', optimal: false,
            desc: 'Designed for the Vehicle Routing Problem. Starts with individual depot-to-customer routes, then merges them based on "savings" s(i,j) = d(0,i) + d(0,j) - d(i,j). Routes with the greatest savings are merged first.',
            animate: 'merge'
        },
        genetic: {
            name: 'Genetic Algorithm', time: 'O(G·P·N)', space: 'O(P·N)', optimal: false,
            desc: 'Evolutionary metaheuristic that maintains a population of tour solutions. Uses ordered crossover (OX) to combine parent tours, random swap mutation, and tournament selection. Elitism preserves the best solutions across generations.',
            animate: 'genetic'
        },
        annealing: {
            name: 'Simulated Annealing', time: 'O(I·N)', space: 'O(N)', optimal: false,
            desc: 'Inspired by metallurgical annealing. Accepts worse solutions with probability e^(-Δ/T), where T decreases over time. This allows escaping local optima early on, while converging to a good solution as the temperature "cools".',
            animate: 'annealing'
        },
        antcolony: {
            name: 'Ant Colony Optimization', time: 'O(A·N²·I)', space: 'O(N²)', optimal: false,
            desc: 'Swarm intelligence inspired by ant foraging behavior. Artificial ants deposit pheromone on good routes. Over iterations, pheromone trails reinforce shorter paths through positive feedback, while evaporation prevents stagnation.',
            animate: 'antcolony'
        },
        branchbound: {
            name: 'Branch & Bound', time: 'O(N!)', space: 'O(N²)', optimal: true,
            desc: 'Exact solver that systematically explores the solution tree, pruning branches whose lower bound exceeds the best known solution. For small instances (≤18 cities), finds the provably optimal tour.',
            animate: 'tree'
        },
        heldkarp: {
            name: 'Held-Karp (DP)', time: 'O(2ᴺ·N²)', space: 'O(2ᴺ·N)', optimal: true,
            desc: 'Dynamic programming approach using bitmask subsets. Computes optimal tours through all subsets of cities. The first algorithm to solve TSP in better than O(N!) time. Practical for up to ~20 cities.',
            animate: 'dp'
        },
        qaoa: {
            name: 'QAOA Simulator', time: 'O(p·N²)', space: 'O(N)', optimal: false,
            desc: 'Quantum Approximate Optimization Algorithm: alternates between a problem Hamiltonian (encoding route costs) and a mixing Hamiltonian (exploring superpositions). Variational parameters γ and β are optimized classically.',
            animate: 'quantum'
        },
        grover: {
            name: 'Grover Search', time: 'O(√N!)', space: 'O(N)', optimal: true,
            desc: 'Quantum search algorithm providing quadratic speedup over brute force. Uses amplitude amplification to boost the probability of measuring optimal solutions. Requires O(√N!) iterations vs O(N!) classical.',
            animate: 'quantum'
        },
        qannealing: {
            name: 'Quantum Annealing', time: 'O(poly(N))', space: 'O(N²)', optimal: false,
            desc: 'Encodes the TSP as a QUBO (Quadratic Unconstrained Binary Optimization) problem. Quantum tunneling allows the system to pass through energy barriers that trap classical annealing, potentially finding global optima faster.',
            animate: 'quantum'
        },
        vqe: {
            name: 'VQE Router', time: 'O(p·N²)', space: 'O(N)', optimal: false,
            desc: 'Variational Quantum Eigensolver applied to route optimization. Uses a parameterized quantum circuit (ansatz) to prepare candidate solutions, with classical SPSA optimizer updating rotation angles. The ground state of the cost Hamiltonian encodes the optimal tour.',
            animate: 'quantum'
        },
        qwalk: {
            name: 'Quantum Walk', time: 'O(√N)', space: 'O(N)', optimal: false,
            desc: 'Continuous-time quantum walk on the solution graph. Multiple quantum walkers explore the solution space simultaneously, with constructive interference amplifying paths toward better solutions. Coin and shift operators control walk direction.',
            animate: 'quantum'
        },
        qgenetic: {
            name: 'Quantum Genetic', time: 'O(√G·P·N)', space: 'O(P·N)', optimal: false,
            desc: 'Quantum-enhanced genetic algorithm combining Grover-inspired selection (quadratic speedup in finding fit individuals) with quantum crossover that uses rotation gates to probabilistically inherit genes from parents in superposition.',
            animate: 'genetic'
        }
    };

    // Fixed demo nodes for animation
    const DEMO_NODES = [
        { x: 170, y: 30 }, { x: 290, y: 60 }, { x: 310, y: 150 },
        { x: 240, y: 200 }, { x: 120, y: 190 }, { x: 50, y: 120 },
        { x: 100, y: 55 }, { x: 200, y: 120 }
    ];

    let animFrame = null;
    let currentAlgo = 'dijkstra';

    function startExplorerAnim(algoKey) {
        if (animFrame) cancelAnimationFrame(animFrame);
        currentAlgo = algoKey;
        const canvas = document.getElementById('algoExploreCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = 340 * dpr;
        canvas.height = 220 * dpr;
        canvas.style.width = '340px';
        canvas.style.height = '220px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const info = ALGO_INFO[algoKey];
        const startT = performance.now();
        const dur = 4000;

        function animate(t) {
            const elapsed = t - startT;
            const prog = Math.min(1, elapsed / dur);
            renderAlgoDemo(ctx, 340, 220, algoKey, info, prog, elapsed);
            if (prog < 1) {
                animFrame = requestAnimationFrame(animate);
            } else {
                // Loop
                setTimeout(() => {
                    if (currentAlgo === algoKey) startExplorerAnim(algoKey);
                }, 1500);
            }
        }
        animFrame = requestAnimationFrame(animate);
    }

    function renderAlgoDemo(ctx, w, h, key, info, prog, time) {
        const tc = window.QubibyteSubpageColors?.get?.() || {};
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = tc.bg || '#0a0a1a';
        ctx.fillRect(0, 0, w, h);

        // Draw faint grid
        ctx.strokeStyle = tc.grid || 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

        const nodes = DEMO_NODES;
        const n = nodes.length;
        const color = ALGORITHM_META[key]?.color || '#38bdf8';

        // Build simple greedy order for animation
        const visited = [0];
        const remaining = Array.from({ length: n - 1 }, (_, i) => i + 1);
        while (remaining.length > 0) {
            const cur = visited[visited.length - 1];
            let bestIdx = 0, bestD = Infinity;
            for (let i = 0; i < remaining.length; i++) {
                const d = Math.hypot(nodes[cur].x - nodes[remaining[i]].x, nodes[cur].y - nodes[remaining[i]].y);
                if (d < bestD) { bestD = d; bestIdx = i; }
            }
            visited.push(remaining.splice(bestIdx, 1)[0]);
        }
        visited.push(0);

        const type = info.animate;
        const edgesVisible = Math.floor(prog * (visited.length - 1));
        const partialProg = prog * (visited.length - 1) - edgesVisible;

        // Draw based on type
        if (type === 'greedy' || type === 'expandTree') {
            // Progressively draw route
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            for (let i = 0; i <= edgesVisible && i < visited.length; i++) {
                const nd = nodes[visited[i]];
                i === 0 ? ctx.moveTo(nd.x, nd.y) : ctx.lineTo(nd.x, nd.y);
            }
            if (edgesVisible < visited.length - 1 && partialProg > 0) {
                const f = nodes[visited[edgesVisible]], t = nodes[visited[edgesVisible + 1]];
                ctx.lineTo(f.x + (t.x - f.x) * partialProg, f.y + (t.y - f.y) * partialProg);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Draw "expanding frontier" for dijkstra/astar
            if (type === 'expandTree' && prog < 0.7) {
                const radius = prog * 200;
                const depot = nodes[0];
                ctx.beginPath();
                ctx.arc(depot.x, depot.y, radius, 0, Math.PI * 2);
                ctx.strokeStyle = color + '20';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        } else if (type === 'twoopt') {
            // Draw full route, then show a swap animation
            ctx.strokeStyle = color + '40';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = 0; i < visited.length; i++) {
                const nd = nodes[visited[i]];
                i === 0 ? ctx.moveTo(nd.x, nd.y) : ctx.lineTo(nd.x, nd.y);
            }
            ctx.stroke();

            // Highlight swap segment
            const swapPhase = (prog * 3) % 1;
            const swapIdx = Math.floor(prog * 3) % 3;
            const si = 1 + swapIdx * 2, ei = Math.min(si + 2, visited.length - 2);
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.5 + swapPhase * 0.5;
            ctx.beginPath();
            for (let i = si; i <= ei; i++) {
                const nd = nodes[visited[i]];
                i === si ? ctx.moveTo(nd.x, nd.y) : ctx.lineTo(nd.x, nd.y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Draw improved route fading in
            if (prog > 0.5) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.globalAlpha = (prog - 0.5) * 2;
                ctx.beginPath();
                for (let i = 0; i < visited.length; i++) {
                    const nd = nodes[visited[i]];
                    i === 0 ? ctx.moveTo(nd.x, nd.y) : ctx.lineTo(nd.x, nd.y);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        } else if (type === 'genetic' || type === 'annealing') {
            // Show multiple semi-transparent routes converging
            const numGhosts = 5;
            for (let g = 0; g < numGhosts; g++) {
                const offset = (1 - prog) * 30 * (g % 2 === 0 ? 1 : -1);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.15;
                ctx.beginPath();
                for (let i = 0; i < visited.length; i++) {
                    const nd = nodes[visited[i]];
                    const ox = Math.sin(g * 2 + i) * offset;
                    const oy = Math.cos(g * 3 + i) * offset;
                    i === 0 ? ctx.moveTo(nd.x + ox, nd.y + oy) : ctx.lineTo(nd.x + ox, nd.y + oy);
                }
                ctx.stroke();
            }
            // Best route fading in
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = prog;
            ctx.beginPath();
            for (let i = 0; i < visited.length; i++) {
                const nd = nodes[visited[i]];
                i === 0 ? ctx.moveTo(nd.x, nd.y) : ctx.lineTo(nd.x, nd.y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        } else if (type === 'antcolony') {
            // Pheromone trails getting thicker
            for (let i = 0; i < visited.length - 1; i++) {
                const f = nodes[visited[i]], t = nodes[visited[i + 1]];
                const strength = Math.min(1, prog * 2 - i * 0.1);
                if (strength <= 0) continue;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1 + strength * 3;
                ctx.globalAlpha = 0.2 + strength * 0.6;
                ctx.beginPath();
                ctx.moveTo(f.x, f.y);
                ctx.lineTo(t.x, t.y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        } else if (type === 'merge') {
            // Show individual routes merging
            const mergePhase = prog;
            if (mergePhase < 0.4) {
                // Individual depot routes
                for (let i = 1; i < n; i++) {
                    ctx.strokeStyle = color + '60';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(nodes[0].x, nodes[0].y);
                    ctx.lineTo(nodes[i].x, nodes[i].y);
                    ctx.stroke();
                }
            } else {
                const mp = (mergePhase - 0.4) / 0.6;
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.globalAlpha = mp;
                ctx.beginPath();
                for (let i = 0; i < visited.length; i++) {
                    const nd = nodes[visited[i]];
                    i === 0 ? ctx.moveTo(nd.x, nd.y) : ctx.lineTo(nd.x, nd.y);
                }
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        } else if (type === 'tree' || type === 'dp') {
            // Branch exploration
            const numPaths = Math.floor(prog * 6) + 1;
            for (let p = 0; p < numPaths; p++) {
                const alpha = p === numPaths - 1 ? 0.8 : 0.1;
                ctx.strokeStyle = p === numPaths - 1 ? color : '#ffffff';
                ctx.lineWidth = p === numPaths - 1 ? 2.5 : 1;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                // Different permutation per path
                const order = [0];
                const rem = Array.from({ length: n - 1 }, (_, i) => i + 1);
                for (let i = 0; i < rem.length; i++) {
                    const idx = (i + p * 3) % rem.length;
                    order.push(rem[idx]);
                }
                order.push(0);
                for (let i = 0; i < order.length; i++) {
                    const nd = nodes[order[i] % n];
                    i === 0 ? ctx.moveTo(nd.x, nd.y) : ctx.lineTo(nd.x, nd.y);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        } else if (type === 'quantum') {
            // Superposition effect - many routes shown simultaneously
            const numSuper = 8;
            for (let s = 0; s < numSuper; s++) {
                const phase = (time * 0.002 + s * 0.8) % (Math.PI * 2);
                const alpha = 0.08 + Math.abs(Math.sin(phase)) * 0.15;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                const order = [0];
                const rem = Array.from({ length: n - 1 }, (_, i) => i + 1);
                for (let i = rem.length - 1; i > 0; i--) {
                    const j = (i + s * 3 + Math.floor(Math.sin(phase + i) * 2 + 2)) % (i + 1);
                    [rem[i], rem[j]] = [rem[j], rem[i]];
                }
                order.push(...rem, 0);
                for (let i = 0; i < order.length; i++) {
                    const nd = nodes[order[i]];
                    i === 0 ? ctx.moveTo(nd.x, nd.y) : ctx.lineTo(nd.x, nd.y);
                }
                ctx.stroke();
            }
            // Collapse to best
            if (prog > 0.6) {
                const cp = (prog - 0.6) / 0.4;
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.globalAlpha = cp;
                ctx.beginPath();
                for (let i = 0; i < visited.length; i++) {
                    const nd = nodes[visited[i]];
                    i === 0 ? ctx.moveTo(nd.x, nd.y) : ctx.lineTo(nd.x, nd.y);
                }
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        } else {
            // Default: progressive route draw
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            for (let i = 0; i <= edgesVisible && i < visited.length; i++) {
                const nd = nodes[visited[i]];
                i === 0 ? ctx.moveTo(nd.x, nd.y) : ctx.lineTo(nd.x, nd.y);
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Draw nodes on top
        for (let i = 0; i < n; i++) {
            const nd = nodes[i];
            if (i === 0) {
                ctx.beginPath();
                ctx.arc(nd.x, nd.y, 8, 0, Math.PI * 2);
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(nd.x, nd.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.fillStyle = tc.bg || '#0a0a1a';
                ctx.font = 'bold 6px Inter';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('D', nd.x, nd.y + 0.5);
            } else {
                ctx.beginPath();
                ctx.arc(nd.x, nd.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(148,163,184,0.7)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }
    }

    function initExplorer() {
        const list = document.getElementById('algoExplorerList');
        if (!list) return;

        list.addEventListener('click', (e) => {
            const btn = e.target.closest('.algo-explore-btn');
            if (!btn) return;
            const key = btn.dataset.explore;
            const info = ALGO_INFO[key];
            if (!info) return;

            // Update active state
            list.querySelectorAll('.algo-explore-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update info
            document.getElementById('algoExploreName').textContent = info.name;
            document.getElementById('algoExploreTime').textContent = info.time;
            document.getElementById('algoExploreSpace').textContent = info.space;
            document.getElementById('algoExploreOptimal').textContent = info.optimal ? '✓ Optimal' : 'Not Optimal';
            document.getElementById('algoExploreOptimal').classList.toggle('optimal-yes', info.optimal);
            document.getElementById('algoExploreDesc').textContent = info.desc;

            startExplorerAnim(key);
        });

        // Start default animation
        startExplorerAnim('dijkstra');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initExplorer);
    } else {
        initExplorer();
    }
})();

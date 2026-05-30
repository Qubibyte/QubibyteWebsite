/**
 * Qubibyte Route Simulator — Main Application Controller
 */
(function () {
    'use strict';

    const state = {
        cityData: null,
        distMatrix: null,
        results: [],
        vehicleRoutes: [],
        quantumMode: false,
        isRunning: false,
        quantumData: null
    };

    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    let renderer, chartRouteLength, chartComputeTime, chartConvergence, chartProbDist;
    let blochAnimFrame = null;

    /* ============ Init ============ */
    function init() {
        renderer = new MapRenderer($('#mapCanvas'));
        chartRouteLength = new SimpleChart($('#chartRouteLength'), 'bar');
        chartComputeTime = new SimpleChart($('#chartComputeTime'), 'bar');
        chartConvergence = new SimpleChart($('#chartConvergence'), 'line');
        chartProbDist = new SimpleChart($('#chartProbDist'), 'bar');

        wireSliders();
        wireButtons();
        wirePanelTabs();
        wireModal();
        wireRealtimeRecalc();
        $$('#algoList input[type="checkbox"]').forEach(cb => cb.addEventListener('change', updateMetrics));
        initQuantumMode();
        updateMetrics();
        setTimeout(doGenerate, 200);
    }

    /* ============ Slider wiring ============ */
    function wireSliders() {
        const bind = (id, dispId, suf = '') => {
            const s = $(`#${id}`), d = $(`#${dispId}`);
            if (s && d) s.addEventListener('input', () => d.textContent = s.value + suf);
        };
        bind('numStops', 'numStopsVal');
        bind('numVehicles', 'numVehiclesVal');
        bind('simSpeed', 'simSpeedVal', 'x');
        bind('trafficVar', 'trafficVarVal', '%');
    }

    /* ============ Buttons ============ */
    function wireButtons() {
        $('#btnGenerate').addEventListener('click', doGenerate);
        $('#btnRun').addEventListener('click', runSimulation);
        $('#btnClear').addEventListener('click', clearAll);
        $('#btnLearn').addEventListener('click', () => $('#learnModal').classList.add('active'));
        $('#btnShowAll').addEventListener('click', () => setAllRoutesVisible(true));
        $('#btnHideAll').addEventListener('click', () => setAllRoutesVisible(false));

        // Select All Algorithms button
        const btnSelectAll = $('#btnSelectAll');
        if (btnSelectAll) {
            btnSelectAll.addEventListener('click', () => {
                $$('#algoList input[type="checkbox"]').forEach(cb => {
                    // Only enable visible algorithms
                    if (cb.closest('.algo-category')?.style.display !== 'none') {
                        cb.checked = true;
                    }
                });
                updateMetrics();
            });
        }
    }

    /* ============ Panel Tabs ============ */
    function wirePanelTabs() {
        $$('.panel-tab').forEach(tab => tab.addEventListener('click', () => {
            const t = tab.dataset.tab;
            $$('.panel-tab').forEach(t => t.classList.remove('active'));
            $$('.panel-content').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            $(`[data-panel="${t}"]`).classList.add('active');
            if (t === 'chart') setTimeout(() => {
                chartRouteLength?.setSize();
                chartComputeTime?.setSize();
                chartConvergence?.setSize();
            }, 50);
        }));
    }

    /* ============ Modal ============ */
    function wireModal() {
        $('#modalClose').addEventListener('click', () => $('#learnModal').classList.remove('active'));
        $('#learnModal').addEventListener('click', e => { if (e.target === $('#learnModal')) $('#learnModal').classList.remove('active'); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#learnModal').classList.remove('active'); });
    }

    /* ============ Real-time Recalc ============ */
    function wireRealtimeRecalc() {
        const inputs = ['numStops', 'numVehicles', 'simSpeed', 'distMetric', 'trafficVar', 'randomSeed', 'routeMode'];
        let debounceTimer = null;
        inputs.forEach(id => {
            const el = $(`#${id}`);
            if (el) el.addEventListener('change', () => {
                if ($('#chkRealtime')?.checked && state.cityData) {
                    clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => runSimulation(), 300);
                }
            });
        });
    }

    /* ============ Generate City ============ */
    function doGenerate() {
        const numStops = parseInt($('#numStops').value);
        const seedInput = $('#randomSeed');
        const randomToggle = $('#chkRandomSeed');
        let seed;
        if (randomToggle && randomToggle.checked) {
            seed = Math.floor(Math.random() * 99999);
            seedInput.value = seed;
        } else {
            seed = parseInt(seedInput.value) || 42;
        }
        const useRoads = $('#routeMode').value === 'roads';
        const w = renderer.width, h = renderer.height;

        let cityData;
        if (useRoads) {
            cityData = generateCityWithRoads(numStops, w, h, seed);
        } else {
            cityData = generateCityDirect(numStops, w, h, seed);
        }
        state.cityData = cityData;
        state.results = [];
        state.vehicleRoutes = [];
        state.distMatrix = null;
        state.quantumData = null;

        renderer.setCity(cityData);

        $('#mapNodeCount').textContent = `${cityData.nodes.length} nodes`;
        const edges = cityData.roads ? cityData.roads.length : (cityData.nodes.length * (cityData.nodes.length - 1) / 2);
        $('#mapEdgeCount').textContent = `${edges} edges`;

        // Depot label
        const depot = cityData.nodes[0];
        const dl = $('#depotLabel');
        if (depot) {
            dl.style.display = 'flex';
            dl.style.left = (depot.x + 18) + 'px';
            dl.style.top = (depot.y - 12) + 'px';
        } else { dl.style.display = 'none'; }

        clearResultsUI();
        updateMetrics();
        setStatus('ready', `${cityData.nodes.length} nodes generated`);
    }

    /* ============ Run Simulation ============ */
    async function runSimulation() {
        if (state.isRunning) return;
        if (!state.cityData || state.cityData.nodes.length < 3) { doGenerate(); return; }
        state.isRunning = true;
        setStatus('running', 'Preparing...');

        // Disable buttons during run
        const btnRun = $('#btnRun');
        const btnGen = $('#btnGenerate');
        btnRun.disabled = true;
        btnGen.disabled = true;
        btnRun.classList.add('btn-loading');

        const selected = [];
        $$('#algoList input[type="checkbox"]:checked').forEach(cb => selected.push(cb.dataset.algo));
        if (!selected.length) {
            setStatus('ready', 'No algorithms selected');
            state.isRunning = false;
            btnRun.disabled = false;
            btnGen.disabled = false;
            btnRun.classList.remove('btn-loading');
            return;
        }

        const nodes = state.cityData.nodes;
        const metric = $('#distMetric').value;
        const trafficVar = parseInt($('#trafficVar').value);
        const seed = parseInt($('#randomSeed').value) || 42;
        const numVehicles = parseInt($('#numVehicles').value);
        const useRoads = $('#routeMode').value === 'roads';
        const timeConstrained = $('#chkTimeConstraints')?.checked;

        // Build distance matrix
        setStatus('running', 'Building distance matrix...');
        await sleep(10);
        if (useRoads && state.cityData.adjList) {
            state.distMatrix = buildRoadDistanceMatrix(nodes, state.cityData.adjList, state.cityData.intersections.length);
        } else {
            state.distMatrix = buildDistanceMatrix(nodes, metric, trafficVar, seed);
        }
        const dm = state.distMatrix;

        renderer.animSpeed = parseInt($('#simSpeed').value);

        state.results = [];
        state.vehicleRoutes = [];
        state.quantumData = null;

        let completedCount = 0;
        const totalCount = selected.length;

        for (const algoKey of selected) {
            const meta = ALGORITHM_META[algoKey];
            if (!meta) continue;
            completedCount++;
            setStatus('running', `Running ${meta.name} (${completedCount}/${totalCount})...`);
            await sleep(15);

            // Determine which solver to use
            const isQuantum = QUANTUM_ALGORITHMS.hasOwnProperty(algoKey);
            const solver = isQuantum ? QUANTUM_ALGORITHMS[algoKey] : ALGORITHMS[algoKey];
            if (!solver) continue;

            // VRP: split into vehicle clusters
            if (numVehicles > 1) {
                const clusters = splitVRP(nodes, numVehicles, dm);
                let totalLen = 0, totalTime = 0, allIters = 0;
                const allConv = [];
                const vehicleResults = [];

                for (let v = 0; v < clusters.length; v++) {
                    const cluster = clusters[v];
                    const subIndices = [0, ...cluster];
                    const subNodes = subIndices.map(i => nodes[i]);
                    const subDM = Array.from({ length: subIndices.length }, (_, i) =>
                        new Float64Array(subIndices.length).map((_, j) => dm[subIndices[i]][subIndices[j]])
                    );
                    let result, time;
                    try {
                        const exec = timedExecution(() => solver(subNodes, subDM));
                        result = exec.result; time = exec.time;
                    } catch (err) {
                        console.error(`VRP ${algoKey} V${v} failed:`, err);
                        result = { route: [0, ...Array.from({ length: subNodes.length - 1 }, (_, i) => i + 1), 0], length: 0, iterations: 0 };
                        result.length = calcRouteLength(result.route, subDM);
                        time = 0;
                    }
                    const mappedRoute = (result.route || []).map(i => {
                        if (i >= 0 && i < subIndices.length) return subIndices[i];
                        return 0;
                    });
                    if (mappedRoute.length > 0 && mappedRoute[0] !== 0) mappedRoute[0] = 0;
                    if (mappedRoute.length > 1 && mappedRoute[mappedRoute.length - 1] !== 0) mappedRoute.push(0);
                    let routeLen = 0;
                    for (let k = 0; k < mappedRoute.length - 1; k++) {
                        const fromIdx = mappedRoute[k], toIdx = mappedRoute[k + 1];
                        if (dm[fromIdx] && dm[fromIdx][toIdx] !== undefined) {
                            routeLen += dm[fromIdx][toIdx];
                        }
                    }

                    if (timeConstrained) {
                        const avgDist = routeLen / mappedRoute.length;
                        const maxLen = avgDist * Math.min(mappedRoute.length, 20);
                        if (routeLen > maxLen * 1.5) {
                            const trimmed = [mappedRoute[0]];
                            let cumLen = 0;
                            for (let k = 1; k < mappedRoute.length - 1; k++) {
                                cumLen += dm[trimmed[trimmed.length - 1]][mappedRoute[k]];
                                if (cumLen + dm[mappedRoute[k]][0] > maxLen) break;
                                trimmed.push(mappedRoute[k]);
                            }
                            trimmed.push(0);
                            routeLen = calcRouteLength(trimmed, dm);
                            vehicleResults.push({ route: trimmed, length: routeLen });
                        } else {
                            vehicleResults.push({ route: mappedRoute, length: routeLen });
                        }
                    } else {
                        vehicleResults.push({ route: mappedRoute, length: routeLen });
                    }
                    totalLen += vehicleResults[vehicleResults.length - 1].length;
                    totalTime += time;
                    allIters += (result.iterations || 0);
                    if (result.convergence) allConv.push(...result.convergence);
                    if (result.quantum) state.quantumData = result.quantum;
                }

                for (let v = 0; v < vehicleResults.length; v++) {
                    const hue = adjustHue(meta.color, v * 40);
                    state.vehicleRoutes.push({
                        algoKey, vehicleIdx: v,
                        route: vehicleResults[v].route,
                        length: vehicleResults[v].length,
                        color: hue, visible: true,
                        name: `${meta.name} V${v + 1}`
                    });
                }

                state.results.push({
                    key: algoKey, meta,
                    route: vehicleResults[0].route,
                    length: totalLen, time: totalTime,
                    iterations: allIters,
                    convergence: allConv.length > 2 ? allConv : undefined,
                    vehicles: vehicleResults
                });
            } else {
                // Single vehicle
                try {
                    const { result, time } = timedExecution(() => solver(nodes, dm));
                    if (result.quantum) state.quantumData = result.quantum;
                    const route = result.route || [0, ...Array.from({ length: nodes.length - 1 }, (_, i) => i + 1), 0];
                    const length = isFinite(result.length) ? result.length : calcRouteLength(route, dm);
                    state.results.push({ key: algoKey, meta, ...result, route, length, time });
                    state.vehicleRoutes.push({
                        algoKey, vehicleIdx: 0,
                        route, length,
                        color: meta.color, visible: true,
                        name: meta.name
                    });
                } catch (err) {
                    console.error(`Algorithm ${algoKey} failed:`, err);
                    const fallbackRoute = [0, ...Array.from({ length: nodes.length - 1 }, (_, i) => i + 1), 0];
                    const fallbackLen = calcRouteLength(fallbackRoute, dm);
                    state.results.push({
                        key: algoKey, meta,
                        route: fallbackRoute, length: fallbackLen, time: 0,
                        iterations: 0, error: true
                    });
                    state.vehicleRoutes.push({
                        algoKey, vehicleIdx: 0,
                        route: fallbackRoute, length: fallbackLen,
                        color: meta.color, visible: true,
                        name: `${meta.name} (err)`
                    });
                }
            }
        }

        state.results.sort((a, b) => a.length - b.length || a.time - b.time);
        displayResults();
        displayRoutes();
        updateCharts();
        updateMetrics();
        if (state.quantumMode && state.quantumData) updateQuantumPanel();

        state.isRunning = false;
        btnRun.disabled = false;
        btnGen.disabled = false;
        btnRun.classList.remove('btn-loading');
        setStatus('ready', `${state.results.length} algorithms completed`);
    }

    /* ============ Display Results ============ */
    function displayResults() {
        const empty = $('#resultsEmpty'), list = $('#resultsList'), actions = $('#resultsActions');
        empty.style.display = 'none';
        list.style.display = 'block';
        actions.style.display = 'flex';
        list.innerHTML = '';
        const best = state.results.length > 0 ? state.results[0].length : 1;
        state.results.forEach((r, idx) => {
            const opt = ((best / r.length) * 100).toFixed(1);
            const item = document.createElement('div');
            item.className = 'result-item' + (idx === 0 ? ' best' : '') + (r.error ? ' error' : '');
            item.style.setProperty('--result-color', r.meta.color);

            // Determine algorithm type badge
            const isQuantum = r.meta.type === 'quantum';
            const typeBadge = isQuantum ? '<span class="result-type-badge quantum">Q</span>' : '';

            // Build vehicle toggle buttons
            const relVehicles = state.vehicleRoutes.filter(v => v.algoKey === r.key);
            let togglesHTML = '';
            if (relVehicles.length > 0) {
                togglesHTML = '<div class="result-toggles">';
                relVehicles.forEach(v => {
                    const vIdx = state.vehicleRoutes.indexOf(v);
                    togglesHTML += `<button class="route-toggle ${v.visible ? 'active' : ''}" data-vidx="${vIdx}" style="--tc:${v.color}" title="Toggle ${v.name}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${v.visible ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}
                        </svg>
                        <span>${relVehicles.length > 1 ? 'V' + (v.vehicleIdx + 1) : ''}</span>
                    </button>`;
                });
                togglesHTML += '</div>';
            }

            item.innerHTML = `
                <div class="result-header">
                    <span class="result-name"><span class="algo-color" style="--algo-clr:${r.meta.color}"></span>${r.meta.name}${typeBadge}</span>
                    <span class="result-rank ${idx === 0 ? 'first' : ''}">#${idx + 1}</span>
                </div>
                <div class="result-stats">
                    <div class="result-stat"><span class="result-stat-label">Route Length</span><span class="result-stat-value">${r.length.toFixed(1)}</span></div>
                    <div class="result-stat"><span class="result-stat-label">Compute</span><span class="result-stat-value">${r.time < 1 ? r.time.toFixed(3) : r.time.toFixed(1)} ms</span></div>
                    <div class="result-stat"><span class="result-stat-label">Optimality</span><span class="result-stat-value">${opt}%</span></div>
                    <div class="result-stat"><span class="result-stat-label">Complexity</span><span class="result-stat-value">${r.meta.timeComplexity}</span></div>
                    ${r.iterations !== undefined && r.iterations >= 0 ? `<div class="result-stat"><span class="result-stat-label">Iterations</span><span class="result-stat-value">${fmtNum(r.iterations)}</span></div>` : ''}
                    ${r.vehicles ? `<div class="result-stat"><span class="result-stat-label">Vehicles</span><span class="result-stat-value">${r.vehicles.length}</span></div>` : ''}
                </div>
                <div class="result-bar"><div class="result-bar-fill" style="width:${opt}%"></div></div>
                ${togglesHTML}
            `;
            list.appendChild(item);
        });

        // Wire toggle buttons
        list.querySelectorAll('.route-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const vIdx = parseInt(btn.dataset.vidx);
                state.vehicleRoutes[vIdx].visible = !state.vehicleRoutes[vIdx].visible;
                btn.classList.toggle('active', state.vehicleRoutes[vIdx].visible);
                const vis = state.vehicleRoutes[vIdx].visible;
                btn.querySelector('svg').innerHTML = vis
                    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
                    : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
                renderer.routes = state.vehicleRoutes.map(v => ({
                    route: v.route, color: v.color, name: v.name, visible: v.visible
                }));
                renderer.render();
                updateLegend();
            });
        });
    }

    /* ============ Display Routes ============ */
    function displayRoutes() {
        renderer.setRoutes(state.vehicleRoutes.map(v => ({
            route: v.route, color: v.color, name: v.name, visible: v.visible
        })));
        updateLegend();
    }

    function setAllRoutesVisible(vis) {
        state.vehicleRoutes.forEach(v => v.visible = vis);
        renderer.routes = state.vehicleRoutes.map(v => ({
            route: v.route, color: v.color, name: v.name, visible: v.visible
        }));
        renderer.render();
        updateLegend();
        $$('.route-toggle').forEach(btn => {
            const vIdx = parseInt(btn.dataset.vidx);
            const v = state.vehicleRoutes[vIdx];
            if (!v) return;
            btn.classList.toggle('active', v.visible);
            btn.querySelector('svg').innerHTML = v.visible
                ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
                : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        });
    }

    function updateLegend() {
        const legend = $('#mapLegend');
        const visibleRoutes = state.vehicleRoutes.filter(v => v.visible);
        if (visibleRoutes.length > 12) {
            legend.classList.add('legend-collapsed');
            const shown = visibleRoutes.slice(0, 8);
            const moreCount = visibleRoutes.length - 8;
            legend.innerHTML = shown.map(v =>
                `<div class="legend-item"><span class="legend-dot" style="background:${v.color}"></span>${v.name}</div>`
            ).join('') + `<div class="legend-item legend-more">+${moreCount} more</div>`;
        } else {
            legend.classList.remove('legend-collapsed');
            legend.innerHTML = visibleRoutes.map(v =>
                `<div class="legend-item"><span class="legend-dot" style="background:${v.color}"></span>${v.name}</div>`
            ).join('');
        }
    }

    /* ============ Charts ============ */
    function updateCharts() {
        chartRouteLength.setData(state.results.map(r => ({ label: r.meta.name, value: r.length, color: r.meta.color })));
        chartComputeTime.setData(state.results.map(r => ({ label: r.meta.name, value: r.time, color: r.meta.color })));
        const convData = state.results.filter(r => r.convergence && r.convergence.length > 2)
            .map(r => ({ label: r.meta.name, color: r.meta.color, values: r.convergence }));
        if (convData.length) chartConvergence.setData(convData);
        if (state.quantumData?.probDistribution) {
            chartProbDist.setData(state.quantumData.probDistribution.map((p, i) => ({
                label: `S${i}`, value: p, color: '#c084fc'
            })));
        }
    }

    /* ============ Metrics ============ */
    function updateMetrics() {
        const nodes = state.cityData ? state.cityData.nodes.length : 0;
        $('#metricNodesVal').textContent = nodes;
        $('#metricAlgosVal').textContent = $$('#algoList input[type="checkbox"]:checked').length;
        if (state.results.length) {
            $('#metricBestVal').textContent = state.results[0].length.toFixed(1);
            const fastest = Math.min(...state.results.map(r => r.time));
            $('#metricTimeVal').textContent = fastest < 1 ? fastest.toFixed(3) + ' ms' : fastest.toFixed(1) + ' ms';
        } else {
            $('#metricBestVal').textContent = '—';
            $('#metricTimeVal').textContent = '—';
        }
    }

    /* ============ Quantum Mode (always-on) ============ */
    function initQuantumMode() {
        state.quantumMode = true;
        document.body.classList.add('quantum-mode');
        renderer.quantumMode = true;
        startBlochAnim();
    }

    function updateQuantumPanel() {
        if (!state.quantumData) return;
        const qd = state.quantumData;
        $('#qstatQubits').textContent = qd.qubits;
        $('#qstatDepth').textContent = fmtNum(qd.circuitDepth);
        $('#qstatCoherence').textContent = qd.coherenceCost;
    }

    function startBlochAnim() {
        const canvas = $('#blochCanvas');
        const dpr = window.devicePixelRatio || 1;
        const size = 180;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
        const angles = state.quantumData?.blochAngles || { theta: Math.PI / 4, phi: 0 };
        const animate = t => {
            renderBlochSphere(canvas, angles.theta, angles.phi, t);
            blochAnimFrame = requestAnimationFrame(animate);
        };
        blochAnimFrame = requestAnimationFrame(animate);
    }

    function stopBlochAnim() {
        if (blochAnimFrame) { cancelAnimationFrame(blochAnimFrame); blochAnimFrame = null; }
    }

    /* ============ Clear ============ */
    function clearAll() {
        state.cityData = null; state.results = []; state.vehicleRoutes = []; state.distMatrix = null; state.quantumData = null;
        renderer.clear();
        clearResultsUI();
        $('#mapNodeCount').textContent = '0 nodes';
        $('#mapEdgeCount').textContent = '0 edges';
        $('#depotLabel').style.display = 'none';
        chartRouteLength.clear(); chartComputeTime.clear(); chartConvergence.clear();
        updateMetrics();
        setStatus('ready', 'Ready');
    }

    function clearResultsUI() {
        $('#resultsEmpty').style.display = 'flex';
        $('#resultsList').style.display = 'none';
        $('#resultsList').innerHTML = '';
        $('#resultsActions').style.display = 'none';
        $('#mapLegend').innerHTML = '';
    }

    /* ============ Status ============ */
    function setStatus(type, text) {
        const dot = $('#topbarStatus .status-dot');
        const txt = $('#topbarStatus .status-text');
        txt.textContent = text;
        dot.classList.toggle('running', type === 'running');
    }

    /* ============ Helpers ============ */
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    function fmtNum(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toString(); }
    function adjustHue(hexColor, shift) {
        const m = hexColor.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (!m) return hexColor;
        let r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        h = (h * 360 + shift) % 360 / 360;
        const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        const nr = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
        const ng = Math.round(hue2rgb(p, q, h) * 255);
        const nb = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
        return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
    }

    document.addEventListener('DOMContentLoaded', init);

    window.addEventListener('qubibyte-theme-change', () => {
        if (renderer) renderer.render();
        if (chartRouteLength?.data?.length) chartRouteLength.draw();
        if (chartComputeTime?.data?.length) chartComputeTime.draw();
        if (chartConvergence?.data?.length) chartConvergence.draw();
        if (chartProbDist?.data?.length) chartProbDist.draw();
    });
})();

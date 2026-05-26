/**
 * Qubibyte Route Simulator — Map Renderer
 * Canvas-based visualization of nodes, roads, and routes
 */
class MapRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = window.devicePixelRatio || 1;
        this.cityData = null;
        this.routes = [];
        this.animSpeed = 5;
        this.quantumMode = false;
        this.resize();
        window.addEventListener('resize', () => { this.resize(); this.render(); });
    }

    get width() { return this.canvas.parentElement?.clientWidth || 800; }
    get height() { return this.canvas.parentElement?.clientHeight || 600; }

    resize() {
        const w = this.width, h = this.height;
        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    setCity(cityData) {
        this.cityData = cityData;
        this.routes = [];
        this.render();
    }

    setRoutes(routes) {
        this.routes = routes;
        this.render();
    }

    clear() {
        this.cityData = null;
        this.routes = [];
        this.render();
    }

    render() {
        const ctx = this.ctx, w = this.width, h = this.height;
        ctx.clearRect(0, 0, w, h);

        // Background
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, w, h);

        if (!this.cityData) return;
        const { nodes, roads, intersections } = this.cityData;
        if (!nodes || nodes.length === 0) return;

        // Draw grid
        ctx.strokeStyle = 'rgba(255,255,255,0.02)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

        // Draw roads
        if (roads && intersections) {
            ctx.strokeStyle = this.quantumMode ? 'rgba(171,111,175,0.12)' : 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 1;
            for (const road of roads) {
                const from = intersections[road.from], to = intersections[road.to];
                if (from && to) {
                    ctx.beginPath();
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                    ctx.stroke();
                }
            }
        }

        // Draw routes
        this.drawRoutes(ctx);

        // Draw nodes
        this.drawNodes(ctx, nodes);
    }

    drawRoutes(ctx) {
        const visibleRoutes = this.routes.filter(r => r.visible);
        for (const routeData of visibleRoutes) {
            const { route, color } = routeData;
            if (!route || route.length < 2) continue;
            const nodes = this.cityData.nodes;

            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.85;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;

            // Road-based: use path segments
            if (this.cityData.adjList && this.cityData.intersections) {
                for (let i = 0; i < route.length - 1; i++) {
                    const fromNode = nodes[route[i]], toNode = nodes[route[i + 1]];
                    if (!fromNode || !toNode) continue;
                    if (fromNode.intId !== undefined && toNode.intId !== undefined) {
                        const path = getRoadPath(fromNode.intId, toNode.intId,
                            this.cityData.adjList, this.cityData.intersections.length, this.cityData.intersections);
                        if (path && path.length > 1) {
                            ctx.beginPath();
                            ctx.moveTo(path[0].x, path[0].y);
                            for (let j = 1; j < path.length; j++) ctx.lineTo(path[j].x, path[j].y);
                            ctx.stroke();
                            continue;
                        }
                    }
                    // Fallback: direct line
                    ctx.beginPath();
                    ctx.moveTo(fromNode.x, fromNode.y);
                    ctx.lineTo(toNode.x, toNode.y);
                    ctx.stroke();
                }
            } else {
                // Direct mode
                ctx.beginPath();
                for (let i = 0; i < route.length; i++) {
                    const node = nodes[route[i]];
                    if (!node) continue;
                    i === 0 ? ctx.moveTo(node.x, node.y) : ctx.lineTo(node.x, node.y);
                }
                ctx.stroke();
            }
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    drawNodes(ctx, nodes) {
        const n = nodes.length;
        const nodeRadius = n > 60 ? 3 : n > 30 ? 4 : 5;
        for (let i = 1; i < n; i++) {
            const nd = nodes[i];
            ctx.beginPath();
            ctx.arc(nd.x, nd.y, nodeRadius, 0, Math.PI * 2);
            ctx.fillStyle = this.quantumMode ? 'rgba(192,132,252,0.5)' : 'rgba(148,163,184,0.5)';
            ctx.fill();
            ctx.strokeStyle = this.quantumMode ? 'rgba(192,132,252,0.15)' : 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }
        // Depot
        const depot = nodes[0];
        if (depot) {
            const depotColor = '#38bdf8';
            ctx.beginPath();
            ctx.arc(depot.x, depot.y, nodeRadius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = depotColor;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(depot.x, depot.y, nodeRadius + 1, 0, Math.PI * 2);
            ctx.fillStyle = depotColor;
            ctx.fill();
            // Depot ring glow
            ctx.beginPath();
            ctx.arc(depot.x, depot.y, nodeRadius + 8, 0, Math.PI * 2);
            ctx.strokeStyle = depotColor + '15';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

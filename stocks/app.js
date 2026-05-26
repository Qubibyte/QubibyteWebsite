/* ============================================================
   QUANTUM STOCK TRACKER — App (Graph-Dominant + Real Data)
   Fetches real prices from Yahoo Finance via CORS proxy.
   ============================================================ */

(function () {
    'use strict';

    // ======================== DOM ========================
    const stockStrip = document.getElementById('stockStrip');
    const chartWrap = document.getElementById('chartWrap');
    const mainChart = document.getElementById('mainChart');
    const ctx = mainChart.getContext('2d');
    const tooltip = document.getElementById('tooltip');
    const crossV = document.getElementById('crossV');
    const crossH = document.getElementById('crossH');
    const xAxis = document.getElementById('xAxis');
    const yAxisEl = document.getElementById('yAxis');
    const tfGroup = document.getElementById('tfGroup');
    const eventsScroll = document.getElementById('eventsScroll');
    const tickerTrack = document.getElementById('tickerTrack');

    // Chart bar elements
    const chartBarIcon = document.getElementById('chartBarIcon');
    const chartBarName = document.getElementById('chartBarName');
    const chartBarTicker = document.getElementById('chartBarTicker');
    const chartBarPrice = document.getElementById('chartBarPrice');
    const chartBarChange = document.getElementById('chartBarChange');
    const chartBarSrc = document.getElementById('chartBarSrc');

    // Modal
    const modal = document.getElementById('modal');
    const modalX = document.getElementById('modalX');
    const modalBar = document.getElementById('modalBar');
    const mDate = document.getElementById('mDate');
    const mTitle = document.getElementById('mTitle');
    const mImpact = document.getElementById('mImpact');
    const mDesc = document.getElementById('mDesc');
    const mDetails = document.getElementById('mDetails');

    // ======================== STATE ========================
    let selected = null;
    let timeframe = '1M';
    let chartData = null;
    let geo = null;
    let loading = false;

    // ======================== LOADING OVERLAY ========================
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'chart-loading';
    loadingOverlay.innerHTML = `<div class="chart-loading-inner">
        <div class="chart-loading-spinner"></div>
        <div class="chart-loading-text">Fetching market data…</div>
    </div>`;
    chartWrap.appendChild(loadingOverlay);

    function showLoading() { loadingOverlay.classList.add('visible'); loading = true; }
    function hideLoading() { loadingOverlay.classList.remove('visible'); loading = false; }

    const chartErrorEl = document.createElement('div');
    chartErrorEl.className = 'chart-loading';
    chartErrorEl.innerHTML = `<div class="chart-loading-inner">
        <div class="chart-loading-text" style="color:var(--red)"></div>
        <div class="chart-loading-text" style="font-size:0.68em;margin-top:4px;color:var(--t3)">Check console for details</div>
    </div>`;
    chartWrap.appendChild(chartErrorEl);

    function showChartError(msg) {
        chartErrorEl.querySelector('.chart-loading-text').textContent = msg;
        chartErrorEl.classList.add('visible');
        const dpr = window.devicePixelRatio || 1;
        const rect = chartWrap.getBoundingClientRect();
        mainChart.width = rect.width * dpr;
        mainChart.height = rect.height * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, rect.width * dpr, rect.height * dpr);
        chartWrap.querySelectorAll('.ev-marker').forEach(m => m.remove());
    }
    function hideChartError() { chartErrorEl.classList.remove('visible'); }

    // ======================== INIT ========================
    async function init() {
        buildStrip();
        buildTicker();
        setupListeners();
        selectStock(STOCKS[0]);

        // Fetch real 1D daily prices for sidebar + ticker (in background)
        try {
            const daily = await fetchDailyPrices();
            updateStripWithDaily(daily);
            updateTickerWithDaily(daily);
        } catch (e) { /* failsafe — sidebar keeps placeholder values */ }
    }

    // ======================== STOCK STRIP ========================
    function buildStrip() {
        let html = '';
        STOCKS.forEach(s => {
            html += `<button class="stock-btn" data-t="${s.ticker}">
                <span class="stock-btn-icon">${s.icon}</span>
                <span class="stock-btn-info">
                    <span class="stock-btn-ticker">${s.ticker}</span>
                    <span class="stock-btn-name">${s.name}</span>
                </span>
                <span class="stock-btn-change neu">--</span>
            </button>`;
        });
        stockStrip.innerHTML = html;

        stockStrip.querySelectorAll('.stock-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = STOCKS.find(x => x.ticker === btn.dataset.t);
                if (s) selectStock(s);
            });
        });
    }

    function updateStripWithDaily(daily) {
        stockStrip.querySelectorAll('.stock-btn').forEach(btn => {
            const ticker = btn.dataset.t;
            const d = daily[ticker];
            if (!d) return;
            const el = btn.querySelector('.stock-btn-change');
            if (!el) return;
            const up = d.change >= 0;
            el.textContent = `${up ? '+' : ''}${d.change.toFixed(1)}%`;
            el.className = `stock-btn-change ${up ? 'up' : 'down'}`;
        });
    }

    // ======================== SELECT STOCK (async) ========================
    async function selectStock(stock) {
        selected = stock;

        // Update strip active
        stockStrip.querySelectorAll('.stock-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.t === stock.ticker);
        });

        chartBarIcon.textContent = stock.icon;
        chartBarName.textContent = stock.name;
        chartBarTicker.textContent = stock.ticker;
        chartBarPrice.textContent = '—';
        chartBarChange.textContent = '';
        chartBarChange.className = 'chart-bar-change';
        if (chartBarSrc) chartBarSrc.textContent = '';

        await renderChart();
        renderEvents();
    }

    // ======================== RENDER CHART (async) ========================
    async function renderChart() {
        if (!selected) return;

        showLoading();
        hideChartError();

        try {
            chartData = await fetchChartData(selected, timeframe);
        } catch (e) {
            chartData = errorResult('Unexpected error');
        }

        hideLoading();

        if (!chartData || chartData.source === 'error' || !chartData.data || chartData.data.length < 2) {
            const msg = (chartData && chartData.error) ? chartData.error : 'Unable to load market data';
            showChartError(msg);
            chartBarPrice.textContent = '—';
            chartBarChange.textContent = '';
            chartBarChange.className = 'chart-bar-change';
            if (chartBarSrc) { chartBarSrc.textContent = '● ERROR'; chartBarSrc.className = 'chart-bar-src sim'; }
            xAxis.innerHTML = '';
            yAxisEl.innerHTML = '';
            geo = null;
            return;
        }

        const data = chartData.data;

        // Update chart bar with real price/change from fetched data
        const lp = chartData.livePrice;
        const lc = chartData.liveChange;
        const isUp = lc >= 0;
        chartBarPrice.textContent = `$${lp.toFixed(2)}`;
        chartBarChange.textContent = `${isUp ? '+' : ''}${lc.toFixed(2)}%`;
        chartBarChange.className = `chart-bar-change ${isUp ? 'up' : 'down'}`;

        // Show data source indicator (market hours aware)
        if (chartBarSrc) {
            if (chartData.source === 'live') {
                if (isMarketOpen()) {
                    chartBarSrc.textContent = '● LIVE';
                    chartBarSrc.className = 'chart-bar-src live';
                } else {
                    chartBarSrc.textContent = '● CLOSED';
                    chartBarSrc.className = 'chart-bar-src closed';
                }
            } else if (chartData.source === 'private') {
                chartBarSrc.textContent = '● PRIVATE';
                chartBarSrc.className = 'chart-bar-src private';
            } else {
                chartBarSrc.textContent = '● SIM';
                chartBarSrc.className = 'chart-bar-src sim';
            }
        }

        // ---- DRAW ----
        const dpr = window.devicePixelRatio || 1;
        const rect = chartWrap.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        mainChart.width = w * dpr;
        mainChart.height = h * dpr;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        const pad = { top: 16, right: 6, bottom: 6, left: 8 };
        const prices = data.map(d => d.price);
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        const range = maxP - minP || 1;
        const pPad = range * 0.12;
        const eMin = minP - pPad;
        const eMax = maxP + pPad;
        const eRange = eMax - eMin;

        ctx.clearRect(0, 0, w, h);

        // Grid
        const gridN = 5;
        ctx.strokeStyle = 'rgba(255,255,255,0.035)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= gridN; i++) {
            const y = pad.top + (i / gridN) * (h - pad.top - pad.bottom);
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();
        }

        // Compute points
        const cw = w - pad.left - pad.right;
        const ch = h - pad.top - pad.bottom;
        const pts = data.map((d, i) => ({
            x: pad.left + (i / (data.length - 1)) * cw,
            y: pad.top + ((eMax - d.price) / eRange) * ch
        }));

        const lineColor = isUp ? '#10b981' : '#ef4444';
        const gradTop = isUp ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)';
        const gradBot = isUp ? 'rgba(16,185,129,0.0)' : 'rgba(239,68,68,0.0)';

        // Fill
        const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
        grad.addColorStop(0, gradTop);
        grad.addColorStop(1, gradBot);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, h - pad.bottom);
        pts.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(pts[pts.length - 1].x, h - pad.bottom);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Glow line
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.1;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Main line
        ctx.beginPath();
        pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Last price dot
        const last = pts[pts.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = lineColor.replace(')', ',0.2)').replace('rgb', 'rgba');
        ctx.fill();

        // Event markers
        chartWrap.querySelectorAll('.ev-marker').forEach(m => m.remove());
        chartData.events.forEach(ev => {
            const x = pad.left + ev.x * cw;
            const y = pad.top + ((eMax - ev.y) / eRange) * ch;
            const type = ev.type === 'positive' ? 'pos' : ev.type === 'negative' ? 'neg' : 'neu';
            const m = document.createElement('div');
            m.className = `ev-marker ${type}`;
            m.style.left = x + 'px';
            m.style.top = y + 'px';
            m.title = ev.title;
            m.addEventListener('click', e => { e.stopPropagation(); openModal(ev); });
            chartWrap.appendChild(m);
        });

        // Y axis
        yAxisEl.innerHTML = '';
        for (let i = 0; i <= gridN; i++) {
            const price = eMax - (i / gridN) * eRange;
            const d = document.createElement('div');
            d.textContent = '$' + price.toFixed(2);
            yAxisEl.appendChild(d);
        }

        // X axis
        xAxis.innerHTML = '';
        const labelN = window.innerWidth < 600 ? 4 : 6;
        for (let i = 0; i < labelN; i++) {
            const idx = Math.floor((i / (labelN - 1)) * (data.length - 1));
            const d = document.createElement('div');
            d.textContent = fmtDate(data[idx].date, timeframe);
            xAxis.appendChild(d);
        }

        // Cache geometry
        geo = { w, h, pad, eMin, eMax, eRange, data, pts, cw, ch };
    }

    // ======================== CHART INTERACTIONS ========================
    function onMove(e) {
        if (!geo || loading) return;
        const rect = chartWrap.getBoundingClientRect();
        const mx = (e.clientX || e.touches[0].clientX) - rect.left;
        const my = (e.clientY || e.touches[0].clientY) - rect.top;
        const { pad, eMax, eRange, data, cw, ch } = geo;

        const relX = mx - pad.left;
        const progress = Math.max(0, Math.min(1, relX / cw));
        const idx = Math.round(progress * (data.length - 1));
        const pt = data[idx];
        if (!pt) return;

        const px = pad.left + (idx / (data.length - 1)) * cw;
        const py = pad.top + ((eMax - pt.price) / eRange) * ch;

        crossV.style.display = 'block';
        crossV.style.left = px + 'px';
        crossH.style.display = 'block';
        crossH.style.top = py + 'px';

        const chg = data[0].price > 0 ? ((pt.price - data[0].price) / data[0].price * 100) : 0;
        const chgSign = chg >= 0 ? '+' : '';
        const col = chg >= 0 ? 'var(--grn)' : 'var(--red)';
        const dateStr = fmtDateFull(pt.date);
        const timeStr = (timeframe === '1D' || timeframe === '5D')
            ? pt.date.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })
            : '';
        tooltip.innerHTML = `<div style="color:var(--t3);font-size:0.85em;margin-bottom:3px">${dateStr}${timeStr ? `<br>${timeStr}` : ''}</div>
            <div style="font-size:1.1em;font-weight:700">$${pt.price.toFixed(2)}</div>
            <div style="color:${col};font-weight:600">${chgSign}${chg.toFixed(2)}%</div>`;
        tooltip.style.display = 'block';

        let tx = px + 14, ty = py - 36;
        const tw = tooltip.offsetWidth;
        if (tx + tw > geo.w - 10) tx = px - tw - 14;
        if (ty < 8) ty = py + 14;
        tooltip.style.left = tx + 'px';
        tooltip.style.top = ty + 'px';
    }

    function onLeave() {
        tooltip.style.display = 'none';
        crossV.style.display = 'none';
        crossH.style.display = 'none';
    }

    // ======================== EVENTS STRIP ========================
    function renderEvents() {
        if (!chartData || chartData.events.length === 0) {
            eventsScroll.innerHTML = '<span class="events-empty">No events in this timeframe — try a longer period</span>';
            return;
        }
        let html = '';
        chartData.events.forEach(ev => {
            const type = ev.type === 'positive' ? 'pos' : ev.type === 'negative' ? 'neg' : 'neu';
            html += `<div class="ev-pill" data-ev='${JSON.stringify(ev).replace(/'/g, "&#39;")}'>
                <span class="ev-pill-dot ${type}"></span>
                <span class="ev-pill-text">${ev.title}</span>
                <span class="ev-pill-impact ${type}">${ev.impact}</span>
            </div>`;
        });
        eventsScroll.innerHTML = html;

        eventsScroll.querySelectorAll('.ev-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                openModal(JSON.parse(pill.dataset.ev));
            });
        });
    }

    // ======================== MODAL ========================
    function openModal(ev) {
        const type = ev.type === 'positive' ? 'pos' : ev.type === 'negative' ? 'neg' : 'neu';
        modalBar.className = 'modal-bar ' + type;
        mDate.textContent = fmtDateFull(new Date(ev.date));
        mTitle.textContent = ev.title;
        mImpact.className = 'modal-impact ' + type;
        mImpact.textContent = ev.impact;
        mDesc.textContent = ev.description;

        let dh = '';
        if (ev.priceBefore !== undefined) {
            dh += `<div class="md-row"><span class="md-label">Price Before</span><span class="md-val">$${ev.priceBefore.toFixed(2)}</span></div>`;
            dh += `<div class="md-row"><span class="md-label">Price After</span><span class="md-val">$${ev.priceAfter.toFixed(2)}</span></div>`;
        }
        if (ev.details) {
            Object.entries(ev.details).forEach(([k, v]) => {
                dh += `<div class="md-row"><span class="md-label">${k}</span><span class="md-val">${v}</span></div>`;
            });
        }
        mDetails.innerHTML = dh;

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    // ======================== BOTTOM TICKER ========================
    function buildTicker() {
        let html = '';
        for (let r = 0; r < 3; r++) {
            STOCKS.forEach(s => {
                html += `<div class="tick-item" data-ticker="${s.ticker}">
                    <span class="tick-sym">${s.ticker}</span>
                    <span class="tick-price">—</span>
                    <span class="tick-chg neu">--</span>
                </div>`;
            });
        }
        tickerTrack.innerHTML = html;
    }

    function updateTickerWithDaily(daily) {
        tickerTrack.querySelectorAll('.tick-item').forEach(item => {
            const ticker = item.dataset.ticker;
            const d = daily[ticker];
            if (!d) return;
            const priceEl = item.querySelector('.tick-price');
            const chgEl = item.querySelector('.tick-chg');
            if (priceEl) priceEl.textContent = `$${d.price.toFixed(2)}`;
            if (chgEl) {
                const up = d.change >= 0;
                chgEl.textContent = `${up ? '+' : ''}${d.change.toFixed(2)}%`;
                chgEl.className = `tick-chg ${up ? 'up' : 'down'}`;
            }
        });
    }

    // ======================== LISTENERS ========================
    function setupListeners() {
        // Timeframe (async)
        tfGroup.addEventListener('click', async (e) => {
            const btn = e.target.closest('.tf-btn');
            if (!btn || loading) return;
            tfGroup.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            timeframe = btn.dataset.tf;
            await renderChart();
            renderEvents();
        });

        // Chart mouse/touch
        chartWrap.addEventListener('mousemove', onMove);
        chartWrap.addEventListener('touchmove', e => { e.preventDefault(); onMove(e); }, { passive: false });
        chartWrap.addEventListener('mouseleave', onLeave);
        chartWrap.addEventListener('touchend', onLeave);

        // Modal
        modalX.addEventListener('click', closeModal);
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

        // Resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => renderChart(), 150);
        });
    }

    // ======================== UTILS ========================
    function fmtDate(d, tf) {
        const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        if (tf === '1D') return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
        if (tf === '5D') return `${m[d.getMonth()]} ${d.getDate()}`;
        if (tf === '1M' || tf === '6M' || tf === 'YTD') return `${m[d.getMonth()]} ${d.getDate()}`;
        if (tf === '5Y' || tf === 'All') return `${m[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
        return `${m[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    }

    function fmtDateFull(d) {
        return d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    }

    // ======================== GO ========================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

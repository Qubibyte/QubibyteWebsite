/**
 * Qubibyte Route Simulator — Simple Chart Library
 * Zero-dependency canvas charts for results visualization
 */
class SimpleChart {
    constructor(canvas, type = 'bar') {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d') : null;
        this.type = type;
        this.data = [];
        this.setSize();
        if (canvas) window.addEventListener('resize', () => { this.setSize(); this.draw(); });
    }

    setSize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const w = Math.max(100, rect.width);
        const h = parseInt(this.canvas.getAttribute('height')) || 200;
        this.canvas.width = w * dpr;
        this.canvas.height = h * dpr;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._w = w;
        this._h = h;
    }

    setData(data) {
        this.data = data || [];
        this.setSize();
        this.draw();
    }

    clear() {
        this.data = [];
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this._w || 300, this._h || 200);
        }
    }

    draw() {
        if (!this.ctx || !this.data.length) return;
        const ctx = this.ctx, w = this._w, h = this._h;
        ctx.clearRect(0, 0, w, h);

        if (this.type === 'bar') {
            this.drawBar(ctx, w, h);
        } else if (this.type === 'line') {
            this.drawLine(ctx, w, h);
        }
    }

    drawBar(ctx, w, h) {
        const data = this.data;
        const pad = { top: 20, right: 20, bottom: 50, left: 60 };
        const cw = w - pad.left - pad.right;
        const ch = h - pad.top - pad.bottom;
        if (cw <= 0 || ch <= 0) return;

        const maxVal = Math.max(...data.map(d => d.value || 0), 0.01);
        const barCount = data.length;
        const barGap = Math.max(4, Math.min(12, cw / barCount * 0.2));
        const barWidth = Math.max(8, (cw - barGap * (barCount + 1)) / barCount);

        // Y-axis grid lines
        const yTicks = this.calcTicks(0, maxVal, 5);
        ctx.font = '10px "JetBrains Mono",monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (const tick of yTicks) {
            const y = pad.top + ch * (1 - tick / maxVal);
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillText(this.fmtVal(tick), pad.left - 8, y);
        }

        // Bars
        data.forEach((d, i) => {
            const x = pad.left + barGap + i * (barWidth + barGap);
            const barH = Math.max(2, (d.value / maxVal) * ch);
            const y = pad.top + ch - barH;

            // Bar
            const grad = ctx.createLinearGradient(x, y, x, y + barH);
            grad.addColorStop(0, d.color || '#38bdf8');
            grad.addColorStop(1, this.adjustAlpha(d.color || '#38bdf8', 0.4));
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, barWidth, barH);

            // Top glow
            ctx.fillStyle = d.color || '#38bdf8';
            ctx.globalAlpha = 0.6;
            ctx.fillRect(x, y, barWidth, 2);
            ctx.globalAlpha = 1;

            // Label
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '9px "Inter",sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const label = (d.label || '').length > 8 ? d.label.substring(0, 7) + '…' : d.label;
            ctx.save();
            ctx.translate(x + barWidth / 2, pad.top + ch + 8);
            ctx.rotate(-0.4);
            ctx.fillText(label, 0, 0);
            ctx.restore();
        });
    }

    drawLine(ctx, w, h) {
        const data = this.data;
        if (!data.length) return;
        const pad = { top: 20, right: 20, bottom: 30, left: 60 };
        const cw = w - pad.left - pad.right;
        const ch = h - pad.top - pad.bottom;
        if (cw <= 0 || ch <= 0) return;

        // data is array of { label, color, values: number[] }
        let maxVal = 0, maxLen = 0;
        for (const series of data) {
            if (series.values) {
                maxLen = Math.max(maxLen, series.values.length);
                for (const v of series.values) if (isFinite(v) && v > maxVal) maxVal = v;
            }
        }
        if (maxVal === 0 || maxLen === 0) return;

        // Y-axis grid
        const yTicks = this.calcTicks(0, maxVal, 5);
        ctx.font = '10px "JetBrains Mono",monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (const tick of yTicks) {
            const y = pad.top + ch * (1 - tick / maxVal);
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(w - pad.right, y);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillText(this.fmtVal(tick), pad.left - 8, y);
        }

        for (const series of data) {
            if (!series.values || series.values.length < 2) continue;
            ctx.strokeStyle = series.color || '#38bdf8';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            series.values.forEach((v, i) => {
                const x = pad.left + (i / (series.values.length - 1)) * cw;
                const y = pad.top + ch * (1 - (isFinite(v) ? v : 0) / maxVal);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    calcTicks(min, max, count) {
        const range = max - min;
        if (range === 0) return [0];
        const step = Math.pow(10, Math.floor(Math.log10(range)));
        const niceStep = range / step < 2 ? step / 5 : range / step < 5 ? step / 2 : step;
        const ticks = [];
        for (let v = 0; v <= max * 1.05; v += niceStep) {
            ticks.push(v);
            if (ticks.length >= count + 2) break;
        }
        return ticks;
    }

    fmtVal(v) {
        if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
        if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
        if (v >= 1) return v.toFixed(1);
        if (v >= 0.01) return v.toFixed(3);
        return v.toFixed(4);
    }

    adjustAlpha(hex, alpha) {
        const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (!m) return hex;
        return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
    }
}

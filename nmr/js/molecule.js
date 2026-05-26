/**
 * Molecular Structure Viewer
 * 2D canvas-based molecular structure visualization
 * Inspired by the quantum circuit simulator's molecule viewer
 */

class MoleculeVisualization {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas not found:', canvasId);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.sample = null;

        // Element colors
        this.colors = {
            'H': '#e0e0e0',
            'C': '#404040',
            '13C': '#505050',
            'N': '#4a9eff',
            '15N': '#6ab0ff',
            'O': '#ff4444',
            'F': '#10b981',
            '19F': '#34d399',
            'Cl': '#84cc16',
            'Br': '#b45309',
            'I': '#8b5cf6',
            'P': '#fb923c',
            '31P': '#fdba74',
            'S': '#fbbf24',
            'Si': '#94a3b8',
            '29Si': '#a8b8c8'
        };

        // Element radii (relative)
        this.radii = {
            'H': 0.6, '1H': 0.6,
            'C': 1.0, '13C': 1.0,
            'N': 0.9, '15N': 0.9,
            'O': 0.85,
            'F': 0.75, '19F': 0.75,
            'Cl': 1.1,
            'Br': 1.2,
            'I': 1.4,
            'P': 1.2, '31P': 1.2,
            'S': 1.15,
            'Si': 1.15, '29Si': 1.15
        };

        // Setup resize handling
        this.setupResize();
    }

    setupResize() {
        const resizeObserver = new ResizeObserver(() => {
            this.render();
        });

        if (this.canvas.parentElement) {
            resizeObserver.observe(this.canvas.parentElement);
        }
    }

    setSample(sample) {
        this.sample = sample;
        this.render();
    }

    render() {
        if (!this.canvas || !this.ctx) return;

        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();

        this.canvas.width = rect.width;
        this.canvas.height = rect.height - 60; // Leave room for legend

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear with gradient background
        const bgGradient = ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height)
        );
        const rootStyle = getComputedStyle(document.documentElement);
        const inner = rootStyle.getPropertyValue('--viz-canvas-inner').trim() || '#111827';
        const outer = rootStyle.getPropertyValue('--viz-canvas-outer').trim() || '#0a0f1a';
        bgGradient.addColorStop(0, inner);
        bgGradient.addColorStop(1, outer);
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        if (!this.sample || !this.sample.structure) {
            this.drawEmptyState();
            return;
        }

        const structure = this.sample.structure;
        const atoms = structure.atoms || [];
        const bonds = structure.bonds || [];

        if (atoms.length === 0) {
            this.drawEmptyState();
            return;
        }

        // Calculate bounds and scale
        const xs = atoms.map(a => a.x);
        const ys = atoms.map(a => a.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const padding = 80;
        const scaleX = (width - padding * 2) / (maxX - minX || 100);
        const scaleY = (height - padding * 2) / (maxY - minY || 100);
        const scale = Math.min(scaleX, scaleY, 3.0); // Max scale

        const offsetX = width / 2 - (minX + maxX) / 2 * scale;
        const offsetY = height / 2 - (minY + maxY) / 2 * scale;

        const transform = (x, y) => ({
            x: x * scale + offsetX,
            y: y * scale + offsetY
        });

        // Draw bonds first
        this.drawBonds(ctx, atoms, bonds, transform, scale);

        // Draw atoms
        this.drawAtoms(ctx, atoms, transform, scale);

        // Draw molecule info
        this.drawInfo(ctx, width, height);
    }

    drawBonds(ctx, atoms, bonds, transform, scale) {
        const bondWidth = Math.max(2, scale * 0.8);

        bonds.forEach(bond => {
            const [i, j, bondType] = bond;
            if (i >= atoms.length || j >= atoms.length) return;

            const a1 = transform(atoms[i].x, atoms[i].y);
            const a2 = transform(atoms[j].x, atoms[j].y);

            const dx = a2.x - a1.x;
            const dy = a2.y - a1.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const perpDist = 4;
            const perpX = -dy / len * perpDist;
            const perpY = dx / len * perpDist;

            ctx.lineCap = 'round';
            ctx.strokeStyle = '#64748b';

            if (bondType === 'double') {
                ctx.lineWidth = bondWidth * 0.8;
                ctx.beginPath();
                ctx.moveTo(a1.x + perpX, a1.y + perpY);
                ctx.lineTo(a2.x + perpX, a2.y + perpY);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(a1.x - perpX, a1.y - perpY);
                ctx.lineTo(a2.x - perpX, a2.y - perpY);
                ctx.stroke();
            } else if (bondType === 'triple') {
                ctx.lineWidth = bondWidth * 0.6;
                for (let k = -1; k <= 1; k++) {
                    ctx.beginPath();
                    ctx.moveTo(a1.x + perpX * k * 1.5, a1.y + perpY * k * 1.5);
                    ctx.lineTo(a2.x + perpX * k * 1.5, a2.y + perpY * k * 1.5);
                    ctx.stroke();
                }
            } else {
                ctx.lineWidth = bondWidth;
                ctx.beginPath();
                ctx.moveTo(a1.x, a1.y);
                ctx.lineTo(a2.x, a2.y);
                ctx.stroke();
            }
        });
    }

    drawAtoms(ctx, atoms, transform, scale) {
        const baseRadius = Math.max(12, scale * 8);

        atoms.forEach((atom, idx) => {
            const pos = transform(atom.x, atom.y);
            const element = atom.element;
            const baseColor = this.colors[element] || '#888888';
            const radius = baseRadius * (this.radii[element] || 1.0);
            const isQubit = atom.qubit !== undefined;

            // Outer glow for qubit atoms
            if (isQubit) {
                const glowRadius = radius * 1.5;
                const glow = ctx.createRadialGradient(
                    pos.x, pos.y, radius * 0.8,
                    pos.x, pos.y, glowRadius
                );
                glow.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
                glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
                ctx.fill();
            }

            // Atom circle with gradient
            const grad = ctx.createRadialGradient(
                pos.x - radius * 0.3, pos.y - radius * 0.3, 0,
                pos.x, pos.y, radius
            );
            grad.addColorStop(0, this.lightenColor(baseColor, 40));
            grad.addColorStop(0.7, baseColor);
            grad.addColorStop(1, this.darkenColor(baseColor, 30));

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fill();

            // Border
            ctx.strokeStyle = isQubit ? '#fbbf24' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = isQubit ? 3 : 1.5;
            ctx.stroke();

            // Element label
            const label = element.replace(/[0-9]/g, '');
            ctx.fillStyle = this.getContrastColor(baseColor);
            ctx.font = `${isQubit ? 'bold ' : ''}${Math.max(10, radius * 0.8)}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, pos.x, pos.y);

            // Qubit label
            if (isQubit) {
                ctx.fillStyle = '#fbbf24';
                ctx.font = `bold ${Math.max(9, radius * 0.5)}px Arial, sans-serif`;
                ctx.fillText(`Q${atom.qubit}`, pos.x, pos.y + radius + 12);
            }
        });
    }

    drawInfo(ctx, width, height) {
        if (!this.sample) return;

        // Sample name and formula
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${this.sample.name}`, 15, height - 30);

        ctx.fillStyle = '#64748b';
        ctx.font = '11px Arial, sans-serif';
        ctx.fillText(`${this.sample.formula} • MW: ${this.sample.molecularWeight?.toFixed(2) || 'N/A'} g/mol`, 15, height - 12);
    }

    drawEmptyState() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.fillStyle = '#64748b';
        ctx.font = '14px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No molecular structure data available', width / 2, height / 2);

        if (this.sample) {
            ctx.font = '12px Arial, sans-serif';
            ctx.fillText(`Sample: ${this.sample.name || 'Unknown'}`, width / 2, height / 2 + 25);
        }
    }

    // Color utility functions
    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `rgb(${R},${G},${B})`;
    }

    darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `rgb(${R},${G},${B})`;
    }

    getContrastColor(hex) {
        const num = parseInt(hex.replace('#', ''), 16);
        const R = (num >> 16);
        const G = ((num >> 8) & 0x00FF);
        const B = (num & 0x0000FF);
        const luminance = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
        return luminance > 0.5 ? '#1e293b' : '#f1f5f9';
    }

    applyTheme() {
        this.render();
    }
}

// Export
window.MoleculeVisualization = MoleculeVisualization;

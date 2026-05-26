// Qubi Programming Language Parser

/**
 * Strip line comments (slash-slash) and block comments (slash-star … star-slash) for parsing.
 * Preserves newlines. Line comments hide the rest of the physical line from the parser.
 */
(function (g) {
    function lexStripComments(source) {
        if (!source) return '';
        let out = '';
        let state = 'code';
        let depthParen = 0;
        let depthBracket = 0;
        for (let i = 0; i < source.length; i++) {
            const c = source[i];
            const n = source[i + 1];
            if (state === 'code') {
                if (c === '(') {
                    depthParen++;
                    out += c;
                    continue;
                }
                if (c === ')') {
                    depthParen = Math.max(0, depthParen - 1);
                    out += c;
                    continue;
                }
                if (c === '[') {
                    depthBracket++;
                    out += c;
                    continue;
                }
                if (c === ']') {
                    depthBracket = Math.max(0, depthBracket - 1);
                    out += c;
                    continue;
                }
                if (c === '/' && n === '/') {
                    if (depthParen === 0 && depthBracket === 0) {
                        out += ' ';
                        out += ' ';
                        i++;
                        state = 'lineComment';
                        continue;
                    }
                    out += c;
                    out += n;
                    i++;
                    continue;
                }
                if (c === '/' && n === '*') {
                    out += ' ';
                    out += ' ';
                    i++;
                    state = 'blockComment';
                    continue;
                }
                out += c;
                continue;
            }
            if (state === 'lineComment') {
                if (c === '\n') {
                    out += '\n';
                    state = 'code';
                } else {
                    out += ' ';
                }
                continue;
            }
            if (state === 'blockComment') {
                if (c === '*' && n === '/') {
                    out += ' ';
                    out += ' ';
                    i++;
                    state = 'code';
                } else if (c === '\n') {
                    out += '\n';
                } else {
                    out += ' ';
                }
                continue;
            }
        }
        return out;
    }

    /** Index of // that starts a line comment, only when not inside () or [] on this line. */
    function findLineCommentStart(line) {
        let depthParen = 0;
        let depthBracket = 0;
        for (let i = 0; i < line.length - 1; i++) {
            const ch = line[i];
            if (ch === '(') depthParen++;
            else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
            else if (ch === '[') depthBracket++;
            else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
            else if (ch === '/' && line[i + 1] === '/' && depthParen === 0 && depthBracket === 0) {
                return i;
            }
        }
        return -1;
    }

    /** Executable part of one physical line (block comments already removed in full source). */
    function stripTrailingLineCommentOneLine(line) {
        const idx = findLineCommentStart(line);
        if (idx === -1) return line.trim();
        return line.slice(0, idx).trimEnd();
    }

    function scanUnclosedBlockComment(source) {
        let state = 'code';
        let line = 0;
        let blockStartLine = 0;
        for (let i = 0; i < source.length; i++) {
            const c = source[i];
            const n = source[i + 1];
            if (state === 'code') {
                if (c === '/' && n === '/') {
                    i++;
                    state = 'lineComment';
                    continue;
                }
                if (c === '/' && n === '*') {
                    blockStartLine = line;
                    i++;
                    state = 'blockComment';
                    continue;
                }
                if (c === '\n') line++;
                continue;
            }
            if (state === 'lineComment') {
                if (c === '\n') {
                    line++;
                    state = 'code';
                }
                continue;
            }
            if (state === 'blockComment') {
                if (c === '*' && n === '/') {
                    i++;
                    state = 'code';
                    continue;
                }
                if (c === '\n') line++;
                continue;
            }
        }
        if (state === 'blockComment') {
            return { line: blockStartLine, msg: 'Unclosed block comment (missing */)' };
        }
        return null;
    }

    g.QubiLex = {
        lexStripComments,
        findLineCommentStart,
        stripTrailingLineCommentOneLine,
        scanUnclosedBlockComment
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);

/**
 * Parse rotation angle token for RX/RY/RZ.
 * Plain number = multiple of π (existing Qubi behavior).
 * Suffix deg/degrees = degrees; rad/radians = radians.
 * @param {string} spec
 * @returns {number} radians, or NaN if invalid
 */
function parseQubiRotationAngle(spec) {
    const s = String(spec).trim();
    if (!s) return NaN;
    const numPart = '-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
    const deg = s.match(new RegExp(`^(${numPart})\\s*deg(?:rees)?$`, 'i'));
    if (deg) return parseFloat(deg[1]) * (Math.PI / 180);
    const rad = s.match(new RegExp(`^(${numPart})\\s*rad(?:ians)?$`, 'i'));
    if (rad) return parseFloat(rad[1]);
    const plain = s.match(new RegExp(`^(${numPart})$`));
    if (plain) return parseFloat(plain[1]) * Math.PI;
    return NaN;
}

if (typeof globalThis !== 'undefined') {
    globalThis.parseQubiRotationAngle = parseQubiRotationAngle;
}

/** @returns {{ span: string, next: number } | null} */
function qubiTakeBalanced(s, startIdx, openCh, closeCh) {
    if (startIdx < 0 || startIdx >= s.length || s[startIdx] !== openCh) return null;
    let depth = 0;
    for (let i = startIdx; i < s.length; i++) {
        if (s[i] === openCh) depth++;
        else if (s[i] === closeCh) {
            depth--;
            if (depth === 0) return { span: s.slice(startIdx, i + 1), next: i + 1 };
        }
    }
    return null;
}

/** @returns {number[] | null} */
function qubiParseIntList(inner) {
    const parts = String(inner ?? '').split(',').map((p) => p.trim()).filter(Boolean);
    const out = [];
    for (const p of parts) {
        const n = parseInt(p, 10);
        if (!Number.isInteger(n) || n < 0) return null;
        out.push(n);
    }
    return out.length ? out : null;
}

/**
 * Parse inner of (...) as comma-separated [..] [..] lists only (no bare integers).
 * @returns {number[][] | null}
 */
function qubiParseParenBracketSegments(inner) {
    const lists = [];
    let i = 0;
    const s = String(inner ?? '').trim();
    while (i < s.length) {
        while (i < s.length && /[\s,]/.test(s[i])) i++;
        if (i >= s.length) break;
        if (s[i] !== '[') return null;
        const t = qubiTakeBalanced(s, i, '[', ']');
        if (!t) return null;
        const qi = qubiParseIntList(t.span.slice(1, -1));
        if (!qi) return null;
        lists.push(qi);
        i = t.next;
    }
    return lists.length ? lists : null;
}

const QUBI_MULTI_PAREN_FORBIDDEN = new Set(['CX', 'CY', 'CZ', 'SWAP']);

class QubiParser {
    constructor() {
        this.tokens = [];
        this.current = 0;
    }

    /**
     * @param {string} gateName
     * @param {string} rest trimmed tail after gate name
     * @param {number} lineNum
     * @returns {object | null}
     */
    static tryTokenizeGateRegister(gateName, rest, lineNum) {
        if (!rest) return null;

        // Direct bracket: CX [0,1]  or  U [0,1,2]
        if (rest.startsWith('[')) {
            const t = qubiTakeBalanced(rest, 0, '[', ']');
            if (!t || t.next !== rest.length) return null;
            const qubits = qubiParseIntList(t.span.slice(1, -1));
            if (!qubits) return null;
            return {
                type: 'GATE',
                gate: gateName,
                parallelBracketSegments: [qubits],
                line: lineNum
            };
        }

        if (rest.startsWith('(')) {
            const t = qubiTakeBalanced(rest, 0, '(', ')');
            if (!t || t.next !== rest.length) return null;
            const inner = t.span.slice(1, -1);
            const segLists = qubiParseParenBracketSegments(inner);
            if (segLists) {
                return {
                    type: 'GATE',
                    gate: gateName,
                    parallelBracketSegments: segLists,
                    line: lineNum
                };
            }
            if (!/^[\d,\s]+$/.test(inner.trim())) return null;
            const qubits = qubiParseIntList(inner);
            if (!qubits || !qubits.length) return null;
            if (QUBI_MULTI_PAREN_FORBIDDEN.has(gateName)) return null;
            return {
                type: 'GATE',
                gate: gateName,
                qubits,
                isControlled: false,
                params: {},
                line: lineNum
            };
        }

        return null;
    }

    parse(code) {
        this.tokens = this.tokenize(code);
        this.current = 0;
        
        const instructions = [];
        while (!this.isAtEnd()) {
            const instruction = this.parseInstruction();
            if (instruction) {
                instructions.push(instruction);
            }
        }
        
        return instructions;
    }

    tokenize(code) {
        const tokens = [];
        const stripped = (typeof globalThis !== 'undefined' && globalThis.QubiLex)
            ? globalThis.QubiLex.lexStripComments(code)
            : code;
        const lines = stripped.split('\n');

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum].trim();
            if (!line) continue;

            // RX/RY/RZ (q0,q1,…) [angle] — same rotation on each wire (parallel); omitted angle → π/2
            const rotParenMatch = line.match(/^(RX|RY|RZ)\s*\(\s*([^)]+)\)(?:\s+(.+))?$/i);
            if (rotParenMatch) {
                const gateName = rotParenMatch[1].toUpperCase();
                const qubits = rotParenMatch[2].split(',').map(q => parseInt(q.trim(), 10));
                const angleRaw = rotParenMatch[3];
                const angleRad =
                    angleRaw != null && String(angleRaw).trim()
                        ? parseQubiRotationAngle(String(angleRaw).trim())
                        : Math.PI / 2;
                if (
                    qubits.length >= 1 &&
                    qubits.every(q => Number.isInteger(q) && !isNaN(q) && q >= 0) &&
                    !isNaN(angleRad)
                ) {
                    tokens.push({
                        type: 'GATE',
                        gate: gateName,
                        qubits,
                        isControlled: false,
                        params: { angle: angleRad },
                        line: lineNum
                    });
                }
                continue;
            }

            // RX/RY/RZ [q0,q1,…] [angle] — same rotation on each wire (parallel, bracket form); omitted angle → π/2
            const rotBracketMatch = line.match(/^(RX|RY|RZ)\s*\[\s*([^\]]+)\](?:\s+(.+))?$/i);
            if (rotBracketMatch) {
                const gateName = rotBracketMatch[1].toUpperCase();
                const qubits = rotBracketMatch[2].split(',').map((q) => parseInt(q.trim(), 10));
                const angleRaw = rotBracketMatch[3];
                const angleRad =
                    angleRaw != null && String(angleRaw).trim()
                        ? parseQubiRotationAngle(String(angleRaw).trim())
                        : Math.PI / 2;
                if (
                    qubits.length >= 1 &&
                    qubits.every((q) => Number.isInteger(q) && !isNaN(q) && q >= 0) &&
                    !isNaN(angleRad)
                ) {
                    tokens.push({
                        type: 'GATE',
                        gate: gateName,
                        qubits,
                        isControlled: false,
                        params: { angle: angleRad },
                        line: lineNum
                    });
                }
                continue;
            }

            // RX/RY/RZ qubit [angle] — single-wire rotation; omitted angle → π/2 (same as parallel RX (q) path)
            const rotSingleMatch = line.match(/^(RX|RY|RZ)\s+(\d+)(?:\s+(.+))?$/i);
            if (rotSingleMatch) {
                const gateName = rotSingleMatch[1].toUpperCase();
                const qubit = parseInt(rotSingleMatch[2], 10);
                const angleRaw = rotSingleMatch[3];
                const angleRad =
                    angleRaw != null && String(angleRaw).trim()
                        ? parseQubiRotationAngle(String(angleRaw).trim())
                        : Math.PI / 2;
                if (!isNaN(angleRad) && !isNaN(qubit)) {
                    tokens.push({
                        type: 'GATE',
                        gate: gateName,
                        qubits: [qubit],
                        isControlled: false,
                        params: { angle: angleRad },
                        line: lineNum
                    });
                }
                continue;
            }
            
            // Handle REPEAT
            if (line.startsWith('REPEAT')) {
                const match = line.match(/REPEAT\s+(\d+)/);
                if (match) {
                    tokens.push({ type: 'REPEAT', value: parseInt(match[1]), line: lineNum });
                }
                continue;
            }
            
            // Handle END
            if (line === 'END') {
                tokens.push({ type: 'END', line: lineNum });
                continue;
            }
            
            // Handle gate instructions: GATE (qubits), GATE [qubits], or GATE qubit (shorthand for single qubit only)
            // First try shorthand: GATE qubit (must be single qubit, no commas)
            // This regex ensures it's a single number at the end, not multiple numbers
            const shorthandMatch = line.match(/^([A-Z0-9]+)\s+(\d+)$/);
            if (shorthandMatch) {
                const gateName = shorthandMatch[1];
                const qubit = parseInt(shorthandMatch[2]);
                
                tokens.push({
                    type: 'GATE',
                    gate: gateName,
                    qubits: [qubit],
                    isControlled: false,
                    params: {},
                    line: lineNum
                });
                continue;
            }

            // GATE + register: […] for multi-qubit / controlled gates; (…) only for parallel single-qubit;
            // ( […], […] ) for several bracket-gates in one timestep.
            const gateLine = line.match(/^([A-Z0-9]+)\s+(.+)$/);
            if (gateLine) {
                const gateName = gateLine[1];
                const rest = gateLine[2].trim();
                const tok = QubiParser.tryTokenizeGateRegister(gateName, rest, lineNum);
                if (tok) {
                    tokens.push(tok);
                    continue;
                }
            }
        }
        
        return tokens;
    }

    parseInstruction() {
        if (this.isAtEnd()) return null;
        
        const token = this.advance();
        
        if (token.type === 'REPEAT') {
            return this.parseRepeat(token);
        } else if (token.type === 'GATE') {
            return token;
        } else if (token.type === 'END') {
            return { type: 'END' };
        }
        
        return null;
    }

    parseRepeat(repeatToken) {
        const count = repeatToken.value;
        const instructions = [];
        let depth = 1; // Track nested REPEAT blocks
        
        while (!this.isAtEnd() && depth > 0) {
            const token = this.peek();
            if (!token) break;
            
            if (token.type === 'REPEAT') {
                depth++;
                const instruction = this.parseInstruction();
                if (instruction) instructions.push(instruction);
            } else if (token.type === 'END') {
                depth--;
                if (depth > 0) {
                    // This END belongs to a nested REPEAT, include it
                    const instruction = this.parseInstruction();
                    if (instruction) instructions.push(instruction);
                } else {
                    // This END belongs to our REPEAT, consume it
                    this.advance();
                }
            } else {
                const instruction = this.parseInstruction();
                if (instruction) {
                    instructions.push(instruction);
                }
            }
        }
        
        return {
            type: 'REPEAT',
            count: count,
            instructions: instructions
        };
    }

    peek() {
        if (this.isAtEnd()) return null;
        return this.tokens[this.current];
    }

    advance() {
        if (!this.isAtEnd()) this.current++;
        return this.tokens[this.current - 1];
    }

    isAtEnd() {
        return this.current >= this.tokens.length;
    }
}

class QubiExecutor {
    constructor(circuit) {
        this.circuit = circuit;
        this.parser = new QubiParser();
    }

    /**
     * Execute Qubi source into the circuit builder.
     * Supports preprocessing directives:
     * - #import file.qubi  (alias: #include)
     * - #define NAME [ ... ]  (NAME: 1–4 uppercase letters A–Z; square matrix 2^k×2^k, unitary)
     * @param {string} code
     * @param {object} [opts]
     * @param {(filename:string)=>string|null|undefined} [opts.resolveImport]
     * @param {(gateName:string)=>void} [opts.onDefineGate]
     */
    execute(code, opts = {}) {
        const { code: preprocessed } = this.preprocess(code, opts);
        const instructions = this.parser.parse(preprocessed);
        this.circuit.clear();
        
        // Find max qubit index needed
        const maxQubit = this.findMaxQubit(instructions);
        while (this.circuit.numQubits <= maxQubit) {
            this.circuit.addQubit();
        }
        
        // Build circuit visually (without expanding repeats)
        let column = 0;
        column = this.buildVisualCircuit(instructions, column);
        
        return this.circuit;
    }

    preprocess(code, opts = {}) {
        const resolveImport = typeof opts.resolveImport === 'function' ? opts.resolveImport : null;
        const onDefineGate = typeof opts.onDefineGate === 'function' ? opts.onDefineGate : null;

        const seen = new Set();
        const MAX_IMPORT_DEPTH = 20;

        const parseComplexToken = (raw) => {
            const src = String(raw ?? '').trim();
            if (!src) return null;
            let pos = 0;
            const s = src.replace(/\s+/g, '');
            const len = s.length;
            const peek = () => pos < len ? s[pos] : '';
            const eat = (ch) => { if (s[pos] === ch) { pos++; return true; } return false; };
            const cMul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
            const cExp = (z) => { const mag = Math.exp(z.re); return { re: mag * Math.cos(z.im), im: mag * Math.sin(z.im) }; };
            const applyFn = (fn, z) => {
                if (Math.abs(z.im) < 1e-15) {
                    const x = z.re;
                    switch (fn) {
                        case 'sqrt': return x >= 0 ? { re: Math.sqrt(x), im: 0 } : { re: 0, im: Math.sqrt(-x) };
                        case 'sin': return { re: Math.sin(x), im: 0 };
                        case 'cos': return { re: Math.cos(x), im: 0 };
                        case 'tan': return { re: Math.tan(x), im: 0 };
                        case 'exp': return { re: Math.exp(x), im: 0 };
                    }
                }
                switch (fn) {
                    case 'exp': return cExp(z);
                    case 'sqrt': { const r = Math.sqrt(Math.sqrt(z.re * z.re + z.im * z.im)); const theta = Math.atan2(z.im, z.re) / 2; return { re: r * Math.cos(theta), im: r * Math.sin(theta) }; }
                    case 'sin': return { re: Math.sin(z.re) * Math.cosh(z.im), im: Math.cos(z.re) * Math.sinh(z.im) };
                    case 'cos': return { re: Math.cos(z.re) * Math.cosh(z.im), im: -Math.sin(z.re) * Math.sinh(z.im) };
                    case 'tan': { const sn = applyFn('sin', z); const cs = applyFn('cos', z); const d = cs.re * cs.re + cs.im * cs.im; if (d < 1e-30) return null; return { re: (sn.re * cs.re + sn.im * cs.im) / d, im: (sn.im * cs.re - sn.re * cs.im) / d }; }
                }
                return null;
            };
            const pExpr = () => {
                let left = pTerm(); if (!left) return null;
                while (pos < len) {
                    if (peek() === '+') { pos++; const r = pTerm(); if (!r) return null; left = { re: left.re + r.re, im: left.im + r.im }; }
                    else if (peek() === '-') { pos++; const r = pTerm(); if (!r) return null; left = { re: left.re - r.re, im: left.im - r.im }; }
                    else break;
                }
                return left;
            };
            const pTerm = () => {
                let left = pUnary(); if (!left) return null;
                while (pos < len) {
                    if (peek() === '*') { pos++; const r = pUnary(); if (!r) return null; left = cMul(left, r); }
                    else if (peek() === '/') { pos++; const r = pUnary(); if (!r) return null; const d = r.re * r.re + r.im * r.im; if (d < 1e-30) return null; left = { re: (left.re * r.re + left.im * r.im) / d, im: (left.im * r.re - left.re * r.im) / d }; }
                    else { const c = peek(); if (c && (c === '(' || c === 'i' || c === 'p' || c === 'e' || c === 's' || c === 'c' || c === 't' || (c >= '0' && c <= '9') || c === '.')) { const r = pUnary(); if (!r) return null; left = cMul(left, r); } else break; }
                }
                return left;
            };
            const pUnary = () => {
                if (peek() === '-') { pos++; const v = pAtom(); return v ? { re: -v.re, im: -v.im } : null; }
                if (peek() === '+') pos++;
                return pAtom();
            };
            const pAtom = () => {
                if (peek() === '(') { pos++; const v = pExpr(); if (!v) return null; eat(')'); return v; }
                for (const fn of ['sqrt', 'sin', 'cos', 'tan', 'exp']) {
                    if (s.substring(pos, pos + fn.length).toLowerCase() === fn && s[pos + fn.length] === '(') { pos += fn.length; pos++; const arg = pExpr(); if (!arg) return null; eat(')'); return applyFn(fn, arg); }
                }
                if (s[pos] === 'e' && s[pos + 1] === '^') { pos += 2; const arg = pAtom(); if (!arg) return null; return cExp(arg); }
                if (s.substring(pos, pos + 2).toLowerCase() === 'pi') { pos += 2; return { re: Math.PI, im: 0 }; }
                if (s[pos] === 'e' && (pos + 1 >= len || !/[a-df-z(^]/i.test(s[pos + 1]))) { pos++; return { re: Math.E, im: 0 }; }
                if (s[pos] === 'i') { pos++; return { re: 0, im: 1 }; }
                const numMatch = s.substring(pos).match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
                if (numMatch) { pos += numMatch[0].length; return { re: parseFloat(numMatch[0]), im: 0 }; }
                return null;
            };
            const result = pExpr();
            if (!result || pos < len) return null;
            return Complex.create(result.re, result.im);
        };

        const isPowerOfTwo = (n) => (n & (n - 1)) === 0 && n > 0;

        const isUnitary = (flat, dim, eps = 1e-6) => {
            const conj = Complex.conj;
            const mul = Complex.mul;
            const add = Complex.add;
            const near = (z, re, im = 0) => Math.abs(z.re - re) <= eps && Math.abs(z.im - im) <= eps;

            // U†U ≈ I
            for (let r = 0; r < dim; r++) {
                for (let c = 0; c < dim; c++) {
                    let sum = Complex.create(0, 0);
                    for (let k = 0; k < dim; k++) {
                        const a = conj(flat[k * dim + r]); // conj(U[k,r])
                        const b = flat[k * dim + c];      // U[k,c]
                        sum = add(sum, mul(a, b));
                    }
                    if (r === c) {
                        if (!near(sum, 1, 0)) return false;
                    } else {
                        if (!near(sum, 0, 0)) return false;
                    }
                }
            }
            return true;
        };

        const defineGateFromMatrixSpec = (gateName, spec, displayName, colorId) => {
            const name = String(gateName ?? '').trim().toUpperCase();
            if (!/^[A-Z]{1,4}$/.test(name)) {
                throw new Error(`Invalid gate name in #define: "${gateName}". Use 1–4 uppercase letters (A–Z) only.`);
            }
            const body = String(spec ?? '').trim();
            if (!body.startsWith('[') || !body.endsWith(']')) {
                throw new Error(`#define ${name}: matrix must be in [ ... ] brackets`);
            }
            const inside = body.slice(1, -1).trim();
            const rows = inside.split(';').map(r => r.trim()).filter(Boolean);
            if (rows.length === 0) throw new Error(`#define ${name}: empty matrix`);

            const splitMatrixRow = (row) => {
                const tokens = [];
                let cur = '';
                let depth = 0;
                for (let j = 0; j < row.length; j++) {
                    const ch = row[j];
                    if (ch === '(') depth++;
                    else if (ch === ')') depth = Math.max(0, depth - 1);
                    if (depth === 0 && (ch === ',' || ch === ' ' || ch === '\t')) {
                        if (cur.trim()) tokens.push(cur.trim());
                        cur = '';
                    } else {
                        cur += ch;
                    }
                }
                if (cur.trim()) tokens.push(cur.trim());
                return tokens;
            };
            const parsedRows = rows.map(r => {
                const parts = splitMatrixRow(r);
                return parts.map(parseComplexToken);
            });
            const dim = parsedRows.length;
            if (!parsedRows.every(rr => rr.length === dim)) {
                throw new Error(`#define ${name}: matrix must be square (N×N)`);
            }
            if (!isPowerOfTwo(dim)) {
                throw new Error(`#define ${name}: matrix dimension must be a power of two (2,4,8,...)`);
            }
            if (dim > 16) {
                throw new Error(`#define ${name}: matrix too large (max 16×16)`);
            }
            for (let r = 0; r < dim; r++) {
                for (let c = 0; c < dim; c++) {
                    if (!parsedRows[r][c]) {
                        throw new Error(`#define ${name}: invalid complex number at (${r + 1}, ${c + 1})`);
                    }
                }
            }
            const flat = [];
            for (let r = 0; r < dim; r++) for (let c = 0; c < dim; c++) flat.push(parsedRows[r][c]);
            if (!isUnitary(flat, dim)) {
                throw new Error(`#define ${name}: matrix is not unitary (U†U must equal I)`);
            }
            GateMatrices[name] = flat;
            if (onDefineGate) onDefineGate(name, displayName || null, colorId || null);
        };

        const expand = (src, depth, stackKey) => {
            if (depth > MAX_IMPORT_DEPTH) {
                throw new Error(`#import exceeded max depth (${MAX_IMPORT_DEPTH})`);
            }
            const lines = String(src ?? '').split(/\r?\n/);
            const out = [];
            for (let i = 0; i < lines.length; i++) {
                const rawLine = lines[i];
                const line = rawLine.trim();
                if (!line) { out.push(rawLine); continue; }
                if (line.startsWith('//')) { out.push(rawLine); continue; }

                const importMatch = line.match(/^#(?:import|include)\s+([A-Za-z0-9._-]+)$/i);
                if (importMatch) {
                    const file = importMatch[1];
                    if (!resolveImport) {
                        throw new Error(`#import ${file}: no import resolver available`);
                    }
                    const key = `${stackKey}=>${file.toLowerCase()}`;
                    if (seen.has(key)) {
                        throw new Error(`#import cycle detected involving "${file}"`);
                    }
                    seen.add(key);
                    const imported = resolveImport(file);
                    if (typeof imported !== 'string') {
                        throw new Error(`#import ${file}: file not found`);
                    }
                    const expandedImport = expand(imported, depth + 1, file);
                    out.push(`// --- begin import: ${file} ---`);
                    out.push(expandedImport);
                    out.push(`// --- end import: ${file} ---`);
                    continue;
                }

                const defineMatch = line.match(/^#define\s+([A-Za-z]{1,4})\s+(\[.*?\])\s*(.*)?$/i);
                if (defineMatch) {
                    const extras = (defineMatch[3] || '').trim();
                    let displayName = null, colorId = null;
                    // Parse optional "name" "color" or . "color"
                    const extParts = [];
                    let ep = extras;
                    while (ep.length > 0) {
                        ep = ep.trim();
                        if (ep.startsWith('"')) {
                            const end = ep.indexOf('"', 1);
                            if (end !== -1) { extParts.push(ep.slice(1, end)); ep = ep.slice(end + 1); }
                            else break;
                        } else if (ep.startsWith('.')) {
                            extParts.push(null);
                            ep = ep.slice(1);
                        } else break;
                    }
                    if (extParts.length >= 1 && extParts[0] !== null) displayName = extParts[0];
                    if (extParts.length >= 2 && extParts[1] !== null) colorId = extParts[1].toLowerCase();
                    defineGateFromMatrixSpec(defineMatch[1], defineMatch[2], displayName, colorId);
                    out.push(`// ${rawLine}`);
                    continue;
                }

                out.push(rawLine);
            }
            return out.join('\n');
        };

        return { code: expand(code, 0, 'main') };
    }
    
    buildVisualCircuit(instructions, startColumn) {
        let column = startColumn;
        
        for (const instruction of instructions) {
            if (instruction.type === 'REPEAT') {
                // Add REPEAT control flow block
                this.circuit.addControlFlow('REPEAT', column, { count: instruction.count });
                column++;
                
                // Recursively build inner instructions
                column = this.buildVisualCircuit(instruction.instructions, column);
                
                // Add END control flow block
                this.circuit.addControlFlow('END', column, { 
                    endingType: 'REPEAT',
                    endingLabel: `REPEAT ${instruction.count}`,
                    matchedRepeatColumn: column - instruction.instructions.length - 1
                });
                column++;
            } else if (instruction.type === 'GATE') {
                this.executeGate(instruction, column);
                column++;
            }
            // Skip END tokens in parsed instructions - they're handled with REPEAT
        }
        
        return column;
    }

    findMaxQubit(instructions) {
        let max = -1;
        for (const instruction of instructions) {
            if (instruction.type === 'REPEAT') {
                const nestedMax = this.findMaxQubit(instruction.instructions);
                max = Math.max(max, nestedMax);
            } else if (instruction.type === 'GATE') {
                if (instruction.parallelBracketSegments) {
                    for (const seg of instruction.parallelBracketSegments) {
                        for (const q of seg) max = Math.max(max, q);
                    }
                } else if (instruction.qubits) {
                    for (const qubit of instruction.qubits) {
                        max = Math.max(max, qubit);
                    }
                }
            }
        }
        return max;
    }

    expandRepeats(instructions) {
        const expanded = [];
        
        for (const instruction of instructions) {
            if (instruction.type === 'REPEAT') {
                for (let i = 0; i < instruction.count; i++) {
                    const innerExpanded = this.expandRepeats(instruction.instructions);
                    expanded.push(...innerExpanded);
                }
            } else {
                expanded.push(instruction);
            }
        }
        
        return expanded;
    }

    executeGate(instruction, column) {
        const { gate, qubits, params, parallelBracketSegments } = instruction;

        if (parallelBracketSegments && parallelBracketSegments.length) {
            for (const seg of parallelBracketSegments) {
                this._executeBracketGateSegment(gate, seg, column, params || {});
            }
            return;
        }

        const qList = qubits || [];
        for (const qubit of qList) {
            if (['RX', 'RY', 'RZ'].includes(gate)) {
                const angle = params && params.angle !== undefined ? params.angle : Math.PI / 2;
                this.circuit.addGate(gate, qubit, column, null, { angle });
            } else {
                this.circuit.addGate(gate, qubit, column);
            }
        }
    }

    /**
     * One bracket register: CX/CY/CZ [c,…,t], SWAP [a,b], joint custom unitary, or broadcast single-qubit gates.
     */
    _executeBracketGateSegment(gate, qubits, column, params) {
        const n = qubits.length;
        if (gate === 'MEASURE') {
            throw new Error('MEASURE does not use […] register syntax; use MEASURE q');
        }

        if (['CX', 'CY', 'CZ'].includes(gate)) {
            if (n < 2) {
                throw new Error(`${gate} […] needs at least two indices (controls…, target).`);
            }
            const target = qubits[n - 1];
            const controls = qubits.slice(0, n - 1);
            this.circuit.addGate(gate, target, column, null, {}, controls);
            return;
        }

        if (gate === 'SWAP') {
            if (n !== 2) {
                throw new Error('SWAP [a,b] requires exactly two qubit indices.');
            }
            this.circuit.addGate('SWAP', qubits[0], column, qubits[1]);
            return;
        }

        if (typeof GateMatrices !== 'undefined' && GateMatrices[gate]) {
            const mat = GateMatrices[gate];
            const nCells = mat.length;
            const dim = Math.round(Math.sqrt(nCells));
            if (dim > 1 && dim * dim === nCells && (dim & (dim - 1)) === 0) {
                const k = Math.round(Math.log2(dim));
                if (k > 1) {
                    if (k !== n) {
                        const ex = Array.from({ length: k }, (_, i) => i).join(',');
                        throw new Error(
                            `Gate "${gate}" is a ${k}-qubit unitary (${dim}×${dim} matrix); use exactly ${k} indices, e.g. ${gate} [${ex}].`
                        );
                    }
                    this.circuit.addGate(gate, qubits[0], column, null, { ...params, jointQubits: [...qubits] });
                    return;
                }
                if (k === 1) {
                    for (const q of qubits) {
                        this.circuit.addGate(gate, q, column, null, { ...params });
                    }
                    return;
                }
            }
        }

        const broadcastSingle = new Set(['H', 'X', 'Y', 'Z', 'S', 'T', 'I']);
        if (broadcastSingle.has(gate)) {
            for (const q of qubits) {
                this.circuit.addGate(gate, q, column);
            }
            return;
        }

        throw new Error(`Gate "${gate}" cannot be used with bracket […] syntax here (not supported or unknown register).`);
    }

    generateCode(circuit, existingCode = '') {
        // Generate Qubi code from circuit, preserving comments from existing code
        const lines = [];
        const gatesByColumn = {};
        const controlFlowByColumn = {};
        
        // Parse existing code to extract comments
        const existingLines = existingCode.split('\n');
        const commentMap = new Map(); // Map column index to comments before that column
        const afterCommentMap = new Map(); // Trailing // on same line as instruction, after generated line
        const standaloneComments = []; // Comments not associated with specific columns

        // Group gates by column
        for (const gate of circuit.gates) {
            if (!gatesByColumn[gate.column]) {
                gatesByColumn[gate.column] = [];
            }
            gatesByColumn[gate.column].push(gate);
        }
        
        // Group control flow by column
        for (const cf of circuit.controlFlow) {
            controlFlowByColumn[cf.column] = cf;
        }
        
        // Get all columns (gates + control flow)
        const allColumns = [...new Set([
            ...Object.keys(gatesByColumn).map(Number),
            ...Object.keys(controlFlowByColumn).map(Number)
        ])].sort((a, b) => a - b);
        
        // Extract comments from existing code (skip if existingCode is empty/whitespace only)
        if (existingCode.trim().length > 0 && globalThis.QubiLex) {
            const strippedBody = globalThis.QubiLex.lexStripComments(existingCode);
            const strippedLines = strippedBody.split('\n');
            let instructionIndex = 0;
            for (let i = 0; i < existingLines.length; i++) {
                const rawLine = existingLines[i];
                const lineTrim = rawLine.trim();
                const execTrim = (strippedLines[i] !== undefined ? strippedLines[i] : '').trim();

                if (!lineTrim) {
                    if (instructionIndex < allColumns.length) {
                        if (!commentMap.has(instructionIndex)) {
                            commentMap.set(instructionIndex, []);
                        }
                        commentMap.get(instructionIndex).push('');
                    } else {
                        standaloneComments.push('');
                    }
                    continue;
                }

                if (execTrim.length === 0) {
                    if (instructionIndex < allColumns.length) {
                        if (!commentMap.has(instructionIndex)) {
                            commentMap.set(instructionIndex, []);
                        }
                        commentMap.get(instructionIndex).push(rawLine);
                    } else {
                        standaloneComments.push(rawLine);
                    }
                    continue;
                }

                const cstart = globalThis.QubiLex.findLineCommentStart(rawLine);
                if (cstart !== -1) {
                    const tail = rawLine.slice(cstart).trimEnd();
                    if (tail) {
                        if (!afterCommentMap.has(instructionIndex)) {
                            afterCommentMap.set(instructionIndex, []);
                        }
                        afterCommentMap.get(instructionIndex).push(tail);
                    }
                }
                instructionIndex++;
            }
        } else if (existingCode.trim().length > 0) {
            let instructionIndex = 0;
            for (let i = 0; i < existingLines.length; i++) {
                const line = existingLines[i].trim();
                if (!line) {
                    if (instructionIndex < allColumns.length) {
                        if (!commentMap.has(instructionIndex)) {
                            commentMap.set(instructionIndex, []);
                        }
                        commentMap.get(instructionIndex).push('');
                    } else {
                        standaloneComments.push('');
                    }
                } else if (line.startsWith('//')) {
                    if (instructionIndex < allColumns.length) {
                        if (!commentMap.has(instructionIndex)) {
                            commentMap.set(instructionIndex, []);
                        }
                        commentMap.get(instructionIndex).push(existingLines[i]);
                    } else {
                        standaloneComments.push(existingLines[i]);
                    }
                } else {
                    instructionIndex++;
                }
            }
        }
        
        let indentLevel = 0;
        let outputIndex = 0;
        
        for (const col of allColumns) {
            // Add comments associated with this column
            if (commentMap.has(outputIndex)) {
                for (const comment of commentMap.get(outputIndex)) {
                    lines.push(comment);
                }
            }
            
            const cf = controlFlowByColumn[col];
            const gates = gatesByColumn[col];
            
            // Handle control flow
            if (cf) {
                if (cf.type === 'REPEAT') {
                    lines.push('  '.repeat(indentLevel) + `REPEAT ${cf.params.count}`);
                    indentLevel++;
                } else if (cf.type === 'END') {
                    indentLevel = Math.max(0, indentLevel - 1);
                    lines.push('  '.repeat(indentLevel) + 'END');
                }
            }
            
            // Handle gates at this column
            if (gates && gates.length > 0) {
            // Group gates by type and qubits/targets. Rotations must include angle in the key so different
            // angles on the same column stay separate; same angle + same type merges for RX (0,1,2) θ output.
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
                let key = `${gate.type}_${gate.target || 'single'}`;
                if (gate.params && Array.isArray(gate.params.jointQubits) && gate.params.jointQubits.length > 0) {
                    key = `${gate.type}_JOINT_${gate.params.jointQubits.join(',')}`;
                } else if (['CX', 'CY', 'CZ'].includes(gate.type) && gate.multiQubits && gate.multiQubits.length) {
                    key = `${gate.type}_MULTI_${gate.multiQubits.join(',')}_${gate.qubit}`;
                } else if (['RX', 'RY', 'RZ'].includes(gate.type)) {
                    key = `${gate.type}_a${rotAngleKey(gate)}`;
                }
                if (!gateGroups[key]) {
                    gateGroups[key] = [];
                }
                gateGroups[key].push(gate);
            }

            const gateGroupValues = Object.values(gateGroups);
            const consumed = new Set();
            const indent = '  '.repeat(indentLevel);

            const isBundleableCxCyCz = (g) =>
                g &&
                ['CX', 'CY', 'CZ'].includes(g.type) &&
                !(g.params && g.params.jointQubits && g.params.jointQubits.length) &&
                ((g.multiQubits && g.multiQubits.length) || (g.target !== null && g.target !== undefined));

            const cxCyCzBracketStr = (g) => {
                if (g.multiQubits && g.multiQubits.length) {
                    return `[${[...g.multiQubits, g.qubit].join(',')}]`;
                }
                return `[${g.target},${g.qubit}]`;
            };

            for (const btyp of ['CX', 'CY', 'CZ']) {
                const cand = gateGroupValues.filter((grp) => grp[0] && grp[0].type === btyp && isBundleableCxCyCz(grp[0]));
                if (cand.length >= 2) {
                    const parts = cand.map((grp) => cxCyCzBracketStr(grp[0]));
                    lines.push(indent + `${btyp} (${parts.join(', ')})`);
                    cand.forEach((grp) => consumed.add(grp));
                }
            }

            // Generate code for each group
            for (const group of gateGroupValues) {
                if (consumed.has(group)) continue;
                const g0 = group[0];

                if (['CX', 'CY', 'CZ'].includes(g0.type) && g0.multiQubits && g0.multiQubits.length > 0) {
                    // Multi-controlled gate
                    const controls = g0.multiQubits;
                    const target = g0.qubit;
                        lines.push(indent + `${g0.type} [${[...controls, target].join(',')}]`);
                } else if (g0.target !== null && g0.target !== undefined) {
                    // Two-qubit gate
                    const control = g0.target;
                    const target = g0.qubit;
                        lines.push(indent + `${g0.type} [${control},${target}]`);
                } else if (['RX', 'RY', 'RZ'].includes(g0.type)) {
                    const angleRad =
                        g0.params && typeof g0.params.angle === 'number'
                            ? g0.params.angle
                            : defaultRotAngle;
                    const anglePi = angleRad / Math.PI;
                    const angleStr = parseFloat(anglePi.toFixed(4));
                    const qubits = group.map(g => g.qubit).sort((a, b) => a - b);
                    const mixedAngle = group.some(g => {
                        const ar =
                            g.params && typeof g.params.angle === 'number'
                                ? g.params.angle
                                : defaultRotAngle;
                        return Math.abs(ar - angleRad) > 1e-6;
                    });
                    if (mixedAngle) {
                        for (const g of [...group].sort((a, b) => a.qubit - b.qubit)) {
                            const ar =
                                g.params && typeof g.params.angle === 'number'
                                    ? g.params.angle
                                    : defaultRotAngle;
                            lines.push(
                                indent +
                                    `${g.type} ${g.qubit} ${parseFloat((ar / Math.PI).toFixed(4))}`
                            );
                        }
                    } else if (qubits.length === 1) {
                        lines.push(indent + `${g0.type} ${qubits[0]} ${angleStr}`);
                    } else {
                        lines.push(indent + `${g0.type} [${qubits.join(',')}] ${angleStr}`);
                    }
                } else if (g0.params && Array.isArray(g0.params.jointQubits) && g0.params.jointQubits.length > 0) {
                    const qs = [...g0.params.jointQubits];
                    lines.push(indent + `${g0.type} [${qs.join(',')}]`);
                } else {
                    // Single-qubit gates (H, X, …), parallel without per-wire params
                    const qubits = group.map(g => g.qubit).sort((a, b) => a - b);
                    const gateType = g0.type;

                    if (qubits.length === 1) {
                        lines.push(indent + `${gateType} ${qubits[0]}`);
                    } else {
                        lines.push(indent + `${gateType} (${qubits.join(',')})`);
                    }
                }
            }
            }
            if (afterCommentMap.has(outputIndex)) {
                for (const tail of afterCommentMap.get(outputIndex)) {
                    lines.push(tail);
                }
            }
            outputIndex++;
        }
        
        // Add standalone comments at the end
        if (standaloneComments.length > 0) {
            lines.push(...standaloneComments);
        }
        
        return lines.join('\n');
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.QubiParser = QubiParser;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QubiParser, QubiExecutor, QubiLex: globalThis.QubiLex, parseQubiRotationAngle };
}


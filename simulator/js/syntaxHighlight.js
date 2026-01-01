// Qubi Syntax Highlighter

class QubiSyntaxHighlighter {
    constructor(textareaId, highlightId, lineNumbersId) {
        this.textarea = document.getElementById(textareaId);
        this.highlight = document.getElementById(highlightId);
        this.lineNumbers = document.getElementById(lineNumbersId);
        
        if (!this.textarea || !this.highlight) {
            console.warn('Syntax highlighter elements not found');
            return;
        }
        
        this.debounceTimer = null;
        this.debounceDelay = 400; // ms to wait before full syntax validation
        this.lineErrors = new Map(); // Store error messages for each line
        
        this.validGates = new Set([
            'H', 'X', 'Y', 'Z', 'S', 'T',
            'RX', 'RY', 'RZ',
            'CX', 'CY', 'CZ', 'SWAP',
            'MEASURE'
        ]);
        
        this.keywords = new Set(['REPEAT', 'END']);
        
        // Create tooltip element
        this.tooltip = this.createTooltip();
        
        this.initEventListeners();
        this.updateHighlight();
        this.updateLineNumbers();
        this.updateWrapperWidth();
    }
    
    createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'syntax-error-tooltip';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);
        return tooltip;
    }
    
    showTooltip(message, x, y) {
        this.tooltip.textContent = message;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
    }
    
    hideTooltip() {
        this.tooltip.style.display = 'none';
    }
    
    initEventListeners() {
        // Input event - immediate visual update, debounced validation
        this.textarea.addEventListener('input', () => {
            this.hideTooltip(); // Hide tooltip while typing
            this.updateHighlightImmediate(); // Show text immediately
            this.updateLineNumbers(); // Update line numbers immediately
            this.updateWrapperWidth(); // Update wrapper width for horizontal scrolling
            this.syncScroll();
            this.debouncedValidation(); // Validate after delay
        });
        
        // Scroll sync - listen to wrapper scroll instead
        const wrapper = this.textarea.closest('.code-editor-wrapper');
        if (wrapper) {
            wrapper.addEventListener('scroll', () => {
                this.syncScroll();
            });
        }
        
        // Also handle textarea scroll for compatibility
        this.textarea.addEventListener('scroll', () => {
            this.syncScroll();
        });
        
        // Handle tab key and enter key
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.textarea.selectionStart;
                const end = this.textarea.selectionEnd;
                const value = this.textarea.value;
                this.textarea.value = value.substring(0, start) + '    ' + value.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
                this.updateHighlightImmediate();
                this.updateLineNumbers();
            }
        });
        
        // Show tooltip on cursor position change (click or arrow keys)
        this.textarea.addEventListener('click', (e) => {
            this.checkErrorAtCursor(e);
        });
        
        this.textarea.addEventListener('keyup', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                this.checkErrorAtCursor(e);
            }
        });
        
        // Hide tooltip when textarea loses focus
        this.textarea.addEventListener('blur', () => {
            this.hideTooltip();
        });
        
        // Line numbers hover
        if (this.lineNumbers) {
            this.lineNumbers.addEventListener('mouseover', (e) => {
                if (e.target.classList.contains('line-num') && e.target.classList.contains('error')) {
                    const lineNum = parseInt(e.target.textContent) - 1;
                    const errorMsg = this.lineErrors.get(lineNum);
                    if (errorMsg) {
                        const rect = e.target.getBoundingClientRect();
                        this.showTooltip(errorMsg, rect.right + 10, rect.top);
                    }
                }
            });
            
            this.lineNumbers.addEventListener('mouseout', (e) => {
                if (e.target.classList.contains('line-num')) {
                    this.hideTooltip();
                }
            });
        }
    }
    
    checkErrorAtCursor(e) {
        const cursorPos = this.textarea.selectionStart;
        const textBeforeCursor = this.textarea.value.substring(0, cursorPos);
        const lineNum = textBeforeCursor.split('\n').length - 1;
        
        const errorMsg = this.lineErrors.get(lineNum);
        if (errorMsg) {
            // Position tooltip near the textarea
            const rect = this.textarea.getBoundingClientRect();
            const lines = textBeforeCursor.split('\n');
            const lineHeight = parseFloat(getComputedStyle(this.textarea).lineHeight) || 22;
            const paddingTop = parseFloat(getComputedStyle(this.textarea).paddingTop) || 16;
            const yOffset = (lines.length * lineHeight) + paddingTop - this.textarea.scrollTop;
            
            this.showTooltip(errorMsg, rect.left + 20, rect.top + Math.min(yOffset, rect.height - 30));
        } else {
            this.hideTooltip();
        }
    }
    
    debouncedValidation() {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.updateHighlight(); // Full syntax highlighting with validation
            this.updateLineNumbers();
        }, this.debounceDelay);
    }
    
    // Immediate highlight without error checking - just show the text with basic coloring
    updateHighlightImmediate() {
        if (!this.highlight) return;
        
        const code = this.textarea.value;
        const lines = code.split('\n');
        
        const highlightedLines = lines.map((line) => {
            return this.highlightLineBasic(line);
        });
        
        this.highlight.innerHTML = highlightedLines.join('\n') + '\n';
    }
    
    updateWrapperWidth() {
        // Update textarea and highlight width based on content
        if (!this.textarea || !this.highlight) return;
        
        // Calculate the maximum line width
        const lines = this.textarea.value.split('\n');
        let maxWidth = 0;
        
        // Create a temporary element to measure text width
        const measureEl = document.createElement('span');
        measureEl.style.visibility = 'hidden';
        measureEl.style.position = 'absolute';
        measureEl.style.fontFamily = getComputedStyle(this.textarea).fontFamily;
        measureEl.style.fontSize = getComputedStyle(this.textarea).fontSize;
        measureEl.style.whiteSpace = 'pre';
        document.body.appendChild(measureEl);
        
        for (const line of lines) {
            measureEl.textContent = line || ' '; // Use space for empty lines
            const width = measureEl.offsetWidth;
            maxWidth = Math.max(maxWidth, width);
        }
        
        document.body.removeChild(measureEl);
        
        // Add padding (1rem on each side = 32px total)
        const padding = 32;
        const contentWidth = maxWidth + padding;
        const wrapper = this.textarea.closest('.code-editor-wrapper');
        const wrapperWidth = wrapper ? wrapper.offsetWidth : 0;
        
        // Set width to be at least wrapper width, but expand if content is wider
        const finalWidth = Math.max(wrapperWidth, contentWidth);
        this.textarea.style.width = `${finalWidth}px`;
        this.highlight.style.width = `${finalWidth}px`;
    }
    
    syncScroll() {
        // Sync scroll with wrapper instead of textarea's internal scroll
        const wrapper = this.textarea.closest('.code-editor-wrapper');
        if (wrapper) {
            // Get the scroll position from the wrapper
            const scrollLeft = wrapper.scrollLeft;
            const scrollTop = wrapper.scrollTop;
            
            // Apply to highlight and line numbers
            if (this.highlight) {
                this.highlight.scrollTop = scrollTop;
                this.highlight.scrollLeft = scrollLeft;
            }
            if (this.lineNumbers) {
                this.lineNumbers.scrollTop = scrollTop;
            }
        }
    }
    
    updateLineNumbers() {
        if (!this.lineNumbers) return;
        
        const lines = this.textarea.value.split('\n');
        
        let html = '';
        for (let i = 0; i < lines.length; i++) {
            const errorMsg = this.lineErrors.get(i);
            const isError = !!errorMsg;
            const tooltip = errorMsg ? ` title="${this.escapeHtml(errorMsg)}"` : '';
            html += `<span class="line-num${isError ? ' error' : ''}"${tooltip}>${i + 1}</span>`;
        }
        
        this.lineNumbers.innerHTML = html;
    }
    
    validateLines(lines) {
        this.lineErrors.clear();
        let inRepeat = 0;
        const repeatStack = []; // Track line numbers of REPEAT statements
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines and comments
            if (!line || line.startsWith('//')) continue;
            
            // Check for valid syntax
            const error = this.getLineError(line);
            if (error) {
                this.lineErrors.set(i, error);
                continue;
            }
            
            // Track REPEAT/END balance
            if (line.startsWith('REPEAT')) {
                inRepeat++;
                repeatStack.push(i);
            } else if (line === 'END') {
                if (inRepeat <= 0) {
                    this.lineErrors.set(i, 'END without matching REPEAT');
                } else {
                    inRepeat--;
                    repeatStack.pop();
                }
            }
        }
        
        // Mark unclosed REPEATs
        for (const lineNum of repeatStack) {
            this.lineErrors.set(lineNum, 'REPEAT without matching END');
        }
    }
    
    getLineError(line) {
        // Empty or comment - no error
        if (!line || line.startsWith('//')) return null;
        
        // REPEAT N
        if (/^REPEAT\s*/.test(line)) {
            if (!/^REPEAT\s+\d+$/.test(line)) {
                return 'REPEAT requires a number (e.g., REPEAT 5)';
            }
            return null;
        }
        
        // END
        if (line === 'END') return null;
        
        // Extract the first word (potential gate name)
        const firstWord = line.split(/[\s(\[]/)[0];
        
        // Check if it's a valid gate
        if (!this.validGates.has(firstWord) && !this.keywords.has(firstWord)) {
            return `"${firstWord}" is not a recognized gate. Valid gates: H, X, Y, Z, S, T, RX, RY, RZ, CX, CY, CZ, SWAP, MEASURE`;
        }
        
        // Rotation gate with angle: RX 0 0.5
        if (/^(RX|RY|RZ)/.test(line)) {
            if (!/^(RX|RY|RZ)\s+\d+\s+[\d.]+$/.test(line)) {
                return `${firstWord} requires qubit and angle (e.g., ${firstWord} 0 0.5)`;
            }
            return null;
        }
        
        // Gate with shorthand: H 0
        if (/^[A-Z]+\s+\d+$/.test(line)) {
            return null;
        }
        
        // Gate with parentheses: H (0,1,2)
        if (/^[A-Z]+\s*\([^)]*\)$/.test(line)) {
            const content = line.match(/\(([^)]*)\)/)?.[1];
            if (!content || !/^[\d,\s]+$/.test(content)) {
                return 'Invalid qubit list in parentheses. Use numbers separated by commas (e.g., (0,1,2))';
            }
            return null;
        }
        
        // Gate with brackets: CX [0,1]
        if (/^[A-Z]+\s*\[[^\]]*\]$/.test(line)) {
            const content = line.match(/\[([^\]]*)\]/)?.[1];
            if (!content || !/^[\d,\s]+$/.test(content)) {
                return 'Invalid qubit list in brackets. Use numbers separated by commas (e.g., [0,1,2])';
            }
            return null;
        }
        
        // Incomplete or invalid syntax
        if (line.includes('(') && !line.includes(')')) {
            return 'Missing closing parenthesis';
        }
        if (line.includes('[') && !line.includes(']')) {
            return 'Missing closing bracket';
        }
        
        return `Invalid syntax. Examples: H 0, H (0,1,2), CX [0,1]`;
    }
    
    updateHighlight() {
        if (!this.highlight) return;
        
        const code = this.textarea.value;
        const lines = code.split('\n');
        
        // Validate all lines and store errors
        this.validateLines(lines);
        
        const highlightedLines = lines.map((line, index) => {
            const errorMsg = this.lineErrors.get(index);
            return this.highlightLine(line, errorMsg);
        });
        
        // Add a trailing newline to match textarea behavior
        this.highlight.innerHTML = highlightedLines.join('\n') + '\n';
        
        // Update wrapper width after highlighting
        this.updateWrapperWidth();
        
        // Trigger error state update event
        const errorEvent = new CustomEvent('qubiErrorStateChanged', {
            detail: { hasErrors: this.lineErrors.size > 0 }
        });
        this.textarea.dispatchEvent(errorEvent);
    }
    
    // Basic highlighting - just colors, no error checking (for immediate feedback)
    highlightLineBasic(line) {
        if (!line) return '';
        
        // Comment line
        if (line.trim().startsWith('//')) {
            return `<span class="token-comment">${this.escapeHtml(line)}</span>`;
        }
        
        return this.tokenizeLine(line, false);
    }
    
    // Full highlighting with error indication
    highlightLine(line, errorMsg) {
        if (!line) return '';
        
        // Wrap in error span if invalid
        const hasError = !!errorMsg;
        const tooltip = hasError ? ` title="${this.escapeHtml(errorMsg)}"` : '';
        const wrapper = hasError ? [`<span class="line-error"${tooltip}>`, '</span>'] : ['', ''];
        
        // Comment line
        if (line.trim().startsWith('//')) {
            return wrapper[0] + `<span class="token-comment">${this.escapeHtml(line)}</span>` + wrapper[1];
        }
        
        return wrapper[0] + this.tokenizeLine(line, hasError) + wrapper[1];
    }
    
    tokenizeLine(line, hasError) {
        let result = '';
        let remaining = line;
        
        // Tokenize and highlight
        while (remaining.length > 0) {
            // Leading whitespace
            const wsMatch = remaining.match(/^(\s+)/);
            if (wsMatch) {
                result += wsMatch[1];
                remaining = remaining.substring(wsMatch[1].length);
                continue;
            }
            
            // Inline comment
            const commentMatch = remaining.match(/^(\/\/.*)$/);
            if (commentMatch) {
                result += `<span class="token-comment">${this.escapeHtml(commentMatch[1])}</span>`;
                break;
            }
            
            // Keywords (REPEAT, END)
            const keywordMatch = remaining.match(/^(REPEAT|END)\b/);
            if (keywordMatch) {
                result += `<span class="token-keyword">${keywordMatch[1]}</span>`;
                remaining = remaining.substring(keywordMatch[1].length);
                continue;
            }
            
            // Gate names (uppercase)
            const gateMatch = remaining.match(/^([A-Z]+)/);
            if (gateMatch) {
                const gate = gateMatch[1];
                const isValid = this.validGates.has(gate);
                const tokenClass = hasError && !isValid ? 'token-invalid' : 'token-gate';
                result += `<span class="${tokenClass}">${gate}</span>`;
                remaining = remaining.substring(gate.length);
                continue;
            }
            
            // Brackets with content: [0,1,2]
            const bracketMatch = remaining.match(/^(\[[^\]]*\]?)/);
            if (bracketMatch) {
                result += `<span class="token-control-qubits">${this.escapeHtml(bracketMatch[1])}</span>`;
                remaining = remaining.substring(bracketMatch[1].length);
                continue;
            }
            
            // Parentheses with content: (0,1,2)
            const parenMatch = remaining.match(/^(\([^)]*\)?)/);
            if (parenMatch) {
                result += `<span class="token-target-qubits">${this.escapeHtml(parenMatch[1])}</span>`;
                remaining = remaining.substring(parenMatch[1].length);
                continue;
            }
            
            // Numbers (including decimals)
            const numMatch = remaining.match(/^(\d+\.?\d*)/);
            if (numMatch) {
                result += `<span class="token-number">${numMatch[1]}</span>`;
                remaining = remaining.substring(numMatch[1].length);
                continue;
            }
            
            // Word characters (potential invalid identifier) - show as text
            const wordMatch = remaining.match(/^([a-z]+)/i);
            if (wordMatch) {
                result += this.escapeHtml(wordMatch[1]);
                remaining = remaining.substring(wordMatch[1].length);
                continue;
            }
            
            // Any other character - just show it
            result += this.escapeHtml(remaining[0]);
            remaining = remaining.substring(1);
        }
        
        return result;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Public method to force update (e.g., when code is loaded programmatically)
    refresh() {
        this.updateHighlight();
        this.updateLineNumbers();
        this.updateWrapperWidth();
    }
    
    // Set code programmatically and update highlighting
    setCode(code) {
        this.textarea.value = code;
        this.updateHighlight();
        this.updateLineNumbers();
        this.updateWrapperWidth();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QubiSyntaxHighlighter };
}


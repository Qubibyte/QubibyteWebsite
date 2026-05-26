/**
 * Load blogData.json for /blog/N/ pages (fixes fetch when URL has no trailing slash).
 */
(function () {
    function getBlogNumber() {
        const path = window.location.pathname.replace(/\\/g, '/');
        const m = path.match(/\/blog\/(\d+)(?:\/|$)/);
        return m ? m[1] : null;
    }

    function getBlogDataUrl() {
        const n = getBlogNumber();
        if (n) return `/blog/${n}/blogData.json`;
        return new URL('blogData.json', window.location.href).href;
    }

    function resolveContentUrl(src) {
        if (window.QubibyteContentUrl?.resolve) {
            return window.QubibyteContentUrl.resolve(src, getBlogNumber());
        }
        if (!src || /^https?:\/\//i.test(src) || src.startsWith('data:')) return src;
        const clean = src.replace(/^\.\//, '');
        if (clean.startsWith('/')) return clean.replace(/\/{2,}/g, '/');
        const n = getBlogNumber();
        if (n) return `/blog/${n}/${clean}`.replace(/\/{2,}/g, '/');
        return new URL(src, window.location.href).href;
    }

    function youtubeEmbedSrc(url) {
        if (window.QubibyteContentUrl?.youtubeEmbedSrc) {
            return window.QubibyteContentUrl.youtubeEmbedSrc(url);
        }
        return url;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function highlightQubi(code) {
        return code.split('\n').map((line) => {
            let comment = '';
            let text = line;
            const idx = line.indexOf('//');
            if (idx !== -1) {
                comment = '<span class="hl-comment">' + escapeHtml(line.slice(idx)) + '</span>';
                text = line.slice(0, idx);
            }
            const regex = /\b(H|X|Y|Z|S|T|RX|RY|RZ|CX|CY|CZ|SWAP|MEASURE)\b|\b(REPEAT|END)\b|(\[[^\]]+\])|(\([^)]+\))|\b(\d+\.?\d*)\b/g;
            const highlighted = escapeHtml(text).replace(regex, (match, gate, kw, br, pa, num) => {
                if (gate) return `<span class="hl-gate">${gate}</span>`;
                if (kw) return `<span class="hl-keyword">${kw}</span>`;
                if (br) return `<span class="hl-bracket">${br}</span>`;
                if (pa) return `<span class="hl-paren">${pa}</span>`;
                if (num) return `<span class="hl-number">${num}</span>`;
                return match;
            });
            return highlighted + comment;
        }).join('\n');
    }

    function highlightPython(code) {
        return code.split('\n').map((line) => {
            let comment = '';
            let text = line;
            const idx = line.indexOf('#');
            if (idx !== -1) {
                comment = '<span class="hl-py-comment">' + escapeHtml(line.slice(idx)) + '</span>';
                text = line.slice(0, idx);
            }
            const regex = /\b(from|import|as|def|class|return|if|else|for|in|with)\b|(\.\w+)\(|('[^']*'|"[^"]*")/g;
            const highlighted = escapeHtml(text).replace(regex, (match, kw, fn, str) => {
                if (kw) return `<span class="hl-py-kw">${kw}</span>`;
                if (fn) return `<span class="hl-py-fn">${fn}</span>(`;
                if (str) return `<span class="hl-py-str">${str}</span>`;
                return match;
            });
            return highlighted + comment;
        }).join('\n');
    }

    function highlightQasm(code) {
        return code.split('\n').map((line) => {
            let comment = '';
            let text = line;
            const idx = line.indexOf('//');
            if (idx !== -1) {
                comment = '<span class="hl-comment">' + escapeHtml(line.slice(idx)) + '</span>';
                text = line.slice(0, idx);
            }
            const regex = /\b(OPENQASM|include|qubit|bit|qreg|creg|gate|if|measure)\b|\b(h|x|y|z|s|t|rx|ry|rz|cx|cy|cz|swap|ccx|reset)\b|(\[[^\]]+\])|("[^"]*")|\b(\d+\.?\d*)\b/g;
            const highlighted = escapeHtml(text).replace(regex, (match, kw, gate, br, str, num) => {
                if (kw) return `<span class="hl-keyword">${kw}</span>`;
                if (gate) return `<span class="hl-gate">${gate}</span>`;
                if (br) return `<span class="hl-bracket">${br}</span>`;
                if (str) return `<span class="hl-py-str">${str}</span>`;
                if (num) return `<span class="hl-number">${num}</span>`;
                return match;
            });
            return highlighted + comment;
        }).join('\n');
    }

    function renderCodeBlock(item) {
        const lang = item.lang || 'qubi';
        const label = lang === 'qubi' ? 'Qubi' : lang === 'python' ? 'Python' : lang === 'qasm' ? 'OpenQASM' : lang;
        const highlighted = lang === 'qubi' ? highlightQubi(item.code)
            : lang === 'python' ? highlightPython(item.code)
                : lang === 'qasm' ? highlightQasm(item.code)
                    : escapeHtml(item.code);
        const caption = item.caption ? escapeHtml(item.caption) : '';
        return `<div class="qubi-code-block">
            <div class="qubi-code-header">
                <span class="qubi-code-lang">${escapeHtml(label)}</span>
                ${caption}
            </div>
            <pre class="qubi-code-body">${highlighted}</pre>
        </div>`;
    }

    function renderBlogTable(item) {
        const headers = item.headers || [];
        const rows = item.rows || [];
        const partCol = item.partColumn
            || (headers[2] && /part/i.test(String(headers[2])))
            || item.partNumberColumn === 2;

        let html = '<div class="blog-component-table-wrapper"><table class="blog-component-table"><thead><tr>';
        headers.forEach((h) => {
            html += `<th>${escapeHtml(h)}</th>`;
        });
        html += '</tr></thead><tbody>';
        rows.forEach((row) => {
            html += '<tr>';
            row.forEach((cell, i) => {
                if (i === 2 && partCol) {
                    if (cell === 'TBD') {
                        html += '<td><span class="tbd">TBD</span></td>';
                    } else if (cell === '—') {
                        html += '<td>—</td>';
                    } else {
                        html += `<td><span class="part-num">${escapeHtml(String(cell))}</span></td>`;
                    }
                } else {
                    html += `<td>${escapeHtml(String(cell))}</td>`;
                }
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        return html;
    }

    function renderArticle(blog) {
        const articleDiv = document.getElementById('articlediv');
        if (!articleDiv) return;

        let contentHTML = '';

        if (blog.ytvid && blog.ytvid.link) {
            const embedSrc = youtubeEmbedSrc(blog.ytvid.link);
            contentHTML += `
                <div class="blog-video-wrap">
                    <iframe id="youtubevideo" src="${escapeHtml(embedSrc)}" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
                </div>`;
        }

        contentHTML += `
            <h2 class="mt-4">${escapeHtml(blog.title)}</h2>
            <p><strong>Author:</strong> ${escapeHtml(blog.author)}</p>
            <p><strong>Date:</strong> ${escapeHtml(blog.date)}</p>
        `;

        (blog.content || []).forEach((item) => {
            if (typeof item === 'string') {
                contentHTML += `<p>${item}</p>`;
            } else if (item.type === 'image') {
                const src = resolveContentUrl(item.src);
                const sizeClass = item.size === 'small' ? ' blogimage--small' : '';
                contentHTML += `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.alt || '')}" class="blogimage img-fluid${sizeClass}">`;
            } else if (item.type === 'table' && item.headers && item.rows) {
                contentHTML += renderBlogTable(item);
            } else if (item.type === 'code' && item.code) {
                contentHTML += renderCodeBlock(item);
            } else if (item.type === 'heading' && item.text) {
                contentHTML += `<h3 class="blog-section-heading">${escapeHtml(item.text)}</h3>`;
            } else if (item.text) {
                contentHTML += `<h3 class="blog-section-heading">${escapeHtml(item.text)}</h3>`;
            }
        });

        articleDiv.innerHTML = contentHTML;
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (window.QubibyteSoftwareMode?.refreshLinkPolicies) {
            window.QubibyteSoftwareMode.refreshLinkPolicies();
        }
        fetch(getBlogDataUrl())
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(renderArticle)
            .catch((err) => {
                console.error('Error loading blog data:', err);
                const articleDiv = document.getElementById('articlediv');
                if (articleDiv) {
                    articleDiv.innerHTML =
                        '<p class="text-danger">Could not load this article. Try opening from the home page again.</p>';
                }
            });
    });
})();

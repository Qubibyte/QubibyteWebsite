var blogs = [
    {
        "id": 1,
        "caption": "The Declaration of Qubibyte & Announcement of Qubibyte Quadra",
        "author": "Trent Rosenthal",
        "date": "March 7th, 2025",
        "thumbnail": "/images/blog1thumb.png"
    },
    {
        "id": 2,
        "caption": "Qubibyte Quadra Design Choices",
        "author": "Trent Rosenthal",
        "date": "July 20th, 2025",
        "thumbnail": "/images/blog2thumb.png"
    },
    {
        "caption": "Qubibyte Quadra Simulators, Quick Demo",
        "author": "Trent Rosenthal",
        "date": "February 9th, 2026",
        "thumbnail": "/images/misc1thumb.png",
        "type": "youtube",
        "videoUrl": "https://www.youtube.com/watch?v=TBKbAuFZHYU"
    },
    {
        "id": 3,
        "caption": "Quantum Circuit Simulator, Qubi Programming Language, and QubiAI",
        "author": "Trent Rosenthal",
        "date": "April 20th, 2026",
        "thumbnail": "/images/blog3thumb.png"
    },
    {
        "caption": "Qubi Programming Language Tutorial #1: Classical & Quantum Computing",
        "author": "Trent Rosenthal",
        "date": "May 15th, 2026",
        "thumbnail": "/images/qubi1thumb.png",
        "type": "youtube",
        "videoUrl": "https://www.youtube.com/watch?v=lUor5_tTGYE"
    },
    {
        "caption": "Qubi Programming Language Tutorial #2: Introduction to Qubi",
        "author": "Trent Rosenthal",
        "date": "May 15th, 2026",
        "thumbnail": "/images/qubi2thumb.png",
        "type": "youtube",
        "videoUrl": "https://www.youtube.com/watch?v=MmtWitxGbe0"
    },
    {
        "id": 4,
        "caption": "How to Design an NMR Quantum Computer",
        "author": "Trent Rosenthal",
        "date": "May 21st, 2026",
        "thumbnail": "/images/blog3thumb.png"
    },
];

// Reverse order so latest post appears first
blogs.reverse();

// Preload AND decode all blog images before building carousel
const preloadPromises = blogs.map(blog => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = blog.thumbnail;
        img.onload = function () {
            if (img.decode) {
                img.decode().then(resolve).catch(resolve);
            } else {
                resolve();
            }
        };
        img.onerror = resolve;
    });
});

// Init immediately so it's not blank
initBlogCarousel();

// Once all images are downloaded AND decoded, re-decode the DOM images too
Promise.all(preloadPromises).then(() => {
    const domImgs = document.querySelectorAll('.blog-card-img');
    domImgs.forEach(img => {
        if (img.complete && img.naturalWidth > 0 && img.decode) {
            img.decode().catch(() => { });
        }
    });
});

function initBlogCarousel() {
    const blogCarouselRow = document.getElementById('blogCarouselRow');
    const blogDotsContainer = document.getElementById('blogCarouselDots');

    if (!blogCarouselRow || blogCarouselRow.children.length > 0) return;

    const totalBlogs = blogs.length;

    function getVisibleCount() {
        return window.innerWidth >= 992 ? 3 : 1;
    }

    function resolveBlogLink(blog) {
        let linkUrl = blog.type === 'youtube' ? blog.videoUrl : (blog.id ? `/blog/${blog.id}/` : '#');
        let linkTarget = blog.type === 'youtube' ? ' target="_blank"' : '';

        if (window.QubibyteSoftwareMode && window.QubibyteSoftwareMode.isSoftwareMode()) {
            const resolved = window.QubibyteSoftwareMode.resolveNavigation(
                linkUrl,
                blog.type === 'youtube' ? '_blank' : '_self'
            );
            if (!resolved.blocked && resolved.url) {
                linkUrl = resolved.url;
                linkTarget = '';
            }
        }
        return { linkUrl, linkTarget };
    }

    // Build card HTML for a blog entry
    function buildCardHTML(blog) {
        const { linkUrl, linkTarget } = resolveBlogLink(blog);
        const typeLabel = blog.type === 'youtube'
            ? '<span class="blog-card-type blog-type-video">▶ Video</span>'
            : '<span class="blog-card-type blog-type-article">📄 Article</span>';
        return `
            <a href="${linkUrl}"${linkTarget} class="blog-card-link">
                <img src="${blog.thumbnail}" class="blog-card-img" alt="${blog.caption}" loading="eager" decoding="async">
                <div class="blog-card-info">
                    <div class="blog-card-title">${blog.caption}</div>
                    <div class="blog-card-meta">
                        <span>${blog.author}</span>
                        <span class="blog-card-meta-sep">•</span>
                        <span>${blog.date}</span>
                    </div>
                    ${typeLabel}
                </div>
            </a>
        `;
    }

    // Create card element
    function createCard(blog, index) {
        const card = document.createElement('div');
        card.className = 'blog-card-col';
        card.dataset.index = index;
        card.innerHTML = buildCardHTML(blog);
        return card;
    }

    // ──────────── INFINITE CAROUSEL (Desktop — 3 visible) ────────────
    // Strategy: prepend `totalBlogs` clones before + append `totalBlogs` clones after.
    // Start position at clone-set offset so originals are initially visible.
    // After each animated slide, if we've slid into a clone region, instantly
    // (no transition) jump to the equivalent position in the real set.

    // Build cards: [clones of all] + [originals] + [clones of all]
    // On mobile (1-at-a-time), we still use the same DOM but cycle differently.

    // Prepend clones
    blogs.forEach((blog, i) => {
        const clone = createCard(blog, i);
        clone.classList.add('blog-clone');
        blogCarouselRow.appendChild(clone); // will reorder below
    });

    // We need: clones | originals | clones
    // First add originals
    const originals = [];
    blogs.forEach((blog, i) => {
        const card = createCard(blog, i);
        originals.push(card);
    });

    // Append clones after
    const afterClones = [];
    blogs.forEach((blog, i) => {
        const clone = createCard(blog, i);
        clone.classList.add('blog-clone');
        afterClones.push(clone);
    });

    // Clear and rebuild in order: before-clones | originals | after-clones
    blogCarouselRow.innerHTML = '';

    // Before clones
    blogs.forEach((blog, i) => {
        const clone = createCard(blog, i);
        clone.classList.add('blog-clone');
        blogCarouselRow.appendChild(clone);
    });

    // Originals
    originals.forEach(card => blogCarouselRow.appendChild(card));

    // After clones
    afterClones.forEach(clone => blogCarouselRow.appendChild(clone));

    // Total DOM cards = 3 × totalBlogs
    // Originals start at index `totalBlogs` (0-based card position in DOM)
    const cloneOffset = totalBlogs; // number of cards in before-clone set

    // ──────────── Mobile dots (still useful for mobile) ────────────
    function buildDots() {
        blogDotsContainer.innerHTML = '';
        const visCount = getVisibleCount();
        if (visCount >= 3) return; // no dots on desktop (infinite)
        for (let i = 0; i < totalBlogs; i++) {
            const dot = document.createElement('span');
            dot.className = 'blog-dot' + (i === 0 ? ' active' : '');
            dot.dataset.index = i;
            dot.addEventListener('click', () => goToBlogSlide(i));
            blogDotsContainer.appendChild(dot);
        }
    }
    buildDots();

    // Pre-decode all images
    blogCarouselRow.querySelectorAll('.blog-card-img').forEach(img => {
        const decodeImg = () => { if (img.decode) img.decode().catch(() => { }); };
        if (img.complete && img.naturalWidth > 0) decodeImg();
        else img.addEventListener('load', decodeImg);
    });

    // ──────────── Carousel state ────────────
    // `logicalIndex` = which original blog is in the leftmost visible slot (0-based)
    let logicalIndex = 0;
    let isTransitioning = false;

    // Position = DOM card index of the leftmost visible card
    function domIndex() {
        return cloneOffset + logicalIndex;
    }

    function setPosition(domIdx, animate) {
        const visCount = getVisibleCount();
        if (!animate) {
            blogCarouselRow.classList.add('no-transition');
        }
        const pct = 100 / visCount;
        blogCarouselRow.style.transform = `translateX(-${domIdx * pct}%)`;
        if (!animate) {
            void blogCarouselRow.offsetWidth;
            blogCarouselRow.classList.remove('no-transition');
        }
    }

    // Initialize position at the originals
    setPosition(domIndex(), false);

    function updateDots() {
        // Wrap logicalIndex into [0, totalBlogs) for dot highlighting
        const wrapped = ((logicalIndex % totalBlogs) + totalBlogs) % totalBlogs;
        document.querySelectorAll('.blog-dot').forEach(dot => {
            dot.classList.toggle('active', parseInt(dot.dataset.index) === wrapped);
        });
    }

    function updateBlogDetails() {
        const wrapped = ((logicalIndex % totalBlogs) + totalBlogs) % totalBlogs;
        const blog = blogs[wrapped];
        if (!blog) return;
        let captionUrl = blog.type === 'youtube' ? blog.videoUrl : (blog.id ? `/blog/${blog.id}/` : '#');
        let captionTarget = blog.type === 'youtube' ? ' target="_blank"' : '';
        if (window.QubibyteSoftwareMode && window.QubibyteSoftwareMode.isSoftwareMode()) {
            const resolved = window.QubibyteSoftwareMode.resolveNavigation(captionUrl, captionTarget ? '_blank' : '_self');
            if (!resolved.blocked && resolved.url) {
                captionUrl = resolved.url;
                captionTarget = '';
            }
        }
        const captionEl = document.getElementById("blogCaption");
        const authorEl = document.getElementById("blogAuthor");
        const dateEl = document.getElementById("blogDate");
        if (captionEl) captionEl.innerHTML = `<a href="${captionUrl}"${captionTarget} class="blog-caption-link">${blog.caption}</a>`;
        if (authorEl) authorEl.innerText = `Author: ${blog.author}`;
        if (dateEl) dateEl.innerText = `📅 Uploaded: ${blog.date}`;
    }

    // After transition ends, check if we're in clone territory and snap back
    blogCarouselRow.addEventListener('transitionend', () => {
        isTransitioning = false;
        // If logicalIndex went past the end, wrap to the equivalent original
        if (logicalIndex >= totalBlogs) {
            logicalIndex = logicalIndex - totalBlogs;
            setPosition(domIndex(), false);
        } else if (logicalIndex < 0) {
            logicalIndex = logicalIndex + totalBlogs;
            setPosition(domIndex(), false);
        }
    });

    function nextBlogSlide() {
        if (isTransitioning) return;
        isTransitioning = true;
        logicalIndex++;
        setPosition(domIndex(), true);
        updateDots();
        updateBlogDetails();
    }

    function prevBlogSlide() {
        if (isTransitioning) return;
        isTransitioning = true;
        logicalIndex--;
        setPosition(domIndex(), true);
        updateDots();
        updateBlogDetails();
    }

    function goToBlogSlide(index) {
        logicalIndex = index;
        setPosition(domIndex(), true);
        updateDots();
        updateBlogDetails();
    }

    // Button handlers
    const prevBtn = document.querySelector('.blog-carousel-prev');
    const nextBtn = document.querySelector('.blog-carousel-next');
    if (prevBtn) prevBtn.addEventListener('click', prevBlogSlide);
    if (nextBtn) nextBtn.addEventListener('click', nextBlogSlide);

    // Touch swipe
    let blogTouchStartX = 0;
    const blogCarousel = document.querySelector('.blog-carousel');
    if (blogCarousel) {
        blogCarousel.addEventListener('touchstart', (e) => {
            blogTouchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        blogCarousel.addEventListener('touchend', (e) => {
            const diff = blogTouchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) nextBlogSlide();
                else prevBlogSlide();
            }
        }, { passive: true });
    }

    // Resize handler
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Wrap logicalIndex and re-position
            logicalIndex = ((logicalIndex % totalBlogs) + totalBlogs) % totalBlogs;
            buildDots();
            setPosition(domIndex(), false);
            updateDots();
        }, 150);
    });

    // Init
    updateBlogDetails();

    function refreshBlogCarouselLinks() {
        blogCarouselRow.querySelectorAll('.blog-card-col').forEach((col) => {
            const blog = blogs[col.dataset.index];
            if (!blog) return;
            const anchor = col.querySelector('.blog-card-link');
            if (!anchor) return;
            const { linkUrl, linkTarget } = resolveBlogLink(blog);
            if (!linkUrl) return;
            anchor.href = linkUrl;
            if (linkTarget) {
                anchor.setAttribute('target', '_blank');
            } else {
                anchor.removeAttribute('target');
            }
        });
        updateBlogDetails();
    }

    window.refreshBlogCarouselLinks = refreshBlogCarouselLinks;
}
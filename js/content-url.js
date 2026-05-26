/**
 * Resolve content asset paths for blog articles and similar pages.
 */
(function (global) {
    function resolveContentUrl(src, blogNumber) {
        if (!src) return src;
        if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return src;

        const clean = src.replace(/^\.\//, '');
        if (clean.startsWith('/')) return clean.replace(/\/{2,}/g, '/');

        let n = blogNumber;
        if (!n) {
            const path = global.location.pathname.replace(/\\/g, '/');
            const m = path.match(/\/blog\/(\d+)(?:\/|$)/);
            n = m ? m[1] : null;
        }
        if (n) return `/blog/${n}/${clean}`.replace(/\/{2,}/g, '/');

        try {
            return new URL(clean, global.location.href).href;
        } catch (e) {
            return clean;
        }
    }

    function youtubeEmbedSrc(url) {
        if (!url) return url;
        if (global.QubibyteYoutubeEmbed?.buildEmbedUrl) {
            return global.QubibyteYoutubeEmbed.buildEmbedUrl(url) || url;
        }
        const id = global.QubibyteSoftwareMode?.youtubeVideoId?.(url);
        if (id) {
            return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&origin=https%3A%2F%2Fqubibyte.org`;
        }
        if (/youtube\.com\/embed\//i.test(url)) {
            return url.replace('www.youtube.com', 'www.youtube-nocookie.com');
        }
        return url;
    }

    global.QubibyteContentUrl = {
        resolve: resolveContentUrl,
        youtubeEmbedSrc
    };
})(typeof window !== 'undefined' ? window : globalThis);

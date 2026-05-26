/**
 * YouTube iframe URLs for Electron / custom-protocol shells.
 * YouTube requires a valid HTTPS Referer + origin (qubibyte:// is rejected → Error 153).
 * Pair with Electron session Referer injection in main.js (HMI).
 */
(function (global) {
    /** Public site origin — must be https (matches Referer injected in Electron). */
    const EMBED_ORIGIN = 'https://qubibyte.org';

    function getEmbedOrigin() {
        try {
            if (global.location?.origin && /^https?:\/\//i.test(global.location.origin)) {
                return global.location.origin;
            }
        } catch (e) {
            /* ignore */
        }
        return EMBED_ORIGIN;
    }

    function extractVideoId(input) {
        if (!input || typeof input !== 'string') return null;
        if (/^[\w-]{11}$/.test(input)) return input;
        if (global.QubibyteSoftwareMode?.youtubeVideoId) {
            return global.QubibyteSoftwareMode.youtubeVideoId(input);
        }
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([\w-]{11})/i,
            /youtu\.be\/([\w-]{11})/i,
            /youtube\.com\/embed\/([\w-]{11})/i,
            /youtube-nocookie\.com\/embed\/([\w-]{11})/i
        ];
        for (const re of patterns) {
            const m = input.match(re);
            if (m) return m[1];
        }
        return null;
    }

    function buildEmbedUrl(videoIdOrUrl) {
        const id = extractVideoId(videoIdOrUrl);
        if (!id) return null;

        const embedOrigin = getEmbedOrigin();
        const params = new URLSearchParams({
            rel: '0',
            modestbranding: '1',
            playsinline: '1',
            enablejsapi: '0',
            origin: embedOrigin,
            widget_referrer: embedOrigin
        });

        return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
    }

    global.QubibyteYoutubeEmbed = {
        EMBED_ORIGIN,
        extractVideoId,
        buildEmbedUrl
    };
})(typeof window !== 'undefined' ? window : globalThis);

// Shared YouTube metadata helper — single source of truth for extracting
// title / author / publish date from a YouTube video ID. Used by both the
// manual submit path (video-actions.ts) and the pipeline hot path
// (api/pipeline/process-video/route.ts). If YouTube changes their page HTML,
// both paths break together and the failure is noticed immediately instead
// of one silently degrading.
//
// Fetches oEmbed for reliable title/author, then scrapes the watch page with
// a Googlebot User-Agent to extract description + publish date via three
// fallback regex patterns. Returns published_at=null on any failure rather
// than throwing — callers should tolerate null (prompt already handles the
// "publish date unknown" case).

export interface YouTubeMetadata {
    title: string;
    author_name: string;
    author_url: string;
    description: string;
    published_at: string | null;
}

export async function getYouTubeMetadata(videoId: string): Promise<YouTubeMetadata> {
    let title = "Unknown Title";
    let author_name = "Unknown Channel";
    let author_url = "";
    let description = "";
    let published_at: string | null = null;

    try {
        // 1. oEmbed for reliable Title/Author
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
            const data = await response.json();
            title = data.title || title;
            author_name = data.author_name || author_name;
            author_url = data.author_url || author_url;
        }

        // 2. Scrape page for description + publish date
        const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            }
        });
        const html = await pageResponse.text();

        const descriptionMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
        if (descriptionMatch && descriptionMatch[1]) {
            description = descriptionMatch[1];
        }

        // Publish date — three fallback patterns
        let publishDateMatch = html.match(/<meta itemprop="uploadDate" content="([^"]+)">/);
        if (!publishDateMatch) {
            publishDateMatch = html.match(/"uploadDate":"([^"]+)"/);
        }
        if (!publishDateMatch) {
            publishDateMatch = html.match(/"publishDate":"([^"]+)"/);
        }
        if (publishDateMatch && publishDateMatch[1]) {
            published_at = publishDateMatch[1];
        }
    } catch (e) {
        console.error("Failed to fetch YouTube metadata:", e);
    }

    return { title, author_name, author_url, description, published_at };
}

import axios from 'axios';
export class WizdomProvider {
    /**
     * Search Wizdom for Hebrew subtitles using IMDb ID or query
     */
    static async getSubtitles(imdbId, season, episode) {
        try {
            // Wizdom search API / endpoint
            const searchUrl = `https://www.wizdom.xyz/api/search?action=by_id&imdb=${imdbId}`;
            const response = await axios.get(searchUrl, {
                timeout: 6000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'application/json, text/plain, */*'
                }
            });
            const results = [];
            const items = response.data?.subtitles || response.data || [];
            if (Array.isArray(items)) {
                for (const item of items) {
                    // If series, check season/episode match
                    if (season !== undefined && episode !== undefined) {
                        if (item.season && item.season !== season)
                            continue;
                        if (item.episode && item.episode !== episode)
                            continue;
                    }
                    const id = `wizdom-${item.id || item.sub_id || Math.random().toString(36).substring(2)}`;
                    const downloadUrl = item.download_url || item.url || (item.id ? `https://www.wizdom.xyz/api/download?id=${item.id}` : '');
                    if (!downloadUrl)
                        continue;
                    results.push({
                        id,
                        lang: 'heb',
                        langName: 'עברית (Wizdom)',
                        release: item.version || item.release || item.name || 'Wizdom Release',
                        downloadUrl,
                        format: 'srt',
                        source: 'wizdom',
                        rating: item.rating ? parseFloat(item.rating) : 5,
                        uploader: item.uploader || item.translator || 'Wizdom'
                    });
                }
            }
            return results;
        }
        catch (error) {
            // Wizdom can occasionally be unavailable or block direct non-browser requests
            console.warn(`[WizdomProvider] Subtitle fetch failed for ${imdbId}:`, error?.message);
            return [];
        }
    }
}

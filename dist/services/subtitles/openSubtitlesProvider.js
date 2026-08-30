import axios from 'axios';
export class OpenSubtitlesProvider {
    /**
     * Fetch subtitles from Stremio OpenSubtitles v3 service
     */
    static async getSubtitles(type, id) {
        try {
            const url = `https://opensubtitles-v3.strem.io/subtitles/${type}/${id}.json`;
            const response = await axios.get(url, {
                timeout: 6000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                }
            });
            const subtitles = response.data?.subtitles || [];
            const results = [];
            for (const item of subtitles) {
                const lang = item.lang?.toLowerCase() || '';
                const isHebrew = lang === 'heb' || lang === 'he' || lang === 'hebrew';
                const isEnglish = lang === 'eng' || lang === 'en' || lang === 'english';
                if (!isHebrew && !isEnglish)
                    continue;
                const langKey = isHebrew ? 'heb' : 'eng';
                const langName = isHebrew ? 'עברית (OpenSubtitles)' : 'English (OpenSubtitles)';
                const downloadUrl = item.url;
                if (!downloadUrl)
                    continue;
                // Try extracting release info or format
                const releaseName = item.SubFileName || item.MovieReleaseName || item.id || 'OpenSubtitles Release';
                results.push({
                    id: `os-${item.id || Math.random().toString(36).substring(2)}`,
                    lang: langKey,
                    langName,
                    release: releaseName,
                    downloadUrl,
                    format: item.url.endsWith('.vtt') ? 'vtt' : 'srt',
                    source: 'opensubtitles',
                    rating: item.Score || 5
                });
            }
            return results;
        }
        catch (error) {
            console.warn(`[OpenSubtitlesProvider] Failed to fetch subtitles for ${id}:`, error?.message);
            return [];
        }
    }
}

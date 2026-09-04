import { WizdomProvider } from './wizdomProvider.js';
import { SubDLProvider } from './subdlProvider.js';
import { OpenSubtitlesProvider } from './openSubtitlesProvider.js';
export class SubtitleService {
    static cache = new Map();
    static CACHE_TTL = 1000 * 60 * 15; // 15 minutes
    static async getSubtitles(type, id, targetTorrentName) {
        const parts = id.split(':');
        const imdbId = parts[0];
        const season = parts[1] ? parseInt(parts[1], 10) : undefined;
        const episode = parts[2] ? parseInt(parts[2], 10) : undefined;
        let allSubs = [];
        const cached = this.cache.get(id);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            allSubs = [...cached.data];
        }
        else {
            // Query all providers in parallel
            const [wizdomSubs, subdlSubs, osSubs] = await Promise.allSettled([
                WizdomProvider.getSubtitles(imdbId, season, episode),
                SubDLProvider.getSubtitles(imdbId, season, episode),
                OpenSubtitlesProvider.getSubtitles(type, id)
            ]);
            if (wizdomSubs.status === 'fulfilled')
                allSubs.push(...wizdomSubs.value);
            if (subdlSubs.status === 'fulfilled')
                allSubs.push(...subdlSubs.value);
            if (osSubs.status === 'fulfilled')
                allSubs.push(...osSubs.value);
            // Deduplicate by downloadUrl or similar release name & lang
            const seen = new Set();
            allSubs = allSubs.filter(sub => {
                const key = `${sub.lang}-${sub.downloadUrl}`;
                if (seen.has(key))
                    return false;
                seen.add(key);
                return true;
            });
            this.cache.set(id, { data: allSubs, timestamp: Date.now() });
        }
        // Score and rank subtitles against torrent filename if provided
        const scoredSubs = allSubs.map(sub => ({
            ...sub,
            matchScore: targetTorrentName ? this.calculateMatchScore(sub.release, targetTorrentName) : 50
        }));
        // Check if high-quality matched Hebrew subtitles are available
        const hasHighQualityHebrew = scoredSubs.some(s => s.lang === 'heb' && (s.matchScore || 0) >= 50 && s.source !== 'ai_translated');
        if (!hasHighQualityHebrew) {
            const topEng = scoredSubs.find(s => s.lang === 'eng');
            if (topEng) {
                scoredSubs.unshift({
                    id: `ai-heb-${imdbId}`,
                    lang: 'heb',
                    langName: 'עברית (תרגום AI מסונכרן)',
                    release: `${topEng.release} (AI Hebrew)`,
                    downloadUrl: `/api/translate-sub?url=${encodeURIComponent(topEng.downloadUrl)}&imdbId=${imdbId}&release=${encodeURIComponent(topEng.release)}`,
                    format: 'srt',
                    source: 'ai_translated',
                    rating: 5.0,
                    uploader: 'AI Auto-Translator',
                    matchScore: 95
                });
            }
        }
        // Sort: Hebrew first, then highest match score, then rating
        scoredSubs.sort((a, b) => {
            // Hebrew always prioritized
            if (a.lang === 'heb' && b.lang !== 'heb')
                return -1;
            if (b.lang === 'heb' && a.lang !== 'heb')
                return 1;
            // Match score
            const scoreDiff = (b.matchScore || 0) - (a.matchScore || 0);
            if (Math.abs(scoreDiff) > 10)
                return scoreDiff;
            // Rating
            return (b.rating || 0) - (a.rating || 0);
        });
        return scoredSubs;
    }
    /**
     * Calculate similarity score between release name and torrent filename
     */
    static calculateMatchScore(subRelease, torrentName) {
        if (!subRelease || !torrentName)
            return 50;
        const cleanSub = subRelease.toLowerCase().replace(/[^a-z0-9]/g, ' ');
        const cleanTorrent = torrentName.toLowerCase().replace(/[^a-z0-9]/g, ' ');
        const subTokens = cleanSub.split(/\s+/).filter(t => t.length > 2);
        const torrentTokens = new Set(cleanTorrent.split(/\s+/).filter(t => t.length > 2));
        if (subTokens.length === 0)
            return 50;
        let matches = 0;
        const releaseKeywords = [
            'yify', 'yts', 'psa', 'galaxyrg', 'amzn', 'webrip', 'web dl', 'webdl', 'bluray',
            'bdrip', 'brrip', 'hdtv', 'x264', 'x265', 'hevc', '1080p', '720p', '2160p', '4k',
            'rarbg', 'flux', 'ntb', 'cmrg', 'evo', 'megusta', 'sparks'
        ];
        for (const token of subTokens) {
            if (torrentTokens.has(token)) {
                matches++;
                // Bonus points for matching key release group or rip type
                if (releaseKeywords.includes(token)) {
                    matches += 1.5;
                }
            }
        }
        const ratio = (matches / subTokens.length) * 100;
        return Math.min(100, Math.max(10, Math.round(ratio)));
    }
}

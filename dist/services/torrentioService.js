import axios from 'axios';
const DEFAULT_TRACKERS = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://explodie.org:6969/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://p4p.arenabg.com:1337/announce',
    'udp://tracker.coppersurfer.tk:6969/announce',
    'http://tracker.openbittorrent.com:80/announce'
];
export class TorrentioService {
    static cache = new Map();
    static CACHE_TTL = 1000 * 60 * 10; // 10 minutes
    static async getStreams(type, id) {
        const cached = this.cache.get(id);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        try {
            const url = `https://torrentio.strem.fun/stream/${type}/${id}.json`;
            const response = await axios.get(url, {
                timeout: 8000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const rawStreams = response.data?.streams || [];
            const streams = [];
            for (let i = 0; i < rawStreams.length; i++) {
                const s = rawStreams[i];
                if (!s.infoHash)
                    continue;
                const parsed = this.parseStream(s, i);
                if (parsed) {
                    streams.push(parsed);
                }
            }
            // Sort by Quality (4K -> 1080p -> 720p) and then by Seeds
            streams.sort((a, b) => {
                const qualityRank = { '4K': 4, '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
                const qA = qualityRank[a.quality] || 0;
                const qB = qualityRank[b.quality] || 0;
                if (qB !== qA)
                    return qB - qA;
                return b.seeders - a.seeders;
            });
            this.cache.set(id, { data: streams, timestamp: Date.now() });
            return streams;
        }
        catch (error) {
            console.error(`[TorrentioService] Error fetching streams for ${id}:`, error?.message);
            return [];
        }
    }
    static parseStream(stream, index) {
        try {
            const rawTitle = stream.title || '';
            const rawName = stream.name || '';
            const lines = rawTitle.split('\n');
            const filename = lines[0]?.trim() || `Media_${stream.infoHash}`;
            const detailsLine = lines[1] || '';
            // Parse Quality / Resolution
            let quality = '1080p';
            let resolution = '1080p';
            if (/4k|2160p/i.test(rawName) || /4k|2160p/i.test(filename)) {
                quality = '4K';
                resolution = '2160p';
            }
            else if (/1080p/i.test(rawName) || /1080p/i.test(filename)) {
                quality = '1080p';
                resolution = '1080p';
            }
            else if (/720p/i.test(rawName) || /720p/i.test(filename)) {
                quality = '720p';
                resolution = '720p';
            }
            else if (/480p|576p|SD/i.test(rawName) || /480p|576p|SD/i.test(filename)) {
                quality = '480p';
                resolution = '480p';
            }
            // Parse Codec
            let codec = 'x264';
            if (/hevc|x265|h\.265/i.test(rawTitle) || /hevc|x265|h\.265/i.test(filename)) {
                codec = 'x265 (HEVC)';
            }
            else if (/av1/i.test(rawTitle) || /av1/i.test(filename)) {
                codec = 'AV1';
            }
            else if (/x264|h\.264/i.test(rawTitle) || /x264|h\.264/i.test(filename)) {
                codec = 'x264';
            }
            // Parse Seeders
            let seeders = 0;
            const seedMatch = detailsLine.match(/(?:👤|👥|Seeds?:?)\s*(\d+)/i) || rawTitle.match(/👤\s*(\d+)/);
            if (seedMatch) {
                seeders = parseInt(seedMatch[1], 10);
            }
            // Parse Size
            let sizeFormatted = 'לא ידוע';
            let sizeBytes = 0;
            const sizeMatch = detailsLine.match(/(?:💾|Size:?)\s*([\d.]+\s*(?:GB|MB|KB|G|M))/i) || rawTitle.match(/💾\s*([\d.]+\s*(?:GB|MB))/);
            if (sizeMatch) {
                sizeFormatted = sizeMatch[1].trim();
                const num = parseFloat(sizeMatch[1]);
                if (sizeMatch[1].toUpperCase().includes('GB')) {
                    sizeBytes = num * 1024 * 1024 * 1024;
                }
                else if (sizeMatch[1].toUpperCase().includes('MB')) {
                    sizeBytes = num * 1024 * 1024;
                }
            }
            // Provider (e.g. RARBG, YTS, TorrentGalaxy)
            let provider = 'Torrentio';
            const provMatch = detailsLine.match(/(?:⚙️|Provider:?)\s*([A-Za-z0-9_-]+)/);
            if (provMatch) {
                provider = provMatch[1].trim();
            }
            // Build Clean Magnet Link with Trackers
            const trackers = stream.sources && Array.isArray(stream.sources) && stream.sources.length > 0
                ? stream.sources.filter((s) => s.startsWith('tracker:'))
                : DEFAULT_TRACKERS;
            const trackerParams = trackers
                .map((t) => `&tr=${encodeURIComponent(t.replace(/^tracker:/, ''))}`)
                .join('');
            const magnetUrl = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(filename)}${trackerParams}`;
            return {
                id: `torrent-${stream.infoHash}-${stream.fileIdx ?? 0}-${index}`,
                title: filename,
                name: rawName,
                quality,
                resolution,
                codec,
                sizeBytes,
                sizeFormatted,
                seeders,
                infoHash: stream.infoHash,
                fileIdx: stream.fileIdx,
                magnetUrl,
                filename,
                provider,
                rawTitle
            };
        }
        catch (err) {
            console.warn(`[TorrentioService] Error parsing stream:`, err);
            return null;
        }
    }
}

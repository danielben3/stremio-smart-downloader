import axios from 'axios';
import { ContentType, MediaMeta } from '../types/index.js';

export class MetadataService {
  private static cache = new Map<string, { data: MediaMeta; timestamp: number }>();
  private static CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours

  static async getMeta(type: ContentType, id: string): Promise<MediaMeta> {
    const cached = this.cache.get(id);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const cleanId = decodeURIComponent(id).replace('.json', '');
    const parts = cleanId.split(':');
    const imdbId = parts[0];
    const season = parts[1] ? parseInt(parts[1], 10) : undefined;
    const episode = parts[2] ? parseInt(parts[2], 10) : undefined;

    try {
      const response = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`, {
        timeout: 6000
      });

      const meta = response.data?.meta;
      let episodeTitle: string | undefined;

      if (type === 'series' && season !== undefined && episode !== undefined && meta?.videos) {
        const ep = meta.videos.find((v: any) => v.season === season && v.episode === episode);
        if (ep) {
          episodeTitle = ep.title || `פרק ${episode}`;
        }
      }

      const result: MediaMeta = {
        id,
        imdbId,
        type,
        title: meta?.name || imdbId,
        year: meta?.year || meta?.releaseInfo,
        poster: meta?.poster,
        background: meta?.background,
        season,
        episode,
        episodeTitle
      };

      this.cache.set(id, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.warn(`[MetadataService] Failed to fetch Cinemeta for ${id}:`, (error as any)?.message);
      return {
        id,
        imdbId,
        type,
        title: imdbId,
        season,
        episode
      };
    }
  }
}

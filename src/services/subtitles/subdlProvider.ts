import axios from 'axios';
import { SubtitleItem } from '../../types/index.js';

export class SubDLProvider {
  /**
   * Fetch subtitles from SubDL API (Supports Hebrew and English)
   */
  static async getSubtitles(imdbId: string, season?: number, episode?: number): Promise<SubtitleItem[]> {
    try {
      const apiKey = process.env.SUBDL_API_KEY || '';
      let url = `https://api.subdl.com/api/v1/subtitles?imdb_id=${imdbId}&languages=HE,EN`;
      if (season !== undefined) url += `&season_number=${season}`;
      if (episode !== undefined) url += `&episode_number=${episode}`;
      if (apiKey) url += `&api_key=${apiKey}`;

      const response = await axios.get(url, {
        timeout: 6000,
        headers: {
          'User-Agent': 'StremioSmartDownloader/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.data?.status || !Array.isArray(response.data?.subtitles)) {
        return [];
      }

      const results: SubtitleItem[] = [];
      for (const item of response.data.subtitles) {
        const isHebrew = item.lang?.toLowerCase() === 'he' || item.lang?.toLowerCase() === 'heb' || item.language?.toLowerCase() === 'hebrew';
        const isEnglish = item.lang?.toLowerCase() === 'en' || item.lang?.toLowerCase() === 'eng' || item.language?.toLowerCase() === 'english';

        if (!isHebrew && !isEnglish) continue;

        const lang = isHebrew ? 'heb' : 'eng';
        const langName = isHebrew ? 'עברית (SubDL)' : 'English (SubDL)';
        const downloadUrl = item.url ? `https://dl.subdl.com${item.url}` : '';
        if (!downloadUrl) continue;

        results.push({
          id: `subdl-${item.id || Math.random().toString(36).substring(2)}`,
          lang,
          langName,
          release: item.release_name || item.name || 'SubDL Release',
          downloadUrl,
          format: 'srt',
          source: 'subdl',
          uploader: item.author || 'SubDL',
          rating: item.hi ? 4.5 : 5
        });
      }

      return results;
    } catch (error) {
      console.warn(`[SubDLProvider] Failed to fetch subtitles for ${imdbId}:`, (error as any)?.message);
      return [];
    }
  }
}

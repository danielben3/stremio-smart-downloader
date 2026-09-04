export type ContentType = 'movie' | 'series';

export interface MediaMeta {
  id: string;
  imdbId: string;
  type: ContentType;
  title: string;
  year?: string | number;
  poster?: string;
  background?: string;
  season?: number;
  episode?: number;
  episodeTitle?: string;
}

export interface TorrentStream {
  id: string;
  title: string;
  name: string;
  quality: string;
  resolution: string;
  codec: string;
  audio?: string;
  sizeBytes: number;
  sizeFormatted: string;
  seeders: number;
  infoHash: string;
  fileIdx?: number;
  magnetUrl: string;
  filename: string;
  provider: string;
  rawTitle: string;
}

export interface SubtitleItem {
  id: string;
  lang: string; // 'heb', 'eng', etc.
  langName: string; // 'עברית', 'English'
  release: string; // e.g. 'PSA', 'YIFY', 'AMZN'
  downloadUrl: string;
  format: 'srt' | 'vtt';
  source: 'wizdom' | 'subdl' | 'opensubtitles' | 'stremio' | 'ai_translated';
  rating?: number;
  uploader?: string;
  matchScore?: number; // 0 to 100 based on release name matching
}

export interface DownloadDetailsResponse {
  meta: MediaMeta;
  torrents: TorrentStream[];
  subtitles: SubtitleItem[];
}

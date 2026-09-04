import { Router, Request, Response } from 'express';
import axios from 'axios';
import QRCode from 'qrcode';
import { MetadataService } from '../services/metadataService.js';
import { TorrentioService } from '../services/torrentioService.js';
import { SubtitleService } from '../services/subtitles/subtitleService.js';
import { EncodingService } from '../services/encodingService.js';
import { ContentType, DownloadDetailsResponse } from '../types/index.js';
import torrentStream from 'torrent-stream';

export const downloadRouter = Router();

// Get full media details, torrents, and subtitles
downloadRouter.get('/api/details/:type/:id', async (req: Request, res: Response) => {
  const type = String(req.params.type);
  const id = String(req.params.id);

  if (type !== 'movie' && type !== 'series') {
    return res.status(400).json({ error: 'Invalid content type' });
  }

  try {
    const cleanId = decodeURIComponent(id).replace('.json', '');

    // Fetch metadata and torrents in parallel
    const [meta, torrents] = await Promise.all([
      MetadataService.getMeta(type as ContentType, cleanId),
      TorrentioService.getStreams(type as ContentType, cleanId)
    ]);

    // Get primary torrent name to score subtitles
    const topTorrentName = torrents[0]?.filename || meta.title;
    const subtitles = await SubtitleService.getSubtitles(type as ContentType, cleanId, topTorrentName);

    const responseData: DownloadDetailsResponse = {
      meta,
      torrents,
      subtitles
    };

    res.json(responseData);
  } catch (error) {
    console.error(`[DownloadRouter] Error fetching details for ${id}:`, error);
    res.status(500).json({ error: 'Failed to fetch details' });
  }
});

// Get subtitles scored against a specific selected torrent filename
downloadRouter.get('/api/subtitles/:type/:id', async (req: Request, res: Response) => {
  const type = String(req.params.type);
  const id = String(req.params.id);
  const torrentName = req.query.torrentName as string | undefined;

  try {
    const cleanId = decodeURIComponent(id).replace('.json', '');
    const subtitles = await SubtitleService.getSubtitles(type as ContentType, cleanId, torrentName);
    res.json({ subtitles });
  } catch (error) {
    console.error(`[DownloadRouter] Error fetching subtitles for ${id}:`, error);
    res.status(500).json({ error: 'Failed to fetch subtitles' });
  }
});

import { TranslationService } from '../services/subtitles/translationService.js';

// Proxy and download subtitle with auto UTF-8 conversion and exact filename match
downloadRouter.get('/api/download-sub', async (req: Request, res: Response) => {
  const subUrl = req.query.url as string;
  let targetFilename = (req.query.filename as string) || 'subtitle';

  if (!subUrl) {
    return res.status(400).send('Missing subtitle URL');
  }

  // Ensure filename has .srt extension and no illegal characters
  targetFilename = targetFilename.replace(/[<>:"/\\|?*]/g, '_').trim();
  if (targetFilename.endsWith('.mkv') || targetFilename.endsWith('.mp4') || targetFilename.endsWith('.avi')) {
    targetFilename = targetFilename.substring(0, targetFilename.lastIndexOf('.'));
  }
  if (!targetFilename.endsWith('.srt')) {
    targetFilename += '.srt';
  }

  // Handle AI Translated subtitles or internal relative URLs
  if (subUrl.startsWith('/api/translate-sub') || subUrl.includes('/api/translate-sub')) {
    try {
      const parsed = new URL(subUrl, 'http://127.0.0.1');
      const realSourceUrl = parsed.searchParams.get('url');
      const imdbId = parsed.searchParams.get('imdbId') || 'unknown';

      if (!realSourceUrl) {
        return res.status(400).send('Missing source URL for AI translation');
      }

      const response = await axios.get(realSourceUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      let rawSource = EncodingService.convertToUtf8(Buffer.from(response.data));
      if (realSourceUrl.endsWith('.vtt') || rawSource.startsWith('WEBVTT')) {
        rawSource = EncodingService.vttToSrt(rawSource);
      }

      const cacheKey = `${imdbId}_${realSourceUrl}`;
      const hebrewSrt = await TranslationService.translateSrt(rawSource, cacheKey);

      res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(targetFilename)}"; filename*=UTF-8''${encodeURIComponent(targetFilename)}`);
      res.setHeader('Access-Control-Allow-Origin', '*');

      return res.send(Buffer.from(hebrewSrt, 'utf-8'));
    } catch (err) {
      console.error('[DownloadRouter] Error in AI subtitle translation proxy:', (err as any)?.message);
      return res.status(500).send('Error translating subtitle');
    }
  }

  try {
    const response = await axios.get(subUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const buffer = Buffer.from(response.data);
    let utf8Content = EncodingService.convertToUtf8(buffer);

    // If source is VTT, convert to standard SRT
    if (subUrl.endsWith('.vtt') || utf8Content.startsWith('WEBVTT')) {
      utf8Content = EncodingService.vttToSrt(utf8Content);
    }

    res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(targetFilename)}"; filename*=UTF-8''${encodeURIComponent(targetFilename)}`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.send(Buffer.from(utf8Content, 'utf-8'));
  } catch (error) {
    console.error(`[DownloadRouter] Failed to proxy subtitle: ${subUrl}`, (error as any)?.message);
    res.status(500).send('Error downloading and processing subtitle');
  }
});

// Automated AI Hebrew Translation Endpoint for Subtitles
downloadRouter.get('/api/translate-sub', async (req: Request, res: Response) => {
  const sourceUrl = req.query.url as string;
  const imdbId = (req.query.imdbId as string) || 'unknown';
  const release = (req.query.release as string) || 'release';
  let targetFilename = (req.query.filename as string) || `${release}.srt`;

  if (!sourceUrl) {
    return res.status(400).send('Missing source subtitle URL');
  }

  targetFilename = targetFilename.replace(/[<>:"/\\|?*]/g, '_').trim();
  if (targetFilename.endsWith('.mkv') || targetFilename.endsWith('.mp4') || targetFilename.endsWith('.avi')) {
    targetFilename = targetFilename.substring(0, targetFilename.lastIndexOf('.'));
  }
  if (!targetFilename.endsWith('.srt')) {
    targetFilename += '.srt';
  }

  try {
    const response = await axios.get(sourceUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    let rawSource = EncodingService.convertToUtf8(Buffer.from(response.data));
    if (sourceUrl.endsWith('.vtt') || rawSource.startsWith('WEBVTT')) {
      rawSource = EncodingService.vttToSrt(rawSource);
    }

    const cacheKey = `${imdbId}_${sourceUrl}`;
    const hebrewSrt = await TranslationService.translateSrt(rawSource, cacheKey);

    res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(targetFilename)}"; filename*=UTF-8''${encodeURIComponent(targetFilename)}`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.send(Buffer.from(hebrewSrt, 'utf-8'));
  } catch (error) {
    console.error(`[DownloadRouter] Failed to translate subtitle from ${sourceUrl}:`, (error as any)?.message);
    res.status(500).send('Error translating subtitle');
  }
});

// Direct HTTP Torrent Streaming & Download Bridge (Zero P2P blockades for mobile carriers)
downloadRouter.get('/api/stream/:infoHash', (req: Request, res: Response) => {
  const infoHash = String(req.params.infoHash);
  let customFilename = (req.query.filename as string) || `video_${infoHash}.mp4`;

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

  try {
    const engine = torrentStream(`magnet:?xt=urn:btih:${infoHash}`, {
      trackers: DEFAULT_TRACKERS
    });

    let isClosed = false;

    const cleanup = () => {
      if (!isClosed) {
        isClosed = true;
        try {
          engine.destroy(() => {});
        } catch {}
      }
    };

    req.on('close', cleanup);
    res.on('finish', cleanup);

    // Timeout if torrent cannot be resolved in 25 seconds
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        cleanup();
        res.status(504).send('Torrent stream resolution timeout');
      }
    }, 25000);

    engine.on('ready', () => {
      clearTimeout(timeout);
      if (isClosed) return;

      // Find the main video file by size
      const videoFiles = engine.files.filter((f: any) =>
        f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.avi') || f.name.endsWith('.webm')
      );

      const targetFile = videoFiles.length > 0
        ? videoFiles.reduce((prev: any, curr: any) => curr.length > prev.length ? curr : prev, videoFiles[0])
        : engine.files.reduce((prev: any, curr: any) => curr.length > prev.length ? curr : prev, engine.files[0]);

      if (!targetFile) {
        cleanup();
        return res.status(404).send('No playable file found in torrent');
      }

      const total = targetFile.length;
      const range = req.headers.range;
      const filename = customFilename || targetFile.name;
      const mimeType = filename.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4';

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
        const chunkSize = (end - start) + 1;

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType
        });

        const fileStream = targetFile.createReadStream({ start, end });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': total,
          'Accept-Ranges': 'bytes',
          'Content-Type': mimeType
        });

        const fileStream = targetFile.createReadStream();
        fileStream.pipe(res);
      }
    });

    engine.on('error', (err: any) => {
      console.error('[TorrentStream Error]:', err);
      clearTimeout(timeout);
      cleanup();
      if (!res.headersSent) {
        res.status(500).send('Error streaming torrent');
      }
    });
  } catch (error) {
    console.error('[TorrentStream Exception]:', error);
    res.status(500).send('Failed to initialize stream bridge');
  }
});

// Generate QR Code image
downloadRouter.get('/api/qr', async (req: Request, res: Response) => {
  const text = req.query.text as string;
  if (!text) return res.status(400).send('Missing text parameter');

  try {
    const qrPng = await QRCode.toBuffer(text, {
      type: 'png',
      width: 320,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff'
      }
    });

    res.setHeader('Content-Type', 'image/png');
    res.send(qrPng);
  } catch (error) {
    res.status(500).send('QR Generation failed');
  }
});

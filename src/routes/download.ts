import { Router, Request, Response } from 'express';
import axios from 'axios';
import QRCode from 'qrcode';
import { MetadataService } from '../services/metadataService.js';
import { TorrentioService } from '../services/torrentioService.js';
import { SubtitleService } from '../services/subtitles/subtitleService.js';
import { EncodingService } from '../services/encodingService.js';
import { ContentType, DownloadDetailsResponse } from '../types/index.js';

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

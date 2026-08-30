import { Router, Request, Response } from 'express';
import { addonManifest } from '../manifest.js';
import { MetadataService } from '../services/metadataService.js';
import { ContentType } from '../types/index.js';

export const stremioRouter = Router();

// Stremio Manifest endpoint
stremioRouter.get('/manifest.json', (_req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.json(addonManifest);
});

// Stremio Stream endpoint
stremioRouter.get('/stream/:type/:id.json', async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const type = String(req.params.type);
  const id = String(req.params.id);

  if (type !== 'movie' && type !== 'series') {
    return res.json({ streams: [] });
  }

  try {
    const cleanId = id.replace('.json', '');
    const meta = await MetadataService.getMeta(type as ContentType, cleanId);

    // Determine public base URL from request or environment
    let protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host && (host.includes('onrender.com') || host.includes('vercel.app') || host.includes('render.com'))) {
      protocol = 'https';
    }
    const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;

    const downloadUrl = `${baseUrl}/download/${type}/${cleanId}`;

    let titleLabel = `📥 הורדה חכמה למובייל + כתוביות בעברית`;
    if (meta.title) {
      if (meta.season !== undefined && meta.episode !== undefined) {
        titleLabel = `📥 הורדה חכמה: ${meta.title} (עונה ${meta.season} פרק ${meta.episode}) + תרגום עברי`;
      } else {
        titleLabel = `📥 הורדה חכמה: ${meta.title} (${meta.year || ''}) + תרגום עברי`;
      }
    }

    const streams = [
      {
        name: `⚡ הורדה חכמה\n(כתוביות בעברית)`,
        title: `${titleLabel}\n📱 לחיצה פותחת את מנהל ההורדות המהיר (הורדת וידאו + כתוביות .SRT מסונכרנות ל-1DM)`,
        externalUrl: downloadUrl
      }
    ];

    res.json({ streams });
  } catch (error) {
    console.error(`[StremioRouter] Error generating streams for ${id}:`, error);
    res.json({ streams: [] });
  }
});

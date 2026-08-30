import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { TorrentioService } from './dist/services/torrentioService.js';
import { SubtitleService } from './dist/services/subtitles/subtitleService.js';
import { MetadataService } from './dist/services/metadataService.js';
import { EncodingService } from './dist/services/encodingService.js';

async function main() {
  console.log('🔍 מחפש את הסרט "Mutiny" (ג\'ייסון סטיית\'ם)...');

  // Search Cinemeta catalog for Mutiny
  let imdbId = '';
  let movieTitle = '';

  try {
    const searchRes = await axios.get('https://v3-cinemeta.strem.io/catalog/movie/top/search=Mutiny.json', { timeout: 8000 });
    const metas = searchRes.data?.metas || [];
    console.log(`נמצאו ${metas.length} תוצאות עבור "Mutiny":`);

    for (const m of metas) {
      console.log(`- ${m.name} (${m.year || m.releaseInfo}) | ID: ${m.id}`);
      if (m.name.toLowerCase().includes('mutiny')) {
        if (!imdbId) {
          imdbId = m.id;
          movieTitle = m.name;
        }
      }
    }
  } catch (err) {
    console.warn('Cinemeta search failed:', err.message);
  }

  // If not found in catalog search, let's search via IMDb suggestion API
  if (!imdbId) {
    try {
      const imdbRes = await axios.get('https://v3.sg.media-imdb.com/suggestion/m/mutiny.json', { timeout: 6000 });
      const items = imdbRes.data?.d || [];
      for (const item of items) {
        console.log(`IMDb Suggestion: ${item.l} (${item.y}) - Stars: ${item.s} | ID: ${item.id}`);
        if (item.s && item.s.toLowerCase().includes('statham')) {
          imdbId = item.id;
          movieTitle = item.l;
          break;
        }
      }
      if (!imdbId && items.length > 0) {
        imdbId = items[0].id;
        movieTitle = items[0].l;
      }
    } catch (err) {
      console.warn('IMDb suggestion failed:', err.message);
    }
  }

  if (!imdbId) {
    console.log('לא נמצא IMDb ID אוטומטי, ננסה לחפש ישירות לפי מזהים נפוצים...');
  }

  console.log(`\n🎬 נבחר סרט: ${movieTitle} (ID: ${imdbId})`);

  // Fetch full metadata
  const meta = await MetadataService.getMeta('movie', imdbId);
  console.log(`שם מלא: ${meta.title} (${meta.year})`);

  // Fetch streams from Torrentio
  console.log('\n📥 שולף מקורות טורנט מ-Torrentio...');
  const torrents = await TorrentioService.getStreams('movie', imdbId);
  console.log(`נמצאו ${torrents.length} טורנטים זמינים!`);

  let topTorrent = null;
  if (torrents.length > 0) {
    torrents.slice(0, 5).forEach((t, i) => {
      console.log(`[${i + 1}] ${t.quality} | ${t.sizeFormatted} | 👤 ${t.seeders} Seeds | ${t.filename}`);
    });
    topTorrent = torrents[0];
  } else {
    console.log('⚠️ עדיין אין שחרורי טורנט רשמיים זמינים לסרט זה (ייתכן שהוא עדיין בקולנוע או בשלבי הפקה).');
  }

  // Fetch Subtitles
  console.log('\n🇮🇱 שולף כתוביות בעברית...');
  const subs = await SubtitleService.getSubtitles('movie', imdbId, topTorrent?.filename);
  console.log(`נמצאו ${subs.length} כתוביות.`);

  const hebSubs = subs.filter(s => s.lang === 'heb');
  console.log(`כתוביות בעברית: ${hebSubs.length}`);

  if (hebSubs.length > 0) {
    const topSub = hebSubs[0];
    console.log(`תרגום מוביל: [${topSub.source}] ${topSub.release} (${topSub.matchScore}% התאמה)`);

    // Download and save subtitle to downloads folder
    try {
      const downloadsDir = path.resolve('downloads');
      if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

      const targetFilename = topTorrent ? `${topTorrent.filename.replace(/\.[^/.]+$/, '')}.srt` : `${meta.title}.srt`;
      const subResponse = await axios.get(topSub.downloadUrl, { responseType: 'arraybuffer', timeout: 10000 });
      const utf8Content = EncodingService.convertToUtf8(Buffer.from(subResponse.data));

      const savePath = path.join(downloadsDir, targetFilename);
      fs.writeFileSync(savePath, utf8Content, 'utf-8');
      console.log(`\n✅ קובץ הכתוביות בעברית נשמר בהצלחה ב: ${savePath}`);
    } catch (err) {
      console.warn('שגיאה בשמירת כתוביות:', err.message);
    }
  }

  console.log('\n======================================================');
  if (topTorrent) {
    console.log(`🎯 קישור מגנט להורדה ישירה:\n${topTorrent.magnetUrl}`);
  }
  console.log('======================================================');
}

main().catch(err => {
  console.error('שגיאה:', err);
});

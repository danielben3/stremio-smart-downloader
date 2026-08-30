import { TorrentioService } from './dist/services/torrentioService.js';
import { SubtitleService } from './dist/services/subtitles/subtitleService.js';

async function getBestOptions() {
  const imdbId = 'tt32338669';
  const torrents = await TorrentioService.getStreams('movie', imdbId);
  const subs = await SubtitleService.getSubtitles('movie', imdbId);

  console.log('=== 1080p Torrents ===');
  const t1080 = torrents.filter(t => t.quality === '1080p').slice(0, 3);
  t1080.forEach(t => {
    console.log(`\n📦 ${t.filename}\n👤 ${t.seeders} Seeds | 💾 ${t.sizeFormatted} | ⚙️ ${t.codec}\n🧲 ${t.magnetUrl}`);
  });

  console.log('\n=== 4K Torrents ===');
  const t4k = torrents.filter(t => t.quality === '4K' || t.quality === '2160p').slice(0, 2);
  t4k.forEach(t => {
    console.log(`\n📦 ${t.filename}\n👤 ${t.seeders} Seeds | 💾 ${t.sizeFormatted} | ⚙️ ${t.codec}\n🧲 ${t.magnetUrl}`);
  });
}

getBestOptions();

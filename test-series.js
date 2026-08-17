import { TorrentioService } from './dist/services/torrentioService.js';
import { SubtitleService } from './dist/services/subtitles/subtitleService.js';
import { MetadataService } from './dist/services/metadataService.js';

async function testSeries() {
  console.log('--- Testing Series S01E01 (Game of Thrones) ---');
  const id = 'tt0944947:1:1';
  const meta = await MetadataService.getMeta('series', id);
  console.log(`Title: ${meta.title}, S${meta.season}E${meta.episode} (${meta.episodeTitle})`);

  const torrents = await TorrentioService.getStreams('series', id);
  console.log(`Found ${torrents.length} series torrents.`);
  if (torrents.length > 0) {
    console.log(`Top Torrent: ${torrents[0].filename} (Seeds: ${torrents[0].seeders}, Size: ${torrents[0].sizeFormatted})`);
  }

  const subs = await SubtitleService.getSubtitles('series', id, torrents[0]?.filename);
  console.log(`Found ${subs.length} subtitles for episode.`);
  const hebrewSubs = subs.filter(s => s.lang === 'heb');
  console.log(`Hebrew subtitles: ${hebrewSubs.length}`);
  if (hebrewSubs.length > 0) {
    console.log(`Top Hebrew Sub: [${hebrewSubs[0].source}] ${hebrewSubs[0].release}`);
  }

  console.log('✅ Series test completed successfully!');
}

testSeries().catch(err => {
  console.error('Series test failed:', err);
  process.exit(1);
});

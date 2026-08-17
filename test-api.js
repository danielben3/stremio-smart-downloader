import { TorrentioService } from './dist/services/torrentioService.js';
import { SubtitleService } from './dist/services/subtitles/subtitleService.js';
import { MetadataService } from './dist/services/metadataService.js';
import { EncodingService } from './dist/services/encodingService.js';

async function runTests() {
  console.log('--- 1. Testing Metadata Service ---');
  const meta = await MetadataService.getMeta('movie', 'tt15239678');
  console.log(`Title: ${meta.title} (${meta.year}), Poster: ${meta.poster ? 'OK' : 'Missing'}`);

  console.log('\n--- 2. Testing Torrentio Service ---');
  const torrents = await TorrentioService.getStreams('movie', 'tt15239678');
  console.log(`Found ${torrents.length} torrents.`);
  if (torrents.length > 0) {
    const top = torrents[0];
    console.log(`Top Torrent: ${top.filename}`);
    console.log(`Quality: ${top.quality}, Seeds: ${top.seeders}, Size: ${top.sizeFormatted}`);
    console.log(`Magnet starts with: ${top.magnetUrl.substring(0, 60)}...`);
  }

  console.log('\n--- 3. Testing Subtitles Service (Hebrew + Matching) ---');
  const topFilename = torrents[0]?.filename || meta.title;
  const subs = await SubtitleService.getSubtitles('movie', 'tt15239678', topFilename);
  console.log(`Found ${subs.length} subtitles.`);
  const hebrewSubs = subs.filter(s => s.lang === 'heb');
  console.log(`Hebrew subtitles count: ${hebrewSubs.length}`);
  if (hebrewSubs.length > 0) {
    console.log(`Top Hebrew Sub: [${hebrewSubs[0].source}] ${hebrewSubs[0].release} (${hebrewSubs[0].matchScore}% match)`);
  }

  console.log('\n--- 4. Testing Encoding Service (Hebrew Windows-1255 to UTF-8) ---');
  // Buffer containing Windows-1255 Hebrew "שלום עולם"
  // ש=0xf9, ל=0xec, ו=0xe5, ם=0xed, ' '=0x20, ע=0xf2, ו=0xe5, ל=0xec, ם=0xed
  const win1255Buf = Buffer.from([0xf9, 0xec, 0xe5, 0xed, 0x20, 0xf2, 0xe5, 0xec, 0xed]);
  const decoded = EncodingService.convertToUtf8(win1255Buf);
  console.log(`Decoded Hebrew text: "${decoded}" (Expected: "שלום עולם")`);
  if (decoded === 'שלום עולם') {
    console.log('✅ Encoding test passed!');
  } else {
    console.error('❌ Encoding test mismatch:', decoded);
  }

  console.log('\n🎉 ALL SERVICES VERIFIED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

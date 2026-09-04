import fs from 'fs';
import path from 'path';

/**
 * Validates a subtitle file (SRT / VTT) to ensure it is not a dummy/mock placeholder
 * and contains a genuine, full-length set of dialogue subtitles.
 * 
 * Usage: node validate_subtitle.js <path-to-srt-file> [min-cues] [min-duration-minutes]
 */
export function validateSubtitleFile(filePath, minCues = 50, minDurationMinutes = 45) {
  if (!fs.existsSync(filePath)) {
    return {
      valid: false,
      reason: `File does not exist: ${filePath}`,
      details: null
    };
  }

  const stats = fs.statSync(filePath);
  if (stats.size < 1024) { // Less than 1 KB is almost certainly a dummy/corrupt subtitle
    return {
      valid: false,
      reason: `File size is suspiciously small (${stats.size} bytes). Expected at least 15-150 KB for a full movie.`,
      sizeBytes: stats.size
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  // Match timestamp lines (00:00:00,000 --> 00:00:00,000 or 00:00:00.000 --> 00:00:00.000)
  const timestampRegex = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;
  const timestamps = [];

  for (const line of lines) {
    const match = line.match(timestampRegex);
    if (match) {
      const startSec = parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10);
      const endSec = parseInt(match[5], 10) * 3600 + parseInt(match[6], 10) * 60 + parseInt(match[7], 10);
      timestamps.push({ startSec, endSec, raw: match[0] });
    }
  }

  const cueCount = timestamps.length;
  if (cueCount === 0) {
    return {
      valid: false,
      reason: 'No valid SRT timestamps found in the file.',
      cueCount: 0
    };
  }

  const firstTimestamp = timestamps[0];
  const lastTimestamp = timestamps[timestamps.length - 1];
  const totalDurationMinutes = (lastTimestamp.endSec - firstTimestamp.startSec) / 60;

  // Check for dummy text markers
  const dummyPatterns = [
    /תרגום וסנכרון אוטומטי/i,
    /בכיכובו של/i,
    /dummy/i,
    /placeholder/i,
    /sample subtitle/i,
    /test subtitle/i
  ];

  const hasDummyPattern = dummyPatterns.some(pattern => pattern.test(content));

  if (cueCount < minCues) {
    return {
      valid: false,
      reason: `Subtitle has only ${cueCount} cues (minimum required is ${minCues}). Likely a truncated or dummy file.`,
      cueCount,
      totalDurationMinutes: totalDurationMinutes.toFixed(1),
      hasDummyPattern
    };
  }

  if (totalDurationMinutes < minDurationMinutes) {
    return {
      valid: false,
      reason: `Subtitle timeline spans only ${totalDurationMinutes.toFixed(1)} minutes (minimum expected is ${minDurationMinutes} minutes).`,
      cueCount,
      totalDurationMinutes: totalDurationMinutes.toFixed(1),
      hasDummyPattern
    };
  }

  return {
    valid: true,
    cueCount,
    sizeBytes: stats.size,
    firstCue: firstTimestamp.raw,
    lastCue: lastTimestamp.raw,
    totalDurationMinutes: totalDurationMinutes.toFixed(1),
    hasDummyPattern
  };
}

// CLI Execution Support
const args = process.argv.slice(2);
if (args.length > 0) {
  const targetPath = path.resolve(args[0]);
  const minCues = args[1] ? parseInt(args[1], 10) : 50;
  const minMinutes = args[2] ? parseInt(args[2], 10) : 45;

  const result = validateSubtitleFile(targetPath, minCues, minMinutes);
  console.log(JSON.stringify(result, null, 2));

  if (!result.valid) {
    process.exit(1);
  }
}

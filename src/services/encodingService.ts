import iconv from 'iconv-lite';

/**
 * Clean and normalize subtitles to UTF-8
 * Fixes Hebrew character encoding (Windows-1255 / ISO-8859-8 -> UTF-8)
 */
export class EncodingService {
  /**
   * Convert subtitle buffer/string to clean UTF-8 string
   */
  static convertToUtf8(buffer: Buffer): string {
    // Check for UTF-8 BOM
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return buffer.slice(3).toString('utf-8');
    }

    // Try decoding as UTF-8 first
    const utf8Text = buffer.toString('utf-8');
    
    // Check if it looks like properly decoded Hebrew or English text
    // Hebrew Unicode range is \u0590-\u05FF
    const hasHebrewUtf8 = /[\u0590-\u05FF]/.test(utf8Text);
    const hasReplacementChar = utf8Text.includes('\uFFFD');

    if (hasHebrewUtf8 && !hasReplacementChar) {
      return utf8Text;
    }

    // If UTF-8 decode failed or didn't detect Hebrew, try Windows-1255 (standard Hebrew ANSI)
    try {
      const win1255Text = iconv.decode(buffer, 'windows-1255');
      if (/[\u0590-\u05FF]/.test(win1255Text)) {
        return win1255Text;
      }
    } catch {
      // Fallback
    }

    // Try ISO-8859-8
    try {
      const isoText = iconv.decode(buffer, 'iso-8859-8');
      if (/[\u0590-\u05FF]/.test(isoText)) {
        return isoText;
      }
    } catch {
      // Fallback
    }

    return utf8Text;
  }

  /**
   * Convert WebVTT (.vtt) format to SubRip (.srt) format if needed
   */
  static vttToSrt(vttContent: string): string {
    let srt = vttContent
      .replace(/^WEBVTT[^\n]*\n+/i, '') // Remove WEBVTT header
      .replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, '$1,$2') // Replace dot in timestamps with comma
      .replace(/<[^>]+>/g, '') // Remove VTT formatting tags like <v ...> or <c>
      .trim();

    // Ensure sequential index numbers if missing
    const blocks = srt.split(/\n\s*\n/);
    const numberedBlocks = blocks.map((block, index) => {
      const lines = block.trim().split('\n');
      if (!lines[0]) return '';
      // If first line is already a timestamp (starts with 00: or digits:digits)
      if (lines[0].includes('-->')) {
        return `${index + 1}\n${lines.join('\n')}`;
      }
      return lines.join('\n');
    });

    return numberedBlocks.filter(Boolean).join('\n\n') + '\n';
  }
}

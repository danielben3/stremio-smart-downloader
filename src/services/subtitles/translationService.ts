import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EncodingService } from '../encodingService.js';

interface SubtitleCue {
  index: number;
  time: string;
  text: string[];
}

export class TranslationService {
  private static cacheDir = path.resolve('cache/subtitles');

  private static ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Translate full SRT content from English to Hebrew with caching and quality validation
   */
  static async translateSrt(sourceSrtContent: string, cacheKey?: string): Promise<string> {
    this.ensureCacheDir();

    // Check disk cache
    if (cacheKey) {
      const hash = crypto.createHash('md5').update(cacheKey).digest('hex');
      const cachedPath = path.join(this.cacheDir, `${hash}.srt`);
      if (fs.existsSync(cachedPath)) {
        const cachedContent = fs.readFileSync(cachedPath, 'utf-8');
        if (this.isValidSubtitleContent(cachedContent)) {
          return cachedContent;
        }
      }

      // Check if cacheKey contains an IMDb ID prefix (e.g. tt1234567_...)
      const imdbMatch = cacheKey.match(/^(tt\d+)/);
      if (imdbMatch) {
        const imdbPath = path.join(this.cacheDir, `${imdbMatch[1]}.srt`);
        if (fs.existsSync(imdbPath)) {
          const cachedContent = fs.readFileSync(imdbPath, 'utf-8');
          if (this.isValidSubtitleContent(cachedContent)) {
            return cachedContent;
          }
        }
      }
    }

    const cues = this.parseSrt(sourceSrtContent);
    if (cues.length === 0) {
      throw new Error('No valid cues found in source subtitle');
    }

    console.log(`[TranslationService] Translating ${cues.length} subtitle cues to Hebrew...`);

    // Translate cues in batches
    const BATCH_SIZE = 25;
    const translatedCues: SubtitleCue[] = [];

    for (let i = 0; i < cues.length; i += BATCH_SIZE) {
      const batch = cues.slice(i, i + BATCH_SIZE);
      const batchTranslated = await this.translateBatch(batch);
      translatedCues.push(...batchTranslated);
    }

    // Build final SRT
    let outputSrt = '';
    for (const cue of translatedCues) {
      outputSrt += `${cue.index}\n`;
      outputSrt += `${cue.time}\n`;
      outputSrt += `${cue.text.join('\n')}\n\n`;
    }

    // Save to disk cache
    if (cacheKey) {
      const hash = crypto.createHash('md5').update(cacheKey).digest('hex');
      const cachedPath = path.join(this.cacheDir, `${hash}.srt`);
      fs.writeFileSync(cachedPath, outputSrt, 'utf-8');
    }

    return outputSrt;
  }

  /**
   * Translate a batch of cues preserving timestamps and index
   */
  private static async translateBatch(batch: SubtitleCue[]): Promise<SubtitleCue[]> {
    const combinedTexts = batch.map(c => c.text.join(' '));
    const separator = ' ||| ';
    const joinedString = combinedTexts.join(separator);

    try {
      const translatedJoined = await this.translateText(joinedString, 'en', 'he');
      const splitTranslations = translatedJoined.split(/\s*\|\|\|\s*/);

      return batch.map((cue, idx) => ({
        index: cue.index,
        time: cue.time,
        text: [splitTranslations[idx] || cue.text.join(' ')]
      }));
    } catch (err) {
      console.warn('[TranslationService] Batch translation fallback per item:', (err as any)?.message);
      // Fallback: translate items individually
      const results: SubtitleCue[] = [];
      for (const cue of batch) {
        try {
          const trans = await this.translateText(cue.text.join(' '), 'en', 'he');
          results.push({ index: cue.index, time: cue.time, text: [trans] });
        } catch {
          results.push(cue);
        }
      }
      return results;
    }
  }

  /**
   * Translate text string with multi-provider resilient fallback
   */
  static async translateText(text: string, from = 'en', to = 'he'): Promise<string> {
    if (!text || !text.trim()) return text;

    // 1. Try Gemini API if key is provided
    if (process.env.GEMINI_API_KEY) {
      try {
        return await this.translateWithGemini(text, from, to);
      } catch (err) {
        console.warn('[TranslationService] Gemini API failed, falling back to free provider:', (err as any)?.message);
      }
    }

    // 2. Try Lingva instances
    const lingvaInstances = [
      'https://lingva.ml/api/v1',
      'https://lingva.lunar.icu/api/v1',
      'https://translate.plausibility.cloud/api/v1'
    ];

    for (const base of lingvaInstances) {
      try {
        const url = `${base}/${from}/${to}/${encodeURIComponent(text)}`;
        const res = await axios.get(url, { timeout: 6000 });
        if (res.data?.translation) {
          return res.data.translation;
        }
      } catch {}
    }

    // 3. Try MyMemory API (Limit to max 450 chars per request to avoid query length limit)
    if (text.length <= 450) {
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
        const res = await axios.get(url, { timeout: 6000 });
        const candidate = res.data?.responseData?.translatedText;
        if (candidate && !candidate.includes('QUERY LENGTH') && !candidate.includes('MYMEMORY WARNING')) {
          return candidate;
        }
      } catch {}
    }

    // Return original if all providers fail
    return text;
  }

  private static isValidSubtitleContent(content: string): boolean {
    if (!content || content.length < 500) return false;
    if (content.includes('QUERY LENGTH LIMIT') || content.includes('MYMEMORY WARNING')) return false;
    return true;
  }

  /**
   * Translate using Google Gemini API
   */
  private static async translateWithGemini(text: string, _from: string, _to: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `Translate the following movie subtitle text into natural, cinema-quality Hebrew. Return ONLY the translation, preserving separators ' ||| ' without adding any explanations or extra quotes:\n\n${text}`;

    const response = await axios.post(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    }, { timeout: 10000 });

    const reply = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) throw new Error('Empty Gemini response');
    return reply;
  }

  /**
   * Parse raw SRT text into structured cues
   */
  static parseSrt(srtText: string): SubtitleCue[] {
    const cleanText = EncodingService.convertToUtf8(Buffer.from(srtText));
    const lines = cleanText.split(/\r?\n/);
    const cues: SubtitleCue[] = [];

    let currentCue: SubtitleCue | null = null;
    const timestampRegex = /^(\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3})/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (currentCue && currentCue.time && currentCue.text.length > 0) {
          cues.push(currentCue);
          currentCue = null;
        }
        continue;
      }

      const matchNum = line.match(/^(\d+)$/);
      const matchTime = line.match(timestampRegex);

      if (matchNum && !currentCue) {
        currentCue = { index: parseInt(matchNum[1], 10), time: '', text: [] };
      } else if (matchTime && currentCue && !currentCue.time) {
        currentCue.time = matchTime[1];
      } else if (currentCue) {
        currentCue.text.push(line);
      }
    }

    if (currentCue && currentCue.time && currentCue.text.length > 0) {
      cues.push(currentCue);
    }

    return cues;
  }
}

import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { EncodingService } from './encodingService.js';

export interface HardsubJobProgress {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  percent: number;
  currentSeconds: number;
  totalSeconds: number;
  speed: string;
  fps: number;
  eta: string;
  inputVideo: string;
  outputVideo: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

export class HardsubService {
  private static ffmpegPath: string | null = null;
  private static jobs = new Map<string, HardsubJobProgress>();
  private static activeProcesses = new Map<string, ChildProcess>();

  /**
   * Resolve FFmpeg executable path
   */
  static getFFmpegPath(): string {
    if (this.ffmpegPath) return this.ffmpegPath;

    // 1. Check environment variable
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
      this.ffmpegPath = process.env.FFMPEG_PATH;
      return this.ffmpegPath;
    }

    // 2. Check bundled Stremio FFmpeg on Windows
    const userProfile = process.env.USERPROFILE || 'C:\\Users\\Daniel';
    const stremioFFmpeg = path.join(userProfile, 'AppData', 'Local', 'Programs', 'Stremio', 'ffmpeg.exe');
    if (fs.existsSync(stremioFFmpeg)) {
      this.ffmpegPath = stremioFFmpeg;
      return this.ffmpegPath;
    }

    // 3. Fallback to system PATH
    this.ffmpegPath = 'ffmpeg';
    return this.ffmpegPath;
  }

  /**
   * Convert SRT subtitle text into high-quality ASS format with Hebrew BiDi / RTL fix
   */
  static srtToAss(srtContent: string, title = 'Hebrew Subtitles'): string {
    // Normalize newlines
    const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // ASS Header with Netflix/Cinema styling (crisp bold Arial, white text, subtle black outline & shadow)
    const assHeader = `[Script Info]
Title: ${title}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2.8,1.2,2,40,40,45,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

    // Unicode Right-to-Left Mark to lock punctuation to the logical end of Hebrew sentences
    const RLM = '\u200F';

    // Parse SRT cues
    const blocks = normalized.trim().split(/\n\s*\n/);
    const dialogueLines: string[] = [];

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;

      let timeIndex = 0;
      if (!lines[0].includes('-->') && lines[1] && lines[1].includes('-->')) {
        timeIndex = 1;
      }

      const timeLine = lines[timeIndex];
      if (!timeLine || !timeLine.includes('-->')) continue;

      const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
      const startAss = this.srtTimeToAssTime(startStr);
      const endAss = this.srtTimeToAssTime(endStr);

      const textLines = lines.slice(timeIndex + 1);
      const processedTextLines = textLines.map(line => {
        let clean = line.replace(/<[^>]+>/g, '').trim(); // Remove basic HTML tags

        // If line contains Hebrew characters (\u0590-\u05FF)
        if (/[\u0590-\u05FF]/.test(clean)) {
          // Prepend RLM
          clean = RLM + clean;
          // If line ends with neutral punctuation (comma, period, exclamation, question mark, colon, semicolon, dash)
          if (/[,.!?:;\-"'״׳]$/.test(clean)) {
            clean = clean + RLM;
          }
        }
        return clean;
      });

      const assText = processedTextLines.join('\\N');
      dialogueLines.push(`Dialogue: 0,${startAss},${endAss},Default,,0,0,0,,${assText}`);
    }

    return assHeader + dialogueLines.join('\n') + '\n';
  }

  /**
   * Convert SRT timestamp (00:01:23,456) to ASS timestamp (0:01:23.46)
   */
  private static srtTimeToAssTime(srtTime: string): string {
    const parts = srtTime.split(/[:,]/);
    if (parts.length < 4) return '0:00:00.00';

    const hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');
    const seconds = parts[2].padStart(2, '0');
    const ms = parseInt(parts[3], 10);
    const cs = Math.round(ms / 10).toString().padStart(2, '0').slice(0, 2);

    return `${hours}:${minutes}:${seconds}.${cs}`;
  }

  /**
   * Convert HH:MM:SS.xx to total seconds
   */
  private static timeToSeconds(timeStr: string): number {
    const parts = timeStr.trim().split(':');
    if (parts.length !== 3) return 0;
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Format seconds to HH:MM:SS or MM:SS
   */
  private static formatDuration(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hours > 0) {
      return `${hours} שעות ו-${mins} דקות`;
    }
    return `${mins} דק' ו-${secs} שנ'`;
  }

  /**
   * Start asynchronous Hardsub burn-in job
   */
  static startBurnJob(params: {
    inputVideoPath: string;
    inputSrtPath: string;
    outputVideoPath?: string;
    jobId?: string;
  }): HardsubJobProgress {
    const { inputVideoPath, inputSrtPath } = params;

    if (!fs.existsSync(inputVideoPath)) {
      throw new Error(`קובץ וידאו מקור לא נמצא: ${inputVideoPath}`);
    }
    if (!fs.existsSync(inputSrtPath)) {
      throw new Error(`קובץ כתוביות מקור לא נמצא: ${inputSrtPath}`);
    }

    const jobId = params.jobId || `hardsub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Default output path in downloads directory with .Hardsub.mp4
    const ext = path.extname(inputVideoPath);
    const baseDir = path.dirname(inputVideoPath);
    const baseName = path.basename(inputVideoPath, ext);
    const outputVideoPath = params.outputVideoPath || path.join(baseDir, `${baseName}.Hardsub.mp4`);

    // Prepare temp ASS subtitle file
    const scratchDir = path.resolve('scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
    const tempAssPath = path.join(scratchDir, `${jobId}.ass`);

    // Read and convert SRT to ASS
    const rawSrtBuffer = fs.readFileSync(inputSrtPath);
    const utf8Srt = EncodingService.convertToUtf8(rawSrtBuffer);
    const assContent = this.srtToAss(utf8Srt, baseName);
    fs.writeFileSync(tempAssPath, assContent, 'utf-8');

    const job: HardsubJobProgress = {
      id: jobId,
      status: 'processing',
      percent: 0,
      currentSeconds: 0,
      totalSeconds: 0,
      speed: '0x',
      fps: 0,
      eta: 'מחשב...',
      inputVideo: inputVideoPath,
      outputVideo: outputVideoPath,
      startedAt: Date.now()
    };

    this.jobs.set(jobId, job);

    const ffmpegExe = this.getFFmpegPath();

    // Escape ASS file path for FFmpeg subtitles/ass filter on Windows
    // Replace backslashes with forward slashes and escape colon: C:/foo -> C\:/foo
    const normalizedAssPath = tempAssPath.replace(/\\/g, '/').replace(/^([a-zA-Z]):/, '$1\\:');

    const ffmpegArgs = [
      '-y',
      '-i', inputVideoPath,
      '-vf', `ass='${normalizedAssPath}'`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ac', '2',
      '-movflags', '+faststart',
      outputVideoPath
    ];

    console.log(`[HardsubService] Starting job ${jobId}:`);
    console.log(`  FFmpeg: ${ffmpegExe}`);
    console.log(`  Input:  ${inputVideoPath}`);
    console.log(`  Output: ${outputVideoPath}`);

    const child = spawn(ffmpegExe, ffmpegArgs, {
      windowsHide: true
    });

    this.activeProcesses.set(jobId, child);

    let stderrBuffer = '';

    child.stderr.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      stderrBuffer += str;

      // Detect total duration from FFmpeg header: Duration: 01:35:03.85
      if (!job.totalSeconds) {
        const durationMatch = str.match(/Duration:\s*(\d{2}:\d{2}:\d{2}\.\d+)/);
        if (durationMatch) {
          job.totalSeconds = this.timeToSeconds(durationMatch[1]);
        }
      }

      // Detect current encoding progress: frame=  146 fps=132 q=27.0 size= 1536kB time=00:00:06.61 ... speed=5.99x
      const timeMatch = str.match(/time=(\d{2}:\d{2}:\d{2}\.\d+)/);
      const speedMatch = str.match(/speed=\s*([\d.]+x)/);
      const fpsMatch = str.match(/fps=\s*([\d.]+)/);

      if (timeMatch) {
        job.currentSeconds = this.timeToSeconds(timeMatch[1]);
        if (job.totalSeconds > 0) {
          job.percent = Math.min(99.9, Math.round((job.currentSeconds / job.totalSeconds) * 1000) / 10);
        }
      }

      if (speedMatch) {
        job.speed = speedMatch[1];
        const numericSpeed = parseFloat(job.speed);
        if (numericSpeed > 0 && job.totalSeconds > job.currentSeconds) {
          const remainingSec = (job.totalSeconds - job.currentSeconds) / numericSpeed;
          job.eta = this.formatDuration(remainingSec);
        }
      }

      if (fpsMatch) {
        job.fps = Math.round(parseFloat(fpsMatch[1]));
      }
    });

    child.on('close', (code) => {
      this.activeProcesses.delete(jobId);

      // Clean up temp ASS file
      try {
        if (fs.existsSync(tempAssPath)) fs.unlinkSync(tempAssPath);
      } catch {}

      if (code === 0 && fs.existsSync(outputVideoPath)) {
        job.status = 'completed';
        job.percent = 100;
        job.eta = 'הושלם בהצלחה!';
        job.completedAt = Date.now();
        console.log(`[HardsubService] Job ${jobId} finished successfully! Saved to: ${outputVideoPath}`);
      } else {
        job.status = 'failed';
        job.error = `FFmpeg process exited with code ${code}. Details: ${stderrBuffer.slice(-500)}`;
        console.error(`[HardsubService] Job ${jobId} failed with code ${code}:`, job.error);
      }
    });

    child.on('error', (err) => {
      this.activeProcesses.delete(jobId);
      job.status = 'failed';
      job.error = err.message;
      console.error(`[HardsubService] Failed to spawn FFmpeg for job ${jobId}:`, err);
    });

    return job;
  }

  /**
   * Get status of a job
   */
  static getJob(jobId: string): HardsubJobProgress | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * List all jobs
   */
  static listJobs(): HardsubJobProgress[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Cancel / kill an ongoing job
   */
  static cancelJob(jobId: string): boolean {
    const child = this.activeProcesses.get(jobId);
    if (child) {
      child.kill('SIGKILL');
      this.activeProcesses.delete(jobId);
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.error = 'בוטל על ידי המשתמש';
      }
      return true;
    }
    return false;
  }
}

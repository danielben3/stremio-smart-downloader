import path from 'path';
import fs from 'fs';
import { HardsubService } from './dist/services/hardsubService.js';

async function main() {
  const videoName = 'Mutiny 2026 1080p WEB-DL HEVC x265 5.1 BONE.mkv';
  const srtName = 'Mutiny 2026 1080p WEB-DL HEVC x265 5.1 BONE.srt';
  const downloadsDir = path.resolve('downloads');

  const inputVideoPath = path.join(downloadsDir, videoName);
  const inputSrtPath = path.join(downloadsDir, srtName);
  const outputVideoPath = path.join(downloadsDir, 'Mutiny 2026 1080p WEB-DL HEVC x265 5.1 BONE.Hardsub.mp4');

  console.log('================================================================');
  console.log('🔥 מפעיל צריבת כתוביות בעברית מלאה (Hardsub) מותאם לטלגרם');
  console.log('================================================================');
  console.log(`🎬 קובץ וידאו מקור: ${videoName}`);
  console.log(`🇮🇱 קובץ כתוביות עברית: ${srtName}`);
  console.log(`📁 קובץ יעד לטלגרם: ${path.basename(outputVideoPath)}\n`);

  if (!fs.existsSync(inputVideoPath)) {
    console.error(`❌ קובץ וידאו מקור לא נמצא: ${inputVideoPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(inputSrtPath)) {
    console.error(`❌ קובץ כתוביות לא נמצא: ${inputSrtPath}`);
    process.exit(1);
  }

  const job = HardsubService.startBurnJob({
    inputVideoPath,
    inputSrtPath,
    outputVideoPath
  });

  const startTime = Date.now();
  const interval = setInterval(() => {
    const current = HardsubService.getJob(job.id);
    if (!current) return;

    if (current.status === 'processing') {
      process.stdout.write(
        `\r⏳ התקדמות צריבה: ${current.percent.toFixed(1)}% | 🚀 מהירות: ${current.speed} | 🎞️ FPS: ${current.fps} | ⏱️ נותר: ${current.eta}    `
      );
    } else if (current.status === 'completed') {
      clearInterval(interval);
      const totalSec = Math.round((Date.now() - startTime) / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;

      console.log('\n\n================================================================');
      console.log('🎉 תהליך הצריבה הושלם בהצלחה ב-100%!');
      console.log(`📁 קובץ ה-Hardsub נשמר ב: ${outputVideoPath}`);

      if (fs.existsSync(outputVideoPath)) {
        const stats = fs.statSync(outputVideoPath);
        const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`💾 גודל הקובץ הסופי: ${sizeMb} MB`);
      }
      console.log(`⏱️ משך זמן הקידוד: ${min} דקות ו-${sec} שניות`);
      console.log('✨ הקובץ מוכן כעת להעלאה ישירה לטלגרם ורץ עם כתוביות בעברית בכל נגן!');
      console.log('================================================================');
      process.exit(0);
    } else if (current.status === 'failed') {
      clearInterval(interval);
      console.error(`\n\n❌ שגיאה בצריבת הוידאו: ${current.error}`);
      process.exit(1);
    }
  }, 1000);
}

main().catch(err => {
  console.error('שגיאה:', err);
  process.exit(1);
});

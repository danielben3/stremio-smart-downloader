# Stremio Smart Downloader (כתוביות בעברית + מובייל) 📥🎬

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/danielben3/stremio-smart-downloader)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/danielben3/stremio-smart-downloader)

תוסף Stremio מתקדם ומותאם למובייל אנדרואיד המאפשר הורדת סרטים וסדרות מ-**Torrentio** במהירות שיא ישירות לאפליקציית **1DM** / מנהל הורדות עצמאי, יחד עם כתוביות בעברית מסונכרנות מ-**Wizdom** ו-**OpenSubtitles** בקידוד **UTF-8** תקין.

---

## ✨ למה התוסף הזה נוצר?

בעת שימוש ב-Stremio עם אפליקציות כמו ADM (Advanced Download Manager):
1. **ADM נכשל וקופא**: Stremio משעה את השרת המקומי שלו ברקע כשהמסך כבוי או כשעוברים אפליקציה, ו-ADM מאבד את החיבור.
2. **כתוביות לא יורדות**: Stremio מעביר ב-Intent רק את כתובת הוידאו ולא שולח כתוביות חיצוניות.
3. **ג'יבריש בעברית**: קובצי כתוביות שנשמרו ב-Windows-1255 מופיעים כסימני שאלה או ג'יבריש בנגנים.

**Stremio Smart Downloader** פותר את כל הבעיות האלה מהשורש!

---

## 🚀 תכונות עיקריות

- **הורדה עצמאית ל-1DM**: משגר קישור Magnet מלא עם רשימת Trackers מהירים ישירות ל-1DM או LibreTorrent – ההורדה ממשיכה ברקע במהירות מקסימלית גם כשהמסך כבוי.
- **סנכרון כתוביות בעברית (Auto File Pairing)**: קובץ ה-`.srt` יורד ישירות לתיקיית `Downloads` בטלפון עם **אותו שם בדיוק** של קובץ הוידאו. נגנים כמו **VLC**, **Nova Player** ו-**MX Player** מזהים את התרגום אוטומטית!
- **מנוע כתוביות מרובה מקורות**: שליפה מ-Wizdom, SubDL ו-OpenSubtitles v3 עם התאמת גרסה (Release Group Matching) ל-PSA, YIFY, AMZN, RARBG ועוד.
- **המרה אוטומטית ל-UTF-8**: מבטיח 0% בעיות ג'יבריש בתרגום.
- **ממשק מובייל מהיר ויוקרתי (Mobile-First Web UI)**: Dark Mode, Glassmorphism, תמיכה מלאה ב-RTL וקוד QR לסריקה ישירה מהטלפון.

---

## 🛠️ הפעלה מקומית

1. **התקנת תלויות**:
   ```bash
   npm install
   ```

2. **בנייה והרצה**:
   ```bash
   npm run build
   npm start
   ```
   או במצב פיתוח (Dev):
   ```bash
   npm run dev
   ```

3. **כתובות זמינות**:
   - עמוד הבית וההתקנה: `http://localhost:7000`
   - קישור Manifest ל-Stremio: `http://localhost:7000/manifest.json`

---

## 📱 התקנה ב-Stremio במובייל אנדרואיד

1. פתח את Stremio במכשיר האנדרואיד שלך.
2. לחץ על לשונית **Addons** (תוספים) -> סמל החיפוש / שורת הכתובת.
3. הדבק את כתובת ה-Manifest של התוסף (למשל `http://<YOUR-IP>:7000/manifest.json` או כתובת השרת בענן) ולחץ **Install**.
4. עכשיו, בכל סרט או פרק של סדרה, תחת רשימת הסטרימים תופיע האפשרות:
   `⚡ [📥 הורדה חכמה] בחירת איכות + כתוביות בעברית`.
5. לחיצה עליה תפתח את עמוד ההורדה שבו תוכל להוריד את התרגום ולשגר את הטורנט ל-1DM בלחיצה אחת!

---

## 🌐 פריסה לענן (24/7 בחינם)

כדי שהתוסף יהיה זמין בטלפון מכל מקום (גם מחוץ לרשת הביתית):
1. **Render.com**: פתח חשבון חינמי, חבר את ה-Repository, ובחר Node.js Web Service (`Build: npm run build`, `Start: npm start`).
2. **Vercel / Hugging Face**: ניתן לפרוס בלחיצה אחת.

---

## 📂 מבנה הפרויקט

```
stremio-smart-downloader/
├── src/
│   ├── index.ts                     # שרת Express ראשי
│   ├── manifest.ts                  # מפרט ה-Manifest הרשמי של Stremio
│   ├── types/                       # הגדרות טיפוסים (TypeScript)
│   ├── services/
│   │   ├── metadataService.ts       # שליפת מטא-דאטה מ-Cinemeta/IMDb
│   │   ├── torrentioService.ts      # שליפת טורנטים וחישוב Magnet מ-Torrentio
│   │   ├── encodingService.ts       # המרת כתוביות עבריות ל-UTF-8
│   │   └── subtitles/
│   │       ├── subtitleService.ts   # שירות כתוביות ראשי והתאמת שחרור
│   │       ├── wizdomProvider.ts    # ספק כתוביות Wizdom
│   │       ├── subdlProvider.ts     # ספק כתוביות SubDL
│   │       └── openSubtitlesProvider.ts # ספק כתוביות OpenSubtitles
│   └── routes/
│       ├── stremio.ts               # ראוטים של Stremio (/manifest.json, /stream/...)
│       └── download.ts              # ראוטים של עמוד ההורדה למובייל
└── public/
    ├── index.html                   # דף בית והתקנה
    ├── download.html                # עמוד הורדה ייעודי למובייל
    ├── css/style.css                # עיצוב מודרני, Dark Mode ו-RTL
    └── js/app.js                    # לוגיקת צד-לקוח למובייל
```

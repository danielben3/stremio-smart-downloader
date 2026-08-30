# מדריך פריסה חינמית לענן (בתוך 2 דקות) ☁️🚀

פריסת התוסף לענן תאפשר לך להשתמש בו ב-Stremio מכל מכשיר (טלפון, טאבלט, Android TV) ללא צורך במחשב פעיל!

---

## 🌟 אפשרות ראשית ומומלצת: Render.com (חינם 24/7)

### שלב 1: העלאת הקוד ל-GitHub
1. פתח חשבון ב-[GitHub.com](https://github.com) (אם אין לך).
2. צור מאגר חדש (New Repository) בשם `stremio-smart-downloader`.
3. הרץ בטרמינל במחשב את הפקודות הבאות (מחליף את `YOUR_USERNAME` בשם המשתמש שלך):
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/stremio-smart-downloader.git
   git push -u origin main
   ```

### שלב 2: יצירת Web Service ב-Render
1. היכנס ל-[Render.com](https://render.com) והתחבר עם חשבון ה-GitHub שלך.
2. לחץ על **New +** -> בחר **Web Service**.
3. בחר את המאגר `stremio-smart-downloader` שהעלית הרגע.
4. Render יזהה אוטומטית את ההגדרות (מתוך קובץ `render.yaml` שהכנו עבורך):
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. לחץ **Create Web Service**.

### שלב 3: התקנה ב-Stremio בטלפון
בסיום הבנייה (כדקה), Render ייתן לך כתובת HTTPS קבועה, למשל:
`https://stremio-smart-downloader-xyz.onrender.com`

1. פתח את Stremio בטלפון אנדרואיד שלך.
2. עבור ללשונית **Addons** (תוספים) -> לחץ על שורת החיפוש.
3. הדבק את הכתובת הבאה:
   ```
   https://stremio-smart-downloader-xyz.onrender.com/manifest.json
   ```
4. לחץ **Install**.

🎉 **וזהו! מעכשיו התוסף מותקן בטלפון שלך לצמיתות ועובד 24/7 מכל מקום ללא צורך במחשב.**

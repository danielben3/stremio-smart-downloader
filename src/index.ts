import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { stremioRouter } from './routes/stremio.js';
import { downloadRouter } from './routes/download.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 7000;

app.use(cors());
app.use(express.json());

// Serve static assets from public folder
app.use(express.static(path.join(rootDir, 'public')));

// Mount Stremio Addon protocol routes
app.use('/', stremioRouter);

// Mount Downloader API routes
app.use('/', downloadRouter);

// Serve Downloader UI for Stremio external links: /download/:type/:id
app.get('/download/:type/:id', (_req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'download.html'));
});

// Root URL redirects or serves installation homepage
app.get('/', (_req, res) => {
  res.sendFile(path.join(rootDir, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=====================================================`);
  console.log(`🚀 Stremio Smart Downloader is running!`);
  console.log(`🌐 Web & Install Page: http://localhost:${PORT}`);
  console.log(`📦 Manifest URL:       http://localhost:${PORT}/manifest.json`);
  console.log(`📥 Test Downloader:    http://localhost:${PORT}/download/movie/tt15239678`);
  console.log(`=====================================================`);
});

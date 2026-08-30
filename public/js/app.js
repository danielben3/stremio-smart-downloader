let currentData = null;
let selectedTorrentIndex = 0;
let selectedSubtitleIndex = 0; // 0 is top Hebrew sub, -1 means none

const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://p4p.arenabg.com:1337/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'http://tracker.openbittorrent.com:80/announce'
];

document.addEventListener('DOMContentLoaded', () => {
  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      document.getElementById('errorState').style.display = 'none';
      document.getElementById('loadingState').style.display = 'flex';
      initApp();
    });
  }
  initApp();
});

async function initApp() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  // Expected path: /download/:type/:id
  const type = pathParts[1] || 'movie';
  const rawId = pathParts.slice(2).join('/');
  const id = decodeURIComponent(rawId || '').replace('.json', '');

  if (!id) {
    showError('מזהה תוכן חסר בכתובת');
    return;
  }

  try {
    // 1. Fetch metadata and subtitles from our backend
    let meta = { id, imdbId: id.split(':')[0], type, title: id };
    let subtitles = [];
    let torrents = [];

    try {
      const res = await fetch(`/api/details/${type}/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.meta) meta = data.meta;
        if (data.subtitles) subtitles = data.subtitles;
        if (data.torrents && data.torrents.length > 0) torrents = data.torrents;
      }
    } catch (backendErr) {
      console.warn('Backend fetch warning:', backendErr);
    }

    // 2. If backend torrents is empty (e.g. cloud datacenter IP blocked by Cloudflare), fetch directly from client browser!
    if (torrents.length === 0) {
      console.log('Fetching torrents directly from client mobile IP...');
      const clientTorrents = await fetchTorrentioClientSide(type, id);
      if (clientTorrents && clientTorrents.length > 0) {
        torrents = clientTorrents;
      }
    }

    // 3. Fallback for metadata if missing
    if (!meta.title || meta.title === id) {
      try {
        const cleanImdb = id.split(':')[0];
        const cinemetaRes = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${cleanImdb}.json`);
        if (cinemetaRes.ok) {
          const cData = await cinemetaRes.json();
          if (cData.meta) {
            meta.title = cData.meta.name || meta.title;
            meta.year = cData.meta.year || cData.meta.releaseInfo;
            meta.poster = cData.meta.poster;
          }
        }
      } catch (cErr) {
        console.warn('Cinemeta client fetch failed:', cErr);
      }
    }

    if (torrents.length === 0) {
      showError('לא נמצאו מקורות טורנט זמינים עבור תוכן זה מ-Torrentio.');
      return;
    }

    currentData = { meta, torrents, subtitles };
    renderMedia(meta);
    renderTorrents(torrents);
    renderSubtitles(subtitles);

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('headerStatus').innerText = 'מוכן להורדה';
    document.getElementById('headerStatus').className = 'badge badge-success';

    setupActions();
  } catch (err) {
    console.error(err);
    showError('אירעה שגיאה בטעינת הנתונים. אנא לחץ "נסה שוב".');
  }
}

async function fetchTorrentioClientSide(type, id) {
  const cleanId = id.replace('.json', '');
  const candidateUrls = [
    `https://torrentio.strem.fun/stream/${type}/${cleanId}.json`,
    `https://torrentio.strem.fun/sort=qualitysize/stream/${type}/${cleanId}.json`,
    `https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl/stream/${type}/${cleanId}.json`
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (data.streams && Array.isArray(data.streams) && data.streams.length > 0) {
          return parseRawStreams(data.streams);
        }
      }
    } catch (e) {
      console.warn('Client-side Torrentio attempt failed for', url, e);
    }
  }

  return [];
}

function parseRawStreams(rawStreams) {
  const streams = [];

  rawStreams.forEach((stream, index) => {
    if (!stream.infoHash) return;

    const rawTitle = stream.title || '';
    const rawName = stream.name || '';
    const lines = rawTitle.split('\n');

    const filename = lines[0]?.trim() || `Media_${stream.infoHash}`;
    const detailsLine = lines[1] || '';

    // Parse Quality
    let quality = '1080p';
    let resolution = '1080p';
    if (/4k|2160p/i.test(rawName) || /4k|2160p/i.test(filename)) {
      quality = '4K';
      resolution = '2160p';
    } else if (/1080p/i.test(rawName) || /1080p/i.test(filename)) {
      quality = '1080p';
      resolution = '1080p';
    } else if (/720p/i.test(rawName) || /720p/i.test(filename)) {
      quality = '720p';
      resolution = '720p';
    } else if (/480p|576p|SD/i.test(rawName) || /480p|576p|SD/i.test(filename)) {
      quality = '480p';
      resolution = '480p';
    }

    // Parse Codec
    let codec = 'x264';
    if (/hevc|x265|h\.265/i.test(rawTitle) || /hevc|x265|h\.265/i.test(filename)) {
      codec = 'x265 (HEVC)';
    } else if (/av1/i.test(rawTitle) || /av1/i.test(filename)) {
      codec = 'AV1';
    }

    // Parse Seeders
    let seeders = 0;
    const seedMatch = detailsLine.match(/(?:👤|👥|Seeds?:?)\s*(\d+)/i) || rawTitle.match(/👤\s*(\d+)/);
    if (seedMatch) seeders = parseInt(seedMatch[1], 10);

    // Parse Size
    let sizeFormatted = 'לא ידוע';
    let sizeBytes = 0;
    const sizeMatch = detailsLine.match(/(?:💾|Size:?)\s*([\d.]+\s*(?:GB|MB|KB|G|M))/i) || rawTitle.match(/💾\s*([\d.]+\s*(?:GB|MB))/);
    if (sizeMatch) {
      sizeFormatted = sizeMatch[1].trim();
      const num = parseFloat(sizeMatch[1]);
      if (sizeMatch[1].toUpperCase().includes('GB')) sizeBytes = num * 1024 * 1024 * 1024;
      else if (sizeMatch[1].toUpperCase().includes('MB')) sizeBytes = num * 1024 * 1024;
    }

    // Provider
    let provider = 'Torrentio';
    const provMatch = detailsLine.match(/(?:⚙️|Provider:?)\s*([A-Za-z0-9_-]+)/);
    if (provMatch) provider = provMatch[1].trim();

    // Magnet link
    const trackers = stream.sources && Array.isArray(stream.sources) && stream.sources.length > 0
      ? stream.sources.filter(s => s.startsWith('tracker:'))
      : DEFAULT_TRACKERS;

    const trackerParams = trackers
      .map(t => `&tr=${encodeURIComponent(t.replace(/^tracker:/, ''))}`)
      .join('');

    const magnetUrl = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(filename)}${trackerParams}`;

    streams.push({
      id: `torrent-${stream.infoHash}-${stream.fileIdx ?? 0}-${index}`,
      title: filename,
      name: rawName,
      quality,
      resolution,
      codec,
      sizeBytes,
      sizeFormatted,
      seeders,
      infoHash: stream.infoHash,
      fileIdx: stream.fileIdx,
      magnetUrl,
      filename,
      provider,
      rawTitle
    });
  });

  // Sort by Quality and Seeds
  streams.sort((a, b) => {
    const qualityRank = { '4K': 4, '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
    const qA = qualityRank[a.quality] || 0;
    const qB = qualityRank[b.quality] || 0;
    if (qB !== qA) return qB - qA;
    return b.seeders - a.seeders;
  });

  return streams;
}

function showError(msg) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('mainContent').style.display = 'none';
  document.getElementById('errorMessage').innerText = msg;
  document.getElementById('errorState').style.display = 'block';
  document.getElementById('headerStatus').innerText = 'שגיאה';
  document.getElementById('headerStatus').className = 'badge';
}

function renderMedia(meta) {
  document.getElementById('mediaTitle').innerText = meta.title || 'סרט';
  document.getElementById('mediaYear').innerText = meta.year || '';
  document.getElementById('mediaType').innerText = meta.type === 'series' ? 'סדרה' : 'סרט';

  if (meta.poster) {
    document.getElementById('mediaPoster').src = meta.poster;
  } else {
    document.getElementById('mediaPoster').style.display = 'none';
  }

  if (meta.type === 'series' && meta.season !== undefined && meta.episode !== undefined) {
    const epTag = document.getElementById('mediaEpisode');
    epTag.innerText = `עונה ${meta.season} פרק ${meta.episode}${meta.episodeTitle ? ` - ${meta.episodeTitle}` : ''}`;
    epTag.style.display = 'inline';
  }

  document.getElementById('torrentsCountBadge').innerText = `${currentData.torrents.length} טורנטים`;
  document.getElementById('subsCountBadge').innerText = `${currentData.subtitles.length} כתוביות`;
}

function renderTorrents(torrents) {
  const container = document.getElementById('torrentsList');
  container.innerHTML = '';

  torrents.forEach((torrent, index) => {
    const isSelected = index === selectedTorrentIndex;
    const card = document.createElement('div');
    card.className = `selectable-card ${isSelected ? 'selected' : ''}`;
    card.dataset.index = index;

    card.innerHTML = `
      <div class="card-left">
        <div class="radio-indicator"></div>
        <div class="card-details">
          <div class="card-main-title" title="${escapeHtml(torrent.filename)}">${escapeHtml(torrent.filename)}</div>
          <div class="card-sub-info">
            <span class="quality-badge">${torrent.quality}</span>
            <span style="color: #4ade80; font-weight: 600;">👤 ${torrent.seeders} Seeds</span>
            <span>💾 ${torrent.sizeFormatted}</span>
            <span>⚙️ ${torrent.codec}</span>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      selectTorrent(index);
    });

    container.appendChild(card);
  });
}

function selectTorrent(index) {
  selectedTorrentIndex = index;
  const cards = document.querySelectorAll('#torrentsList .selectable-card');
  cards.forEach((c, idx) => {
    c.classList.toggle('selected', idx === index);
  });

  const selectedTorrent = currentData.torrents[index];
  if (selectedTorrent) {
    rescoreSubtitles(selectedTorrent.filename);
  }
}

async function rescoreSubtitles(torrentName) {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const type = pathParts[1];
  const rawId = pathParts.slice(2).join('/');
  const id = decodeURIComponent(rawId || '').replace('.json', '');

  try {
    const res = await fetch(`/api/subtitles/${type}/${encodeURIComponent(id)}?torrentName=${encodeURIComponent(torrentName)}`);
    if (res.ok) {
      const data = await res.json();
      currentData.subtitles = data.subtitles;
      renderSubtitles(data.subtitles);
    }
  } catch (err) {
    console.warn('Failed to re-score subtitles:', err);
  }
}

function renderSubtitles(subtitles) {
  const container = document.getElementById('subtitlesList');
  container.innerHTML = '';

  if (!subtitles || subtitles.length === 0) {
    container.innerHTML = `
      <div class="selectable-card selected" style="cursor: default;">
        <div class="card-left">
          <div class="radio-indicator"></div>
          <div class="card-details">
            <div class="card-main-title" style="direction: rtl; text-align: right;">לא נמצאו כתוביות חיצוניות</div>
            <div class="card-sub-info">הוידאו יורד עם כתוביות מובנות (אם קיימות בטורנט)</div>
          </div>
        </div>
      </div>
    `;
    selectedSubtitleIndex = -1;
    return;
  }

  subtitles.forEach((sub, index) => {
    const isSelected = index === selectedSubtitleIndex;
    const card = document.createElement('div');
    card.className = `selectable-card ${isSelected ? 'selected' : ''}`;
    card.dataset.index = index;

    const isHebrew = sub.lang === 'heb';
    const matchBadge = sub.matchScore && sub.matchScore >= 70
      ? `<span class="match-badge">${sub.matchScore}% התאמה</span>`
      : '';

    card.innerHTML = `
      <div class="card-left">
        <div class="radio-indicator"></div>
        <div class="card-details">
          <div class="card-main-title" title="${escapeHtml(sub.release)}">${escapeHtml(sub.release)}</div>
          <div class="card-sub-info">
            <span class="quality-badge" style="${isHebrew ? 'background: rgba(16, 185, 129, 0.15); color: #34d399;' : ''}">${sub.langName}</span>
            ${matchBadge}
            <span>מקור: ${sub.source}</span>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      selectSubtitle(index);
    });

    container.appendChild(card);
  });
}

function selectSubtitle(index) {
  selectedSubtitleIndex = index;
  const cards = document.querySelectorAll('#subtitlesList .selectable-card');
  cards.forEach((c, idx) => {
    c.classList.toggle('selected', idx === index);
  });
}

function setupActions() {
  // Download All (SRT + Magnet to 1DM)
  document.getElementById('downloadAllBtn').addEventListener('click', () => {
    const torrent = currentData.torrents[selectedTorrentIndex];
    if (!torrent) return;

    // 1. Download Subtitle with matching filename
    downloadSelectedSubtitle(torrent.filename);

    // 2. Open Magnet in 1DM / external app
    setTimeout(() => {
      triggerMagnetDownload(torrent.magnetUrl);
    }, 400);

    showToast('🚀 הכתובית יורדת, והטורנט נפתח באפליקציית ההורדות!');
  });

  // Download Subtitle Only
  document.getElementById('downloadSubOnlyBtn').addEventListener('click', () => {
    const torrent = currentData.torrents[selectedTorrentIndex];
    const targetFilename = torrent ? torrent.filename : (currentData.meta.title || 'subtitle');
    downloadSelectedSubtitle(targetFilename);
    showToast('📥 הורדת קובץ הכתוביות (.SRT) החלה');
  });

  // Copy Magnet Link
  document.getElementById('copyMagnetBtn').addEventListener('click', () => {
    const torrent = currentData.torrents[selectedTorrentIndex];
    if (!torrent) return;

    navigator.clipboard.writeText(torrent.magnetUrl).then(() => {
      showToast('🧲 קישור ה-Magnet הועתק ללוח!');
    }).catch(() => {
      prompt('העתק את קישור ה-Magnet:', torrent.magnetUrl);
    });
  });
}

function downloadSelectedSubtitle(targetVideoFilename) {
  if (selectedSubtitleIndex < 0 || !currentData.subtitles[selectedSubtitleIndex]) {
    return;
  }

  const sub = currentData.subtitles[selectedSubtitleIndex];
  let cleanName = targetVideoFilename.replace(/\.[^/.]+$/, ''); // remove extension
  cleanName = cleanName.replace(/[<>:"/\\|?*]/g, '_');

  const downloadUrl = `/api/download-sub?url=${encodeURIComponent(sub.downloadUrl)}&filename=${encodeURIComponent(cleanName)}`;

  // Trigger browser download
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', `${cleanName}.srt`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function triggerMagnetDownload(magnetUrl) {
  // Standard Android Intent / URI handler for 1DM, LibreTorrent, Flud
  const link = document.createElement('a');
  link.href = magnetUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

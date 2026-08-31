let currentData = { meta: {}, torrents: [], subtitles: [] };
let selectedTorrentIndex = 0;
let selectedSubtitleIndex = 0;

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
  setupSearch();

  const retryBtn = document.getElementById('retryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      document.getElementById('errorState').style.display = 'none';
      document.getElementById('loadingState').style.display = 'flex';
      initFromUrl();
    });
  }

  initFromUrl();
});

function initFromUrl() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  // Expected path: /download/:type/:id
  const type = pathParts[1] || 'movie';
  const rawId = pathParts.slice(2).join('/');
  const id = decodeURIComponent(rawId || '').replace('.json', '');

  if (id && id !== 'movie' && id !== 'series') {
    loadMedia(type, id);
  } else {
    // If opened without specific ID, show search prompt
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorMessage').innerText = 'הקלד את שם הסרט או הסדרה בשורת החיפוש למעלה כדי להתחיל.';
    document.getElementById('errorState').style.display = 'block';
  }
}

async function loadMedia(type, id) {
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('mainContent').style.display = 'none';
  document.getElementById('loadingState').style.display = 'flex';
  document.getElementById('headerStatus').innerText = 'טוען מקורות...';
  document.getElementById('headerStatus').className = 'badge';

  currentData = {
    meta: { id, imdbId: id.split(':')[0], type, title: 'טוען...' },
    torrents: [],
    subtitles: []
  };

  // 1. Fetch Cinemeta metadata for title/poster
  fetchCinemeta(type, id);

  // 2. Fetch Torrents from Torrentio (Direct Client + Backend in parallel)
  const clientTorrentsPromise = fetchTorrentioClient(type, id);
  const backendPromise = fetchBackend(type, id);

  clientTorrentsPromise.then(torrents => {
    if (torrents && torrents.length > 0) {
      currentData.torrents = torrents;
      displayResults();
    }
  }).catch(e => console.warn('Client torrent fetch warning:', e));

  backendPromise.then(bData => {
    if (bData) {
      if (bData.meta && (!currentData.meta.title || currentData.meta.title === 'טוען...')) {
        currentData.meta = bData.meta;
      }
      if (bData.subtitles && bData.subtitles.length > 0) {
        currentData.subtitles = bData.subtitles;
      }
      if ((!currentData.torrents || currentData.torrents.length === 0) && bData.torrents && bData.torrents.length > 0) {
        currentData.torrents = bData.torrents;
      }
      displayResults();
    }
  }).catch(e => console.warn('Backend warning:', e));

  setTimeout(() => {
    if (!currentData.torrents || currentData.torrents.length === 0) {
      showError('לא נמצאו מקורות טורנט זמינים עבור תוכן זה מ-Torrentio. נסה לחפש שוב בשורת החיפוש.');
    }
  }, 7000);
}

async function fetchCinemeta(type, id) {
  try {
    const cleanImdb = id.split(':')[0];
    const res = await fetch(`https://v3-cinemeta.strem.io/meta/${type}/${cleanImdb}.json`);
    if (res.ok) {
      const data = await res.json();
      if (data.meta) {
        currentData.meta.title = data.meta.name || currentData.meta.title;
        currentData.meta.year = data.meta.year || data.meta.releaseInfo;
        currentData.meta.poster = data.meta.poster;
        if (type === 'series') {
          const parts = id.split(':');
          currentData.meta.season = parts[1] ? parseInt(parts[1], 10) : undefined;
          currentData.meta.episode = parts[2] ? parseInt(parts[2], 10) : undefined;
        }
        renderMedia(currentData.meta);
      }
    }
  } catch (e) {
    console.warn('Cinemeta err:', e);
  }
}

async function fetchBackend(type, id) {
  try {
    const res = await fetch(`/api/details/${type}/${encodeURIComponent(id)}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Backend fetch err:', e);
  }
  return null;
}

async function fetchTorrentioClient(type, id) {
  const cleanId = id.replace('.json', '');
  const candidateUrls = [
    `https://torrentio.strem.fun/stream/${type}/${cleanId}.json`,
    `https://torrentio.strem.fun/sort=qualitysize/stream/${type}/${cleanId}.json`,
    `https://torrentio.strem.fun/providers=yts,eztv,rarbg,1337x,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl/stream/${type}/${cleanId}.json`
  ];

  for (const url of candidateUrls) {
    try {
      // Simple fetch without custom headers to avoid CORS preflight OPTIONS failure
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.streams && Array.isArray(data.streams) && data.streams.length > 0) {
          return parseRawStreams(data.streams);
        }
      }
    } catch (e) {
      console.warn('Torrentio fetch failed:', url, e);
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

    // Quality
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

    // Codec
    let codec = 'x264';
    if (/hevc|x265|h\.265/i.test(rawTitle) || /hevc|x265|h\.265/i.test(filename)) {
      codec = 'x265 (HEVC)';
    } else if (/av1/i.test(rawTitle) || /av1/i.test(filename)) {
      codec = 'AV1';
    }

    // Seeds
    let seeders = 0;
    const seedMatch = detailsLine.match(/(?:👤|👥|Seeds?:?)\s*(\d+)/i) || rawTitle.match(/👤\s*(\d+)/);
    if (seedMatch) seeders = parseInt(seedMatch[1], 10);

    // Size
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

function displayResults() {
  if (currentData.torrents.length === 0) return;

  renderMedia(currentData.meta);
  renderTorrents(currentData.torrents);
  renderSubtitles(currentData.subtitles);

  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('mainContent').style.display = 'block';
  document.getElementById('headerStatus').innerText = 'מוכן להורדה';
  document.getElementById('headerStatus').className = 'badge badge-success';

  setupActions();
}

function showError(msg) {
  if (currentData.torrents && currentData.torrents.length > 0) return;
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
    document.getElementById('mediaPoster').style.display = 'block';
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
  const type = currentData.meta.type || 'movie';
  const id = currentData.meta.id || '';

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
  // Direct HTTP Download (Bypasses P2P blocking, instant fast HTTP stream to 1DM)
  const directHttpBtn = document.getElementById('downloadDirectHttpBtn');
  if (directHttpBtn) {
    directHttpBtn.onclick = () => {
      const torrent = currentData.torrents[selectedTorrentIndex];
      if (!torrent) return;

      // 1. Download subtitle with matching name
      downloadSelectedSubtitle(torrent.filename);

      // 2. Open Direct HTTP Stream in 1DM / Browser
      const directStreamUrl = `/api/stream/${torrent.infoHash}?filename=${encodeURIComponent(torrent.filename)}`;
      
      const link = document.createElement('a');
      link.href = directStreamUrl;
      link.setAttribute('download', torrent.filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('⚡ הורדה ישירה החלה ב-HTTP ללא חסימות P2P!');
    };
  }

  // Download All (SRT + Magnet to 1DM)
  document.getElementById('downloadAllBtn').onclick = () => {
    const torrent = currentData.torrents[selectedTorrentIndex];
    if (!torrent) return;

    downloadSelectedSubtitle(torrent.filename);

    setTimeout(() => {
      triggerMagnetDownload(torrent.magnetUrl);
    }, 400);

    showToast('🚀 הכתובית יורדת, והטורנט נפתח באפליקציית ההורדות!');
  };

  // Download Subtitle Only
  document.getElementById('downloadSubOnlyBtn').onclick = () => {
    const torrent = currentData.torrents[selectedTorrentIndex];
    const targetFilename = torrent ? torrent.filename : (currentData.meta.title || 'subtitle');
    downloadSelectedSubtitle(targetFilename);
    showToast('📥 הורדת קובץ הכתוביות (.SRT) החלה');
  };

  // Download .torrent File directly
  const torrentFileBtn = document.getElementById('downloadTorrentFileBtn');
  if (torrentFileBtn) {
    torrentFileBtn.onclick = () => {
      const torrent = currentData.torrents[selectedTorrentIndex];
      if (!torrent) return;

      const directUrl = `https://itorrents.org/torrent/${torrent.infoHash.toUpperCase()}.torrent`;
      window.open(directUrl, '_blank');
      showToast('📄 מוריד קובץ .torrent ישיר ל-1DM...');
    };
  }

  // Copy Magnet Link
  document.getElementById('copyMagnetBtn').onclick = () => {
    const torrent = currentData.torrents[selectedTorrentIndex];
    if (!torrent) return;

    navigator.clipboard.writeText(torrent.magnetUrl).then(() => {
      showToast('🧲 קישור ה-Magnet הועתק ללוח!');
    }).catch(() => {
      prompt('העתק את קישור ה-Magnet:', torrent.magnetUrl);
    });
  };
}

function downloadSelectedSubtitle(targetVideoFilename) {
  if (selectedSubtitleIndex < 0 || !currentData.subtitles[selectedSubtitleIndex]) {
    return;
  }

  const sub = currentData.subtitles[selectedSubtitleIndex];
  let cleanName = targetVideoFilename.replace(/\.[^/.]+$/, '');
  cleanName = cleanName.replace(/[<>:"/\\|?*]/g, '_');

  const downloadUrl = `/api/download-sub?url=${encodeURIComponent(sub.downloadUrl)}&filename=${encodeURIComponent(cleanName)}`;

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', `${cleanName}.srt`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function triggerMagnetDownload(magnetUrl) {
  const link = document.createElement('a');
  link.href = magnetUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function setupSearch() {
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const dropdown = document.getElementById('searchResultsDropdown');

  searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;

    dropdown.style.display = 'none';
    searchMedia(query);
  });

  searchInput.addEventListener('input', debounce(async () => {
    const query = searchInput.value.trim();
    if (query.length < 2) {
      dropdown.style.display = 'none';
      return;
    }

    try {
      const res = await fetch(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(query)}.json`);
      if (res.ok) {
        const data = await res.json();
        const metas = data.metas || [];
        if (metas.length > 0) {
          dropdown.innerHTML = metas.slice(0, 5).map(m => `
            <div class="search-item" onclick="selectSearchMedia('${m.type || 'movie'}', '${m.id}')">
              <img src="${m.poster || ''}" class="search-item-img" alt="">
              <div>
                <div style="font-weight: 600; color: #fff; font-size: 0.9rem;">${escapeHtml(m.name)}</div>
                <div style="font-size: 0.78rem; color: var(--text-secondary);">${m.year || m.releaseInfo || ''} • ${m.type === 'series' ? 'סדרה' : 'סרט'}</div>
              </div>
            </div>
          `).join('');
          dropdown.style.display = 'block';
        } else {
          dropdown.style.display = 'none';
        }
      }
    } catch (e) {
      console.warn('Search autocomplete error:', e);
    }
  }, 300));
}

window.selectSearchMedia = function(type, id) {
  document.getElementById('searchResultsDropdown').style.display = 'none';
  window.history.pushState(null, '', `/download/${type}/${id}`);
  loadMedia(type, id);
};

async function searchMedia(query) {
  try {
    const res = await fetch(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(query)}.json`);
    if (res.ok) {
      const data = await res.json();
      const metas = data.metas || [];
      if (metas.length > 0) {
        const first = metas[0];
        window.history.pushState(null, '', `/download/${first.type || 'movie'}/${first.id}`);
        loadMedia(first.type || 'movie', first.id);
        return;
      }
    }
  } catch (e) {
    console.warn('Search submit err:', e);
  }
  showError(`לא נמצאו תוצאות עבור החיפוש "${query}".`);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
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

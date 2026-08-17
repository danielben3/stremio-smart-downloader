let currentData = null;
let selectedTorrentIndex = 0;
let selectedSubtitleIndex = 0; // 0 is top Hebrew sub, -1 means none

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  // Expected path: /download/:type/:id
  const type = pathParts[1] || 'movie';
  const id = pathParts[2] || '';

  if (!id) {
    showError('מזהה תוכן חסר');
    return;
  }

  try {
    const res = await fetch(`/api/details/${type}/${id}`);
    if (!res.ok) throw new Error('שגיאה בטעינת נתונים');
    const data = await res.json();

    if (!data.torrents || data.torrents.length === 0) {
      showError('לא נמצאו טורנטים זמינים מ-Torrentio עבור תוכן זה.');
      return;
    }

    currentData = data;
    renderMedia(data.meta);
    renderTorrents(data.torrents);
    renderSubtitles(data.subtitles);

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('headerStatus').innerText = 'מוכן להורדה';
    document.getElementById('headerStatus').className = 'badge badge-success';

    setupActions();
  } catch (err) {
    console.error(err);
    showError('אירעה שגיאה בעת טעינת המידע. אנא נסה שוב.');
  }
}

function showError(msg) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('mainContent').style.display = 'none';
  document.getElementById('errorMessage').innerText = msg;
  document.getElementById('errorState').style.display = 'block';
  document.getElementById('headerStatus').innerText = 'שגיאה';
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

  // Re-score subtitles based on this torrent's filename
  const selectedTorrent = currentData.torrents[index];
  if (selectedTorrent) {
    rescoreSubtitles(selectedTorrent.filename);
  }
}

async function rescoreSubtitles(torrentName) {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const type = pathParts[1];
  const id = pathParts[2];

  try {
    const res = await fetch(`/api/subtitles/${type}/${id}?torrentName=${encodeURIComponent(torrentName)}`);
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
      // Fallback
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

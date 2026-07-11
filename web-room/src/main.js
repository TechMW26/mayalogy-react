import './styles.css';

const params = new URLSearchParams(location.search);
const initialRoom = clean(params.get('room') || '');
const role = params.get('role') === 'host' ? 'host' : 'join';
const initialName = params.get('name') || '';
const apiBase = import.meta.env.VITE_CICADA_SYNC_API_URL || '';
const PLAY_LEAD_MS = 60;
const CLOCK_MAX_RTT_MS = 2500;
const DRIFT_SEEK_THRESHOLD_SEC = 0.85;
const DRIFT_HARD_SEEK_THRESHOLD_SEC = 1.5;
const DRIFT_CORRECTION_COOLDOWN_MS = 3000;

const state = {
  roomId: initialRoom,
  roomName: initialName,
  role,
  videoId: '',
  title: '',
  thumb: '',
  offsetMs: 0,
  clockReady: false,
  rttMs: 0,
  version: 0,
  playerApiReady: false,
  playerReady: false,
  playerCreating: false,
  isPlaying: false,
  loadedVideoId: '',
  pendingPlay: null,
  playTimer: null,
  lastCommandKey: '',
  lastCorrectionAt: 0,
  queue: [],
};

const icons = {
  search:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="M16 16l4 4"></path></svg>',
  play:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" stroke="none"></path></svg>',
  pause:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"></path></svg>',
  close:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"></path></svg>',
  plus:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"></path></svg>',
  check:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"></path></svg>',
};

function clean(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);
}

function makeRoomId(name) {
  const base = clean(name).slice(0, 4) || 'ROOM';
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 3; i += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${base}${suffix}`.slice(0, 8);
}

function api(path) {
  return `${apiBase}${path}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function routeTo(roomId, nextRole, name = '') {
  const next = new URL(location.href);
  next.searchParams.set('room', clean(roomId));
  next.searchParams.set('role', nextRole);
  if (name) next.searchParams.set('name', name);
  location.href = next.toString();
}

function routeToSetup() {
  const next = new URL(location.href);
  next.search = '';
  location.href = next.toString();
}

function renderSetup() {
  document.querySelector('#root').innerHTML = `
    <main class="setup-shell">
      <section class="setup-card">
        <div class="brand">CICADA LISTEN</div>
        <h1>Create a room</h1>
        <p>Name your listening room, then play synced music through Cicada and every joined device.</p>
        <input id="roomName" class="setup-input" placeholder="Room name" autocomplete="off" />
        <button id="createRoom" class="primary">Create room</button>
        <div class="divider"><span>or join</span></div>
        <input id="joinRoom" class="setup-input code" placeholder="ROOM ID" maxlength="8" autocomplete="off" />
        <button id="joinRoomBtn" class="secondary">Join room</button>
      </section>
    </main>
  `;

  document.querySelector('#createRoom').onclick = () => {
    const name = document.querySelector('#roomName').value.trim() || 'Cicada Room';
    routeTo(makeRoomId(name), 'host', name);
  };
  document.querySelector('#joinRoom').addEventListener('input', (event) => {
    event.target.value = clean(event.target.value);
  });
  document.querySelector('#joinRoomBtn').onclick = () => {
    const id = clean(document.querySelector('#joinRoom').value);
    if (id.length >= 4) routeTo(id, 'join');
  };
}

function renderRoom() {
  document.querySelector('#root').innerHTML = `
    <main class="room-shell">
      <header class="room-header">
        <div>
          <div class="brand">CICADA ${state.role === 'host' ? 'HOST' : 'GUEST'}</div>
          <h1>${escapeHtml(state.roomName || 'Cicada Room')}</h1>
        </div>
        <div class="header-actions">
          ${state.role === 'host' ? `<button id="openSearch" class="top-search icon-btn" aria-label="Search music">${icons.search}</button>` : ''}
          <div class="room-code"><span>ROOM</span>${state.roomId}</div>
          <button id="closeRoom" class="close-room icon-btn" aria-label="Close room">${icons.close}</button>
        </div>
      </header>

      <section class="player-card">
        <div class="screen" id="screen">
          <div id="player"></div>
          <img id="cover" class="cover" alt="" />
          <div class="empty-video" id="emptyVideo">
            <div class="disc"><div></div></div>
            <p>${state.role === 'host' ? 'Search and play a video' : 'Waiting for host'}</p>
          </div>
          <div id="coverPlay" class="cover-play">${icons.play}</div>
        </div>
        <div class="track">
          <img id="art" class="art" alt="" />
          <div class="track-text">
            <div id="trackTitle">Cicada is ready</div>
            <span id="trackSub">Room ${state.roomId} · Synced listening</span>
          </div>
        </div>
        <div class="transport-row">
          ${state.role === 'host' ? `<button id="playPause" class="transport-btn primary-transport icon-btn" aria-label="Play">${icons.play}</button>` : ''}
          <div class="progress"><div id="progressBar"></div></div>
        </div>
        <p id="status" class="status">${state.role === 'host' ? 'Pick a video to start.' : 'Waiting for host...'}</p>
      </section>

      ${state.role === 'host' ? `
        <section class="queue-strip">
          <div class="queue-head">
            <span>Up next</span>
            <button id="openSearchInline">Add music</button>
          </div>
          <div id="queue" class="queue"><p class="muted">No queued videos.</p></div>
        </section>

        <section id="searchPage" class="search-page" aria-hidden="true">
          <div class="search-top">
            <button id="closeSearch" class="close-search icon-btn" aria-label="Close search">${icons.close}</button>
            <div>
              <div class="brand">CICADA SEARCH</div>
              <h2>Add music</h2>
            </div>
          </div>
          <div class="search-row">
            <input id="query" placeholder="Search music or paste a YouTube link" />
            <button id="search" class="icon-btn" aria-label="Search">${icons.search}</button>
          </div>
          <div id="results" class="results"></div>
        </section>
      ` : ''}
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </main>
  `;
}

function el(id) {
  return document.getElementById(id);
}

function setStatus(text, bad = false) {
  const node = el('status');
  if (!node) return;
  node.textContent = text;
  node.className = bad ? 'status bad' : 'status';
}

function setSearchOpen(open) {
  const page = el('searchPage');
  if (!page) return;
  page.classList.toggle('open', open);
  page.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (open) setTimeout(() => el('query')?.focus(), 80);
}

function showToast(message) {
  const toast = el('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1600);
}

async function postRoom(payload) {
  const sentAt = clientNow();
  const res = await fetch(api('/api/room'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomId: state.roomId, roomName: state.roomName, role: state.role, ...payload }),
  });
  if (!res.ok) throw new Error('Room sync failed');
  const receivedAt = clientNow();
  const data = await res.json();
  updateClock(data.serverAt, receivedAt - sentAt, receivedAt);
  return data;
}

async function getRoom() {
  const sentAt = clientNow();
  const res = await fetch(api(`/api/room?room=${encodeURIComponent(state.roomId)}`), { cache: 'no-store' });
  if (!res.ok) throw new Error('Room sync failed');
  const receivedAt = clientNow();
  const data = await res.json();
  updateClock(data.serverAt, receivedAt - sentAt, receivedAt);
  return data;
}

function clientNow() {
  return (performance.timeOrigin || Date.now() - performance.now()) + performance.now();
}

function updateClock(serverAt, rttMs, receivedAt) {
  if (!Number.isFinite(serverAt) || !Number.isFinite(rttMs) || !Number.isFinite(receivedAt)) return;
  const sampleOffset = serverAt + rttMs / 2 - receivedAt;
  state.rttMs = rttMs;
  if (!state.clockReady) {
    state.offsetMs = sampleOffset;
    state.clockReady = true;
    return;
  }
  if (rttMs > CLOCK_MAX_RTT_MS) return;
  const delta = sampleOffset - state.offsetMs;
  const cappedDelta = Math.max(-100, Math.min(100, delta));
  const alpha = rttMs < 450 ? 0.25 : 0.12;
  state.offsetMs += cappedDelta * alpha;
}

function serverNow() {
  return clientNow() + state.offsetMs;
}

function createPlayer() {
  if (state.playerCreating || state.playerReady || !state.playerApiReady || !window.YT?.Player || !el('player')) {
    return;
  }
  state.playerCreating = true;
  try {
    window.player = new YT.Player('player', {
      width: '100%',
      height: '100%',
      playerVars: {
        playsinline: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        enablejsapi: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          state.playerCreating = false;
          state.playerReady = true;
          if (state.pendingPlay) {
            const pending = state.pendingPlay;
            state.pendingPlay = null;
            syncPlay(pending.startAt, pending.positionSec, pending.videoId);
          }
        },
        onError: () => {
          setPlaying(false);
          setStatus('This video cannot be embedded. Choose another result.', true);
        },
      },
    });
  } catch {
    state.playerCreating = false;
    state.playerReady = false;
  }
}

function ensurePlayer() {
  createPlayer();
}

function updateTrack(video) {
  if (!video?.videoId) return;
  state.videoId = video.videoId;
  state.title = video.title || 'YouTube video';
  state.thumb = video.thumb || video.thumbnail || `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;
  el('trackTitle').textContent = state.title;
  el('trackSub').textContent = `Room ${state.roomId} · YouTube`;
  const art = el('art');
  art.src = state.thumb;
  art.style.display = 'block';
  const cover = el('cover');
  cover.src = state.thumb;
  cover.style.display = 'block';
  el('coverPlay').style.display = 'grid';
  el('emptyVideo').style.display = 'none';
  ensurePlayer();
}

function playerTime() {
  try {
    return state.playerReady && window.player?.getCurrentTime ? window.player.getCurrentTime() || 0 : 0;
  } catch {
    return 0;
  }
}

function playerDuration() {
  try {
    return state.playerReady && window.player?.getDuration ? window.player.getDuration() || 0 : 0;
  } catch {
    return 0;
  }
}

function setPlaying(playing) {
  state.isPlaying = playing;
  const button = el('playPause');
  if (button) {
    button.innerHTML = playing ? icons.pause : icons.play;
    button.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    button.classList.toggle('is-playing', playing);
  }
  const coverButton = el('coverPlay');
  if (coverButton) coverButton.innerHTML = playing ? icons.pause : icons.play;
}

function pauseLocalPlayer() {
  setPlaying(false);
  if (state.playTimer) {
    clearTimeout(state.playTimer);
    state.playTimer = null;
  }
  if (!state.playerReady) return;
  try {
    window.player.pauseVideo();
  } catch {
    state.playerReady = false;
  }
}

async function closeRoom() {
  const positionSec = playerTime();
  pauseLocalPlayer();
  if (state.role === 'host') {
    setStatus('Closing room...');
    try {
      await postRoom({
        action: 'closed',
        videoId: '',
        title: '',
        thumb: '',
        startAt: serverNow(),
        positionSec,
      });
    } catch {
      // Leave locally even if the final close broadcast fails.
    }
  }
  routeToSetup();
}

function commandKey(room) {
  return [
    room.version || 0,
    room.action || '',
    room.videoId || '',
    room.startAt || 0,
    room.positionSec || 0,
  ].join(':');
}

function targetPosition(startAt, positionSec) {
  const scheduledAt = Number(startAt || serverNow());
  const base = Number(positionSec || 0);
  return Math.max(0, base + (serverNow() - scheduledAt) / 1000);
}

function syncPlay(startAt, positionSec, requestedVideoId = state.videoId) {
  if (!requestedVideoId) return;
  setPlaying(true);
  if (!state.playerReady) {
    state.pendingPlay = { videoId: requestedVideoId, startAt, positionSec };
    ensurePlayer();
    return;
  }
  if (state.playTimer) {
    clearTimeout(state.playTimer);
    state.playTimer = null;
  }
  const run = () => {
    try {
      const nextSeek = targetPosition(startAt, positionSec);
      if (state.loadedVideoId === requestedVideoId) {
        if (Math.abs(playerTime() - nextSeek) > 0.35) {
          window.player.seekTo(nextSeek, true);
        }
        window.player.playVideo();
      } else {
        window.player.loadVideoById({ videoId: requestedVideoId, startSeconds: nextSeek });
      }
      state.loadedVideoId = requestedVideoId;
    } catch {
      state.playerReady = false;
      state.pendingPlay = { videoId: requestedVideoId, startAt, positionSec };
      ensurePlayer();
    }
  };
  const delay = Math.max(0, startAt - serverNow());
  if (delay <= 80) run();
  else {
    state.playTimer = setTimeout(() => {
      state.playTimer = null;
      run();
    }, delay);
  }
}

function correctGuestDrift(room) {
  if (state.role === 'host') return;
  if (!state.playerReady || room.action !== 'play' || !room.videoId) return;
  if (state.loadedVideoId !== room.videoId) return;
  const now = serverNow();
  if (now - state.lastCorrectionAt < DRIFT_CORRECTION_COOLDOWN_MS) return;
  try {
    const playerState = window.player?.getPlayerState?.();
    if (playerState === 3) return;
    const expected = targetPosition(room.startAt, room.positionSec || 0);
    const actual = playerTime();
    const drift = expected - actual;
    const absDrift = Math.abs(drift);
    if (absDrift < DRIFT_SEEK_THRESHOLD_SEC) return;
    if (absDrift < DRIFT_HARD_SEEK_THRESHOLD_SEC && now - state.lastCorrectionAt < DRIFT_CORRECTION_COOLDOWN_MS * 2) {
      return;
    }
    window.player.seekTo(expected, true);
    window.player.playVideo();
    state.lastCorrectionAt = now;
  } catch {
    state.playerReady = false;
  }
}

async function searchYouTube() {
  const query = el('query').value.trim();
  if (!query) return;
  el('results').innerHTML = '<p class="muted">Searching...</p>';
  const res = await fetch(api(`/api/youtube?q=${encodeURIComponent(query)}`), { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok) {
    el('results').innerHTML = `<p class="bad">${escapeHtml(data.error || 'Search failed')}</p>`;
    return;
  }
  if (!data.items?.length) {
    el('results').innerHTML = '<p class="muted">No videos found.</p>';
    return;
  }
  el('results').innerHTML = data.items.map((item) => `
    <article class="result">
      <img src="${item.thumbnail}" alt="" />
      <div><strong>${escapeHtml(item.title)}</strong></div>
      <button class="queue-add icon-btn" aria-label="Add to queue" data-action="queue" data-video-id="${item.videoId}" data-title="${encodeURIComponent(item.title)}" data-thumb="${item.thumbnail}">${icons.plus}</button>
      <button class="play-hit" aria-label="Play now" data-action="play" data-video-id="${item.videoId}" data-title="${encodeURIComponent(item.title)}" data-thumb="${item.thumbnail}"></button>
    </article>
  `).join('');
}

function renderQueue() {
  const queue = el('queue');
  if (!queue) return;
  if (state.queue.length === 0) {
    queue.innerHTML = '<p class="muted">No queued videos.</p>';
    return;
  }
  queue.innerHTML = state.queue.map((item, index) => `
    <button class="queue-item" data-index="${index}">
      <img src="${item.thumb}" alt="" />
      <span><strong>${escapeHtml(item.title)}</strong><small>Tap to play now</small></span>
      <b>${icons.play}</b>
    </button>
  `).join('');
}

async function playVideo(video, positionSec = 0) {
  updateTrack(video);
  const startAt = serverNow() + PLAY_LEAD_MS;
  syncPlay(startAt, positionSec);
  await postRoom({ action: 'play', ...video, startAt, positionSec });
}

async function pollRoom() {
  let data;
  try {
    data = await getRoom();
  } catch {
    setStatus('Sync reconnecting...', true);
    return;
  }

  const room = data.room;
  if (!room) {
    if (state.role === 'host') {
      try {
        await postRoom({ action: 'idle' });
      } catch {
        setStatus('Sync reconnecting...', true);
      }
    }
    return;
  }

  if (room.action === 'closed') {
    pauseLocalPlayer();
    setStatus('Room closed.');
    setTimeout(routeToSetup, 600);
    return;
  }

  try {
    if (room.roomName && !state.roomName) state.roomName = room.roomName;
    const nextCommandKey = commandKey(room);
    if (nextCommandKey !== state.lastCommandKey) {
      state.lastCommandKey = nextCommandKey;
      state.version = room.version;
      if (room.videoId) updateTrack(room);
      if (room.action === 'play') {
        const hostAlreadyAuthoritative =
          state.role === 'host' && state.loadedVideoId === room.videoId && state.isPlaying;
        if (!hostAlreadyAuthoritative) {
          syncPlay(room.startAt, room.positionSec || 0, room.videoId);
        }
      }
      if (room.action === 'pause') {
        pauseLocalPlayer();
        if (state.playerReady) {
          try {
            window.player.seekTo(room.positionSec || 0, true);
          } catch {
            state.playerReady = false;
          }
        }
      }
    } else {
      correctGuestDrift(room);
    }
  } catch {
    // The room is still connected even if the hidden YouTube player is not ready.
  }

  setStatus(state.role === 'host' ? 'Room synced.' : 'Synced with host.');
}

function loadYouTubeApi() {
  window.onYouTubeIframeAPIReady = () => {
    state.playerApiReady = true;
    ensurePlayer();
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

if (!initialRoom) {
  renderSetup();
} else {
  renderRoom();
  loadYouTubeApi();
  ensurePlayer();
  pollRoom();
  setInterval(pollRoom, state.role === 'host' ? 1000 : 500);
  setInterval(() => {
    const d = playerDuration();
    const progress = d ? Math.min(100, (playerTime() / d) * 100) : 0;
    const bar = el('progressBar');
    if (bar) bar.style.width = `${progress}%`;
    try {
      const playerState = window.player?.getPlayerState?.();
      if (playerState === 1 && !state.isPlaying) setPlaying(true);
      if (
        (playerState === 0 || playerState === 2 || playerState === 5) &&
        state.isPlaying &&
        !state.pendingPlay &&
        !state.playTimer
      ) {
        setPlaying(false);
      }
    } catch {
      // Player state is best-effort UI only.
    }
  }, 350);

  el('closeRoom').onclick = closeRoom;

  if (state.role === 'host') {
    el('openSearch').onclick = () => setSearchOpen(true);
    el('openSearchInline').onclick = () => setSearchOpen(true);
    el('closeSearch').onclick = () => setSearchOpen(false);
    el('search').onclick = () => searchYouTube().catch(() => {
      el('results').innerHTML = '<p class="bad">Search failed.</p>';
    });
    el('query').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') searchYouTube();
    });
    el('results').addEventListener('click', async (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const video = {
        videoId: button.dataset.videoId,
        title: decodeURIComponent(button.dataset.title || ''),
        thumb: button.dataset.thumb,
      };
      if (button.dataset.action === 'queue') {
        state.queue.push(video);
        renderQueue();
        button.innerHTML = icons.check;
        button.classList.add('added');
        showToast('Added to queue');
        return;
      }
      setSearchOpen(false);
      await playVideo(video);
    });
    el('queue').addEventListener('click', async (event) => {
      const item = event.target.closest('.queue-item');
      if (!item) return;
      const [video] = state.queue.splice(Number(item.dataset.index), 1);
      renderQueue();
      await playVideo(video);
    });
  }

  async function togglePlayback() {
    if (!state.videoId) return;
    if (state.isPlaying) {
      const positionSec = playerTime();
      pauseLocalPlayer();
      await postRoom({
        action: 'pause',
        videoId: state.videoId,
        title: state.title,
        thumb: state.thumb,
        positionSec,
      });
      return;
    }
    const positionSec = playerTime();
    const startAt = serverNow() + PLAY_LEAD_MS;
    syncPlay(startAt, positionSec, state.videoId);
    await postRoom({
      action: 'play',
      videoId: state.videoId,
      title: state.title,
      thumb: state.thumb,
      startAt,
      positionSec,
    });
  }

  const playPause = el('playPause');
  if (playPause) playPause.onclick = togglePlayback;
}

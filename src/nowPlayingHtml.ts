// Self-contained HTML for the Now Playing WebView.
// Contains TWO scenes adapted verbatim from the design files:
//   - Detect scene  -> musicrec.html (sound-reactive pastel blob)
//   - Lyrics scene  -> lyrics.html  (frosted-glass synced lyrics)
// The mic/upload controls are removed. A small `window.ZV` bridge lets
// React Native drive the status text, song info, lyrics and the play clock.
// All per-frame work (karaoke fill + auto-centering) runs INSIDE the WebView
// for buttery-smooth 60fps motion without spamming the RN bridge.

export const NOW_PLAYING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<style>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
:root {
  --volume: 0; --bass: 0; --mid: 0; --treble: 0;
  --blob-blur: 22px;
  --blob-radius-a: 42%; --blob-radius-b: 58%; --blob-radius-c: 54%; --blob-radius-d: 46%;
  --sat: 0px; --sab: 0px;
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body {
  margin: 0; width: 100%; height: 100%;
  font-family: ui-rounded, "SF Pro Rounded", "Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f4eee2; color: #111827; overflow: hidden;
  -webkit-user-select: none; user-select: none;
}

/* scene visibility + transition toggled by body class.
   transform + opacity only (compositor-friendly) so it stays smooth on low-end devices. */
.detect-scene, .lyrics-scene {
  position: fixed; inset: 0;
  transition: opacity 0.42s ease, transform 0.52s cubic-bezier(.22,.61,.36,1);
  will-change: opacity, transform; backface-visibility: hidden;
  /* isolate each scene's paint/layout so the GPU composites them independently */
  contain: layout paint style; transform: translateZ(0);
}
/* detect parked to the LEFT while lyrics are shown */
body.mode-lyrics .detect-scene {
  opacity: 0; transform: translate3d(-9%,0,0) scale(0.92); pointer-events: none;
}
/* lyrics parked to the RIGHT while detecting (enters from the right -> left) */
body.mode-detect .lyrics-scene {
  opacity: 0; transform: translate3d(9%,0,0) scale(0.92); pointer-events: none;
}
/* Freeze every animation on the parked scene so only ONE scene paints/animates at a time. */
body.mode-lyrics .detect-scene, body.mode-lyrics .detect-scene *,
body.mode-detect .lyrics-scene, body.mode-detect .lyrics-scene * { animation-play-state: paused !important; }

/* =========================  DETECT SCENE  ========================= */
.detect-scene {
  display: grid; place-items: center; overflow: hidden;
  background: #f4eee2;
}
.glass-card {
  position: relative; z-index: 5;
  width: min(92vw, 520px); aspect-ratio: 1;
  display: grid; place-items: center;
  background: transparent; border: none; box-shadow: none;
  overflow: visible; transform: translateZ(0);
}
.blob {
  position: relative; width: 58%; height: 58%;
  border-radius: var(--blob-radius-a) var(--blob-radius-b) var(--blob-radius-c) var(--blob-radius-d);
  background:
    radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.95), transparent 22%),
    radial-gradient(circle at 28% 32%, rgba(255, 193, 218, 0.8), transparent 38%),
    radial-gradient(circle at 72% 30%, rgba(186, 219, 255, 0.85), transparent 42%),
    radial-gradient(circle at 62% 78%, rgba(202, 255, 232, 0.78), transparent 40%),
    linear-gradient(135deg, rgba(255, 199, 228, 0.75), rgba(190, 218, 255, 0.75), rgba(205, 255, 235, 0.75));
  filter: blur(calc(var(--blob-blur) * 0.08)) drop-shadow(0 22px 45px rgba(120, 150, 190, 0.22));
  transform: translateZ(0) scale(calc(1 + var(--volume) * 0.22)) rotate(calc(var(--bass) * 16deg));
  opacity: calc(0.82 + var(--volume) * 0.14);
  animation: blobIdle 8s ease-in-out infinite;
  transition: border-radius 0.16s ease, transform 0.08s linear, opacity 0.12s linear;
  /* own GPU layer: the blur/shadow rasterize once and the per-frame scale/rotate is a cheap matrix op */
  will-change: transform, opacity; backface-visibility: hidden;
}
.blob::before {
  content: ""; position: absolute; inset: 12%; border-radius: inherit;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.18));
  mix-blend-mode: soft-light; filter: blur(8px);
  opacity: calc(0.55 + var(--treble) * 0.45);
}
.blob::after {
  content: ""; position: absolute; inset: -18%; border-radius: inherit;
  background:
    radial-gradient(circle, rgba(255, 210, 232, 0.45), transparent 58%),
    radial-gradient(circle at 70% 35%, rgba(185, 218, 255, 0.45), transparent 52%),
    radial-gradient(circle at 45% 80%, rgba(198, 255, 232, 0.4), transparent 55%);
  filter: blur(26px);
  z-index: -1; opacity: calc(0.48 + var(--bass) * 0.4);
  transform: translateZ(0) scale(calc(1.12 + var(--bass) * 0.26));
  will-change: transform, opacity; backface-visibility: hidden;
}
.orb { display: none; }
@keyframes blobIdle {
  0%, 100% { border-radius: 42% 58% 54% 46% / 45% 42% 58% 55%; }
  33% { border-radius: 58% 42% 48% 52% / 52% 62% 38% 48%; }
  66% { border-radius: 48% 52% 62% 38% / 44% 48% 52% 56%; }
}
.status {
  position: fixed; z-index: 10; top: calc(var(--sat) + 18px);
  left: 50%; transform: translateX(-50%);
  padding: 9px 16px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.55); border: 1px solid rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  color: rgba(17, 24, 39, 0.62); font-size: 12px; font-weight: 800; white-space: nowrap;
  transform: translate(-50%, 0) translateZ(0);
}

/* =========================  LYRICS SCENE  ========================= */
.lyrics-scene {
  display: flex; justify-content: center;
  padding: calc(var(--sat) + 8px) 10px calc(var(--sab) + 8px);
  background: #f4eee2;
  overflow: hidden;
}
.player {
  position: relative; z-index: 2; width: 100%; max-width: 520px; height: 100%;
  display: flex; flex-direction: column; padding: 16px; border-radius: 34px;
  background: rgba(255, 255, 255, 0.10); border: 1px solid rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px) saturate(150%); -webkit-backdrop-filter: blur(16px) saturate(150%);
  box-shadow: 0 28px 80px rgba(31, 41, 55, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  overflow: hidden; transform: translateZ(0);
}
.grabber { width: 46px; height: 5px; border-radius: 99px; background: rgba(17, 24, 39, 0.16); margin: 0 auto 18px; flex: 0 0 auto; cursor: pointer; }
.song-header {
  display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 24px;
  background: rgba(255, 255, 255, 0.45); border: 1px solid rgba(255, 255, 255, 0.65); flex-shrink: 0;
}
.album-wrap {
  position: relative; width: 82px; height: 82px; flex: 0 0 auto; border-radius: 22px; overflow: hidden;
  box-shadow: 0 14px 28px rgba(17, 24, 39, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  background: rgba(17, 24, 39, 0.06);
}
.album-wrap::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.42), transparent 42%); pointer-events: none;
}
.album-art { width: 100%; height: 100%; object-fit: cover; animation: albumBreath 5s ease-in-out infinite; will-change: transform; backface-visibility: hidden; transform: translateZ(0); }
@keyframes albumBreath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
.song-meta { min-width: 0; }
.now-playing { font-size: 11px; font-weight: 800; color: #7b8190; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 7px; }
.song-title { font-size: 22px; line-height: 1; font-weight: 850; letter-spacing: -0.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.artist { margin-top: 7px; font-size: 14px; color: #7b8190; }
.lyrics-card {
  position: relative; flex: 1; margin-top: 16px; padding: 22px 12px; border-radius: 30px; overflow: hidden;
  background: rgba(255, 255, 255, 0.10); border: 1px solid rgba(255, 255, 255, 0.65);
}
.lyrics-card::before, .lyrics-card::after { content: ""; position: absolute; left: 0; right: 0; height: 100px; z-index: 3; pointer-events: none; }
.lyrics-card::before { top: 0; background: linear-gradient(to bottom, rgba(244,238,226,0.96), transparent); }
.lyrics-card::after { bottom: 0; background: linear-gradient(to top, rgba(244,238,226,0.96), transparent); }
.lyrics-window { position: relative; height: 100%; overflow: hidden; }
.lyrics-list { position: absolute; left: 0; top: 0; width: 100%; transition: transform 0.7s cubic-bezier(.2,.85,.2,1); will-change: transform; }
.lyric-line {
  position: relative; width: 100%; margin: 18px auto; padding: 0 20px; text-align: center;
  font-size: 24px; line-height: 0.99; font-weight: 400; letter-spacing: -0.045em;
  color: rgba(17, 24, 39, 0.24); opacity: 0.35; transform: scale(0.88); filter: blur(0.8px);
  transition: color 0.5s ease, opacity 0.5s ease, transform 0.5s cubic-bezier(.2,.85,.2,1), filter 0.5s ease;
}
.lyric-line.prev, .lyric-line.next { opacity: 0.56; filter: blur(0.25px); transform: scale(0.94); color: rgba(17, 24, 39, 0.42); }
.lyric-line.active { opacity: 1; filter: blur(0); transform: scale(1.06); color: rgba(17, 24, 39, 0.95); font-weight: 700; }
/* plain (unsynced) lyrics: readable, no karaoke highlight, hand-scrollable */
.lyrics-list.plain { top: 8px; }
.lyrics-list.plain .lyric-line { opacity: 0.82; color: rgba(17, 24, 39, 0.72); transform: none; filter: none; font-size: 20px; margin: 13px auto; }
.lyrics-empty { position: absolute; inset: 0; display: grid; place-items: center; color: rgba(17,24,39,0.3); font-size: 34px; }
/* subtle loader shown while synced lyrics are being fetched */
.lyrics-loader {
  position: absolute; inset: 0; z-index: 4; display: none;
  flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  pointer-events: none;
}
body.lyrics-loading .lyrics-loader { display: flex; }
body.lyrics-loading .lyrics-list { opacity: 0.25; }
body.lyrics-loading .lyrics-empty { display: none; }
.lyrics-loader .spinner {
  width: 30px; height: 30px; border-radius: 999px;
  border: 2.5px solid rgba(17,24,39,0.12);
  border-top-color: rgba(17,24,39,0.55);
  animation: zvSpin 0.8s linear infinite;
}
@keyframes zvSpin { to { transform: rotate(360deg); } }
.backbtn {
  position: fixed; z-index: 60; top: calc(var(--sat) + 12px); right: 14px;
  width: 38px; height: 38px; border-radius: 999px; display: grid; place-items: center;
  background: rgba(255,255,255,0.62); border: 1px solid rgba(255,255,255,0.82);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  color: rgba(17,24,39,0.72); cursor: pointer; padding: 0;
  box-shadow: 0 8px 20px rgba(31,41,55,0.12); transform: translateZ(0);
}
.backbtn svg { width: 20px; height: 20px; display: block; }
.retry-wrap {
  position: fixed; z-index: 30; left: 0; right: 0; bottom: calc(var(--sab) + 26px);
  display: none; justify-content: center; pointer-events: none;
}
body.show-retry.mode-detect .retry-wrap { display: flex; }
.retry-btn {
  pointer-events: auto; display: inline-flex; align-items: center; gap: 9px;
  padding: 14px 26px; border-radius: 999px; border: none; cursor: pointer;
  background: #2f5a48; color: #fff; font-family: inherit; font-size: 15px; font-weight: 700;
  letter-spacing: 0.01em; box-shadow: 0 12px 28px rgba(47,90,72,0.32);
}
.retry-btn svg { width: 18px; height: 18px; display: block; }
.retry-btn:active { transform: scale(0.96); }
</style>
</head>
<body class="mode-detect">

  <button class="backbtn" id="backBtn" aria-label="Back">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
  </button>

  <div class="detect-scene" id="detectScene">
    <div class="status" id="status">Tap to detect music</div>
    <main class="glass-card"><div class="blob" id="blob"></div></main>
    <div class="retry-wrap">
      <button class="retry-btn" id="retryBtn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Retry
      </button>
    </div>
  </div>

  <div class="lyrics-scene" id="lyricsScene">
    <main class="player" id="player">
      <div class="grabber" id="grabber"></div>
      <section class="song-header">
        <div class="album-wrap"><img id="albumArt" class="album-art" alt="" /></div>
        <div class="song-meta">
          <div class="now-playing">Now Playing</div>
          <div class="song-title" id="songTitle">Zenova</div>
          <div class="artist" id="artistName">Song Detection</div>
        </div>
      </section>
      <section class="lyrics-card">
        <div class="lyrics-window">
          <div class="lyrics-empty" id="lyricsEmpty"></div>
          <div class="lyrics-loader" id="lyricsLoader">
            <div class="spinner"></div>
          </div>
          <div class="lyrics-list" id="lyricsList"></div>
        </div>
      </section>
    </main>
  </div>

<script>
(function(){
  var body = document.body;
  var root = document.documentElement;
  var statusEl = document.getElementById('status');
  var albumArt = document.getElementById('albumArt');
  var songTitle = document.getElementById('songTitle');
  var artistName = document.getElementById('artistName');
  var lyricsList = document.getElementById('lyricsList');
  var lyricsEmpty = document.getElementById('lyricsEmpty');
  var lyricsWindow = lyricsList.parentElement;

  var mode = 'detect';
  var energy = 0.5, speed = 0.85;
  var lyricEls = [], lyrics = [], synced = false, activeIndex = -1;
  var baseMs = 0, anchorPerf = 0, playing = false;
  var LOOKAHEAD = 180;

  // ---- human scroll state ----
  var autoCenterY = 0;       // last computed auto-center target for the active line
  var manualY = 0;           // translateY currently applied to the list
  var userScrolling = false; // true while the user is dragging or within the idle window
  var dragging = false;
  var dragStartTouchY = 0, dragStartManualY = 0;
  var scrollIdleTimer = null;
  var SCROLL_IDLE_MS = 2600;  // re-center on the active verse after this much inactivity

  function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
  function post(o){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(o)); }

  function detectFrame(ts){
    var s = ts / 1000 * speed;
    var bass = (0.5 + 0.5 * Math.sin(s * 2.1)) * energy;
    var mid = (0.5 + 0.5 * Math.sin(s * 3.3 + 1.1)) * energy * 0.85;
    var treble = (0.5 + 0.5 * Math.sin(s * 5.7 + 2.3)) * energy * 0.7;
    var volume = clamp(bass * 0.55 + mid * 0.3 + treble * 0.15, 0, 1);
    root.style.setProperty('--volume', volume.toFixed(3));
    root.style.setProperty('--bass', bass.toFixed(3));
    root.style.setProperty('--mid', mid.toFixed(3));
    root.style.setProperty('--treble', treble.toFixed(3));
  }

  function nowMs(){ return playing ? baseMs + (performance.now() - anchorPerf) : baseMs; }
  function activeIndexAt(t){
    var idx = -1;
    for (var i = 0; i < lyrics.length; i++){ if (t >= lyrics[i].ms) idx = i; else break; }
    return idx;
  }
  function centerActive(){
    var el = lyricEls[activeIndex]; if (!el) return;
    var wh = lyricsWindow.offsetHeight;
    autoCenterY = wh * 0.5 - el.offsetTop - el.offsetHeight / 2;
    // While the user is hand-scrolling, don't fight their position — just remember
    // where the active verse wants to be and snap back once they stop.
    if (userScrolling) return;
    manualY = autoCenterY;
    lyricsList.style.transition = '';
    lyricsList.style.transform = 'translateY(' + autoCenterY + 'px)';
  }
  function scrollBounds(){
    var wh = lyricsWindow.offsetHeight;
    var lh = lyricsList.offsetHeight;
    // allow the whole list to be dragged through, with a little overscroll headroom
    return { min: Math.min(0, wh - lh - 24) - wh * 0.18, max: wh * 0.5 + wh * 0.18 };
  }
  function applyManual(){
    manualY = clamp(manualY, scrollBounds().min, scrollBounds().max);
    lyricsList.style.transform = 'translateY(' + manualY + 'px)';
  }
  function scheduleRecenter(){
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(function(){
      userScrolling = false;
      lyricsList.style.transition = '';
      if (synced) centerActive();
    }, SCROLL_IDLE_MS);
  }
  function beginUserScroll(){
    userScrolling = true;
    if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
    lyricsList.style.transition = 'none';
  }
  function updateLyrics(){
    if (!synced || lyrics.length === 0) return;
    var t = nowMs() + LOOKAHEAD;
    var idx = activeIndexAt(t);
    if (idx !== activeIndex){
      activeIndex = idx;
      for (var i = 0; i < lyricEls.length; i++){
        var el = lyricEls[i];
        el.className = 'lyric-line';
        if (i === idx) el.className = 'lyric-line active';
        else if (i === idx - 1) el.className = 'lyric-line prev';
        else if (i === idx + 1) el.className = 'lyric-line next';
      }
      centerActive();
    }
  }

  var lastDetect = 0;
  function loop(ts){
    if (mode === 'detect'){
      // throttle the synthetic blob to ~30fps; it's ambient, doesn't need 60fps style writes
      if (ts - lastDetect >= 33){ lastDetect = ts; detectFrame(ts); }
    } else {
      updateLyrics();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  window.addEventListener('resize', function(){ if (mode === 'lyrics') centerActive(); });

  // ---- human-scrollable lyrics with auto re-center on inactivity ----
  lyricsWindow.addEventListener('touchstart', function(e){
    if (mode !== 'lyrics' || lyrics.length === 0) return;
    dragging = true;
    beginUserScroll();
    dragStartTouchY = e.touches[0].clientY;
    dragStartManualY = manualY;
  }, { passive: true });
  lyricsWindow.addEventListener('touchmove', function(e){
    if (!dragging) return;
    manualY = dragStartManualY + (e.touches[0].clientY - dragStartTouchY);
    applyManual();
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  function endDrag(){
    if (!dragging) return;
    dragging = false;
    scheduleRecenter();
  }
  lyricsWindow.addEventListener('touchend', endDrag, { passive: true });
  lyricsWindow.addEventListener('touchcancel', endDrag, { passive: true });
  lyricsWindow.addEventListener('wheel', function(e){
    if (mode !== 'lyrics' || lyrics.length === 0) return;
    beginUserScroll();
    manualY -= e.deltaY;
    applyManual();
    scheduleRecenter();
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  document.getElementById('detectScene').addEventListener('click', function(){ post({ type: 'detect' }); });
  document.getElementById('grabber').addEventListener('click', function(e){ e.stopPropagation(); post({ type: 'close' }); });
  document.getElementById('backBtn').addEventListener('click', function(e){ e.stopPropagation(); post({ type: 'close' }); });
  document.getElementById('retryBtn').addEventListener('click', function(e){ e.stopPropagation(); post({ type: 'detect' }); });

  window.ZV = {
    setMode: function(m){
      mode = m;
      var lyr = (m === 'lyrics');
      body.classList.toggle('mode-lyrics', lyr);
      body.classList.toggle('mode-detect', !lyr);
      if (lyr) centerActive();
    },
    setStatus: function(txt){ statusEl.textContent = txt; },
    setRetry: function(show){ body.classList.toggle('show-retry', !!show); },
    setLoading: function(show){ body.classList.toggle('lyrics-loading', !!show); },
    setEnergy: function(e, sp){ energy = e; speed = sp || 1; },
    setSong: function(s){
      if (s.title != null) songTitle.textContent = s.title;
      if (s.artist != null) artistName.textContent = s.artist;
      if (s.art){ albumArt.style.visibility = 'visible'; albumArt.src = s.art; }
      else { albumArt.removeAttribute('src'); albumArt.style.visibility = 'hidden'; }
    },
    setLyrics: function(d){
      synced = !!d.synced;
      lyrics = d.lines || [];
      activeIndex = -1;
      lyricsList.innerHTML = '';
      lyricEls = [];
      lyricsEmpty.textContent = lyrics.length === 0 ? '\u266b' : '';
      for (var i = 0; i < lyrics.length; i++){
        var el = document.createElement('div');
        el.className = 'lyric-line';
        el.textContent = lyrics[i].text || '';
        lyricsList.appendChild(el);
        lyricEls.push(el);
      }
      lyricsList.className = 'lyrics-list' + (synced ? '' : ' plain');
      userScrolling = false;
      if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
      lyricsList.style.transition = '';
      if (!synced){ manualY = 0; lyricsList.style.transform = 'translateY(0px)'; }
      else centerActive();
    },
    sync: function(d){ baseMs = d.posMs || 0; anchorPerf = performance.now(); playing = !!d.playing; },
    setInsets: function(o){
      root.style.setProperty('--sat', (o.top || 0) + 'px');
      root.style.setProperty('--sab', (o.bottom || 0) + 'px');
      if (mode === 'lyrics') centerActive();
    }
  };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;

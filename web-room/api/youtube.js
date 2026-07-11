const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

function extractVideoId(input) {
  try {
    const url = new URL(input);
    if (url.hostname.includes('youtu.be')) return url.pathname.slice(1);
    if (url.searchParams.get('v')) return url.searchParams.get('v');
    const embed = url.pathname.match(/\/embed\/([^/?]+)/);
    if (embed) return embed[1];
  } catch {
    return null;
  }
  return null;
}

export default async function handler(request, response) {
  const q = String(request.query.q || '').trim();
  if (!q) {
    response.status(400).json({ error: 'Search query is required.' });
    return;
  }

  const pastedVideoId = extractVideoId(q);
  if (pastedVideoId) {
    response.status(200).json({
      items: [{
        videoId: pastedVideoId,
        title: 'YouTube video',
        thumbnail: `https://img.youtube.com/vi/${pastedVideoId}/hqdefault.jpg`,
      }],
    });
    return;
  }

  const key = process.env.YOUTUBE_API_KEY || process.env.VITE_PUBLIC_YOUTUBE_API_KEY;

  if (key) {
    const url = new URL(YOUTUBE_SEARCH_URL);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoEmbeddable', 'true');
    url.searchParams.set('videoCategoryId', '10');
    url.searchParams.set('maxResults', '10');
    url.searchParams.set('q', `${q} music`);
    url.searchParams.set('key', key);

    const yt = await fetch(url);
    const data = await yt.json();
    if (yt.ok) {
      response.status(200).json({
        items: (data.items || []).map((item) => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          thumbnail:
            item.snippet.thumbnails?.medium?.url ||
            item.snippet.thumbnails?.default?.url ||
            `https://img.youtube.com/vi/${item.id.videoId}/mqdefault.jpg`,
        })),
      });
      return;
    }
  }

  const items = await fallbackSearch(`${q} music`);
  if (items.length === 0) {
    response.status(502).json({ error: 'YouTube search failed.' });
    return;
  }

  response.status(200).json({ items });
}

function extractInitialData(html) {
  const marker = 'ytInitialData = ';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start + marker.length, i + 1);
    }
  }
  return null;
}

function textFromRuns(value) {
  return value?.runs?.map((run) => run.text).join('') || value?.simpleText || '';
}

function collectVideos(node, out = []) {
  if (!node || out.length >= 10) return out;
  if (Array.isArray(node)) {
    for (const child of node) collectVideos(child, out);
    return out;
  }
  if (typeof node !== 'object') return out;
  if (node.videoRenderer?.videoId) {
    const video = node.videoRenderer;
    out.push({
      videoId: video.videoId,
      title: textFromRuns(video.title) || 'YouTube video',
      thumbnail:
        video.thumbnail?.thumbnails?.at?.(-1)?.url ||
        `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`,
    });
    return out;
  }
  for (const value of Object.values(node)) collectVideos(value, out);
  return out;
}

async function fallbackSearch(query) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0 CicadaRoom/1.0',
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const raw = extractInitialData(html);
  if (!raw) return [];
  try {
    return collectVideos(JSON.parse(raw));
  } catch {
    return [];
  }
}

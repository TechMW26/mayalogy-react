const memoryStore = globalThis.__cicadaRooms || new Map();
globalThis.__cicadaRooms = memoryStore;

function cleanRoomId(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);
}

function getBody(request) {
  return typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body || {};
}

function dbBase() {
  return (process.env.FIREBASE_DB_URL || process.env.VITE_PUBLIC_FIREBASE_DB_URL || '').replace(/\/$/, '');
}

async function readRoom(roomId) {
  const base = dbBase();
  if (!base) return memoryStore.get(roomId) || null;
  const res = await fetch(`${base}/cicadaRooms/${roomId}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Room read failed');
  return res.json();
}

async function writeRoom(roomId, value) {
  const base = dbBase();
  if (!base) {
    memoryStore.set(roomId, value);
    return value;
  }
  const res = await fetch(`${base}/cicadaRooms/${roomId}.json`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
  if (!res.ok) throw new Error('Room write failed');
  return res.json();
}

export default async function handler(request, response) {
  response.setHeader('cache-control', 'no-store');

  try {
    if (request.method === 'GET') {
      const roomId = cleanRoomId(request.query.room || request.query.roomId);
      const room = roomId ? await readRoom(roomId) : null;
      response.status(200).json({
        serverAt: Date.now(),
        room,
      });
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    const body = getBody(request);
    const roomId = cleanRoomId(body.roomId);
    if (!roomId) {
      response.status(400).json({ error: 'Room ID is required.' });
      return;
    }

    const current = (await readRoom(roomId)) || { version: 0 };
    const action = body.action || current.action || 'idle';
    const closing = action === 'closed';
    const next = {
      ...current,
      roomName: body.roomName || current.roomName || '',
      action,
      videoId: closing ? '' : body.videoId || current.videoId || '',
      title: closing ? '' : body.title || current.title || '',
      thumb: closing ? '' : body.thumb || body.thumbnail || current.thumb || '',
      startAt: Number(body.startAt || current.startAt || Date.now()),
      positionSec: Number(body.positionSec || 0),
      updatedAt: Date.now(),
      version: Number(current.version || 0) + 1,
    };

    await writeRoom(roomId, next);
    response.status(200).json({ serverAt: Date.now(), room: next });
  } catch {
    response.status(500).json({ error: 'Room sync failed.' });
  }
}

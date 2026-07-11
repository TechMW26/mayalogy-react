import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 8787);
const rooms = new Map();

function peersFor(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  return rooms.get(roomId);
}

function send(peer, message) {
  if (peer.readyState === peer.OPEN) peer.send(JSON.stringify(message));
}

function broadcast(roomId, sender, message) {
  const peers = rooms.get(roomId);
  if (!peers) return;
  for (const peer of peers) {
    if (peer !== sender) send(peer, message);
  }
}

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  let roomId = null;

  socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (typeof msg.roomId !== 'string' || !msg.roomId) return;
    roomId = msg.roomId.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);

    if (msg.type === 'join') {
      peersFor(roomId).add(socket);
      send(socket, { type: 'joined', roomId, serverAt: Date.now() });
      broadcast(roomId, socket, { type: 'peer', role: msg.role || 'join', serverAt: Date.now() });
      return;
    }

    if (msg.type === 'ping') {
      send(socket, {
        type: 'pong',
        roomId,
        clientSentAt: msg.clientSentAt,
        serverAt: Date.now(),
      });
      return;
    }

    if (['load', 'play', 'pause', 'sync'].includes(msg.type)) {
      broadcast(roomId, socket, { ...msg, roomId, serverAt: Date.now() });
    }
  });

  socket.on('close', () => {
    if (!roomId) return;
    const peers = rooms.get(roomId);
    if (!peers) return;
    peers.delete(socket);
    if (peers.size === 0) rooms.delete(roomId);
  });
});

server.listen(port, () => {
  console.log(`Cicada room socket listening on :${port}`);
});

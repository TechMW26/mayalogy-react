export default function handler(_request, response) {
  response.status(200).json({
    ok: true,
    service: 'cicada-room-web',
    roomSync: 'Set FIREBASE_DB_URL for persistent room state.',
  });
}

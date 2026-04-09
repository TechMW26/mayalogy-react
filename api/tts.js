import { handleTextToSpeechRequest } from '../server/mayaApi.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const result = await handleTextToSpeechRequest(req.body || {}, process.env);

  Object.entries(result.headers || {}).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (result.isBinary) {
    res.status(result.status).send(result.body);
    return;
  }

  res.status(result.status).json(result.body);
}
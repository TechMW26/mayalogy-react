import { handleTextGenerationRequest } from '../server/pollinationsApi.js';
import { sendApiResult } from './_pollinationsResponse.js';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return sendApiResult(res, await handleTextGenerationRequest(req.body || {}, process.env));
}

export function sendApiResult(res, result) {
  Object.entries(result.headers || {}).forEach(([key, value]) => res.setHeader(key, value));
  if (result.isBinary) return res.status(result.status).send(result.body);
  return res.status(result.status).json(result.body);
}

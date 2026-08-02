export const json = (statusCode, body, headers = {}) => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  body: JSON.stringify(body)
});
export const parseBody = (event) => {
  try { return JSON.parse(event.body || '{}'); } catch { return {}; }
};

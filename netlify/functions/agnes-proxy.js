/**
 * Agnes AI server-side proxy.
 *
 * Browser -> same-origin Netlify Function -> Agnes API
 * This removes browser CORS as a failure mode and keeps the upstream API
 * request server-side. The user's Agnes key is still supplied by the browser
 * for now; it is never persisted by this function.
 */
const ALLOWED_BASE_HOSTS = new Set([
  'apihub.agnes-ai.com',
  'apihub.agnes-ai.cn',
  'api.agnes-ai.cn'
]);

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function getBaseUrl(raw) {
  const fallback = String(process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1').trim();
  const candidate = String(raw || fallback).trim().replace(/\/+$/, '');
  let url;
  try {
    url = new URL(candidate);
  } catch (_) {
    throw new Error('Invalid Agnes Base URL');
  }
  if (url.protocol !== 'https:' || !ALLOWED_BASE_HOSTS.has(url.hostname)) {
    throw new Error('Agnes Base URL is not allowlisted');
  }
  if (!url.pathname.endsWith('/v1')) {
    url.pathname = url.pathname.replace(/\/+$/, '') + '/v1';
  }
  return url.toString().replace(/\/+$/, '');
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Cache-Control': 'no-store'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: { code: 'method_not_allowed', message: 'POST only' } });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } });
  }

  const apiKey = String(payload.apiKey || '').trim();
  const requestBody = payload.request;
  if (!apiKey) return json(400, { error: { code: 'missing_api_key', message: 'Agnes API key is required.' } });
  if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
    return json(400, { error: { code: 'invalid_request', message: 'Missing Agnes request payload.' } });
  }
  if (typeof requestBody.model !== 'string' || !requestBody.model.trim()) {
    return json(400, { error: { code: 'invalid_request', message: 'Missing model.' } });
  }
  if (!Array.isArray(requestBody.messages)) {
    return json(400, { error: { code: 'invalid_request', message: 'Missing messages.' } });
  }

  let baseUrl;
  try {
    baseUrl = getBaseUrl(payload.baseUrl);
  } catch (err) {
    return json(400, { error: { code: 'invalid_base_url', message: err.message } });
  }

  // Never log the key or the full prompt. The upstream response is passed
  // through so the existing OpenAI-compatible parser keeps working.
  try {
    const controller = new AbortController();
    // Agnes 5,000-token segments can legitimately take >25s. Netlify synchronous
    // Functions currently allow up to 60s, so keep a safety margin and abort upstream
    // at 55s rather than failing a healthy generation at 25s.
    const timer = setTimeout(() => controller.abort(), 55000);
    let upstream;
    try {
      upstream = await fetch(baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await upstream.text();
    const headers = {
      'Cache-Control': 'no-store, max-age=0',
      'X-Agnes-Proxy': 'netlify'
    };
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) headers['Retry-After'] = retryAfter;

    return {
      statusCode: upstream.status,
      headers: { ...headers, 'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8' },
      body: text
    };
  } catch (err) {
    const isAbort = err && err.name === 'AbortError';
    return json(isAbort ? 504 : 502, {
      error: {
        code: isAbort ? 'upstream_timeout' : 'upstream_network_error',
        message: isAbort
          ? 'Agnes API did not respond within the 55-second proxy timeout.'
          : 'Netlify could not reach the selected Agnes API endpoint.',
        baseUrl
      }
    });
  }
};

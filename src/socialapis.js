const { incrementUsage, remaining } = require('./db');

const MAX_PROVIDER_LIMIT = 9;

function requestedLimit() {
  const configured = Number.parseInt(process.env.SOCIALAPIS_LIMIT || `${MAX_PROVIDER_LIMIT}`, 10);
  if (!Number.isFinite(configured) || configured < 1) return MAX_PROVIDER_LIMIT;
  return Math.min(configured, MAX_PROVIDER_LIMIT);
}

function extractPosts(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.posts)) return payload.posts;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.posts)) return payload.data.posts;
  return [];
}

async function fetchGroupPosts(groupUrl) {
  if (remaining() <= 0) {
    const error = new Error('Monthly SocialAPIs budget exhausted');
    error.code = 'BUDGET_EXHAUSTED';
    throw error;
  }

  const token = process.env.SOCIALAPIS_TOKEN;
  if (!token) throw new Error('SOCIALAPIS_TOKEN is not configured');

  const url = new URL('https://api.socialapis.io/facebook/groups/posts');
  url.searchParams.set('link', groupUrl);
  url.searchParams.set('limit', String(requestedLimit()));

  incrementUsage();
  const response = await fetch(url, { headers: { 'x-api-token': token } });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok || payload?.success === false) {
    const detail = payload?.detail ? ` ${JSON.stringify(payload.detail)}` : '';
    throw new Error(`SocialAPIs ${response.status}: ${payload?.message || text || 'request failed'}${detail}`);
  }

  return extractPosts(payload);
}

module.exports = { fetchGroupPosts, extractPosts, requestedLimit, MAX_PROVIDER_LIMIT };

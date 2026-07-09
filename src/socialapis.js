const { incrementUsage, remaining } = require('./db');
async function fetchGroupPosts(groupUrl){
  if (remaining() <= 0) { const e = new Error('Monthly SocialAPIs budget exhausted'); e.code='BUDGET_EXHAUSTED'; throw e; }
  const token = process.env.SOCIALAPIS_TOKEN;
  if (!token) throw new Error('SOCIALAPIS_TOKEN is not configured');
  const url = `https://api.socialapis.io/facebook/groups/posts?link=${encodeURIComponent(groupUrl)}&limit=20`;
  incrementUsage();
  const res = await fetch(url, { headers: { 'x-api-token': token } });
  if (!res.ok) throw new Error(`SocialAPIs ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return Array.isArray(json) ? json : (json.data || json.posts || []);
}
module.exports={fetchGroupPosts};

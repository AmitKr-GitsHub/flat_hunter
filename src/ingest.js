const path = require('path');
const fs = require('fs');
const { db, getSettings } = require('./db');
const { processPost } = require('./processor');
const { fetchGroupPosts } = require('./socialapis');

function safePostId(postId) {
  return String(postId).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function normalizePost(post) {
  const details = post.details || {};
  const values = post.values || {};
  const author = post.author || post.from || values.author || {};
  const text = post.message || post.story || post.description || values.text || '';
  return {
    id: String(post.id || post.post_id || details.post_id || post.url || details.post_link || ''),
    sourceUrl: post.permalink_url || post.url || details.post_link || '',
    authorName: author.name || post.author_name || values.author_name || '',
    createdTime: post.created_time || post.timestamp || values.created_time || values.timestamp || '',
    raw: { ...post, message: text },
  };
}

async function downloadImages(postId, urls) {
  const base = path.resolve(process.env.IMAGE_CACHE_DIR || './data/images', safePostId(postId));
  fs.mkdirSync(base, { recursive: true });
  let position = 0;

  for (const sourceUrl of urls) {
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) continue;
      const localPath = path.join(base, `${position}.jpg`);
      fs.writeFileSync(localPath, Buffer.from(await response.arrayBuffer()));
      db.prepare('INSERT OR IGNORE INTO post_images(post_id,source_url,local_path,position) VALUES(?,?,?,?)')
        .run(postId, sourceUrl, localPath, position);
      position += 1;
    } catch {
      // Image caching is best-effort; failed images should not block post ingestion.
    }
  }
}

async function telegram(post, settings) {
  if (settings.telegram_enabled !== 'true' || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  const text = `🏠 New flat match\n${post.rent_text || ''} ${post.matched_area || ''}\n${post.source_post_url || ''}\n\n${(post.message || '').slice(0, 600)}`;
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
  }).catch(() => {});
}

function imageUrls(post) {
  return [
    post.full_picture,
    post.picture,
    ...(post.images || []),
    ...(post.attachments?.data || []).map((attachment) => attachment.media?.image?.src),
    ...(post.values?.attachments || []).map((attachment) => attachment.media?.image?.src || attachment.url),
  ].filter(Boolean);
}

async function ingest() {
  const settings = getSettings();
  const group = settings.group_url || process.env.FACEBOOK_GROUP_URL;
  if (!group) throw new Error('No Facebook group URL configured');

  const posts = await fetchGroupPosts(group);
  let inserted = 0;
  let matched = 0;

  for (const post of posts) {
    const normalized = normalizePost(post);
    if (!normalized.id) continue;

    const processed = processPost(normalized.raw, settings);
    const existed = db.prepare('SELECT id FROM posts WHERE id=?').get(normalized.id);
    db.prepare(`INSERT INTO posts(id,source_group_url,source_post_url,author_name,message,created_time,fetched_at,post_type,is_hall_sharing,rent_amount,rent_text,brokerage_label,matched_area,is_match,excluded_reason,raw_json)
      VALUES(@id,@source_group_url,@source_post_url,@author_name,@message,@created_time,@fetched_at,@post_type,@is_hall_sharing,@rent_amount,@rent_text,@brokerage_label,@matched_area,@is_match,@excluded_reason,@raw_json)
      ON CONFLICT(id) DO UPDATE SET message=excluded.message,post_type=excluded.post_type,is_hall_sharing=excluded.is_hall_sharing,rent_amount=excluded.rent_amount,rent_text=excluded.rent_text,brokerage_label=excluded.brokerage_label,matched_area=excluded.matched_area,is_match=excluded.is_match,excluded_reason=excluded.excluded_reason,raw_json=excluded.raw_json`).run({
        id: normalized.id,
        source_group_url: group,
        source_post_url: normalized.sourceUrl,
        author_name: normalized.authorName,
        created_time: normalized.createdTime,
        fetched_at: new Date().toISOString(),
        raw_json: JSON.stringify(post),
        ...processed,
      });

    if (!existed) {
      inserted += 1;
      await downloadImages(normalized.id, imageUrls(post));
      if (processed.is_match) {
        matched += 1;
        await telegram({ id: normalized.id, source_post_url: normalized.sourceUrl, ...processed }, settings);
      }
    }
  }

  return { inserted, matched, seen: posts.length };
}

function recompute() {
  const settings = getSettings();
  const rows = db.prepare('SELECT id,raw_json FROM posts').all();
  const update = db.prepare('UPDATE posts SET message=@message,post_type=@post_type,is_hall_sharing=@is_hall_sharing,rent_amount=@rent_amount,rent_text=@rent_text,brokerage_label=@brokerage_label,matched_area=@matched_area,is_match=@is_match,excluded_reason=@excluded_reason WHERE id=@id');
  rows.forEach((row) => {
    const normalized = normalizePost(JSON.parse(row.raw_json));
    update.run({ id: row.id, ...processPost(normalized.raw, settings) });
  });
  return rows.length;
}

module.exports = { ingest, recompute, normalizePost, safePostId };
const path=require('path'), fs=require('fs');
const { db, getSettings }=require('./db');
const { processPost }=require('./processor');
const { fetchGroupPosts }=require('./socialapis');
async function downloadImages(postId, urls){ const base=path.resolve(process.env.IMAGE_CACHE_DIR||'./data/images', postId); fs.mkdirSync(base,{recursive:true}); let i=0; for(const u of urls){try{const res=await fetch(u); if(!res.ok)continue; const p=path.join(base,`${i}.jpg`); fs.writeFileSync(p, Buffer.from(await res.arrayBuffer())); db.prepare('INSERT OR IGNORE INTO post_images(post_id,source_url,local_path,position) VALUES(?,?,?,?)').run(postId,u,p,i); i++;}catch{}}}
async function telegram(post, settings){ if(settings.telegram_enabled!=='true'||!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_CHAT_ID)return; const msg=`🏠 New flat match\n${post.rent_text||''} ${post.matched_area||''}\n${post.source_post_url||''}\n\n${(post.message||'').slice(0,600)}`; await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:msg})}).catch(()=>{});}
function imageUrls(p){return [p.full_picture,p.picture,...(p.images||[]),...(p.attachments?.data||[]).map(a=>a.media?.image?.src)].filter(Boolean)}
async function ingest(){ const s=getSettings(); const group=s.group_url||process.env.FACEBOOK_GROUP_URL; if(!group) throw new Error('No Facebook group URL configured'); const posts=await fetchGroupPosts(group); let inserted=0, matched=0; for(const p of posts){ const id=String(p.id||p.post_id||p.url||p.permalink_url); if(!id)continue; const proc=processPost(p,s); const existed=db.prepare('SELECT id FROM posts WHERE id=?').get(id); db.prepare(`INSERT INTO posts(id,source_group_url,source_post_url,author_name,message,created_time,fetched_at,post_type,is_hall_sharing,rent_amount,rent_text,brokerage_label,matched_area,is_match,excluded_reason,raw_json) VALUES(@id,@source_group_url,@source_post_url,@author_name,@message,@created_time,@fetched_at,@post_type,@is_hall_sharing,@rent_amount,@rent_text,@brokerage_label,@matched_area,@is_match,@excluded_reason,@raw_json) ON CONFLICT(id) DO UPDATE SET message=excluded.message,post_type=excluded.post_type,is_hall_sharing=excluded.is_hall_sharing,rent_amount=excluded.rent_amount,rent_text=excluded.rent_text,brokerage_label=excluded.brokerage_label,matched_area=excluded.matched_area,is_match=excluded.is_match,excluded_reason=excluded.excluded_reason,raw_json=excluded.raw_json`).run({id,source_group_url:group,source_post_url:p.permalink_url||p.url||'',author_name:p.from?.name||p.author||'',created_time:p.created_time||p.timestamp||'',fetched_at:new Date().toISOString(),raw_json:JSON.stringify(p),...proc}); if(!existed){inserted++; await downloadImages(id.replace(/[^a-zA-Z0-9_-]/g,'_'), imageUrls(p)); if(proc.is_match){matched++; await telegram({id,source_post_url:p.permalink_url||p.url||'',...proc}, s);}} } return {inserted, matched, seen:posts.length};}
function recompute(){const s=getSettings(); const rows=db.prepare('SELECT id,raw_json FROM posts').all(); const upd=db.prepare('UPDATE posts SET message=@message,post_type=@post_type,is_hall_sharing=@is_hall_sharing,rent_amount=@rent_amount,rent_text=@rent_text,brokerage_label=@brokerage_label,matched_area=@matched_area,is_match=@is_match,excluded_reason=@excluded_reason WHERE id=@id'); rows.forEach(r=>upd.run({id:r.id,...processPost(JSON.parse(r.raw_json),s)})); return rows.length;}
module.exports={ingest,recompute};

# Flat Hunter

Flat Hunter is a Node.js 18+ Express app that polls a Facebook group through SocialAPIs, stores posts in a local SQLite database, filters rental posts, caches images locally, and optionally sends Telegram alerts for newly ingested matching posts.

## Local setup

```bash
cp .env.example .env
npm install
npm run build
npm start
```

Open `http://localhost:3000` and log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`.

## Environment variables

See `.env.example` for all supported variables:

- `SOCIALAPIS_TOKEN` is sent as the `x-api-token` header.
- `FACEBOOK_GROUP_URL` is used as the default group URL.
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` enable Telegram alerts.
- `DATABASE_PATH` and `IMAGE_CACHE_DIR` control local storage.

## API budget math

SocialAPIs is capped at 200 calls per calendar month. Flat Hunter records each attempted SocialAPIs request in `api_usage` before calling:

```text
GET https://api.socialapis.io/facebook/groups/posts?link=<group_url>&limit=<SOCIALAPIS_LIMIT>
```

The implementation caps `SOCIALAPIS_LIMIT` at 9 because the live provider currently rejects higher values for this endpoint; the original requested `limit=20` now returns an input validation error. The safe interval is `ceil(31 days * 24 hours * 60 minutes / 200) = 224 minutes`, rounded up and enforced as at least 220 minutes. The UI shows calls used, remaining calls, and the safe interval. When calls reach 200, ingestion circuit-breaks. Manual fetches also enter a cooldown equal to the safe interval to prevent accidentally spending the monthly budget.

## Filtering and classification

The settings page controls comma-separated keywords, exclude keywords, target areas, and optional maximum rent. Saving settings recomputes all existing local posts without calling SocialAPIs. The processor performs:

- include/exclude keyword matching
- post type classification (`flat`, `room`, `pg`, or `unknown`)
- hall-sharing detection
- Indian rent extraction such as `₹25000`, `25k`, or `1.2 lakh`
- brokerage labels (`no_brokerage`, `brokerage`, `unknown`)
- area matching from configured areas

## Dashboard and local browsing

The dashboard reads from SQLite only. Search, match-only filtering, and sorting operate on the local DB and do not consume API calls. Post detail pages display cached local images.

## Image cache

Images are downloaded to:

```text
data/images/{post_id}/{n}.jpg
```

They are served locally under `/images/...`, so browsing cached posts does not call remote image hosts.

## VPS / PM2 deployment

```bash
sudo apt update
sudo apt install -y nodejs npm
cd /opt/flat_hunter
npm ci --omit=dev
cp .env.example .env
npm run build
npm install -g pm2
pm2 start src/server.js --name flat-hunter
pm2 save
pm2 startup
```

## Optional Nginx / HTTPS

```nginx
server {
  server_name flats.example.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Use Certbot or your provider's TLS tooling to add HTTPS.

## Limitations

- SocialAPIs response shapes can vary; the ingestion code accepts common `data`/`posts` arrays and common post fields.
- Filtering is heuristic, not a legal/financial guarantee.
- Scheduler intervals are safe for the 200-call budget but are not a replacement for monitoring your SocialAPIs account usage.

## Checking configuration safely

Run the configuration check before starting ingestion:

```bash
npm run check:config
```

The command verifies that `SOCIALAPIS_TOKEN` is present and shaped like the expected token, and that `FACEBOOK_GROUP_URL` looks like a Facebook group URL. It intentionally does **not** call SocialAPIs, so it does not consume the 200-call monthly budget. If a token has been shared in chat, logs, or a ticket, rotate it in the SocialAPIs dashboard and update `.env`.

require('dotenv').config();

const token = process.env.SOCIALAPIS_TOKEN || '';
const groupUrl = process.env.FACEBOOK_GROUP_URL || '';
const required = ['SESSION_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
let ok = true;

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`WARN ${key} is not set; the application will use development defaults where available.`);
  }
}

if (!token) {
  console.error('FAIL SOCIALAPIS_TOKEN is not set.');
  ok = false;
} else if (!/^[a-f0-9]{64}$/i.test(token)) {
  console.error('FAIL SOCIALAPIS_TOKEN is present but does not look like a 64-character hex token.');
  ok = false;
} else {
  console.log(`OK SOCIALAPIS_TOKEN is present (${token.slice(0, 6)}…${token.slice(-4)}) and has the expected format.`);
}

if (!groupUrl) {
  console.warn('WARN FACEBOOK_GROUP_URL is not set; ingestion needs a group URL from settings or environment.');
} else if (!/^https?:\/\/(www\.)?facebook\.com\/groups\//i.test(groupUrl)) {
  console.warn('WARN FACEBOOK_GROUP_URL is set but does not look like a facebook.com/groups URL.');
} else {
  console.log('OK FACEBOOK_GROUP_URL is configured.');
}

console.log('No SocialAPIs request was made; this check does not consume the 200-call monthly budget.');
process.exit(ok ? 0 : 1);

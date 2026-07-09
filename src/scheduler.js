const cron=require('node-cron'); const { getSettings, safeIntervalMinutes }=require('./db'); const { ingest }=require('./ingest');
let busy=false; async function tick(){const s=getSettings(); if(s.polling_enabled!=='true'||busy)return; busy=true; try{await ingest();}catch(e){console.error('poll failed:',e.message)} finally{busy=false}}
function startScheduler(){ const min=safeIntervalMinutes(); console.log(`Scheduler enabled with safe interval ${min} minutes`); setInterval(tick, min*60*1000).unref(); cron.schedule('7 9 * * *', tick); }
module.exports={startScheduler,tick};

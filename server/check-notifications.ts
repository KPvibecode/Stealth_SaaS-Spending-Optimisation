import { checkAndSendNotifications } from './routes/notifications.js';

async function run() {
  console.log(`[${new Date().toISOString()}] Running notification check...`);
  const results = await checkAndSendNotifications();
  console.log(`[${new Date().toISOString()}] Notification check complete:`, results);
  process.exit(0);
}

run().catch(err => {
  console.error('Notification check failed:', err);
  process.exit(1);
});

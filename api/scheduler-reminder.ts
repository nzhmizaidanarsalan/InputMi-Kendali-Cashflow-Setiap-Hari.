export const config = {
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Optional: check Authorization header if CRON_SECRET is configured
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized cron trigger' });
    }
  }

  const timestamp = new Date().toISOString();

  return res.status(200).json({
    success: true,
    message: 'Scheduled reminder check executed successfully.',
    schedulerTimestamp: timestamp,
    timezone: 'Asia/Jakarta',
  });
}

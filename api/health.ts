export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasApiKey = Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY
  );

  return res.status(200).json({
    status: 'ok',
    environment: process.env.VERCEL ? 'vercel' : 'node',
    hasApiKey,
    time: new Date().toISOString(),
  });
}

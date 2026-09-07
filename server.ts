import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import healthHandler from './api/health';
import scanReceiptHandler from './api/scan-receipt';
import pushVapidKeyHandler from './api/push-vapid-key';
import pushSubscribeHandler from './api/push-subscribe';
import checkRemindersHandler from './api/check-reminders';
import schedulerReminderHandler from './api/scheduler-reminder';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for receipt images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Health check API
  app.all('/api/health', (req, res) => healthHandler(req, res));

  // Receipt Scanner AI OCR API
  app.all('/api/scan-receipt', (req, res) => scanReceiptHandler(req, res));

  // Web Push & Reminder API
  app.all('/api/push-vapid-key', (req, res) => pushVapidKeyHandler(req, res));
  app.all('/api/push-subscribe', (req, res) => pushSubscribeHandler(req, res));
  app.all('/api/check-reminders', (req, res) => checkRemindersHandler(req, res));
  app.all('/api/scheduler-reminder', (req, res) => schedulerReminderHandler(req, res));

  // Serve public static assets (favicons, manifests, logos, open graph images) directly
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InputMi server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

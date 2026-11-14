import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { api } from './routes';

export function createApp() {
  const app = express();
  const allowedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('CORS origin not allowed'));
      },
      credentials: true,
    }),
  );
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'rate_limited',
        message: 'Too many requests. Please try again later.',
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', api);

  // Serve the built dashboard when present (single-process demo mode).
  const dist = path.resolve(process.cwd(), '../frontend/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'internal', message: 'Something went wrong on the server' });
  });
  return app;
}

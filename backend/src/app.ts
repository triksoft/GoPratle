import cors, { type CorsOptions } from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { requirementRouter, type RequirementRepository } from './routes/requirements.js';

export function createApp(options: { allowedOrigins?: string[]; repository?: RequirementRepository } = {}) {
  const configuredOrigins = (process.env.CLIENT_ORIGINS ?? 'http://localhost:3000').split(',').map(origin => origin.trim()).filter(Boolean);
  // The production Vercel origin is intentionally exact, never a wildcard.
  const productionFrontendOrigin = 'https://go-pratle-lovat.vercel.app';
  const allowedOrigins = options.allowedOrigins ?? [...new Set([...configuredOrigins, productionFrontendOrigin])];
  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS.'));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Idempotency-Key'],
    maxAge: 86400
  };
  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok', database: databaseStatus(mongoose.connection.readyState) }));
  app.use('/api/requirements', requirementRouter(options.repository));
  app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(error.message === 'Origin is not allowed by CORS.' ? 403 : 500).json({ message: error.message === 'Origin is not allowed by CORS.' ? error.message : 'An unexpected server error occurred.' });
  });
  return app;
}

function databaseStatus(state: number) {
  return ({ 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' } as Record<number, string>)[state] ?? 'unknown';
}

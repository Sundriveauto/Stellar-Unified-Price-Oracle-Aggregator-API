import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { priceRouter } from './routes/prices';
import { logger } from './utils/logger';
import { subscriptionManager, handleWsMessage } from './utils/subscriptions';
import { apiKeyAuth } from './middleware/auth';
import { metricsMiddleware, metricsHandler } from './middleware/metrics';
import { runMigrations } from '../../shared/src/db';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '16kb' }));
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});
app.use(metricsMiddleware);

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});
app.use('/api', limiter);

// ── Routes ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Metrics endpoint — no auth, no rate limit (scraper access)
app.get('/metrics', metricsHandler);

app.use('/api/prices', apiKeyAuth, priceRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
});

// ── WebSocket ──────────────────────────────────────────────────────────────
subscriptionManager.start(parseInt(process.env.WS_BROADCAST_INTERVAL || '5000', 10));

wss.on('connection', ws => {
  logger.info('WebSocket client connected');
  subscriptionManager.add(ws);
  ws.on('message', (data: Buffer) => handleWsMessage(ws, data.toString()));
  ws.on('close', () => { subscriptionManager.remove(ws); logger.info('WebSocket client disconnected'); });
  ws.on('error', err => logger.error('WebSocket error', err));
});

// ── Start ──────────────────────────────────────────────────────────────────
async function start() {
  await runMigrations();
  logger.info('Database migrations complete');
  server.listen(PORT, () => logger.info(`API server running on port ${PORT}`));
}

start().catch(err => {
  logger.error('Failed to start API', err);
  process.exit(1);
});

export { app, server };

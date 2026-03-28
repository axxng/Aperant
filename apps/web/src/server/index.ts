import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { closeDb } from './db/schema.js';
import { productRoutes } from './routes/products.js';
import { taskRoutes } from './routes/tasks.js';
import { githubRoutes } from './routes/github.js';
import { eventRoutes } from './routes/events.js';
import { aiRoutes } from './routes/ai.js';
import { investigationRoutes } from './routes/investigation.js';
import { prReviewRoutes } from './routes/pr-review.js';
import { startSyncScheduler, stopSyncScheduler, triggerSync } from './sync/scheduler.js';
import { broadcastEvent } from './routes/events.js';

config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json({ limit: '1mb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// API routes
app.use('/api/products', productRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/investigate', investigationRoutes);
app.use('/api/pr-review', prReviewRoutes);

// Manual sync trigger for a product
app.post('/api/products/:id/sync', async (req, res) => {
  try {
    const result = await triggerSync(req.params.id);
    // Broadcast sync complete event to all SSE clients
    broadcastEvent('sync_complete', { productId: req.params.id, result });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Aperant API server running on port ${PORT}`);
  // Start periodic GitHub sync (every 60s)
  if (process.env.GITHUB_TOKEN) {
    startSyncScheduler();
  } else {
    console.log('GITHUB_TOKEN not set — GitHub sync disabled');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  stopSyncScheduler();
  closeDb();
  process.exit(0);
});
process.on('SIGINT', () => {
  stopSyncScheduler();
  closeDb();
  process.exit(0);
});

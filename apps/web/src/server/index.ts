import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { closeDb } from './db/schema.js';
import { requireAuth } from './middleware/auth.js';
import { userCount, createUserWithoutPassword } from './db/users.js';
import { v4 as uuid } from 'uuid';
import { productRoutes } from './routes/products.js';
import { taskRoutes } from './routes/tasks.js';
import { githubRoutes } from './routes/github.js';
import { eventRoutes } from './routes/events.js';
import { aiRoutes } from './routes/ai.js';
import { investigationRoutes } from './routes/investigation.js';
import { prReviewRoutes } from './routes/pr-review.js';
import { insightsRoutes } from './routes/insights.js';
import { roadmapRoutes } from './routes/roadmap.js';
import { ideationRoutes } from './routes/ideation.js';
import { changelogRoutes } from './routes/changelog.js';
import { settingsRoutes } from './routes/settings.js';
import { gitlabRoutes } from './routes/gitlab.js';
import { authRoutes } from './routes/auth.js';
import { startSyncScheduler, stopSyncScheduler, triggerSync } from './sync/scheduler.js';
import { broadcastEvent } from './routes/events.js';
import { resolveConfig } from './config-resolver.js';

config();

// Bootstrap admin user from ADMIN_EMAIL env var on first boot
(function bootstrapAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && userCount() === 0) {
    const id = uuid();
    createUserWithoutPassword(id, adminEmail, 'Admin', 'admin');
    console.log(`[auth] Created initial admin account for ${adminEmail}`);
  }
})();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

// Rate limiters
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests, try again later' } });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many AI requests, try again later' } });

// Public routes (no auth required)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth/users', requireAuth);
app.use('/api/events', requireAuth, eventRoutes);

// Protected routes (require valid JWT)
app.use('/api/products', requireAuth, productRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/github', requireAuth, githubRoutes);
app.use('/api/ai', requireAuth, aiLimiter, aiRoutes);
app.use('/api/investigate', requireAuth, aiLimiter, investigationRoutes);
app.use('/api/pr-review', requireAuth, aiLimiter, prReviewRoutes);
app.use('/api/insights', requireAuth, aiLimiter, insightsRoutes);
app.use('/api/roadmap', requireAuth, aiLimiter, roadmapRoutes);
app.use('/api/ideation', requireAuth, aiLimiter, ideationRoutes);
app.use('/api/changelog', requireAuth, aiLimiter, changelogRoutes);
app.use('/api/settings', requireAuth, settingsRoutes);
app.use('/api/gitlab', requireAuth, gitlabRoutes);

// Manual sync trigger for a product (protected)
app.post('/api/products/:id/sync', requireAuth, async (req, res) => {
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
  if (resolveConfig('githubToken', 'GITHUB_TOKEN')) {
    startSyncScheduler();
  } else {
    console.log('GitHub token not configured — GitHub sync disabled. Set GITHUB_TOKEN or configure it in Settings.');
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

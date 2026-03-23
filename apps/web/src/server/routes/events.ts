import { Router } from 'express';
import type { Request, Response } from 'express';

export const eventRoutes = Router();

// Store connected SSE clients
const clients = new Set<Response>();

// GET /api/events — SSE stream for real-time updates
eventRoutes.get('/', (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send heartbeat every 30s to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(':heartbeat\n\n');
  }, 30000);

  clients.add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
});

/** Broadcast an event to all connected SSE clients */
export function broadcastEvent(event: string, data: any): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(message);
  }
}

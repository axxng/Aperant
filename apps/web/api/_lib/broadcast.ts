import { insertEvent } from './db/events.js';

export async function broadcastEvent(type: string, data: any): Promise<void> {
  await insertEvent(type, data);
}

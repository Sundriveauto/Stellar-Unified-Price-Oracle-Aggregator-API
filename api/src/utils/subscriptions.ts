import { WebSocket } from 'ws';
import { priceStore, PriceRecord } from '../../../shared/src/store';
import { logger } from './logger';

const PAIR_RE = /^[A-Z0-9]{1,10}\/[A-Z0-9]{1,10}$/;
const MAX_PAIRS_PER_SUB = 50;

interface Subscription {
  ws: WebSocket;
  pairs: Set<string>;
}

class SubscriptionManager {
  private subs = new Map<WebSocket, Subscription>();
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;
  private lastBroadcast = new Map<string, number>();

  start(intervalMs = 5000): void {
    this.broadcastInterval = setInterval(() => this.broadcast(), intervalMs);
  }

  stop(): void {
    if (this.broadcastInterval) clearInterval(this.broadcastInterval);
  }

  add(ws: WebSocket): void {
    this.subs.set(ws, { ws, pairs: new Set() });
  }

  remove(ws: WebSocket): void {
    this.subs.delete(ws);
  }

  subscribe(ws: WebSocket, pairs: string[]): void {
    const sub = this.subs.get(ws);
    if (!sub) return;
    for (const p of pairs) sub.pairs.add(p);
  }

  unsubscribe(ws: WebSocket, pairs: string[]): void {
    const sub = this.subs.get(ws);
    if (!sub) return;
    for (const p of pairs) sub.pairs.delete(p);
  }

  notify(record: PriceRecord): void {
    for (const sub of this.subs.values()) {
      if (sub.pairs.has(record.assetPair) && sub.ws.readyState === WebSocket.OPEN) {
        sub.ws.send(JSON.stringify({ type: 'price_update', ...record }));
      }
    }
  }

  private async broadcast(): Promise<void> {
    try {
      const all = await priceStore.getAll();
      for (const record of all) {
        const last = this.lastBroadcast.get(record.assetPair) ?? 0;
        if (record.timestamp <= last) continue;
        this.lastBroadcast.set(record.assetPair, record.timestamp);
        this.notify(record);
      }
    } catch (err) {
      logger.error('WS broadcast error', err);
    }
  }
}

export const subscriptionManager = new SubscriptionManager();

export function handleWsMessage(ws: WebSocket, raw: string): void {
  try {
    const msg = JSON.parse(raw);

    if (msg.action === 'subscribe' || msg.action === 'unsubscribe') {
      if (!Array.isArray(msg.assetPairs)) {
        return void ws.send(JSON.stringify({ type: 'error', message: 'assetPairs must be an array' }));
      }
      const pairs = (msg.assetPairs as unknown[]).filter((p): p is string => typeof p === 'string' && PAIR_RE.test(p));
      if (pairs.length === 0) {
        return void ws.send(JSON.stringify({ type: 'error', message: 'No valid asset pairs provided' }));
      }
      if (pairs.length > MAX_PAIRS_PER_SUB) {
        return void ws.send(JSON.stringify({ type: 'error', message: `Too many pairs (max ${MAX_PAIRS_PER_SUB})` }));
      }
      if (msg.action === 'subscribe') {
        subscriptionManager.subscribe(ws, pairs);
        ws.send(JSON.stringify({ type: 'subscribed', assetPairs: pairs }));
      } else {
        subscriptionManager.unsubscribe(ws, pairs);
        ws.send(JSON.stringify({ type: 'unsubscribed', assetPairs: pairs }));
      }
    } else {
      ws.send(JSON.stringify({ type: 'error', message: 'Unknown action' }));
    }
  } catch {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
  }
}

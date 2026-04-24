import { Request, Response, NextFunction } from 'express';

interface Counter { [label: string]: number }

const counters: Counter = {};
const histograms: { [name: string]: number[] } = {};
let startTime = Date.now();

export function inc(name: string, labels = ''): void {
  const key = labels ? `${name}{${labels}}` : name;
  counters[key] = (counters[key] ?? 0) + 1;
}

export function observe(name: string, value: number): void {
  if (!histograms[name]) histograms[name] = [];
  histograms[name].push(value);
  // Keep last 1000 observations to avoid unbounded growth
  if (histograms[name].length > 1000) histograms[name].shift();
}

/** Express middleware: count requests and measure latency. */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route?.path ?? req.path;
    inc('http_requests_total', `method="${req.method}",route="${route}",status="${res.statusCode}"`);
    observe('http_request_duration_ms', Date.now() - start);
  });
  next();
}

/** GET /metrics — Prometheus text format. */
export function metricsHandler(_req: Request, res: Response): void {
  const lines: string[] = [];

  lines.push(`# HELP process_uptime_seconds Uptime in seconds`);
  lines.push(`# TYPE process_uptime_seconds gauge`);
  lines.push(`process_uptime_seconds ${((Date.now() - startTime) / 1000).toFixed(1)}`);

  lines.push(`# HELP http_requests_total Total HTTP requests`);
  lines.push(`# TYPE http_requests_total counter`);
  for (const [k, v] of Object.entries(counters)) {
    lines.push(`${k} ${v}`);
  }

  for (const [name, values] of Object.entries(histograms)) {
    if (values.length === 0) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    lines.push(`# HELP ${name} Histogram`);
    lines.push(`# TYPE ${name} summary`);
    lines.push(`${name}{quantile="0.5"} ${p50}`);
    lines.push(`${name}{quantile="0.95"} ${p95}`);
    lines.push(`${name}{quantile="0.99"} ${p99}`);
    lines.push(`${name}_count ${values.length}`);
  }

  res.set('Content-Type', 'text/plain; version=0.0.4').send(lines.join('\n') + '\n');
}

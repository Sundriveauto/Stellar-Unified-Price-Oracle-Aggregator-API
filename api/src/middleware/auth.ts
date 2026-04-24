import { Request, Response, NextFunction } from 'express';

const API_KEY = process.env.API_KEY;

/**
 * If API_KEY env var is set, require `x-api-key` header to match.
 * If not set, auth is disabled (useful for local dev).
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) return next();
  if (req.headers['x-api-key'] === API_KEY) return next();
  res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
}

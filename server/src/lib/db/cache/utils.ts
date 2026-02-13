import { log } from '@/lib/logger';
import { cache } from './index';

const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Wrapper to cache the result of an async function
 */
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) {
    log.info(`✅ Cache hit: ${key}`);
    return cached;
  }
  log.info(`🔁 Fetching: ${key}`);
  const value = await fetchFn();
  cache.set(key, value, ttl);
  log.info(`✅ Cached: ${key} (TTL: ${ttl} ms)`);
  return value;
}

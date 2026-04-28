import { Redis } from "@upstash/redis";

let cachedRedisClient: Redis | null | undefined;

export function getRedisClient() {
  if (cachedRedisClient !== undefined) {
    return cachedRedisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    cachedRedisClient = null;
    return null;
  }

  try {
    cachedRedisClient = new Redis({ url, token });
  } catch {
    cachedRedisClient = null;
  }

  return cachedRedisClient;
}

/**
 * Redis Service
 * 
 * Provides Redis caching for geo location data.
 * Falls back to in-memory cache if Redis is unavailable.
 */

import Redis from 'ioredis';
import { cacheService } from './cache.service';

let redisClient: Redis | null = null;
let redisAvailable = false;

// Initialize Redis connection
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_KEY_PREFIX_GEO = 'xandeum:geo:';
const REDIS_KEY_PREFIX_NODES = 'xandeum:nodes:';
const REDIS_KEY_PREFIX_STATS = 'xandeum:stats:';
const REDIS_KEY_PREFIX_ANALYTICS = 'xandeum:analytics:';

/**
 * Initialize Redis connection
 */
export async function initRedis(): Promise<void> {
  try {
    redisClient = new Redis(REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      connectTimeout: 5000,
    });

    // Test connection
    await redisClient.ping();
    redisAvailable = true;
    console.log('✅ Redis connected successfully');

    // Handle connection errors
    redisClient.on('error', (error) => {
      console.warn('⚠️ Redis connection error:', error.message);
      redisAvailable = false;
    });

    redisClient.on('connect', () => {
      redisAvailable = true;
      console.log('✅ Redis reconnected');
    });
  } catch (error) {
    console.warn('⚠️ Redis not available, falling back to in-memory cache:', error instanceof Error ? error.message : error);
    redisAvailable = false;
    // Clean up failed connection
    if (redisClient) {
      redisClient.disconnect();
      redisClient = null;
    }
  }
}

/**
 * Get value from Redis cache
 */
async function getFromRedis<T>(key: string): Promise<T | null> {
  if (!redisAvailable || !redisClient) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`⚠️ Redis get error for key ${key}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Set value in Redis cache with TTL
 */
async function setInRedis<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!redisAvailable || !redisClient) {
    return;
  }

  try {
    await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.warn(`⚠️ Redis set error for key ${key}:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Redis-backed cache service for geo location data
 */
export class GeoCacheService {
  /**
   * Get geo location from cache (Redis first, then in-memory fallback)
   */
  async get<T>(key: string): Promise<T | null> {
    const redisKey = `${REDIS_KEY_PREFIX_GEO}${key}`;
    
    // Try Redis first
    const redisValue = await getFromRedis<T>(redisKey);
    if (redisValue) {
      return redisValue;
    }

    // Fallback to in-memory cache
    return cacheService.get<T>(key);
  }

  /**
   * Set geo location in cache (both Redis and in-memory)
   */
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const redisKey = `${REDIS_KEY_PREFIX_GEO}${key}`;
    const ttlSeconds = Math.floor(ttlMs / 1000);

    // Set in both Redis and in-memory cache
    await Promise.all([
      setInRedis(redisKey, value, ttlSeconds),
      Promise.resolve(cacheService.set(key, value, ttlMs)),
    ]);
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return redisAvailable;
  }
}

export const geoCacheService = new GeoCacheService();

/**
 * General Redis-backed cache service for all data types
 * Falls back to in-memory cache if Redis is unavailable
 */
export class RedisCacheService {
  private keyPrefix: string;

  constructor(keyPrefix: string) {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Get value from cache (Redis first, then in-memory fallback)
   */
  async get<T>(key: string): Promise<T | null> {
    const redisKey = `${this.keyPrefix}${key}`;
    
    // Try Redis first
    const redisValue = await getFromRedis<T>(redisKey);
    if (redisValue) {
      return redisValue;
    }

    // Fallback to in-memory cache
    return cacheService.get<T>(key);
  }

  /**
   * Set value in cache (both Redis and in-memory)
   */
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const redisKey = `${this.keyPrefix}${key}`;
    const ttlSeconds = Math.floor(ttlMs / 1000);

    // Set in both Redis and in-memory cache
    await Promise.all([
      setInRedis(redisKey, value, ttlSeconds),
      Promise.resolve(cacheService.set(key, value, ttlMs)),
    ]);
  }

  /**
   * Delete value from cache (both Redis and in-memory)
   */
  async delete(key: string): Promise<void> {
    const redisKey = `${this.keyPrefix}${key}`;
    
    if (redisAvailable && redisClient) {
      try {
        await redisClient.del(redisKey);
      } catch (error) {
        // Ignore Redis errors
      }
    }
    
    cacheService.delete(key);
  }

  /**
   * Check if Redis is available
   */
  isRedisAvailable(): boolean {
    return redisAvailable;
  }
}

// Create specialized cache services for different data types
export const nodeCacheService = new RedisCacheService(REDIS_KEY_PREFIX_NODES);
export const statsCacheService = new RedisCacheService(REDIS_KEY_PREFIX_STATS);
export const analyticsCacheService = new RedisCacheService(REDIS_KEY_PREFIX_ANALYTICS);

/**
 * Gracefully close Redis connection on shutdown
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    redisAvailable = false;
    console.log('🔌 Redis connection closed');
  }
}


import { db } from '@/db';
import { youtubeCache } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Retrieves a cached value if it exists and has not expired.
 */
export async function getCachedValue<T>(key: string): Promise<T | null> {
  try {
    const cached = await db.query.youtubeCache.findFirst({
      where: eq(youtubeCache.key, key),
    });

    if (cached) {
      const now = new Date();
      const expiresAt = new Date(cached.expiresAt);

      if (now < expiresAt) {
        return cached.value as T;
      } else {
        // Asynchronously delete expired cache item
        db.delete(youtubeCache).where(eq(youtubeCache.key, key)).catch((e) => 
          console.error(`Failed to delete expired cache key ${key}:`, e)
        );
      }
    }
  } catch (e) {
    console.error('Cache read error:', e);
  }
  return null;
}

/**
 * Saves a value to the cache table with a specified expiration time (default 24 hours).
 */
export async function setCachedValue(key: string, value: any, ttlHours = 24): Promise<void> {
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    await db.insert(youtubeCache)
      .values({
        key,
        value,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: youtubeCache.key,
        set: { value, expiresAt },
      });
  } catch (e) {
    console.error('Cache write error:', e);
  }
}

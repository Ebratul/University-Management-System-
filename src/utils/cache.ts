import { redisClient } from "../lib/redis";

const DEFAULT_TTL_SECONDS = 300;

// Redis is a read-through cache for reference/list data only. Any failure here
// must degrade to "no cache" rather than break the request.

export const cacheGet = async <T>(key: string): Promise<T | null> => {
	try {
		const raw = await redisClient.get(key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch (error) {
		console.error(`Cache read failed for key "${key}":`, error);
		return null;
	}
};

export const cacheSet = async (
	key: string,
	value: unknown,
	ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> => {
	try {
		await redisClient.set(key, JSON.stringify(value), {
			expiration: { type: "EX", value: ttlSeconds },
		});
	} catch (error) {
		console.error(`Cache write failed for key "${key}":`, error);
	}
};

export const cacheInvalidateByPrefix = async (
	prefix: string,
): Promise<void> => {
	try {
		const keys: string[] = [];
		for await (const batch of redisClient.scanIterator({
			MATCH: `${prefix}*`,
		})) {
			keys.push(...(Array.isArray(batch) ? batch : [batch]));
		}
		if (keys.length) {
			await Promise.all(keys.map((key) => redisClient.del(key)));
		}
	} catch (error) {
		console.error(`Cache invalidation failed for prefix "${prefix}":`, error);
	}
};

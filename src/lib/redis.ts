import { createClient } from "redis";
import config from "../config";

export const redisClient = createClient({
	username: config.redis_user,
	password: config.redis_password,
	socket: {
		host: config.redis_host,
		port: Number(config.redis_port),
	},
});

// node-redis never auto-connects; every command needs an open socket first.
// The traditional server connects once eagerly at boot (see server.ts), but
// a serverless entrypoint (api/index.ts) never runs that startup code, so
// anything that can't assume a long-lived process (the cache helpers, the
// health check) calls this first instead. Concurrent callers share one
// in-flight connect() so they don't race redis's "already connecting" error.
let connectingPromise: Promise<void> | null = null;

export const ensureRedisConnected = async (): Promise<void> => {
	if (redisClient.isOpen) return;
	if (!connectingPromise) {
		connectingPromise = redisClient.connect().then(
			() => undefined,
			(error: unknown) => {
				connectingPromise = null;
				throw error;
			},
		);
	}
	await connectingPromise;
};

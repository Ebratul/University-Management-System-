import { createClient } from "redis";
import config from "../config";

export const redisClient = createClient({
	username: config.redis_user,
	password: config.redis_password,
	socket: {
		host: config.redis_host,
		port: Number(config.redis_port),
		// Without this, node-redis's default strategy retries forever with
		// backoff even when the failure is unrecoverable (e.g. bad
		// credentials), which floods the logs with the same auth error
		// instead of ever surfacing a final failure to `.connect()`.
		reconnectStrategy: (retries, cause) => {
			const message = cause instanceof Error ? cause.message : String(cause);
			if (/WRONGPASS|NOAUTH|NOPERM/.test(message)) {
				return new Error(`Redis authentication failed, giving up: ${message}`);
			}
			if (retries > 10) {
				return new Error(`Redis: too many reconnect attempts (${retries})`);
			}
			return Math.min(retries * 200, 3000);
		},
	},
});

// node-redis emits "error" on every network hiccup (e.g. a socket read
// timeout). Without a listener, Node treats it as an uncaught exception and
// crashes the whole process instead of just letting the client reconnect.
redisClient.on("error", (error) => {
	console.error("Redis client error:", error);
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

import type { Server } from "node:http";
import app from "./app";
import config from "./config";
import { validateEnv } from "./config/validateEnv";
import { prisma } from "./lib/prisma";
import { redisClient } from "./lib/redis";
import { seedAll } from "./utils/seed";

const port = config.port;
let server: Server;

const shutdown = async (signal: string) => {
	console.log(`${signal} received. Shutting down gracefully...`);

	if (server) {
		server.close(() => console.log("HTTP server closed."));
	}

	await Promise.allSettled([prisma.$disconnect(), redisClient.quit()]);
	process.exit(0);
};

const main = async () => {
	try {
		validateEnv();

		await prisma.$connect();
		console.log("Database connected successfully.");

		// Demo accounts are a convenience, not a dependency: a missing seed env
		// var or a seed error must not keep the API from starting.
		try {
			await seedAll();
		} catch (err) {
			console.error("Seeding failed, continuing without it:", err);
		}

		await redisClient.connect();
		console.log("Redis connected successfully.");

		server = app.listen(port, () => {
			console.log(`Server is running successfully on port ${port}.`);
		});
	} catch (err) {
		console.error("Failed to start the server:", err);
		await prisma.$disconnect();
		process.exit(1);
	}
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
	console.error("Unhandled promise rejection:", reason);
	server?.close(() => process.exit(1));
});

process.on("uncaughtException", (error) => {
	console.error("Uncaught exception:", error);
	server?.close(() => process.exit(1));
});

main();

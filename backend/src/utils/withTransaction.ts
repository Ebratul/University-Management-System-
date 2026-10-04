import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

// Postgres reports a Serializable write conflict as SQLSTATE 40001
// (serialization_failure) or 40P01 (deadlock_detected). Prisma 7's
// driver-adapter layer wraps that as a DriverAdapterError with
// cause.kind === "TransactionWriteConflict" rather than the older
// PrismaClientKnownRequestError P2034 — checking only for P2034 (as an
// earlier version of this helper did) never actually matched, so the retry
// never engaged and a genuine race surfaced as a raw 500. Check both shapes
// without importing @prisma/driver-adapter-utils directly, since it's only
// a transitive dependency of @prisma/adapter-pg here.
const isRetryableTransactionConflict = (error: unknown): boolean => {
	if (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2034"
	) {
		return true;
	}

	const err = error as {
		name?: string;
		cause?: { kind?: string; originalCode?: string };
	};
	if (err?.name === "DriverAdapterError") {
		if (err.cause?.kind === "TransactionWriteConflict") return true;
		if (
			err.cause?.originalCode === "40001" ||
			err.cause?.originalCode === "40P01"
		) {
			return true;
		}
	}

	return false;
};

export const runSerializable = async <T>(
	fn: (tx: Prisma.TransactionClient) => Promise<T>,
	retries = 3,
): Promise<T> => {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			return await prisma.$transaction(fn, {
				isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
			});
		} catch (error) {
			if (!isRetryableTransactionConflict(error) || attempt === retries) {
				throw error;
			}
		}
	}
	throw new Error("Unreachable");
};

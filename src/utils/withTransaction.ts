import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

// P2034: "Transaction failed due to a write conflict or a deadlock." Under
// Serializable isolation, Postgres aborts one side of a genuine race instead
// of silently corrupting a seat count — retrying a few times is the
// documented, correct response, not a bug workaround.
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
			const isSerializationFailure =
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2034";
			if (!isSerializationFailure || attempt === retries) {
				throw error;
			}
		}
	}
	throw new Error("Unreachable");
};

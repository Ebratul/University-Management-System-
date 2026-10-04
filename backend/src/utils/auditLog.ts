import type { Prisma, Role } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../lib/prisma";

type TRecordAuditLog = {
	action: string;
	entityType: string;
	entityId?: string;
	description?: string;
	metadata?: Record<string, unknown>;
	actor?: { userId?: string; email?: string; role?: Role; ip?: string };
	req?: Request;
};

// Audit logging must never fail the request it's describing.
export const recordAuditLog = async ({
	action,
	entityType,
	entityId,
	description,
	metadata,
	actor,
	req,
}: TRecordAuditLog): Promise<void> => {
	try {
		await prisma.auditLog.create({
			data: {
				action,
				entityType,
				entityId,
				description,
				metadata: metadata as Prisma.InputJsonValue | undefined,
				performedByUserId: actor?.userId ?? req?.user?.userId,
				performedByEmail: actor?.email ?? req?.user?.email,
				performedByRole: actor?.role ?? req?.user?.role,
				ipAddress: actor?.ip ?? req?.ip,
			},
		});
	} catch (error) {
		console.error("Failed to record audit log:", error);
	}
};

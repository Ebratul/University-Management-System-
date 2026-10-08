import { randomUUID } from "node:crypto";

import httpStatus from "http-status";

import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { destroyQuietly, uploadBuffer } from "../../utils/cloudinaryUpload";
import {
	requireStaffAccess,
	resolveOfferingAccess,
} from "../../utils/offeringAccess";
import type { IUploadMaterialPayload } from "./material.interface";

const SIGNED_URL_TTL_SECONDS = 5 * 60;
// Authenticated raw assets are only reachable through a signed URL.
const ASSET_OPTIONS = { resource_type: "raw", type: "authenticated" } as const;

// Public projection: never expose the storage id.
const MATERIAL_SELECT = {
	id: true,
	title: true,
	fileName: true,
	fileSize: true,
	mimeType: true,
	createdAt: true,
	courseOfferingId: true,
} as const;

const isPdf = (buffer: Buffer) => buffer.subarray(0, 5).toString() === "%PDF-";

const listMaterials = async (offeringId: string, user: RequestUser) => {
	await resolveOfferingAccess(user, offeringId);
	return prisma.courseMaterial.findMany({
		where: { courseOfferingId: offeringId },
		select: MATERIAL_SELECT,
		orderBy: { createdAt: "desc" },
	});
};

const uploadMaterial = async (
	offeringId: string,
	payload: IUploadMaterialPayload,
	file: Express.Multer.File | undefined,
	user: RequestUser,
) => {
	await requireStaffAccess(user, offeringId);

	if (!file) {
		throw new AppError(httpStatus.BAD_REQUEST, "No PDF file was uploaded.");
	}
	// The mimetype header is client-controlled; check the file's own signature.
	if (!isPdf(file.buffer)) {
		throw new AppError(httpStatus.BAD_REQUEST, "The file is not a valid PDF.");
	}

	let uploaded: Awaited<ReturnType<typeof uploadBuffer>>;
	try {
		uploaded = await uploadBuffer(file.buffer, {
			...ASSET_OPTIONS,
			folder: `ums/courses/${offeringId}`,
			public_id: `${randomUUID()}.pdf`,
		});
	} catch (error) {
		console.error("Cloudinary upload failed for course material:", error);
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"The PDF could not be uploaded. Please try again.",
		);
	}

	const fileName = file.originalname;
	const createRecord = () =>
		prisma.courseMaterial.create({
			data: {
				title: payload.title ?? fileName.replace(/\.pdf$/i, ""),
				fileName,
				fileSize: file.size,
				publicId: uploaded.public_id,
				courseOfferingId: offeringId,
				uploadedById: user.userId,
			},
			select: MATERIAL_SELECT,
		});

	let material: Awaited<ReturnType<typeof createRecord>>;
	try {
		material = await createRecord();
	} catch (error) {
		await destroyQuietly(uploaded.public_id, ASSET_OPTIONS); // don't orphan the file
		throw error;
	}

	await recordAuditLog({
		action: "COURSE_MATERIAL_UPLOADED",
		entityType: "CourseMaterial",
		entityId: material.id,
		description: fileName,
		actor: { userId: user.userId, email: user.email, role: user.role },
	});
	return material;
};

// The signed URL expires quickly, so a copied link stops working; the backend
// hands one out only after checking course membership.
const getAccessUrl = async (
	offeringId: string,
	materialId: string,
	user: RequestUser,
) => {
	await resolveOfferingAccess(user, offeringId);

	// Scoped by offering id too: a material id from another course never resolves.
	const material = await prisma.courseMaterial.findFirst({
		where: { id: materialId, courseOfferingId: offeringId },
	});
	if (!material) {
		throw new AppError(httpStatus.NOT_FOUND, "Material not found.");
	}

	const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
	const url = cloudinary.utils.private_download_url(material.publicId, "", {
		...ASSET_OPTIONS,
		expires_at: expiresAt,
	});

	return {
		url,
		fileName: material.fileName,
		expiresAt: new Date(expiresAt * 1000),
	};
};

const deleteMaterial = async (
	offeringId: string,
	materialId: string,
	user: RequestUser,
) => {
	await requireStaffAccess(user, offeringId);

	const material = await prisma.courseMaterial.findFirst({
		where: { id: materialId, courseOfferingId: offeringId },
	});
	if (!material) {
		throw new AppError(httpStatus.NOT_FOUND, "Material not found.");
	}

	await prisma.courseMaterial.delete({ where: { id: materialId } });
	await destroyQuietly(material.publicId, ASSET_OPTIONS);

	await recordAuditLog({
		action: "COURSE_MATERIAL_DELETED",
		entityType: "CourseMaterial",
		entityId: materialId,
		description: material.fileName,
		actor: { userId: user.userId, email: user.email, role: user.role },
	});
};

export const MaterialService = {
	listMaterials,
	uploadMaterial,
	getAccessUrl,
	deleteMaterial,
};

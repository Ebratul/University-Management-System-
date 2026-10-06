import type { WebsiteSettings } from "@prisma/client";
import type { UploadApiResponse } from "cloudinary";
import httpStatus from "http-status";

import type { IActor } from "../../interface";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../../utils/auditLog";
import { cacheGet, cacheInvalidateByPrefix, cacheSet } from "../../utils/cache";
import type {
	IUpdateWebsiteSettingsPayload,
	TWebsiteAsset,
} from "./website-settings.interface";

const SETTINGS_ID = "global";
const CACHE_PREFIX = "website-settings:";
const CACHE_KEY = `${CACHE_PREFIX}public`;
const CACHE_TTL_SECONDS = 600;

type TPublicSettings = {
	universityName: string;
	tagline: string;
	logoUrl: string | null;
	homepageBackgroundUrl: string | null;
	updatedAt: Date;
};

// Public projection: never leaks Cloudinary public ids.
const toPublic = (row: WebsiteSettings): TPublicSettings => ({
	universityName: row.universityName,
	tagline: row.tagline,
	logoUrl: row.logoUrl,
	homepageBackgroundUrl: row.homepageBackgroundUrl,
	updatedAt: row.updatedAt,
});

// upsert on the fixed id keeps exactly one row, even on a fresh database
// where the migration seed has not run.
const ensureRow = () =>
	prisma.websiteSettings.upsert({
		where: { id: SETTINGS_ID },
		update: {},
		create: { id: SETTINGS_ID },
	});

const getSettings = async (): Promise<TPublicSettings> => {
	const cached = await cacheGet<TPublicSettings>(CACHE_KEY);
	if (cached) return cached;

	const result = toPublic(await ensureRow());
	await cacheSet(CACHE_KEY, result, CACHE_TTL_SECONDS);
	return result;
};

const updateSettings = async (
	payload: IUpdateWebsiteSettingsPayload,
	actor: IActor,
) => {
	await ensureRow();
	const row = await prisma.websiteSettings.update({
		where: { id: SETTINGS_ID },
		data: payload,
	});
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: "WEBSITE_SETTINGS_UPDATED",
		entityType: "WebsiteSettings",
		entityId: SETTINGS_ID,
		description: "Website name/tagline updated",
		actor,
	});
	return toPublic(row);
};

const uploadToCloudinary = (buffer: Buffer, folder: string) =>
	new Promise<UploadApiResponse>((resolve, reject) => {
		cloudinary.uploader
			.upload_stream({ resource_type: "image", folder }, (error, result) => {
				if (error) return reject(error);
				if (!result)
					return reject(new Error("No result returned from Cloudinary"));
				resolve(result);
			})
			.end(buffer);
	});

const destroyQuietly = async (publicId: string | null | undefined) => {
	if (!publicId) return;
	try {
		await cloudinary.uploader.destroy(publicId);
	} catch (error) {
		// A leftover remote file is harmless; failing the request is not.
		console.error(`Failed to delete Cloudinary asset "${publicId}":`, error);
	}
};

const FIELDS = {
	logo: {
		url: "logoUrl",
		publicId: "logoPublicId",
		folder: "ums/branding/logo",
	},
	background: {
		url: "homepageBackgroundUrl",
		publicId: "homepageBackgroundPublicId",
		folder: "ums/branding/background",
	},
} as const;

const replaceAsset = async (
	asset: TWebsiteAsset,
	file: Express.Multer.File | undefined,
	actor: IActor,
) => {
	if (!file) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`No ${asset} image was uploaded.`,
		);
	}
	const field = FIELDS[asset];
	const current = await ensureRow();
	const previousPublicId = current[field.publicId];

	let uploaded: UploadApiResponse;
	try {
		uploaded = await uploadToCloudinary(file.buffer, field.folder);
	} catch (error) {
		console.error(`Cloudinary upload failed for ${asset}:`, error);
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"The image could not be uploaded. Please try again.",
		);
	}

	let row: WebsiteSettings;
	try {
		row = await prisma.websiteSettings.update({
			where: { id: SETTINGS_ID },
			data: {
				[field.url]: uploaded.secure_url,
				[field.publicId]: uploaded.public_id,
			},
		});
	} catch (error) {
		await destroyQuietly(uploaded.public_id); // don't orphan the new file
		throw error;
	}

	await destroyQuietly(previousPublicId);
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: `WEBSITE_${asset.toUpperCase()}_UPDATED`,
		entityType: "WebsiteSettings",
		entityId: SETTINGS_ID,
		description: `Website ${asset} replaced`,
		actor,
	});
	return toPublic(row);
};

const removeAsset = async (asset: TWebsiteAsset, actor: IActor) => {
	const field = FIELDS[asset];
	const current = await ensureRow();
	const previousPublicId = current[field.publicId];

	const row = await prisma.websiteSettings.update({
		where: { id: SETTINGS_ID },
		data: { [field.url]: null, [field.publicId]: null },
	});

	await destroyQuietly(previousPublicId);
	await cacheInvalidateByPrefix(CACHE_PREFIX);
	await recordAuditLog({
		action: `WEBSITE_${asset.toUpperCase()}_REMOVED`,
		entityType: "WebsiteSettings",
		entityId: SETTINGS_ID,
		description: `Website ${asset} removed`,
		actor,
	});
	return toPublic(row);
};

export const WebsiteSettingsService = {
	getSettings,
	updateSettings,
	replaceAsset,
	removeAsset,
};

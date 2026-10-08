import type { UploadApiOptions, UploadApiResponse } from "cloudinary";

import { cloudinary } from "../lib/cloudinary";

export const uploadBuffer = (buffer: Buffer, options: UploadApiOptions) =>
	new Promise<UploadApiResponse>((resolve, reject) => {
		cloudinary.uploader
			.upload_stream(options, (error, result) => {
				if (error) return reject(error);
				if (!result)
					return reject(new Error("No result returned from Cloudinary"));
				resolve(result);
			})
			.end(buffer);
	});

// A leftover remote file is harmless; failing the request over it is not.
export const destroyQuietly = async (
	publicId: string | null | undefined,
	options: {
		resource_type?: "image" | "raw";
		type?: "upload" | "authenticated";
	} = {},
) => {
	if (!publicId) return;
	try {
		await cloudinary.uploader.destroy(publicId, options);
	} catch (error) {
		console.error(`Failed to delete Cloudinary asset "${publicId}":`, error);
	}
};

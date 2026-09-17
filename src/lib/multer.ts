import httpStatus from "http-status";
import multer from "multer";
import { AppError } from "../utils/AppError";

const storage = multer.memoryStorage();

const upload = multer({
	storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — profile images only, not general file storage
	fileFilter: (_req, file, callback) => {
		if (!file.mimetype.startsWith("image/")) {
			return callback(
				new AppError(httpStatus.BAD_REQUEST, "Only image files are allowed."),
			);
		}
		callback(null, true);
	},
});

export default upload;

export type TErrorDetail = {
	path: string;
	message: string;
};

export class AppError extends Error {
	public statusCode: number;
	public errors?: TErrorDetail[];

	constructor(
		statusCode: number,
		message: string,
		errors?: TErrorDetail[],
		stack = "",
	) {
		super(message);

		this.statusCode = statusCode;
		this.errors = errors;

		if (stack) {
			this.stack = stack;
		} else {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

import config from "../config";
import { redisClient } from "./redis";

export const getBkashToken = async () => {
	try {
		const baseUrl = config.bkash_base_url?.trim();

		const IdTokenKey = "sasklfasdflkassflkassfdsds";
		const RefreshTokenKey = "sdkfasldfkjasdflkasddflkasdf";

		let bkashIdToken = await redisClient.get(IdTokenKey);
		let bkashRefreshToken = await redisClient.get(RefreshTokenKey);
		let bkashIdTokenTTL = await redisClient.ttl(IdTokenKey);

		if (bkashIdTokenTTL < 600 && bkashRefreshToken) {
			const refreshTokenResponse = await fetch(
				`${config.bkash_base_url}/tokenized/checkout/token/refresh`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "application/json",
						username: config.bkash_username,
						password: config.bkash_password,
					},
					body: JSON.stringify({
						app_key: config.bkash_app_key,
						app_secret: config.bkash_app_secret,
						refresh_token: bkashRefreshToken,
					}),
				},
			);
			const bkashRefreshTokenResult = await refreshTokenResponse.json();

			bkashIdToken = bkashRefreshTokenResult.id_token as string;

			await redisClient.set(IdTokenKey, bkashIdToken, {
				expiration: {
					type: "EX",
					value: 60 * 60,
				},
			});

			return bkashIdToken;
		}

		if (bkashIdToken) {
			return bkashIdToken;
		}

		if (!baseUrl) {
			throw new Error("BKASH_BASE_URL is not configured");
		}

		const response = await fetch(
			`${config.bkash_base_url}/tokenized/checkout/token/grant`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					username: config.bkash_username,
					password: config.bkash_password,
				},
				body: JSON.stringify({
					app_key: config.bkash_app_key,
					app_secret: config.bkash_app_secret,
				}),
			},
		);

		if (!response.ok) {
			throw new Error("Bkash Access Token Fail");
		}

		const result = await response.json();

		await redisClient.set(IdTokenKey, result.id_token, {
			expiration: {
				type: "EX",
				value: 60 * 60,
			},
		});

		await redisClient.set(RefreshTokenKey, result.id_token, {
			expiration: {
				type: "EX",
				value: 60 * 60 * 24 * 28,
			},
		});

		bkashIdToken = result.id_token;

		return bkashIdToken;
	} catch (error) {
		return error;
	}
};

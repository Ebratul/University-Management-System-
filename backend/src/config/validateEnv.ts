import config from "./index";

const REQUIRED = [
	["database_url", config.database_url],
	["jwt_access_secret", config.jwt_access_secret],
	["jwt_refresh_secret", config.jwt_refresh_secret],
] as const;

// Fail fast and loud at boot instead of silently running with a blank JWT
// secret (jsonwebtoken.sign throws on every request once that happens, but
// only once traffic arrives) or no DB connection string.
export const validateEnv = (): void => {
	const missing = REQUIRED.filter(([, value]) => !value).map(([name]) => name);

	if (missing.length) {
		throw new Error(
			`Missing required environment variable(s): ${missing.join(", ")}. Check your .env against .env.example.`,
		);
	}
};

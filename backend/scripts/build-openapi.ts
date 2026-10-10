/**
 * Builds src/docs/openapi.ts. Run: npm run docs:build
 *
 * The route files are the source of truth for which endpoints exist, their
 * methods, paths and who may call them (auth(...) roles). postman_collection.json
 * adds human descriptions and example request bodies where it has a matching
 * request. Re-run this after adding or changing a route.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd(); // run from backend/ (npm run docs:build)
const read = (p: string) => readFileSync(join(root, p), "utf8");

type Op = {
	method: string;
	path: string;
	roles: string[] | null; // null = public, [] = any signed-in user
	handler: string;
	multipart: boolean;
};

// ---- helpers --------------------------------------------------------------
const balanced = (src: string, open: number): string => {
	let depth = 0;
	let quote = "";
	for (let i = open; i < src.length; i++) {
		const ch = src[i];
		if (quote) {
			if (ch === "\\") i++;
			else if (ch === quote) quote = "";
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") quote = ch;
		else if (ch === "(") depth++;
		else if (ch === ")" && --depth === 0) return src.slice(open + 1, i);
	}
	throw new Error("unbalanced parentheses");
};

const parseAuth = (text: string): string[] | null => {
	const m = text.match(/\bauth\(([^)]*)\)/);
	if (!m) return null;
	return [...m[1].matchAll(/Role\.(\w+)/g)].map((r) => r[1]);
};

// ---- 1. mounts from routes/index.ts ---------------------------------------
const index = read("src/routes/index.ts");
const mounts = [...index.matchAll(/router\.use\("([^"]+)",\s*(\w+)\)/g)].map(
	(m) => ({ prefix: m[1], exportName: m[2] }),
);
const importFiles = new Map<string, string>();
for (const m of index.matchAll(/import \{([^}]+)\} from "\.\.\/(module\/[^"]+)"/g)) {
	for (const name of m[1].split(",").map((s) => s.trim())) {
		importFiles.set(name, `src/${m[2]}.ts`);
	}
}

// ---- 2. operations from each router file ----------------------------------
const ops: Op[] = [];
for (const { prefix, exportName } of mounts) {
	const file = importFiles.get(exportName);
	if (!file) continue;
	const src = read(file);
	const exportMatch = src.match(
		new RegExp(`export const ${exportName}\\s*=\\s*(\\w+)`),
	);
	const routerVar = exportMatch?.[1] ?? "router";

	// const staff = auth(Role.FACULTY, Role.ADMIN)  ->  alias lookups
	const aliases = new Map<string, string[] | null>();
	for (const a of src.matchAll(/const (\w+)\s*=\s*(auth\([^)]*\))/g)) {
		aliases.set(a[1], parseAuth(a[2]));
	}

	let routerLevel: string[] | null = null;
	const callRe = new RegExp(`\\b${routerVar}\\.(get|post|put|patch|delete|use)\\(`, "g");
	for (const m of src.matchAll(callRe)) {
		const method = m[1];
		const args = balanced(src, m.index + m[0].length - 1);
		if (method === "use") {
			const level = parseAuth(args);
			if (level) routerLevel = level;
			continue;
		}
		const pathMatch = args.match(/^\s*"([^"]*)"/);
		if (!pathMatch) continue;

		let roles = parseAuth(args);
		if (!roles) {
			for (const [alias, aliasRoles] of aliases) {
				if (new RegExp(`\\b${alias}\\b`).test(args)) roles = aliasRoles;
			}
		}
		roles ??= routerLevel;

		const handler =
			[...args.matchAll(/\b(\w+Controller\.\w+)/g)].pop()?.[1] ?? "";
		const full = `/${[prefix, pathMatch[1]].join("/")}`
			.replace(/\/+/g, "/")
			.replace(/\/$/, "")
			.replace(/:(\w+)/g, "{$1}");
		ops.push({
			method,
			path: full || "/",
			roles,
			handler,
			multipart: /\.(single|array|fields)\(/.test(args),
		});
	}
}

// ---- 3. descriptions/examples from the Postman collection -----------------
type PmItem = {
	name: string;
	item?: PmItem[];
	request?: {
		method: string;
		url: { raw: string; query?: { key: string; value: string }[] };
		description?: string;
		body?: { mode: string; raw?: string };
	};
};
const collection = JSON.parse(read("postman_collection.json")) as { item: PmItem[] };
const norm = (p: string) =>
	p
		.replace(/^\{\{baseUrl\}\}/, "")
		.split("?")[0]
		.replace(/\/\{\{[^}]+\}\}/g, "/{}")
		.replace(/\/\{[^}]*\}/g, "/{}")
		.replace(/\/:\w+/g, "/{}")
		.replace(/\/$/, "");
const postman = new Map<string, PmItem>();
const walk = (items: PmItem[]) => {
	for (const it of items) {
		if (it.item) walk(it.item);
		else if (it.request) {
			postman.set(`${it.request.method.toLowerCase()} ${norm(it.request.url.raw)}`, it);
		}
	}
};
walk(collection.item);

const words = (s: string) =>
	s
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.toLowerCase()
		.replace(/^./, (c) => c.toUpperCase());

const errorSchema = {
	type: "object",
	properties: {
		success: { type: "boolean", example: false },
		statusCode: { type: "integer" },
		message: { type: "string" },
		errors: {
			type: "array",
			items: {
				type: "object",
				properties: { path: { type: "string" }, message: { type: "string" } },
			},
		},
	},
} as const;

const paths: Record<string, Record<string, unknown>> = {};
const tagSet = new Set<string>();

for (const op of ops) {
	const pm = postman.get(`${op.method} ${norm(op.path.replace(/\{(\w+)\}/g, "{}"))}`);
	const tag = words(op.path.split("/")[1] ?? "General").replace(/-/g, " ");
	tagSet.add(tag);

	const params = [...op.path.matchAll(/\{(\w+)\}/g)].map((p) => ({
		name: p[1],
		in: "path",
		required: true,
		schema: { type: "string" },
	}));
	const query = (pm?.request?.url.query ?? []).map((q) => ({
		name: q.key,
		in: "query",
		required: false,
		schema: { type: "string" },
		example: q.value,
	}));

	const roleText =
		op.roles === null
			? "Public."
			: op.roles.length === 0
				? "Requires sign-in (any role)."
				: `Requires sign-in as: ${op.roles.join(", ")}.`;
	const pmText = (pm?.request?.description ?? "")
		.replace(/\n*Error responses always look like[^\n]*/g, "")
		.replace(/^Public\.\s*/, "")
		.trim();

	const operation: Record<string, unknown> = {
		tags: [tag],
		summary: pm?.name ?? (op.handler ? words(op.handler.split(".")[1]) : `${op.method} ${op.path}`),
		description: [roleText, pmText].filter(Boolean).join("\n\n"),
		parameters: [...params, ...query],
		responses: {
			"200": { description: "Success. Body: { success, statusCode, message, data, meta? }" },
			"400": { description: "Validation failed.", content: { "application/json": { schema: errorSchema } } },
			...(op.roles !== null
				? {
						"401": { description: "Not signed in.", content: { "application/json": { schema: errorSchema } } },
						...(op.roles.length ? { "403": { description: "Your role may not do this.", content: { "application/json": { schema: errorSchema } } } } : {}),
					}
				: {}),
			"404": { description: "Not found.", content: { "application/json": { schema: errorSchema } } },
		},
	};
	if (op.roles !== null) operation.security = [{ bearerAuth: [] }, { cookieAuth: [] }];
	else operation.security = [];

	if (["post", "put", "patch"].includes(op.method)) {
		if (op.multipart) {
			operation.requestBody = {
				content: { "multipart/form-data": { schema: { type: "object", additionalProperties: true } } },
			};
		} else {
			let example: unknown;
			const raw = pm?.request?.body?.raw;
			if (raw) {
				try {
					example = JSON.parse(raw.replace(/\{\{\$?timestamp\}\}/g, "1700000000"));
				} catch {
					example = undefined;
				}
			}
			operation.requestBody = {
				content: {
					"application/json": {
						schema: { type: "object", additionalProperties: true },
						...(example ? { example } : {}),
					},
				},
			};
		}
	}
	paths[op.path] ??= {};
	paths[op.path][op.method] = operation;
}

const spec = {
	openapi: "3.0.3",
	info: {
		title: "University Management System API",
		version: "1.0.0",
		description:
			"REST API for students, faculty and administrators: authentication (password and Google), departments, universities, semesters, courses and offerings, course registration and payments, materials, attendance, quizzes, results and notices.\n\n" +
			"**Authentication.** `POST /auth/login` sets httpOnly `accessToken`/`refreshToken` cookies and also returns the tokens; send the access token as `Authorization: Bearer <token>`. Roles: `ADMIN`, `FACULTY` (teacher), `STUDENT`.\n\n" +
			"**Envelope.** Every response is `{ success, statusCode, message, data, meta? }`; errors are `{ success: false, statusCode, message, errors?: [{ path, message }] }`.",
	},
	servers: [{ url: "/api/v1", description: "This server" }],
	tags: [...tagSet].sort().map((name) => ({ name })),
	paths,
	components: {
		securitySchemes: {
			bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
			cookieAuth: { type: "apiKey", in: "cookie", name: "accessToken" },
		},
	},
};

writeFileSync(
	join(root, "src/docs/openapi.ts"),
	`// Generated by scripts/build-openapi.ts (npm run docs:build). Do not edit by hand.\nexport const openApiSpec: Record<string, unknown> = ${JSON.stringify(spec, null, "\t")};\n`,
);
console.log(`openapi.ts: ${ops.length} operations, ${tagSet.size} tags`);

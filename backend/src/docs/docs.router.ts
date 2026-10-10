import { Router } from "express";
import { openApiSpec } from "./openapi";

// Swagger UI, loaded from a CDN so nothing extra is bundled into the API.
const SWAGGER_UI_VERSION = "5.17.14";
const CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${SWAGGER_UI_VERSION}`;

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>University Management System API</title>
<link rel="stylesheet" href="${CDN}/swagger-ui.css" />
</head>
<body>
<div id="swagger-ui"></div>
<script src="${CDN}/swagger-ui-bundle.js"></script>
<script>
window.ui = SwaggerUIBundle({
  url: "/docs/openapi.json",
  dom_id: "#swagger-ui",
  deepLinking: true,
  persistAuthorization: true,
  tryItOutEnabled: true,
});
</script>
</body>
</html>`;

const router = Router();

// Registered before helmet(): this one page needs to load scripts and styles
// from the CDN, so it carries its own, narrower Content-Security-Policy.
router.get("/", (_req, res) => {
	res.setHeader(
		"Content-Security-Policy",
		[
			"default-src 'self'",
			"base-uri 'self'",
			`script-src 'self' 'unsafe-inline' ${CDN}`,
			`style-src 'self' 'unsafe-inline' ${CDN}`,
			"img-src 'self' data: https:",
			"connect-src 'self'",
			"frame-ancestors 'none'",
		].join("; "),
	);
	res.type("html").send(page);
});

router.get("/openapi.json", (_req, res) => {
	res.json(openApiSpec);
});

export const DocsRouter = router;

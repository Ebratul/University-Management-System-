import { defineConfig } from "tsup";

export default defineConfig({
	// src/app.ts is bundled separately (ESM only) for api/index.ts: Vercel's
	// Node runtime transpiles that file per-file rather than fully bundling
	// it, and this project's extensionless/directory relative imports (e.g.
	// "./config") only resolve under a bundler — Node's own ESM loader
	// requires explicit "./config/index.js"-style specifiers and fails with
	// ERR_MODULE_NOT_FOUND/ERR_UNSUPPORTED_DIR_IMPORT otherwise. Importing
	// this single already-bundled file sidesteps that without touching any
	// import in src/.
	entry: ["src/server.ts", "src/app.ts"],
	format: ["esm", "cjs"],
	target: "esnext",
	outDir: "dist",
	clean: true,
	bundle: true,
	splitting: false,
	sourcemap: true,
	dts: true,
	// Add banner to shim require() for CJS dependencies in ESM context
	banner: {
		js: `
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
    `,
	},
});

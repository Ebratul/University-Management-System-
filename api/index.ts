// Import the tsup-bundled build, not raw src/app.ts: Vercel's Node runtime
// transpiles this file per-file instead of bundling, and Node's own ESM
// loader can't resolve src/app.ts's extensionless/directory imports (e.g.
// "./config") the way a bundler does — see tsup.config.ts. That bundle also
// runs validateEnv() at module load (see src/app.ts), so a missing env var
// fails loudly here too instead of surfacing later as a confusing 500.
import app from "../dist/app.js";

export default app;

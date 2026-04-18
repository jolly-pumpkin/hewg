#!/usr/bin/env node
// Pure-JS fallback entry for `npm install -g hewg` on machines where a
// platform-matched native binary from `dist/` is not available. The primary
// distribution is the compiled binary produced by `bun build --compile`.
import("../src/cli.ts").catch((err) => {
  console.error("hewg: failed to load CLI", err);
  process.exit(2);
});

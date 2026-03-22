import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Only measure coverage on files whose logic is unit-testable without a live DB.
      // routes.ts, scheduler.ts, slack-scanner.ts, auth.ts, slack-commands.ts all
      // require a running database / HTTP server and are excluded from unit coverage.
      include: [
        "server/openai.ts",
        "server/lms-integration.ts",
        "server/google-auth.ts",
      ],
    },
  },
});

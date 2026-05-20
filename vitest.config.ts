import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/qa/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/components/**/*.{ts,tsx}",
        "src/hooks/**/*.{ts,tsx}",
        "src/app/api/**/*.ts",
      ],
      exclude: [
        "**/*.d.ts",
        "**/__tests__/**",
        "src/lib/db.ts",
        "src/components/providers/**",
        // Server entry boilerplate / dynamic route shells without business logic
        "src/app/api/**/route.ts.snap",
      ],
      thresholds: {
        lines: 83,
        functions: 90,
        branches: 84,
        statements: 83,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

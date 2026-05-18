import { z } from "zod";

/**
 * Validated, typed environment variables.
 * Imported at the very top of server.ts so it runs before anything else.
 * On validation failure the process exits immediately with a clear message.
 */

const envSchema = z
  .object({
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
    API_PORT: z.coerce.number().int().positive().default(4000),
    CORS_ALLOWED_ORIGINS: z.string().default(""),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    JWT_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && !data.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "JWT_SECRET is required in production",
      });
    }
  });

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`[env] Invalid environment variables:\n${formatted}`);
    process.exit(1);
  }

  const data = result.data;

  if (data.NODE_ENV !== "production" && !data.JWT_SECRET) {
    // eslint-disable-next-line no-console
    console.warn(
      "[env] WARNING: JWT_SECRET not set — using insecure dev-only fallback. " +
        "Never run this in production without a real secret."
    );
    // Deterministic dev-only fallback so health checks and tests still work.
    (data as { JWT_SECRET?: string }).JWT_SECRET =
      "dev-only-insecure-jwt-secret-do-not-use-in-production";
  }

  return data as typeof data & { JWT_SECRET: string };
}

export const env = parseEnv();

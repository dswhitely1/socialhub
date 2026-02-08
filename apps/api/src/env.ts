import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MEILI_URL: z.string().url(),
  MEILI_MASTER_KEY: z.string(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  /** Parsed CORS origins — supports comma-separated values for multi-origin. */
  CORS_ORIGINS: parsed.CORS_ORIGIN.split(",").map((o) => o.trim()),
};

export type Env = typeof env;

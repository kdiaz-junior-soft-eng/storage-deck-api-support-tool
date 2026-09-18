// StorageDeckAPI/src/config/env.ts
import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// 1. Always load .env first
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// 2. Define Schema with strict constraints, defaults, and transformations
const envSchema = z.object({
  // Infrastructure
  MONGODB_URI: z.string().url("MONGODB_URI must be a valid connection string"),
  MONGODB_DATABASE: z.string().min(1, "MONGODB_DATABASE cannot be empty"),
  
  // App Config
  BATCH_DELETE_API_URL: z.string().url("BATCH_DELETE_API_URL must be a valid URL"),
  MAX_DOCUMENTS_PER_BATCH: z.coerce.number().int().positive().default(1000),
  
  // Strict: TARGET_STATUS MUST be explicitly defined in .env
  TARGET_STATUS: z.string().min(1, "TARGET_STATUS must be specified in .env"),
  // Validates ISO date string format (e.g. 2026-07-08T00:00:00Z) and transforms into Date
  TARGET_DATE: z
    .string()
    .datetime({ message: "TARGET_DATE must be a valid ISO-8601 string (e.g., 2026-07-08T00:00:00Z)" })
    .transform((val) => new Date(val)),
  
  // Dry run safely converts string "true"/"false" into boolean
  DRY_RUN: z
    .enum(["true", "false"])
    .default("true")
    .transform((val) => val === "true"),

  // AWS S3 Configuration (optional - only needed for S3 verification)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SESSION_TOKEN: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),

  // JWT claims (Optional at boot, but validated when needed)
  JWT_SECRET: z.string().optional(),
  JWT_SUB: z.string().optional(),
  JWT_TENANT_UUID: z.string().optional(),
  JWT_TENANT_ID: z.string().optional(),
  JWT_SN: z.string().optional(),
  JWT_USER_SRN: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default("5m"),
});

// 3. Handle key alias fallbacks cleanly before parsing
const rawEnv = {
  ...process.env,
  MONGODB_DATABASE: process.env.MONGODB_DATABASE,
};

// 4. Fail Fast at Boot: If required env vars are missing, halt application startup immediately
const parseEnv = () => {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    console.error("❌ Invalid environment variables detected:\n");
    console.error(result.error.flatten().fieldErrors);
    throw new Error("Fatal: Invalid environment configuration.");
  }

  return result.data;
};

// 5. Export immutable, fully-typed environment object
export const env = parseEnv();

// StorageDeckAPI/src/config/env.ts

/**
 * Validates JWT requirements if no static BEARER_TOKEN is provided.
 */
export function validateJwtEnv(): void {

  const jwtSchema = z.object({
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    JWT_SUB: z.string().min(1, "JWT_SUB is required"),
    JWT_TENANT_UUID: z.string().min(1, "JWT_TENANT_UUID is required"),
    JWT_TENANT_ID: z.string().min(1, "JWT_TENANT_ID is required"),
    JWT_SN: z.string().min(1, "JWT_SN is required"),
    JWT_USER_SRN: z.string().min(1, "JWT_USER_SRN is required"),
  });

  const result = jwtSchema.safeParse(env);

  if (!result.success) {
    console.error("❌ Missing required JWT configuration:\n");
    console.error(result.error.flatten().fieldErrors);
    throw new Error("Invalid JWT configuration.");
  }
}
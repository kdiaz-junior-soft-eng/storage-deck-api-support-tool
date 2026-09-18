// StorageDeckAPI/src/services/s3Service.ts
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env";

let s3Client: S3Client | null = null;

/**
 * Validates that AWS credentials are configured.
 */
export function validateAwsConfig(): void {
  if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    throw new Error(
      "AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env"
    );
  }
}

/**
 * Gets or creates the S3 client singleton.
 */
function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  validateAwsConfig();

  s3Client = new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      sessionToken: env.AWS_SESSION_TOKEN,
    },
  });

  return s3Client;
}

export interface S3FileCheckResult {
  bucket: string;
  key: string;
  exists: boolean;
  error?: string;
}

/**
 * Checks if a file exists in S3 using HeadObject (read-only, no download).
 */
export async function checkFileExistsInS3(
  bucket: string,
  key: string
): Promise<S3FileCheckResult> {
  const client = getS3Client();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return { bucket, key, exists: true };
  } catch (error: any) {
    // NotFound means the file doesn't exist
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return { bucket, key, exists: false };
    }

    // Other errors (permissions, network, etc.)
    const errorMessage = error.$metadata?.httpStatusCode 
      ? `HTTP ${error.$metadata.httpStatusCode}: ${error.name || error.Code || "Unknown"}`
      : error.name || error.Code || error.message || "Unknown";
    
    return {
      bucket,
      key,
      exists: false,
      error: errorMessage,
    };
  }
}

export interface S3BatchCheckResult {
  totalChecked: number;
  existsCount: number;
  missingCount: number;
  errorCount: number;
  results: S3FileCheckResult[];
  missingFiles: S3FileCheckResult[];
  errorFiles: S3FileCheckResult[];
}

/**
 * Checks multiple files in S3 with concurrency control.
 */
export async function checkFilesExistInS3(
  files: Array<{ bucket: string; key: string }>,
  concurrency: number = 10
): Promise<S3BatchCheckResult> {
  const results: S3FileCheckResult[] = [];

  // Process in batches to control concurrency
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((file) => checkFileExistsInS3(file.bucket, file.key))
    );
    results.push(...batchResults);
  }

  const existsCount = results.filter((r) => r.exists).length;
  const missingFiles = results.filter((r) => !r.exists && !r.error);
  const errorFiles = results.filter((r) => r.error);

  return {
    totalChecked: results.length,
    existsCount,
    missingCount: missingFiles.length,
    errorCount: errorFiles.length,
    results,
    missingFiles,
    errorFiles,
  };
}

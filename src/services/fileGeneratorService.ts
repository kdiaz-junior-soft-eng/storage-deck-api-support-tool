// StorageDeckAPI/src/services/fileGeneratorService.ts
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export interface GeneratedFileInfo {
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  content: string;
}

export interface GenerateFileOptions {
  prefix?: string;
  outputDir?: string;
  customContent?: string;
}

/**
 * Ensures the target output directory exists before generating files.
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Generates a dummy .txt file in a dedicated subfolder with a unique timestamp/hash
 * to prevent overwrites when re-uploading to StorageDeck.
 */
export async function generateTestTxtFile(
  options: GenerateFileOptions = {}
): Promise<GeneratedFileInfo> {
  const {
    prefix = "test_doc",
    // Dedicated folder inside the project root to keep things clean
    outputDir = path.join(process.cwd(), "temp_test_files"),
    customContent,
  } = options;

  // 1. Create the target directory if it doesn't exist
  await ensureDirectoryExists(outputDir);

  // 2. Build unique filename: <prefix>_<timestamp>_<hash>.txt
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const randomHash = crypto.randomBytes(3).toString("hex");
  const fileName = `${prefix}_${timestamp}_${randomHash}.txt`;
  const filePath = path.join(outputDir, fileName);

  // 3. Minimal test content payload
  const content = customContent || `StorageDeck Test Payload | Generated: ${new Date().toISOString()} | Ref: ${randomHash}`;

  // 4. Write file into the designated folder
  await fs.writeFile(filePath, content, "utf-8");
  const stats = await fs.stat(filePath);

  return {
    fileName,
    filePath,
    fileSizeBytes: stats.size,
    content,
  };
}

/**
 * Helper to generate multiple isolated test files at once.
 */
export async function generateBatchTestTxtFiles(
  count: number,
  options: GenerateFileOptions = {}
): Promise<GeneratedFileInfo[]> {
  const filePromises = Array.from({ length: count }, (_, i) =>
    generateTestTxtFile({
      ...options,
      prefix: `${options.prefix || "batch_doc"}_${i + 1}`,
    })
  );

  return Promise.all(filePromises);
}
// StorageDeckAPI/src/services/batchPlannerService.ts
import * as fs from "fs";
import * as path from "path";
import { env } from "../config/env";
import { 
  countDocumentsBeforeDate, 
  countNonStoredDocumentsBeforeDate, 
  getNextBatchAfterDate, 
  getNextBatchForNonStored, 
  getStorageDeckErrorDocuments,
  countDocumentsForBatchStore,
  countDocumentsMissingRequiredFields,
  getDocumentsMissingRequiredFields,
  getNextBatchForStore,
  BATCH_STORE_STATUSES,
  StorageDeckDocument,
  StorageDeckFileDetail
} from "../database/repositories/storageDeckRepository";

export interface BatchPlanWindow {
  batchNumber: number;
  count: number;
  windowStart: Date;
  windowEnd: Date;
  dateFilter: string; // ISO string with +1ms adjustment for $lt
  lastDoc: StorageDeckDocument;
}

export interface BatchPlanSummary {
  totalInScope: number;
  totalBatches: number;
  totalMapped: number;
  batches: BatchPlanWindow[];
}

export async function generateBatchDeletePlan(
  batchSize: number = 1000,
  status: string = env.TARGET_STATUS,
  targetCutoffDate: Date = env.TARGET_DATE
): Promise<BatchPlanSummary> {
  const totalInScope = await countDocumentsBeforeDate(targetCutoffDate, status);

  if (totalInScope === 0) {
    return {
      totalInScope: 0,
      totalBatches: 0,
      totalMapped: 0,
      batches: []
    };
  }

  const batches: BatchPlanWindow[] = [];
  let processedCount = 0;
  let batchNumber = 1;
  let lastDoc: StorageDeckDocument | undefined = undefined;

  while (true) {
    const batch: StorageDeckDocument[] = await getNextBatchAfterDate(
      batchSize,
      status,
      targetCutoffDate,
      lastDoc
    );

    if (batch.length === 0) break;

    const windowStart = new Date(batch[0].createdOn);
    const windowEnd = new Date(batch[batch.length - 1].createdOn);
    
    // Add +1ms for $lt filter boundary
    const dateFilter = new Date(windowEnd.getTime() + 1).toISOString();
    const currentLastDoc = batch[batch.length - 1];

    batches.push({
      batchNumber,
      count: batch.length,
      windowStart,
      windowEnd,
      dateFilter,
      lastDoc: currentLastDoc
    });

    lastDoc = currentLastDoc;
    processedCount += batch.length;
    batchNumber++;
  }

  return {
    totalInScope,
    totalBatches: batches.length,
    totalMapped: processedCount,
    batches
  };
}

export async function generateFullNonStoredDeletePlan(
  batchSize: number = 1000,
  targetCutoffDate: Date = new Date() 
): Promise<BatchPlanSummary> {
  // Count total non-STORED documents up to current moment
  const totalInScope = await countNonStoredDocumentsBeforeDate(targetCutoffDate);

  if (totalInScope === 0) {
    return { totalInScope: 0, totalBatches: 0, totalMapped: 0, batches: [] };
  }

  const batches: BatchPlanWindow[] = [];
  let processedCount = 0;
  let batchNumber = 1;
  let lastDoc: StorageDeckDocument | undefined = undefined;

  while (true) {
    const batch = await getNextBatchForNonStored(batchSize, targetCutoffDate, lastDoc);

    if (!batch || batch.length === 0) break;

    const windowStart = new Date(batch[0].createdOn);
    const windowEnd = new Date(batch[batch.length - 1].createdOn);
    const dateFilter = new Date(windowEnd.getTime() + 1).toISOString();
    const currentLastDoc = batch[batch.length - 1];

    batches.push({
      batchNumber,
      count: batch.length,
      windowStart,
      windowEnd,
      dateFilter,
      lastDoc: currentLastDoc
    });

    lastDoc = currentLastDoc;
    processedCount += batch.length;
    batchNumber++;
  }

  return {
    totalInScope,
    totalBatches: batches.length,
    totalMapped: processedCount,
    batches
  };
}


export interface CsvExportResult {
  filePath: string;
  recordCount: number;
  documents: StorageDeckFileDetail[];
}

/**
 * Escapes a string value for CSV format.
 * Handles quotes, commas, and newlines.
 */
function escapeCsvValue(value: string | undefined | null): string {
  if (value === undefined || value === null) {
    return '""';
  }
  // Escape double quotes by doubling them, then wrap in quotes
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Fetches stored documents with errors and exports them to a CSV file.
 * Read-only operation - no database updates.
 */
export async function exportStoredDocumentsWithErrorsToCsv(
  outputDir: string = "/tmp",
  status: string = "STORED"
): Promise<CsvExportResult> {
  // Fetch documents from database (read-only)
  const documents = await getStorageDeckErrorDocuments(status);

  // Build CSV content with all details
  const headerLine = "filename,recipient,errorMessage,createdOn,s3Key,s3Bucket";
  
  const dataLines = documents.map((doc) => {
    const filename = escapeCsvValue(doc.name);
    const recipient = escapeCsvValue(doc.recipientName);
    const errorMessage = escapeCsvValue(
      doc.errorMessages 
        ? (Array.isArray(doc.errorMessages) 
            ? doc.errorMessages[0]?.message || "No error message recorded"
            : doc.errorMessages.message || "No error message recorded")
        : "No error message recorded"
    );
    const createdOn = escapeCsvValue(
      doc.createdOn ? new Date(doc.createdOn).toISOString() : ""
    );
    const s3Key = escapeCsvValue(doc.s3Key);
    const s3Bucket = escapeCsvValue(doc.s3Bucket);

    return `${filename},${recipient},${errorMessage},${createdOn},${s3Key},${s3Bucket}`;
  });

  const csvContent = [headerLine, ...dataLines].join("\n");

  // Generate output file path with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `stored_with_errors_${timestamp}.csv`;
  const filePath = path.join(outputDir, fileName);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to file
  fs.writeFileSync(filePath, csvContent, "utf-8");

  return {
    filePath,
    recordCount: documents.length,
    documents
  };
}

export interface SqlFilenameExportResult {
  filePath: string;
  recordCount: number;
  filenames: string[];
}

/**
 * Exports filenames (without extension) wrapped in quotes for use in SQL queries.
 * Output format: "filename1", "filename2", ...
 * Read-only operation - no database updates.
 */
export async function exportFilenamesForSqlQuery(
  outputDir: string = "/tmp",
  status: string = "STORED"
): Promise<SqlFilenameExportResult> {
  // Fetch documents from database (read-only)
  const documents = await getStorageDeckErrorDocuments(status);

  // Extract filenames without extension, wrapped in quotes
  const filenames = documents.map((doc) => {
    const name = doc.name || "";
    // Remove file extension (e.g., .pdf, .txt)
    const lastDotIndex = name.lastIndexOf(".");
    const nameWithoutExt = lastDotIndex > 0 ? name.substring(0, lastDotIndex) : name;
    return `"${nameWithoutExt}"`;
  });

  // Generate output file path with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `filenames_for_sql_${timestamp}.txt`;
  const filePath = path.join(outputDir, fileName);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write filenames, one per line
  fs.writeFileSync(filePath, filenames.join("\n"), "utf-8");

  return {
    filePath,
    recordCount: filenames.length,
    filenames
  };
}


// ============================================================================
// BATCH STORE SERVICE FUNCTIONS
// ============================================================================

export interface BatchStorePlanSummary {
  totalInScope: number;
  totalBatches: number;
  totalMapped: number;
  batches: BatchPlanWindow[];
}

export interface BatchStoreValidationResult {
  isValid: boolean;
  totalErrorDocuments: number;
  documentsMissingFields: number;
  missingFieldsSample: StorageDeckFileDetail[];
  message: string;
}

/**
 * Generates a batch store plan for error documents, similar to batch delete plan.
 * Targets documents with status ERROR, STORE_ERROR, or FOR_VALIDATION.
 */
export async function generateBatchStorePlan(
  batchSize: number = 1000,
  targetCutoffDate: Date = new Date()
): Promise<BatchStorePlanSummary> {
  const totalInScope = await countDocumentsForBatchStore(targetCutoffDate);

  if (totalInScope === 0) {
    return {
      totalInScope: 0,
      totalBatches: 0,
      totalMapped: 0,
      batches: [],
    };
  }

  const batches: BatchPlanWindow[] = [];
  let processedCount = 0;
  let batchNumber = 1;
  let lastDoc: StorageDeckDocument | undefined = undefined;

  while (true) {
    const batch = await getNextBatchForStore(
      batchSize,
      targetCutoffDate,
      BATCH_STORE_STATUSES,
      lastDoc
    );

    if (!batch || batch.length === 0) break;

    const windowStart = new Date(batch[0].createdOn);
    const windowEnd = new Date(batch[batch.length - 1].createdOn);

    // Add +1ms for $lt filter boundary
    const dateFilter = new Date(windowEnd.getTime() + 1).toISOString();
    const currentLastDoc = batch[batch.length - 1];

    batches.push({
      batchNumber,
      count: batch.length,
      windowStart,
      windowEnd,
      dateFilter,
      lastDoc: currentLastDoc,
    });

    lastDoc = currentLastDoc;
    processedCount += batch.length;
    batchNumber++;
  }

  return {
    totalInScope,
    totalBatches: batches.length,
    totalMapped: processedCount,
    batches,
  };
}

/**
 * Validates that all error documents have required fields before batch store.
 * Checks recipient, folder, and category fields.
 * Returns validation result with details about any missing fields.
 */
export async function validateBatchStoreReadiness(): Promise<BatchStoreValidationResult> {
  const totalErrorDocuments = await countDocumentsForBatchStore(new Date());
  const documentsMissingFields = await countDocumentsMissingRequiredFields();

  const isValid = documentsMissingFields === 0;

  let missingFieldsSample: StorageDeckFileDetail[] = [];
  if (!isValid) {
    missingFieldsSample = await getDocumentsMissingRequiredFields(10);
  }

  const message = isValid
    ? `✅ All ${totalErrorDocuments} error documents have required fields. Ready for batch store.`
    : `❌ ${documentsMissingFields} of ${totalErrorDocuments} documents are missing required fields (recipient, folder, or category).`;

  return {
    isValid,
    totalErrorDocuments,
    documentsMissingFields,
    missingFieldsSample,
    message,
  };
}


// ============================================================================
// S3 VERIFICATION SERVICE FUNCTIONS
// ============================================================================

import { checkFilesExistInS3, S3BatchCheckResult, validateAwsConfig } from "./s3Service";

export interface S3VerificationResult {
  totalDocuments: number;
  documentsWithS3Info: number;
  documentsWithoutS3Info: number;
  s3CheckResult: S3BatchCheckResult;
  missingInS3: Array<{
    filename: string;
    s3Bucket: string;
    s3Key: string;
  }>;
}

/**
 * Verifies that all stored documents with errors actually exist in S3.
 * Read-only operation - only checks file existence using HeadObject.
 */
export async function verifyStoredDocumentsInS3(
  concurrency: number = 10
): Promise<S3VerificationResult> {
  // Validate AWS config before starting
  validateAwsConfig();

  // Fetch documents from database
  const documents = await getStorageDeckErrorDocuments();

  // Filter documents that have S3 info
  const docsWithS3Info = documents.filter(
    (doc) => doc.s3Bucket && doc.s3Key
  );
  const docsWithoutS3Info = documents.filter(
    (doc) => !doc.s3Bucket || !doc.s3Key
  );

  // Prepare files for S3 check
  const filesToCheck = docsWithS3Info.map((doc) => ({
    bucket: doc.s3Bucket!,
    key: doc.s3Key!,
    filename: doc.name,
  }));

  // Check files in S3
  const s3CheckResult = await checkFilesExistInS3(
    filesToCheck.map((f) => ({ bucket: f.bucket, key: f.key })),
    concurrency
  );

  // Map missing files back to document info
  const missingInS3 = s3CheckResult.missingFiles.map((missing) => {
    const doc = filesToCheck.find(
      (f) => f.bucket === missing.bucket && f.key === missing.key
    );
    return {
      filename: doc?.filename || "unknown",
      s3Bucket: missing.bucket,
      s3Key: missing.key,
    };
  });

  return {
    totalDocuments: documents.length,
    documentsWithS3Info: docsWithS3Info.length,
    documentsWithoutS3Info: docsWithoutS3Info.length,
    s3CheckResult,
    missingInS3,
  };
}

// StorageDeckAPI/test/verifyS3FilesTest.ts
import * as fs from "fs";
import * as path from "path";
import { verifyStoredDocumentsInS3 } from "../src/services/storageDeckService";

/**
 * Simple zero-dependency CLI spinner helper.
 */
function createSpinner(message: string) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let index = 0;

  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[index]} ${message}`);
    index = (index + 1) % frames.length;
  }, 80);

  return {
    stop: (finalMessage?: string) => {
      clearInterval(interval);
      process.stdout.write("\r\x1b[K");
      if (finalMessage) {
        console.log(finalMessage);
      }
    },
  };
}

async function testVerifyS3Files() {
  console.log("🔄 Starting S3 File Verification for Stored Documents with Errors...\n");
  console.log("📋 Target documents:");
  console.log("   - _class: StorageDeck");
  console.log("   - source: SF_ONBOARDING");
  console.log("   - status: STORED");
  console.log("   - errorMessages: exists and not null\n");

  const CONCURRENCY = 20; // Number of parallel S3 checks
  console.log(`⚙️  Concurrency: ${CONCURRENCY} parallel requests\n`);

  try {
    const startTime = Date.now();
    const spinner = createSpinner("Verifying files in S3, please wait...");

    const result = await verifyStoredDocumentsInS3(CONCURRENCY);

    spinner.stop("✅ S3 verification complete!\n");

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("------------------------------------------------------------------------------------------------------------------");
    console.log("📊 S3 VERIFICATION SUMMARY");
    console.log("------------------------------------------------------------------------------------------------------------------");
    console.log(`Total Documents in MongoDB    : ${result.totalDocuments}`);
    console.log(`Documents with S3 Info        : ${result.documentsWithS3Info}`);
    console.log(`Documents without S3 Info     : ${result.documentsWithoutS3Info}`);
    console.log("");
    console.log(`Files Found in S3             : ${result.s3CheckResult.existsCount}`);
    console.log(`Files Missing in S3           : ${result.s3CheckResult.missingCount}`);
    console.log(`Files with Check Errors       : ${result.s3CheckResult.errorCount}`);
    console.log(`Execution Duration            : ${durationSec}s`);

    // Report missing files
    if (result.missingInS3.length > 0) {
      console.log("\n------------------------------------------------------------------------------------------------------------------");
      console.log("❌ FILES MISSING IN S3");
      console.log("------------------------------------------------------------------------------------------------------------------\n");

      // Show first 20 missing files
      const displayMissing = result.missingInS3.slice(0, 20);
      displayMissing.forEach((file, index) => {
        console.log(`[${index + 1}] ${file.filename}`);
        console.log(`    Bucket: ${file.s3Bucket}`);
        console.log(`    Key   : ${file.s3Key}\n`);
      });

      if (result.missingInS3.length > 20) {
        console.log(`... and ${result.missingInS3.length - 20} more missing files`);
      }

      // Export missing files to CSV
      const outputDir = path.resolve(__dirname, "../exports");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const csvPath = path.join(outputDir, `missing_in_s3_${timestamp}.csv`);
      
      const csvHeader = "filename,s3Bucket,s3Key";
      const csvLines = result.missingInS3.map(
        (f) => `"${f.filename}","${f.s3Bucket}","${f.s3Key}"`
      );
      fs.writeFileSync(csvPath, [csvHeader, ...csvLines].join("\n"), "utf-8");

      console.log(`\n📁 Missing files exported to: ${csvPath}`);
    }

    // Report error files
    if (result.s3CheckResult.errorFiles.length > 0) {
      console.log("\n------------------------------------------------------------------------------------------------------------------");
      console.log("⚠️  FILES WITH S3 CHECK ERRORS");
      console.log("------------------------------------------------------------------------------------------------------------------\n");

      result.s3CheckResult.errorFiles.slice(0, 10).forEach((file, index) => {
        console.log(`[${index + 1}] Bucket: ${file.bucket}`);
        console.log(`    Key   : ${file.key}`);
        console.log(`    Error : ${file.error}\n`);
      });
    }

    // Final status
    console.log("\n------------------------------------------------------------------------------------------------------------------");
    if (result.s3CheckResult.missingCount === 0 && result.s3CheckResult.errorCount === 0) {
      console.log("✅ SUCCESS: All files exist in S3!");
    } else {
      console.log(`⚠️  WARNING: ${result.s3CheckResult.missingCount} files missing, ${result.s3CheckResult.errorCount} errors`);
    }
    console.log("------------------------------------------------------------------------------------------------------------------");

    process.exit(result.s3CheckResult.missingCount === 0 ? 0 : 1);
  } catch (error) {
    console.error("\n❌ Error during S3 verification:", error);
    process.exit(1);
  }
}

testVerifyS3Files();

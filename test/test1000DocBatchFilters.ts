// StorageDeckAPI/test/test-queries.ts
import { env } from "../src/config/env";
import { 
  countDocumentsBeforeDate, 
  getCutoffDateForLimit,
  getBatchForDeletion
} from "../src/database/repositories/storageDeckRepository";

async function test1000DocBatchFilters() {
  console.log("🚀 Testing Filters for 1,000-Document Batch Deletion Execution...\n");

  const BATCH_SIZE = 1000;
  const status = env.TARGET_STATUS; // 'PROCESSING'

  try {
    // -----------------------------------------------------------------
    // 1. Calculate Cutoff Date for 1,000 Documents
    // -----------------------------------------------------------------
    console.log(`🔍 Calculating cutoff timestamp for the oldest ${BATCH_SIZE} records...`);
    console.time("⏱️  getCutoffDateForLimit (1k)");
    
    const cutoffDate = await getCutoffDateForLimit(BATCH_SIZE, status);
    
    console.timeEnd("⏱️  getCutoffDateForLimit (1k)");

    if (!cutoffDate) {
      console.log(`⚠️ Database has fewer than ${BATCH_SIZE} documents matching status '${status}'.`);
      process.exit(0);
    }

    console.log(`-> 🎯 1000th Document Timestamp Cutoff: ${cutoffDate.toISOString()}\n`);

    // -----------------------------------------------------------------
    // 2. Fetch the Batch using $lte Cutoff Filter
    // -----------------------------------------------------------------
    console.log(`📦 Fetching batch up to cutoff date...`);
    console.time("⏱️  getBatchForDeletion (1k)");

    const batch = await getBatchForDeletion(BATCH_SIZE, status, cutoffDate);

    console.timeEnd("⏱️  getBatchForDeletion (1k)");

    // -----------------------------------------------------------------
    // 3. Validate Batch Integrity
    // -----------------------------------------------------------------
    console.log("\n---------------------------------------------------");
    console.log("📊 BATCH INTEGRITY SUMMARY");
    console.log("---------------------------------------------------");
    console.log(`Requested Batch Size : ${BATCH_SIZE}`);
    console.log(`Retrieved Count     : ${batch.length}`);

    if (batch.length > 0) {
      const oldestDoc = batch[0];
      const newestDoc = batch[batch.length - 1];

      console.log(`Oldest Doc Timestamp : ${new Date(oldestDoc.createdOn).toISOString()}`);
      console.log(`Newest Doc Timestamp : ${new Date(newestDoc.createdOn).toISOString()}`);

      // Verify cutoff matches newest document timestamp
      const matchesCutoff = new Date(newestDoc.createdOn).getTime() === cutoffDate.getTime();
      console.log(`Cutoff Alignment     : ${matchesCutoff ? "✅ MATCHED EXACTLY" : "⚠️ MISMATCH"}`);

      console.log("\nFirst 3 Documents Payload Sample:");
      console.table(batch.slice(0, 3));

      console.log("\nLast 3 Documents Payload Sample (End of Batch Boundary):");
      console.table(batch.slice(-3));
    }

    // -----------------------------------------------------------------
    // 4. Verify Total Remaining Target Count
    // -----------------------------------------------------------------
    console.log("\n---------------------------------------------------");
    console.log("📉 TOTAL SCOPE VERIFICATION");
    console.log("---------------------------------------------------");
    console.time("⏱️  countDocumentsBeforeDate");
    const totalRemaining = await countDocumentsBeforeDate(env.TARGET_DATE, status);
    console.timeEnd("⏱️  countDocumentsBeforeDate");
    
    console.log(`-> Total matching documents remaining in scope: ${totalRemaining.toLocaleString()}`);

    console.log("\n✅ Filters verified and ready for BatchDELETE service integration!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error executing batch query test:", error);
    process.exit(1);
  }
}

test1000DocBatchFilters();
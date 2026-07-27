// StorageDeckAPI/test/checkActiveProcessingBatchesTest.ts
import { connectMongoDB } from "../src/database";
import { auditBatchStatus } from "../src/services";

/**
 * Animated terminal spinner helper for async database operations.
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
      process.stdout.write("\r\x1b[K"); // Clear spinner line
      if (finalMessage) {
        console.log(finalMessage);
      }
    },
  };
}

async function checkActiveProcessingBatchesTest() {
  console.log("🔍 System Safety Check: Inspecting batch operations...\n");

  await connectMongoDB();

  const spinner = createSpinner("Querying batch_collection metrics via BatchService...");
  
  // Delegated to the business service layer
  const audit = await auditBatchStatus();

  spinner.stop("✅ Batch status check completed.\n");

  // 1. High-Level Summary Output
  console.log("📊 BATCH OVERVIEW SUMMARY");
  console.log("------------------------------------------------------------------------------------------------------------------");
  if (audit.summaries.length === 0) {
    console.log("ℹ️  No batch records found matching target statuses.");
  } else {
    for (const s of audit.summaries) {
      const remaining = s.totalRecords - s.totalCompletedRecords;
      const pct = s.totalRecords > 0 ? ((s.totalCompletedRecords / s.totalRecords) * 100).toFixed(1) : "0.0";
      const statusIcon = s.status === "PROCESSING" ? "⏳" : s.status === "DONE" ? "✅" : "❌";

      console.log(`${statusIcon} Status: ${s.status.padEnd(10)} | Type: ${s.batchType.padEnd(8)} | Batches: ${s.totalBatches}`);
      console.log(`   Progress   : ${s.totalCompletedRecords.toLocaleString()} / ${s.totalRecords.toLocaleString()} (${pct}%)`);
      console.log(`   Remaining  : ${remaining.toLocaleString()} records`);
      console.log(`   Errors     : ${s.totalErrorRecords.toLocaleString()}`);
      console.log(`   Window     : ${new Date(s.earliestExecution).toISOString()} ➔ ${new Date(s.latestExecution).toISOString()}`);
      console.log("------------------------------------------------------------------------------------------------------------------");
    }
  }

  // 2. Active Processing Safety Decision
  if (audit.isSafeToRun) {
    console.log("\n✅ SAFETY CHECK PASSED: No active batches are currently PROCESSING.");
    console.log("👉 It is safe to trigger the next batch API execution.\n");
    process.exit(0);
  }

  console.log(`\n⚠️  ATTENTION: Found ${audit.activeBatchesCount} active batch job(s) in progress!\n`);
  console.log("------------------------------------------------------------------------------------------------------------------");

  for (const b of audit.activeBatches) {
    const total = b.totalRecordCount || 0;
    const done = b.doneRunningCount || 0;
    const errors = b.errorRunningCount || 0;
    const pct = total > 0 ? ((done / total) * 100).toFixed(1) : "0.0";

    console.log(`📌 Batch SRN        : ${b.batchSrn}`);
    console.log(`   Type             : ${b.batchType}`);
    console.log(`   Status           : ⏳ ${b.status}`);
    console.log(`   Progress         : ${done.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`);
    console.log(`   Errors           : ${errors}`);
    console.log(`   Executed On      : ${new Date(b.executedOn).toISOString()}`);
    console.log("------------------------------------------------------------------------------------------------------------------");
  }

  console.log("\n🛑 STATUS: BUSY");
  console.log("👉 Please wait for all current batches to complete before executing the next batch window.\n");

  process.exit(0);
}

checkActiveProcessingBatchesTest();
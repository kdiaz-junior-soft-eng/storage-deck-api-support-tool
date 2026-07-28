// StorageDeckAPI/test/test-batch-non-stored-loop.ts
import { env } from "../src/config/env";
import { generateFullNonStoredDeletePlan } from "../src/services/storageDeckService";

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
      process.stdout.write("\r\x1b[K"); // Clear active spinner line
      if (finalMessage) {
        console.log(finalMessage);
      }
    },
  };
}

async function runNonStoredBatchProcessorTest() {
  console.log("🔄 Starting Full Non-STORED Purge Mapping Test...\n");

  const BATCH_SIZE = env.MAX_DOCUMENTS_PER_BATCH;
  // Snapshot exact current moment as frozen cutoff ceiling date
  const targetCutoffDate = new Date();

  console.log(`Global Target Ceiling Date : ${targetCutoffDate.toISOString()}`);
  console.log(`Target Status Scope        : ALL (status != 'STORED')`);
  console.log(`Batch Limit                : ${BATCH_SIZE}\n`);

  const startTime = Date.now();

  const spinner = createSpinner("Mapping non-STORED document batch windows from database, please wait...");

  // 1. Calculate full non-STORED batch plan
  const plan = await generateFullNonStoredDeletePlan(BATCH_SIZE, targetCutoffDate);

  spinner.stop("✅ Non-STORED batch mapping calculation complete!\n");

  console.log(`📊 Total matching non-STORED documents in scope: ${plan.totalInScope.toLocaleString()}\n`);

  if (plan.totalInScope === 0) {
    console.log("✨ No non-STORED documents match the target criteria. Exiting early.");
    process.exit(0);
  }

  console.log("------------------------------------------------------------------------------------------------------------------");
  console.log("🚀 MAPPING NON-STORED BATCH DATE FILTERS FOR API PAYLOAD");
  console.log("------------------------------------------------------------------------------------------------------------------\n");

  // 2. Render output logs
  for (const b of plan.batches) {
    console.log(
      `📦 Batch #${b.batchNumber.toString().padStart(3, "0")} | ` +
      `Docs: ${b.count.toString().padStart(4, " ")} | ` +
      `Window: ${b.windowStart.toISOString()} ➔ ${b.windowEnd.toISOString()} | ` +
      `dateFilter: ${b.dateFilter}`
    );
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n------------------------------------------------------------------------------------------------------------------");
  console.log("🏁 NON-STORED QUEUE MAPPING COMPLETE");
  console.log("------------------------------------------------------------------------------------------------------------------");
  console.log(`Total Batches Required   : ${plan.totalBatches}`);
  console.log(`Total Documents Mapped   : ${plan.totalMapped.toLocaleString()} / ${plan.totalInScope.toLocaleString()}`);
  console.log(`Execution Duration       : ${durationSec}s`);

  if (plan.totalMapped === plan.totalInScope) {
    console.log("\n✅ SUCCESS: All non-STORED batch windows mapped cleanly!");
  } else {
    console.log(`\n⚠️ NOTICE: Mapped count (${plan.totalMapped}) differs from initial snapshot count (${plan.totalInScope}) due to live document writes during execution.`);
  }

  process.exit(0);
}

runNonStoredBatchProcessorTest();
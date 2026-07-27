// StorageDeckAPI/test/test-batch-processor-loop.ts
import { env } from "../src/config/env";
import { generateBatchDeletePlan } from "../src/services/storageDeckService";

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
      process.stdout.write("\r\x1b[K"); // Clear the active spinner line
      if (finalMessage) {
        console.log(finalMessage); // Clean console log with implicit newline
      }
    },
  };
}

async function runBatchProcessorLoopTest() {
  console.log("🔄 Starting Full Batch Window Mapping Test...\n");

  const BATCH_SIZE = env.MAX_DOCUMENTS_PER_BATCH;
  const status = env.TARGET_STATUS;
  const targetCutoffDate = env.TARGET_DATE;

  console.log(`Global Target Date : ${targetCutoffDate.toISOString()}`);
  console.log(`Target Status      : ${status}`);
  console.log(`Batch Limit        : ${BATCH_SIZE}\n`);

  const startTime = Date.now();

  // Start spinner prompt while fetching/calculating batches from MongoDB
  const spinner = createSpinner("Mapping document batch windows from database, please wait...");

  // 1. Calculate the entire batch plan using extracted service
  const plan = await generateBatchDeletePlan(BATCH_SIZE, status, targetCutoffDate);

  // Stop spinner when calculation completes
  spinner.stop("✅ Batch mapping calculation complete!\n");

  console.log(`📊 Total matching documents in scope: ${plan.totalInScope.toLocaleString()}\n`);

  if (plan.totalInScope === 0) {
    console.log("✨ No documents match the target criteria. Exiting early.");
    process.exit(0);
  }

  console.log("------------------------------------------------------------------------------------------------------------------");
  console.log("🚀 MAPPING BATCH DATE FILTERS FOR API PAYLOAD");
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
  console.log("🏁 FULL QUEUE MAPPING COMPLETE");
  console.log("------------------------------------------------------------------------------------------------------------------");
  console.log(`Total Batches Required   : ${plan.totalBatches}`);
  console.log(`Total Documents Mapped   : ${plan.totalMapped.toLocaleString()} / ${plan.totalInScope.toLocaleString()}`);
  console.log(`Execution Duration       : ${durationSec}s`);

  if (plan.totalMapped === plan.totalInScope) {
    console.log("\n✅ SUCCESS: All dateFilters mapped cleanly for API execution!");
  }

  process.exit(0);
}

runBatchProcessorLoopTest();
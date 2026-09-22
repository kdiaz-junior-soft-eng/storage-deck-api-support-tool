// StorageDeckAPI/test/generateBatchStorePlanTest.ts
import { env } from "../src/config/env";
import { select } from "@inquirer/prompts";
import { generateBatchStorePlan, validateBatchStoreReadiness } from "../src/services/storageDeckService";
import { getDistinctSources, getDistinctStatusesWithCounts } from "../src/database/repositories/storageDeckRepository";

/**
 * Checks if a status should be excluded from processing.
 * Excludes: STORED and any status containing "PROCESSING" (locked by other operations)
 */
function isExcludedStatus(status: string): boolean {
  return status === "STORED" || status.includes("PROCESSING");
}

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

async function testGenerateBatchStorePlan() {
  console.log("🔄 Batch Store Plan Generator\n");

  try {
    // Fetch distinct sources from database
    console.log("📡 Fetching available sources from database...");
    const dbSources = await getDistinctSources();
    
    const sourceOptions = [
      { name: "All Sources", value: "ALL", description: "All document sources" },
      ...dbSources.map((source) => ({
        name: source,
        value: source,
        description: `${source} documents`,
      })),
    ];
    
    console.log(`   Found ${dbSources.length} source(s): ${dbSources.join(", ")}`);

    // Fetch distinct statuses from database
    console.log("📡 Fetching available statuses from database...");
    const dbStatuses = await getDistinctStatusesWithCounts();
    
    // Calculate total for "processable" statuses (excluding STORED and *PROCESSING*)
    const processableCount = dbStatuses
      .filter((s) => !isExcludedStatus(s.status))
      .reduce((sum, s) => sum + s.count, 0);

    // Get list of excluded statuses for display
    const excludedStatusNames = dbStatuses
      .filter((s) => isExcludedStatus(s.status))
      .map((s) => s.status);

    // Build status options dynamically
    const statusOptions = [
      { 
        name: `All Processable (${processableCount.toLocaleString()} docs)`, 
        value: "NOT_STORED", 
        description: `All statuses except ${excludedStatusNames.join(", ") || "STORED, *PROCESSING*"}` 
      },
      ...dbStatuses.map((s) => ({
        name: `${s.status} (${s.count.toLocaleString()} docs)`,
        value: s.status,
        description: isExcludedStatus(s.status) 
          ? `${s.status} - cannot be processed` 
          : `${s.count.toLocaleString()} documents`,
      })),
    ];

    console.log(`   Found ${dbStatuses.length} status(es):`);
    dbStatuses.forEach((s) => {
      const marker = isExcludedStatus(s.status) ? "🔒" : "  ";
      console.log(`   ${marker} ${s.status}: ${s.count.toLocaleString()}`);
    });
    console.log("");

    // CLI selections
    const selectedStatus = await select({
      message: "Select document status:",
      choices: statusOptions,
    });

    const selectedSource = await select({
      message: "Select document source:",
      choices: sourceOptions,
    });

    const BATCH_SIZE = env.MAX_DOCUMENTS_PER_BATCH;
    const targetCutoffDate = new Date(); // Current date as cutoff

    const statusDisplay = selectedStatus === "NOT_STORED" 
      ? `(all except ${excludedStatusNames.join(" & ") || "STORED & *PROCESSING*"})` 
      : selectedStatus;

    console.log(`\n📋 Query Criteria:`);
    console.log(`   - _class: StorageDeck`);
    console.log(`   - source: ${selectedSource === "ALL" ? "(all sources)" : selectedSource}`);
    console.log(`   - status: ${statusDisplay}`);
    if (selectedStatus.includes("ERROR")) {
      console.log(`   - errorMessages: exists and not null`);
    }
    console.log(`\nGlobal Target Date : ${targetCutoffDate.toISOString()}`);
    console.log(`Batch Limit        : ${BATCH_SIZE.toLocaleString()}\n`);

    // First validate readiness
    console.log("---------------------------------------------------");
    console.log("🔍 PRE-FLIGHT VALIDATION");
    console.log("---------------------------------------------------");

    const validation = await validateBatchStoreReadiness(selectedStatus, selectedSource);
    console.log(`\n${validation.message}\n`);

    const requiresCurlFields = !validation.isValid;

    if (requiresCurlFields) {
      console.log("⚠️  Documents are missing required fields. You'll need to provide them in the curl command.\n");
    }

    const startTime = Date.now();

    // Start spinner prompt while fetching/calculating batches from MongoDB
    const spinner = createSpinner("Mapping document batch windows from database, please wait...");

    // Calculate the entire batch plan
    const plan = await generateBatchStorePlan(BATCH_SIZE, targetCutoffDate, selectedStatus, selectedSource);

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

    // Render output logs
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
      console.log("\n✅ SUCCESS: All dateFilters mapped cleanly for batch store execution!");
    }

    // Show curl example
    console.log("\n------------------------------------------------------------------------------------------------------------------");
    console.log("📝 CURL COMMAND TEMPLATE");
    console.log("------------------------------------------------------------------------------------------------------------------\n");

    if (requiresCurlFields) {
      console.log("⚠️  IMPORTANT: Documents are missing required fields (recipient, folder, category).");
      console.log("   You MUST provide these values in the curl command:\n");
    }

    console.log(`curl -X POST 'https://<host>/storage/deck/storequeue/batchstore' \\`);
    console.log(`  -H 'Authorization: Bearer <JWT_TOKEN>' \\`);
    console.log(`  -H 'Content-Type: application/json' \\`);
    console.log(`  -d '{`);
    if (requiresCurlFields) {
      console.log(`    "recipientId": "<USERNAME>",        // REQUIRED - missing in documents`);
      console.log(`    "folderId": "<FOLDER_RECORD_ID>",            // REQUIRED - missing in documents`);
      console.log(`    "categoryId": "<CATEGORY_RECORD_ID>",        // REQUIRED - missing in documents`);
    } else {
      console.log(`    "recipientId": "",`);
      console.log(`    "folderId": "",`);
      console.log(`    "categoryId": "",`);
    }
    console.log(`    "dateFilter": "${plan.batches[0]?.dateFilter || "<DATE_FILTER>"}",`);
    console.log(`    "keyword": "",`);
    console.log(`    "language": "en"`);
    console.log(`  }'`);

    if (plan.batches.length > 1) {
      console.log(`\n📋 Date filters for all batches:`);
      plan.batches.forEach((b) => {
        console.log(`   Batch #${b.batchNumber.toString().padStart(3, "0")}: ${b.dateFilter}`);
      });
    }

    // Warning about API behavior
    console.log("\n------------------------------------------------------------------------------------------------------------------");
    console.log("⚠️  IMPORTANT: HOW THE BATCH STORE API ACTUALLY WORKS");
    console.log("------------------------------------------------------------------------------------------------------------------");
    console.log("");
    console.log("The batch store API processes ALL documents before the dateFilter that are NOT in");
    console.log("STORED or *PROCESSING* status — regardless of the status you selected above.");
    console.log("");
    console.log("Example: If you have 20 STORE_ERROR and 80 FOR_VALIDATION documents before the dateFilter,");
    console.log("         and you selected only FOR_VALIDATION (showing 80 docs in this plan),");
    console.log("         the API will actually process ALL 100 documents (20 + 80).");
    console.log("");
    console.log("The status filter in this tool is for PLANNING purposes only — to help you");
    console.log("understand the document breakdown and calculate appropriate date windows.");
    console.log("");
    console.log("📌 To process ONLY specific statuses, use the 'All Processable' option to see");
    console.log("   the true count of documents that will be processed by the API.");
    console.log("------------------------------------------------------------------------------------------------------------------");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error generating batch plan:", error);
    process.exit(1);
  }
}

testGenerateBatchStorePlan();

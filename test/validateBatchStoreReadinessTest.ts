// StorageDeckAPI/test/validateBatchStoreReadinessTest.ts
import { select } from "@inquirer/prompts";
import { validateBatchStoreReadiness } from "../src/services/storageDeckService";
import { getDistinctSources, getDistinctStatusesWithCounts } from "../src/database/repositories/storageDeckRepository";

/**
 * Checks if a status should be excluded from processing.
 * Excludes: STORED and any status containing "PROCESSING" (locked by other operations)
 */
function isExcludedStatus(status: string): boolean {
  return status === "STORED" || status.includes("PROCESSING");
}

async function testValidateBatchStoreReadiness() {
  console.log("🚀 Batch Store Readiness Validator\n");

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
    console.log(`\n🔍 Validating required fields: recipient, folder, category\n`);

    console.time("⏱️  Validation Duration");

    const result = await validateBatchStoreReadiness(selectedStatus, selectedSource);

    console.timeEnd("⏱️  Validation Duration");

    console.log("\n---------------------------------------------------");
    console.log("📊 VALIDATION RESULT");
    console.log("---------------------------------------------------");
    console.log(`Status                    : ${result.isValid ? "✅ READY" : "❌ NOT READY"}`);
    console.log(`Total Documents           : ${result.totalErrorDocuments}`);
    console.log(`Missing Required Fields   : ${result.documentsMissingFields}`);
    console.log(`\n${result.message}`);

    if (!result.isValid && result.missingFieldsSample.length > 0) {
      console.log("\n---------------------------------------------------");
      console.log("📄 Sample Documents Missing Fields (up to 10):");
      console.log("---------------------------------------------------");

      result.missingFieldsSample.forEach((doc, index) => {
        console.log(`\n[${index + 1}] ${doc.name || "(no filename)"}`);
        console.log(`    Status    : ${doc.status}`);
        console.log(`    Recipient : ${(doc as any).recipient || "(MISSING)"}`);
        console.log(`    Folder    : ${(doc as any).folder || "(MISSING)"}`);
        console.log(`    Category  : ${(doc as any).category || "(MISSING)"}`);
      });

      console.log("\n⚠️  Fix these documents before proceeding with batch store.");
    }

    if (result.isValid) {
      console.log("\n✅ All documents have required fields. You can proceed with batch store!");
    }

    process.exit(result.isValid ? 0 : 1);
  } catch (error) {
    console.error("\n❌ Error during validation:", error);
    process.exit(1);
  }
}

testValidateBatchStoreReadiness();

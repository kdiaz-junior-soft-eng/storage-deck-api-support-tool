// StorageDeckAPI/test/exportStoredWithErrorsTest.ts
import * as path from "path";
import { select } from "@inquirer/prompts";
import { exportStoredDocumentsWithErrorsToCsv } from "../src/services/storageDeckService";
import { StorageDeckErrorMessage, getDistinctStatusesWithCounts, getDistinctSources } from "../src/database/repositories/storageDeckRepository";

/**
 * Checks if a status should be excluded from processing.
 * Excludes: STORED and any status containing "PROCESSING" (locked by other operations)
 */
function isExcludedStatus(status: string): boolean {
  return status === "STORED" || status.includes("PROCESSING");
}

/**
 * Extracts error message from errorMessages field (handles both object and array formats)
 */
function getErrorMessage(errorMessages?: StorageDeckErrorMessage | StorageDeckErrorMessage[]): string {
  if (!errorMessages) return "No error message recorded";
  if (Array.isArray(errorMessages)) {
    return errorMessages[0]?.message || "No error message recorded";
  }
  return errorMessages.message || "No error message recorded";
}

async function testExportStoredDocumentsWithErrors() {
  console.log("🚀 CSV Export for Documents with Errors...\n");

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
      message: "Select document status to export:",
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
    console.log(`   - status: ${statusDisplay}\n`);

    // Use dedicated exports directory for CSV output
    const outputDir = path.resolve(__dirname, "../exports");

    console.log(`📁 Output Directory: ${outputDir}`);
    console.time("⏱️  Export Duration");

    const result = await exportStoredDocumentsWithErrorsToCsv(outputDir, selectedStatus, selectedSource);

    console.timeEnd("⏱️  Export Duration");

    console.log("\n---------------------------------------------------");
    console.log("📊 EXPORT SUMMARY");
    console.log("---------------------------------------------------");
    console.log(`Status Exported        : ${statusDisplay}`);
    console.log(`Source Exported        : ${selectedSource === "ALL" ? "(all sources)" : selectedSource}`);
    console.log(`Total Records Exported : ${result.recordCount}`);
    console.log(`Output File Path       : ${result.filePath}`);

    if (result.recordCount > 0) {
      // Count error messages by type and track date ranges
      const errorStats = new Map<string, { count: number; earliest: Date; latest: Date }>();
      
      result.documents.forEach((doc) => {
        const errorMsg = getErrorMessage(doc.errorMessages);
        const docDate = new Date(doc.createdOn);
        
        const existing = errorStats.get(errorMsg);
        if (existing) {
          existing.count++;
          if (docDate < existing.earliest) existing.earliest = docDate;
          if (docDate > existing.latest) existing.latest = docDate;
        } else {
          errorStats.set(errorMsg, { count: 1, earliest: docDate, latest: docDate });
        }
      });

      // Sort by count descending
      const sortedErrors = Array.from(errorStats.entries())
        .sort((a, b) => b[1].count - a[1].count);

      // Calculate overall date range
      const allDates = result.documents.map(d => new Date(d.createdOn));
      const overallEarliest = new Date(Math.min(...allDates.map(d => d.getTime())));
      const overallLatest = new Date(Math.max(...allDates.map(d => d.getTime())));

      console.log("\n---------------------------------------------------");
      console.log("📈 ERROR MESSAGE SUMMARY");
      console.log("---------------------------------------------------");
      console.log(`Unique Error Types : ${sortedErrors.length}`);
      console.log(`Overall Date Range : ${overallEarliest.toISOString().split('T')[0]} ➔ ${overallLatest.toISOString().split('T')[0]}\n`);

      sortedErrors.forEach(([errorMsg, stats], index) => {
        const percentage = ((stats.count / result.recordCount) * 100).toFixed(1);
        const truncatedMsg = errorMsg.length > 80 ? errorMsg.substring(0, 80) + "..." : errorMsg;
        const dateRange = stats.earliest.getTime() === stats.latest.getTime()
          ? stats.earliest.toISOString().split('T')[0]
          : `${stats.earliest.toISOString().split('T')[0]} ➔ ${stats.latest.toISOString().split('T')[0]}`;
        
        console.log(`[${index + 1}] ${stats.count.toLocaleString()} files (${percentage}%)`);
        console.log(`    Error : "${truncatedMsg}"`);
        console.log(`    Period: ${dateRange}\n`);
      });

      console.log("---------------------------------------------------");
      console.log("📄 Sample Data (First 5 Records):");
      console.log("---------------------------------------------------");
      
      const sampleDocs = result.documents.slice(0, 5);
      sampleDocs.forEach((doc, index) => {
        const errorMsg = getErrorMessage(doc.errorMessages);
        console.log(`\n[${index + 1}] ${doc.name || "(no filename)"}`);
        console.log(`    Recipient    : ${doc.recipientName || "(none)"}`);
        console.log(`    Status       : ${doc.status}`);
        console.log(`    Error Message: ${errorMsg || "(none)"}`);
        console.log(`    Created On   : ${doc.createdOn ? new Date(doc.createdOn).toISOString() : "(none)"}`);
      });

      if (result.recordCount > 5) {
        console.log(`\n... and ${result.recordCount - 5} more records`);
      }
    } else {
      console.log("\n⚠️  No documents found matching the criteria.");
    }

    console.log("\n✅ CSV export completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during CSV export test:", error);
    process.exit(1);
  }
}

testExportStoredDocumentsWithErrors();

// StorageDeckAPI/test/exportStoredWithErrorsTest.ts
import * as path from "path";
import { select } from "@inquirer/prompts";
import { exportStoredDocumentsWithErrorsToCsv } from "../src/services/storageDeckService";
import { StorageDeckErrorMessage } from "../src/database/repositories/storageDeckRepository";

const STATUS_OPTIONS = [
  { name: "STORED", value: "STORED", description: "Successfully stored documents with errors" },
  { name: "STORE_ERROR", value: "STORE_ERROR", description: "Documents that failed to store" },
  { name: "ERROR", value: "ERROR", description: "Documents with general errors" },
  { name: "FOR_VALIDATION", value: "FOR_VALIDATION", description: "Documents pending validation" },
];

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
    // CLI status selection
    const selectedStatus = await select({
      message: "Select document status to export:",
      choices: STATUS_OPTIONS,
    });

    console.log(`\n📋 Query Criteria:`);
    console.log(`   - _class: StorageDeck`);
    console.log(`   - source: SF_ONBOARDING`);
    console.log(`   - status: ${selectedStatus}`);
    console.log(`   - errorMessages: exists and not null\n`);

    // Use dedicated exports directory for CSV output
    const outputDir = path.resolve(__dirname, "../exports");

    console.log(`📁 Output Directory: ${outputDir}`);
    console.time("⏱️  Export Duration");

    const result = await exportStoredDocumentsWithErrorsToCsv(outputDir, selectedStatus);

    console.timeEnd("⏱️  Export Duration");

    console.log("\n---------------------------------------------------");
    console.log("📊 EXPORT SUMMARY");
    console.log("---------------------------------------------------");
    console.log(`Status Exported        : ${selectedStatus}`);
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

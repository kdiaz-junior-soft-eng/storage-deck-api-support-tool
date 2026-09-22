// StorageDeckAPI/test/exportFilenamesForSqlTest.ts
import * as path from "path";
import { select } from "@inquirer/prompts";
import { exportFilenamesForSqlQuery } from "../src/services/storageDeckService";
import { getDistinctStatusesWithCounts, getDistinctSources } from "../src/database/repositories/storageDeckRepository";

/**
 * Checks if a status should be excluded from processing.
 * Excludes: STORED and any status containing "PROCESSING" (locked by other operations)
 */
function isExcludedStatus(status: string): boolean {
  return status === "STORED" || status.includes("PROCESSING");
}

async function testExportFilenamesForSql() {
  console.log("🚀 Exporting Filenames for SQL Query...\n");

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

    const outputDir = path.resolve(__dirname, "../exports");

    console.log(`📁 Output Directory: ${outputDir}`);
    console.time("⏱️  Export Duration");

    const result = await exportFilenamesForSqlQuery(outputDir, selectedStatus, selectedSource);

    console.timeEnd("⏱️  Export Duration");

    console.log("\n---------------------------------------------------");
    console.log("📊 EXPORT SUMMARY");
    console.log("---------------------------------------------------");
    console.log(`Status Exported          : ${statusDisplay}`);
    console.log(`Source Exported          : ${selectedSource === "ALL" ? "(all sources)" : selectedSource}`);
    console.log(`Total Filenames Exported : ${result.recordCount}`);
    console.log(`Output File Path         : ${result.filePath}`);

    if (result.recordCount > 0) {
      console.log("\n📄 Sample Filenames (First 10):");
      console.log("---------------------------------------------------");
      result.filenames.slice(0, 10).forEach((name, index) => {
        console.log(`  ${index + 1}. ${name}`);
      });

      if (result.recordCount > 10) {
        console.log(`\n  ... and ${result.recordCount - 10} more`);
      }

      console.log("\n💡 Usage in SQL:");
      console.log("---------------------------------------------------");
      console.log(`SELECT * FROM storage_file sf`);
      console.log(`WHERE sf.recordStatus = "ACTIVE" AND sf.ID IN (`);
      console.log(`  SELECT storageFileNameId FROM storage_file_text`);
      console.log(`  WHERE description LIKE ${result.filenames[0]}`);
      console.log(`);`);
    } else {
      console.log("\n⚠️  No documents found matching the criteria.");
    }

    console.log("\n✅ SQL filenames export completed!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during export:", error);
    process.exit(1);
  }
}

testExportFilenamesForSql();

// StorageDeckAPI/test/exportFilenamesForSqlTest.ts
import * as path from "path";
import { select } from "@inquirer/prompts";
import { exportFilenamesForSqlQuery } from "../src/services/storageDeckService";

const STATUS_OPTIONS = [
  { name: "STORED", value: "STORED", description: "Successfully stored documents with errors" },
  { name: "STORE_ERROR", value: "STORE_ERROR", description: "Documents that failed to store" },
  { name: "ERROR", value: "ERROR", description: "Documents with general errors" },
  { name: "FOR_VALIDATION", value: "FOR_VALIDATION", description: "Documents pending validation" },
];

async function testExportFilenamesForSql() {
  console.log("🚀 Exporting Filenames for SQL Query...\n");

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

    const outputDir = path.resolve(__dirname, "../exports");

    console.log(`📁 Output Directory: ${outputDir}`);
    console.time("⏱️  Export Duration");

    const result = await exportFilenamesForSqlQuery(outputDir, selectedStatus);

    console.timeEnd("⏱️  Export Duration");

    console.log("\n---------------------------------------------------");
    console.log("📊 EXPORT SUMMARY");
    console.log("---------------------------------------------------");
    console.log(`Status Exported          : ${selectedStatus}`);
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

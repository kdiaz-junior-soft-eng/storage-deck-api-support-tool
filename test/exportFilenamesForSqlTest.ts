// StorageDeckAPI/test/exportFilenamesForSqlTest.ts
import * as path from "path";
import { exportFilenamesForSqlQuery } from "../src/services/storageDeckService";

async function testExportFilenamesForSql() {
  console.log("🚀 Exporting Filenames for SQL Query...\n");
  console.log("📋 Query Criteria:");
  console.log("   - _class: StorageDeck");
  console.log("   - source: SF_ONBOARDING");
  console.log("   - status: STORED");
  console.log("   - errorMessages: exists and not null\n");

  try {
    const outputDir = path.resolve(__dirname, "../exports");

    console.log(`📁 Output Directory: ${outputDir}`);
    console.time("⏱️  Export Duration");

    const result = await exportFilenamesForSqlQuery(outputDir);

    console.timeEnd("⏱️  Export Duration");

    console.log("\n---------------------------------------------------");
    console.log("📊 EXPORT SUMMARY");
    console.log("---------------------------------------------------");
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

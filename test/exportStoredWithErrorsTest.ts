// StorageDeckAPI/test/exportStoredWithErrorsTest.ts
import * as path from "path";
import { exportStoredDocumentsWithErrorsToCsv } from "../src/services/storageDeckService";

async function testExportStoredDocumentsWithErrors() {
  console.log("🚀 Testing CSV Export for Stored Documents with Errors...\n");
  console.log("📋 Query Criteria:");
  console.log("   - _class: StorageDeck");
  console.log("   - source: SF_ONBOARDING");
  console.log("   - status: STORED");
  console.log("   - errorMessages: exists and not null\n");

  try {
    // Use dedicated exports directory for CSV output
    const outputDir = path.resolve(__dirname, "../exports");

    console.log(`📁 Output Directory: ${outputDir}`);
    console.time("⏱️  Export Duration");

    const result = await exportStoredDocumentsWithErrorsToCsv(outputDir);

    console.timeEnd("⏱️  Export Duration");

    console.log("\n---------------------------------------------------");
    console.log("📊 EXPORT SUMMARY");
    console.log("---------------------------------------------------");
    console.log(`Total Records Exported : ${result.recordCount}`);
    console.log(`Output File Path       : ${result.filePath}`);

    if (result.recordCount > 0) {
      console.log("\n📄 Sample Data (First 5 Records):");
      console.log("---------------------------------------------------");
      
      const sampleDocs = result.documents.slice(0, 5);
      sampleDocs.forEach((doc, index) => {
        console.log(`\n[${index + 1}] ${doc.name || "(no filename)"}`);
        console.log(`    Recipient    : ${doc.recipientName || "(none)"}`);
        console.log(`    Status       : ${doc.status}`);
        console.log(`    Error Message: ${doc.errorMessages?.[0]?.message || "(none)"}`);
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

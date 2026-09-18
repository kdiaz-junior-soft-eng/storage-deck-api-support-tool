// StorageDeckAPI/test/validateBatchStoreReadinessTest.ts
import { validateBatchStoreReadiness } from "../src/services/storageDeckService";

async function testValidateBatchStoreReadiness() {
  console.log("🚀 Validating Batch Store Readiness...\n");
  console.log("📋 Checking documents with:");
  console.log("   - _class: StorageDeck");
  console.log("   - source: SF_ONBOARDING");
  console.log("   - status: ERROR, STORE_ERROR, or FOR_VALIDATION");
  console.log("   - errorMessages: exists and not null\n");
  console.log("🔍 Validating required fields: recipient, folder, category\n");

  try {
    console.time("⏱️  Validation Duration");

    const result = await validateBatchStoreReadiness();

    console.timeEnd("⏱️  Validation Duration");

    console.log("\n---------------------------------------------------");
    console.log("📊 VALIDATION RESULT");
    console.log("---------------------------------------------------");
    console.log(`Status                    : ${result.isValid ? "✅ READY" : "❌ NOT READY"}`);
    console.log(`Total Error Documents     : ${result.totalErrorDocuments}`);
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
      console.log("\n✅ All error documents have required fields. You can proceed with batch store!");
    }

    process.exit(result.isValid ? 0 : 1);
  } catch (error) {
    console.error("\n❌ Error during validation:", error);
    process.exit(1);
  }
}

testValidateBatchStoreReadiness();

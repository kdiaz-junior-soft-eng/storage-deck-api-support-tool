# Batch Store

Plan batch store operations for error documents with pre-flight validation to ensure all required fields are present.

## Overview

The batch store feature helps re-process documents that failed during initial storage. Before triggering batch store, it validates that all documents have the required fields (recipient, folder, category) that were populated during the original autopull.

## Commands

```bash
# Step 1: Validate documents have required fields
npm run test:batch-store-validate

# Step 2: Generate batch store plan (includes validation)
npm run test:batch-store-plan
```

## Workflow

### 1. Pre-Flight Validation

Before batch store, run validation to ensure all error documents have required fields:

```bash
npm run test:batch-store-validate
```

This checks:
- `recipient` is not null or empty
- `folder` is not null or empty  
- `category` is not null or empty

**If validation fails**, the script shows sample documents missing fields so you can fix them before proceeding.

### 2. Generate Batch Plan

Once validation passes, generate the batch plan:

```bash
npm run test:batch-store-plan
```

This creates date-filtered batches similar to batch delete, ready for execution.

## Target Documents

Batch store targets documents with:

```javascript
{
  _class: "StorageDeck",
  source: "SF_ONBOARDING",
  status: { $in: ["ERROR", "STORE_ERROR", "FOR_VALIDATION"] },
  errorMessages: { $exists: true, $ne: null }
}
```

## Configuration

```env
# Maximum documents per batch
MAX_DOCUMENTS_PER_BATCH=15000
```

## Output Example

### Validation Output

```
🚀 Validating Batch Store Readiness...

📋 Checking documents with:
   - _class: StorageDeck
   - source: SF_ONBOARDING
   - status: ERROR, STORE_ERROR, or FOR_VALIDATION
   - errorMessages: exists and not null

🔍 Validating required fields: recipient, folder, category

---------------------------------------------------
📊 VALIDATION RESULT
---------------------------------------------------
Status                    : ✅ READY
Total Error Documents     : 1,234
Missing Required Fields   : 0

✅ All 1234 error documents have required fields. Ready for batch store.
```

### Batch Plan Output

```
🔄 Starting Full Batch Store Window Mapping Test...

Global Target Date : 2026-09-18T09:20:24.599Z
Target Statuses    : ERROR, STORE_ERROR, FOR_VALIDATION
Batch Limit        : 15,000

---------------------------------------------------
🔍 PRE-FLIGHT VALIDATION
---------------------------------------------------

✅ All 1234 error documents have required fields. Ready for batch store.

✅ Batch mapping calculation complete!

📊 Total matching documents in scope: 1,234

------------------------------------------------------------------------------------------------------------------
🚀 MAPPING BATCH DATE FILTERS FOR API PAYLOAD
------------------------------------------------------------------------------------------------------------------

📦 Batch #001 | Docs: 1234 | Window: 2026-08-01T... ➔ 2026-08-15T... | dateFilter: 2026-08-15T...

------------------------------------------------------------------------------------------------------------------
🏁 FULL QUEUE MAPPING COMPLETE
------------------------------------------------------------------------------------------------------------------
Total Batches Required   : 1
Total Documents Mapped   : 1,234 / 1,234
Execution Duration       : 0.21s

✅ SUCCESS: All dateFilters mapped cleanly for batch store execution!
```

## Related Files

- `src/services/storageDeckService.ts` - `generateBatchStorePlan()`, `validateBatchStoreReadiness()`
- `src/database/repositories/storageDeckRepository.ts` - `countDocumentsForBatchStore()`, `countDocumentsMissingRequiredFields()`, `getNextBatchForStore()`
- `test/validateBatchStoreReadinessTest.ts` - Validation test script
- `test/generateBatchStorePlanTest.ts` - Batch plan generation script

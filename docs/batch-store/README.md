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

## Interactive CLI

Both commands feature an interactive CLI that lets you:

1. **Select Status** - Dynamically fetched from the database with document counts:
   - **All Processable** - All statuses except `STORED` and any `*PROCESSING*` statuses
   - Individual statuses like `STORE_ERROR`, `FOR_VALIDATION`, `ERROR`, etc.
   - 🔒 Locked statuses (`STORED`, `*PROCESSING*`) are marked but still selectable for viewing

2. **Select Source** - Dynamically fetched from the database:
   - **All Sources** - Include all sources (no source filter)
   - Or select a specific source (e.g., `SF_ONBOARDING`, `SF_OFFBOARDING`)

## Target Documents

Batch store targets documents based on CLI selections:

```javascript
// Example: All Processable with All Sources
// Excludes STORED and any status containing "PROCESSING"
{
  _class: "StorageDeck",
  status: { $not: /^STORED$|PROCESSING/ }
}

// Example: STORE_ERROR with specific source
{
  _class: "StorageDeck",
  source: "SF_ONBOARDING",
  status: "STORE_ERROR",
  errorMessages: { $exists: true, $ne: null }  // Only when status contains "ERROR"
}
```

## ⚠️ Important: How the Batch Store API Actually Works

**The batch store API processes ALL documents before the dateFilter that are NOT in STORED or *PROCESSING* status — regardless of the status you selected in this planning tool.**

### Example Scenario

If you have:
- 20 `STORE_ERROR` documents before the dateFilter
- 80 `FOR_VALIDATION` documents before the dateFilter

And you selected only `FOR_VALIDATION` (showing 80 docs in the plan), the API will actually process **ALL 100 documents** (20 + 80).

### Why This Matters

The status filter in this tool is for **PLANNING purposes only** — to help you:
- Understand the document breakdown by status
- Calculate appropriate date windows
- Estimate batch sizes

**To see the true count of documents that will be processed by the API, use the "All Processable" option.**

## Configuration

```env
# Maximum documents per batch
MAX_DOCUMENTS_PER_BATCH=15000
```

## Output Example

### CLI Status Display

```
📡 Fetching available statuses from database...
   Found 5 status(es):
   🔒 STORED: 50,000
      STORE_ERROR: 1,234
      ERROR: 567
      FOR_VALIDATION: 89
   🔒 PROCESSING: 12

? Select document status:
❯ All Processable (1,890 docs)
  STORED (50,000 docs)
  STORE_ERROR (1,234 docs)
  ERROR (567 docs)
  FOR_VALIDATION (89 docs)
  PROCESSING (12 docs)
```

### Batch Plan Output

```
🔄 Batch Store Plan Generator

📡 Fetching available sources from database...
   Found 3 source(s): SF_ONBOARDING, SF_OFFBOARDING, SF_REHIRE
📡 Fetching available statuses from database...
   Found 3 status(es):
   🔒 STORED: 195
      FOR_VALIDATION: 25
      STORE_ERROR: 2

? Select document status: All Processable (27 docs)
? Select document source: All Sources

📋 Query Criteria:
   - _class: StorageDeck
   - source: (all sources)
   - status: (all except STORED & PROCESSING)

Global Target Date : 2026-09-18T09:20:24.599Z
Batch Limit        : 15,000

---------------------------------------------------
🔍 PRE-FLIGHT VALIDATION
---------------------------------------------------

✅ All 27 documents have required fields. Ready for batch store.

✅ Batch mapping calculation complete!

📊 Total matching documents in scope: 27

------------------------------------------------------------------------------------------------------------------
📝 CURL COMMAND TEMPLATE
------------------------------------------------------------------------------------------------------------------

curl -X POST 'https://<host>/storage/deck/storequeue/batchstore' \
  -H 'Authorization: Bearer <JWT_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientId": "",
    "folderId": "",
    "categoryId": "",
    "dateFilter": "2026-08-15T...",
    "keyword": "",
    "language": "en"
  }'

------------------------------------------------------------------------------------------------------------------
⚠️  IMPORTANT: HOW THE BATCH STORE API ACTUALLY WORKS
------------------------------------------------------------------------------------------------------------------

The batch store API processes ALL documents before the dateFilter that are NOT in
STORED or *PROCESSING* status — regardless of the status you selected above.

📌 To process ONLY specific statuses, use the 'All Processable' option to see
   the true count of documents that will be processed by the API.
------------------------------------------------------------------------------------------------------------------
```

## Related Files

- `src/services/storageDeckService.ts` - `generateBatchStorePlan()`, `validateBatchStoreReadiness()`
- `src/database/repositories/storageDeckRepository.ts` - `countDocumentsForBatchStore()`, `countDocumentsMissingRequiredFields()`, `getNextBatchForStore()`, `getDistinctSources()`, `getDistinctStatusesWithCounts()`
- `test/validateBatchStoreReadinessTest.ts` - Validation test script
- `test/generateBatchStorePlanTest.ts` - Batch plan generation script

# Batch Delete

Plan and execute batch deletions of StorageDeck documents by generating date-filtered batches.

## Overview

The batch delete feature calculates optimal date ranges to process documents in controlled batches, ensuring no documents are missed or duplicated during deletion operations.

## Commands

```bash
# Generate batch plan for STORED documents
npm run test:batch-loop

# Generate batch plan for non-STORED documents (FOR_VALIDATION, DELETE_ERROR, etc.)
npm run test:batch-loop-non-stored

# Test batch filters for a 1000-document batch
npm run test:batch-filters
```

## How It Works

1. **Count Total Documents** - Counts all documents matching the target status before the cutoff date
2. **Generate Batches** - Iterates through documents in FIFO order (oldest first), creating batches of `MAX_DOCUMENTS_PER_BATCH` size
3. **Calculate Date Filters** - For each batch, calculates the exact `dateFilter` timestamp to use in API calls
4. **Output Plan** - Displays all batch windows with their date filters ready for execution

## Configuration

Set these in your `.env` file:

```env
# Target status to filter documents (e.g., STORED, PROCESSING)
TARGET_STATUS=STORED

# Cutoff date - only process documents created before this date
TARGET_DATE=2026-07-08T00:00:00Z

# Maximum documents per batch
MAX_DOCUMENTS_PER_BATCH=15000
```

## Output Example

```
🔄 Starting Full Batch Window Mapping Test...

Global Target Date : 2026-07-08T00:00:00.000Z
Target Status      : STORED
Batch Limit        : 15000

✅ Batch mapping calculation complete!

📊 Total matching documents in scope: 45,000

------------------------------------------------------------------------------------------------------------------
🚀 MAPPING BATCH DATE FILTERS FOR API PAYLOAD
------------------------------------------------------------------------------------------------------------------

📦 Batch #001 | Docs: 15000 | Window: 2026-01-01T... ➔ 2026-03-15T... | dateFilter: 2026-03-15T...
📦 Batch #002 | Docs: 15000 | Window: 2026-03-15T... ➔ 2026-05-20T... | dateFilter: 2026-05-20T...
📦 Batch #003 | Docs: 15000 | Window: 2026-05-20T... ➔ 2026-07-07T... | dateFilter: 2026-07-07T...

------------------------------------------------------------------------------------------------------------------
🏁 FULL QUEUE MAPPING COMPLETE
------------------------------------------------------------------------------------------------------------------
Total Batches Required   : 3
Total Documents Mapped   : 45,000 / 45,000
Execution Duration       : 2.15s

✅ SUCCESS: All dateFilters mapped cleanly for API execution!
```

## MongoDB Query

The batch delete targets documents with this query:

```javascript
{
  _class: "StorageDeck",
  status: "<TARGET_STATUS>",
  createdOn: { $lt: "<TARGET_DATE>" }
}
```

## Related Files

- `src/services/storageDeckService.ts` - `generateBatchDeletePlan()`, `generateFullNonStoredDeletePlan()`
- `src/database/repositories/storageDeckRepository.ts` - `getNextBatchAfterDate()`, `getNextBatchForNonStored()`
- `test/runBatchProcessorLoopTest.ts` - Test script for STORED documents
- `test/runNonStoredBatchProcessorTest.ts` - Test script for non-STORED documents
